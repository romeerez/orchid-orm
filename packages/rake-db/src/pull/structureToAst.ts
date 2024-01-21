import { DbStructure } from './dbStructure';
import { RakeDbAst } from '../ast';
import {
  ArrayColumn,
  ColumnFromDbParams,
  ColumnsShape,
  ColumnType,
  CustomTypeColumn,
  DomainColumn,
  EnumColumn,
  ForeignKeyAction,
  ForeignKeyMatch,
  ForeignKeyOptions,
  getConstraintKind,
  instantiateColumn,
  raw,
  simplifyColumnDefault,
  TableData,
  ColumnsByType,
} from 'pqb';
import {
  ColumnSchemaConfig,
  singleQuote,
  toCamelCase,
  toSnakeCase,
} from 'orchid-core';
import { getConstraintName, getIndexName } from '../migration/migrationUtils';

const matchMap: Record<string, undefined | ForeignKeyMatch> = {
  s: undefined,
  f: 'FULL',
  p: 'PARTIAL',
};

const fkeyActionMap: Record<string, undefined | ForeignKeyAction> = {
  a: undefined, // default
  r: 'RESTRICT',
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
};

type Data = {
  schemas: string[];
  tables: DbStructure.Table[];
  views: DbStructure.View[];
  constraints: DbStructure.Constraint[];
  indexes: DbStructure.Index[];
  extensions: DbStructure.Extension[];
  enums: DbStructure.Enum[];
  domains: DbStructure.Domain[];
  collations: DbStructure.Collation[];
};

type Domains = Record<string, ColumnType>;

type PendingTables = Record<
  string,
  { table: DbStructure.Table; dependsOn: Set<string> }
>;

export type StructureToAstCtx = {
  snakeCase?: boolean;
  unsupportedTypes: Record<string, string[]>;
  currentSchema: string;
  columnSchemaConfig: ColumnSchemaConfig;
  columnsByType: ColumnsByType;
};

export const structureToAst = async (
  ctx: StructureToAstCtx,
  db: DbStructure,
): Promise<RakeDbAst[]> => {
  const ast: RakeDbAst[] = [];

  const data = await getData(db);

  for (const name of data.schemas) {
    if (name === 'public') continue;

    ast.push({
      type: 'schema',
      action: 'create',
      name,
    });
  }

  for (const it of data.collations) {
    ast.push({
      type: 'collation',
      action: 'create',
      ...it,
      schema: it.schema === ctx.currentSchema ? undefined : it.schema,
    });
  }

  const pendingTables: PendingTables = {};
  for (const table of data.tables) {
    const key = `${table.schemaName}.${table.name}`;
    const dependsOn = new Set<string>();

    for (const fk of data.constraints) {
      const { references } = fk;
      if (
        !references ||
        fk.schemaName !== table.schemaName ||
        fk.tableName !== table.name
      )
        continue;

      const otherKey = `${references.foreignSchema}.${references.foreignTable}`;
      if (otherKey !== key) {
        dependsOn.add(otherKey);
      }
    }

    pendingTables[key] = { table, dependsOn };
  }

  const domains: Domains = {};
  for (const it of data.domains) {
    domains[`${it.schemaName}.${it.name}`] = getColumn(ctx, data, domains, {
      schemaName: it.schemaName,
      name: it.name,
      type: it.type,
      typeSchema: it.typeSchema,
      isArray: it.isArray,
      isSerial: false,
    });
  }

  for (const key in pendingTables) {
    const { table, dependsOn } = pendingTables[key];
    if (!dependsOn.size) {
      pushTableAst(ctx, ast, data, domains, table, pendingTables);
    }
  }

  const outerConstraints: [DbStructure.Constraint, DbStructure.Table][] = [];

  for (const it of data.extensions) {
    ast.push({
      type: 'extension',
      action: 'create',
      name: it.name,
      schema: it.schemaName === ctx.currentSchema ? undefined : it.schemaName,
      version: it.version,
    });
  }

  for (const it of data.enums) {
    ast.push({
      type: 'enum',
      action: 'create',
      name: it.name,
      schema: it.schemaName === ctx.currentSchema ? undefined : it.schemaName,
      values: it.values,
    });
  }

  for (const it of data.domains) {
    ast.push({
      type: 'domain',
      action: 'create',
      schema: it.schemaName === ctx.currentSchema ? undefined : it.schemaName,
      name: it.name,
      baseType: domains[`${it.schemaName}.${it.name}`],
      notNull: it.notNull,
      collation: it.collation,
      default: simplifyColumnDefault(it.default),
      check: it.check ? raw({ raw: it.check }) : undefined,
    });
  }

  for (const key in pendingTables) {
    const innerConstraints: DbStructure.Constraint[] = [];
    const { table } = pendingTables[key];

    for (const fkey of data.constraints) {
      if (fkey.schemaName !== table.schemaName || fkey.tableName !== table.name)
        continue;

      const otherKey =
        fkey.references &&
        `${fkey.references.foreignSchema}.${fkey.references.foreignTable}`;

      if (!otherKey || !pendingTables[otherKey] || otherKey === key) {
        innerConstraints.push(fkey);
      } else {
        outerConstraints.push([fkey, table]);
      }
    }

    pushTableAst(
      ctx,
      ast,
      data,
      domains,
      table,
      pendingTables,
      innerConstraints,
    );
  }

  for (const [fkey, table] of outerConstraints) {
    ast.push({
      ...constraintToAst(ctx, fkey),
      type: 'constraint',
      action: 'create',
      tableSchema:
        table.schemaName === ctx.currentSchema ? undefined : table.schemaName,
      tableName: fkey.tableName,
    });
  }

  for (const view of data.views) {
    ast.push(viewToAst(ctx, data, domains, view));
  }

  return ast;
};

const getData = async (db: DbStructure): Promise<Data> => {
  const [
    { schemas, tables, views },
    constraints,
    indexes,
    extensions,
    enums,
    domains,
    collations,
  ] = await Promise.all([
    db.getStructure(),
    db.getConstraints(),
    db.getIndexes(),
    db.getExtensions(),
    db.getEnums(),
    db.getDomains(),
    db.getCollations(),
  ]);

  return {
    schemas,
    tables,
    views,
    constraints,
    indexes,
    extensions,
    enums,
    domains,
    collations,
  };
};

const makeBelongsToTable =
  (schema: string | undefined, table: string) =>
  (item: { schemaName: string; tableName: string }) =>
    item.schemaName === schema && item.tableName === table;

const getIsSerial = (item: DbStructure.Column) => {
  if (item.type === 'int2' || item.type === 'int4' || item.type === 'int8') {
    const { default: def, schemaName, tableName, name } = item;
    const seq = `${tableName}_${name}_seq`;
    if (
      def &&
      (def === `nextval(${singleQuote(`${seq}`)}::regclass)` ||
        def === `nextval(${singleQuote(`"${seq}"`)}::regclass)` ||
        def === `nextval(${singleQuote(`${schemaName}.${seq}`)}::regclass)` ||
        def === `nextval(${singleQuote(`"${schemaName}".${seq}`)}::regclass)` ||
        def === `nextval(${singleQuote(`${schemaName}."${seq}"`)}::regclass)` ||
        def === `nextval(${singleQuote(`"${schemaName}"."${seq}"`)}::regclass)`)
    ) {
      return true;
    }
  }

  return false;
};

const getColumn = (
  ctx: StructureToAstCtx,
  data: Data,
  domains: Domains,
  {
    schemaName,
    tableName,
    name,
    type,
    typeSchema,
    isArray,
    isSerial,
    ...params
  }: {
    schemaName: string;
    tableName?: string;
    name: string;
    type: string;
    typeSchema: string;
    isArray: boolean;
    isSerial: boolean;
  } & ColumnFromDbParams,
) => {
  let column: ColumnType;

  const columnType = getColumnType(type, isSerial);
  const typeFn = ctx.columnsByType[columnType];
  if (typeFn) {
    column = instantiateColumn(typeFn, params);
  } else {
    const domainColumn = domains[`${typeSchema}.${type}`];
    if (domainColumn) {
      column = new DomainColumn(ctx.columnSchemaConfig, type).as(domainColumn);
    } else {
      const enumType = data.enums.find(
        (item) => item.name === type && item.schemaName === typeSchema,
      );
      if (enumType) {
        column = new EnumColumn(
          ctx.columnSchemaConfig,
          type,
          enumType.values,
          ctx.columnSchemaConfig.type,
        );
      } else {
        column = new CustomTypeColumn(ctx.columnSchemaConfig, type);

        (ctx.unsupportedTypes[type] ??= []).push(
          `${schemaName}${tableName ? `.${tableName}` : ''}.${name}`,
        );
      }
    }
  }

  return isArray
    ? new ArrayColumn(
        ctx.columnSchemaConfig,
        column,
        ctx.columnSchemaConfig.type,
      )
    : column;
};

const getColumnType = (type: string, isSerial: boolean) => {
  if (!isSerial) return type;

  return type === 'int2'
    ? 'smallserial'
    : type === 'int4'
    ? 'serial'
    : 'bigserial';
};

const pushTableAst = (
  ctx: StructureToAstCtx,
  ast: RakeDbAst[],
  data: Data,
  domains: Domains,
  table: DbStructure.Table,
  pendingTables: PendingTables,
  innerConstraints = data.constraints,
) => {
  const { schemaName, name: tableName, columns } = table;

  const key = `${schemaName}.${table.name}`;
  delete pendingTables[key];

  if (tableName === 'schemaMigrations') return;

  const belongsToTable = makeBelongsToTable(schemaName, tableName);

  let primaryKey: { columns: string[]; name?: string } | undefined;
  for (const item of data.constraints) {
    if (belongsToTable(item) && item.primaryKey)
      primaryKey = { columns: item.primaryKey, name: item.name };
  }

  const tableIndexes = data.indexes.filter(belongsToTable);

  const tableConstraints = innerConstraints.reduce<TableData.Constraint[]>(
    (acc, item) => {
      const { references, check } = item;
      if (
        belongsToTable(item) &&
        (references || (check && !isColumnCheck(item)))
      ) {
        const constraint: TableData.Constraint = {
          references: references
            ? {
                columns: references.columns,
                fnOrTable: getReferencesTable(ctx, references),
                foreignColumns: references.foreignColumns,
                options: {
                  match: matchMap[references.match],
                  onUpdate: fkeyActionMap[references.onUpdate],
                  onDelete: fkeyActionMap[references.onDelete],
                },
              }
            : undefined,
          check: check ? raw({ raw: check.expression }) : undefined,
        };

        const name =
          item.name && item.name !== getConstraintName(tableName, constraint)
            ? item.name
            : undefined;

        if (name) {
          constraint.name = name;
          if (constraint.references?.options) {
            constraint.references.options.name = name;
          }
        }

        acc.push(constraint);
      }
      return acc;
    },
    [],
  );

  const columnChecks = innerConstraints.reduce<Record<string, string>>(
    (acc, item) => {
      if (belongsToTable(item) && isColumnCheck(item)) {
        acc[item.check.columns[0]] = item.check.expression;
      }
      return acc;
    },
    {},
  );

  const shape = makeColumnsShape(
    ctx,
    data,
    domains,
    tableName,
    columns,
    primaryKey,
    tableIndexes,
    tableConstraints,
    columnChecks,
  );

  ast.push({
    type: 'table',
    action: 'create',
    schema: schemaName === ctx.currentSchema ? undefined : schemaName,
    comment: table.comment,
    name: tableName,
    shape,
    noPrimaryKey: primaryKey ? 'error' : 'ignore',
    primaryKey:
      primaryKey && primaryKey.columns.length > 1
        ? {
            columns: primaryKey.columns,
            options:
              primaryKey.name === `${tableName}_pkey`
                ? undefined
                : { name: primaryKey.name },
          }
        : undefined,
    indexes: tableIndexes
      .filter(
        (index) =>
          index.columns.length > 1 ||
          index.columns.some((it) => 'expression' in it),
      )
      .map((index) => ({
        columns: index.columns.map((it) => ({
          ...('column' in it
            ? { column: it.column }
            : { expression: it.expression }),
          collate: it.collate,
          opclass: it.opclass,
          order: it.order,
        })),
        options: {
          name:
            index.name !== getIndexName(tableName, index.columns)
              ? index.name
              : undefined,
          using: index.using === 'btree' ? undefined : index.using,
          unique: index.isUnique,
          include: index.include,
          nullsNotDistinct: index.nullsNotDistinct,
          with: index.with,
          tablespace: index.tablespace,
          where: index.where,
        },
      })),
    constraints: tableConstraints.filter(
      (it) => getConstraintKind(it) === 'constraint' || !isColumnFkey(it),
    ),
  });

  for (const otherKey in pendingTables) {
    const item = pendingTables[otherKey];
    if (item.dependsOn.delete(key) && item.dependsOn.size === 0) {
      pushTableAst(ctx, ast, data, domains, item.table, pendingTables);
    }
  }
};

const constraintToAst = (
  ctx: StructureToAstCtx,
  item: DbStructure.Constraint,
): TableData.Constraint => {
  const result: TableData.Constraint = {};

  const { references, check } = item;

  if (references) {
    const options: ForeignKeyOptions = {};
    result.references = {
      columns: references.columns,
      fnOrTable: getReferencesTable(ctx, references),
      foreignColumns: references.foreignColumns,
      options,
    };

    const match = matchMap[references.match];
    if (match) options.match = match;

    const onUpdate = fkeyActionMap[references.onUpdate];
    if (onUpdate) options.onUpdate = onUpdate;

    const onDelete = fkeyActionMap[references.onDelete];
    if (onDelete) options.onDelete = onDelete;
  }

  if (check) {
    result.check = raw({ raw: check.expression });
  }

  if (item.name && item.name !== getConstraintName(item.tableName, result)) {
    result.name = item.name;
    if (result.references?.options) {
      result.references.options.name = item.name;
    }
  }

  return result;
};

const getReferencesTable = (
  ctx: StructureToAstCtx,
  references: DbStructure.References,
) => {
  return references.foreignSchema !== ctx.currentSchema
    ? `${references.foreignSchema}.${references.foreignTable}`
    : references.foreignTable;
};

const isColumnCheck = (
  it: DbStructure.Constraint,
): it is DbStructure.Constraint & {
  check: DbStructure.Check & { columns: string[] };
} => {
  return !it.references && it.check?.columns?.length === 1;
};

const isColumnFkey = (
  it: TableData.Constraint,
): it is TableData.Constraint & { references: TableData.References } => {
  return !it.check && it.references?.columns.length === 1;
};

const viewToAst = (
  ctx: StructureToAstCtx,
  data: Data,
  domains: Domains,
  view: DbStructure.View,
): RakeDbAst.View => {
  const shape = makeColumnsShape(ctx, data, domains, view.name, view.columns);

  const options: RakeDbAst.ViewOptions = {};
  if (view.isRecursive) options.recursive = true;

  if (view.with) {
    const withOptions: Record<string, unknown> = {};
    options.with = withOptions;
    for (const pair of view.with) {
      const [key, value] = pair.split('=');
      withOptions[toCamelCase(key) as 'checkOption'] =
        value === 'true' ? true : value === 'false' ? false : value;
    }
  }

  return {
    type: 'view',
    action: 'create',
    schema: view.schemaName === ctx.currentSchema ? undefined : view.schemaName,
    name: view.name,
    shape,
    sql: raw({ raw: view.sql }),
    options,
  };
};

const makeColumnsShape = (
  ctx: StructureToAstCtx,
  data: Data,
  domains: Domains,
  tableName: string,
  columns: DbStructure.Column[],
  primaryKey?: { columns: string[]; name?: string },
  indexes?: DbStructure.Index[],
  constraints?: TableData.Constraint[],
  checks?: Record<string, string>,
): ColumnsShape => {
  const shape: ColumnsShape = {};

  for (let item of columns) {
    const isSerial = getIsSerial(item);
    if (isSerial) {
      item = { ...item, default: undefined };
    }

    let column = getColumn(ctx, data, domains, {
      ...item,
      type: item.type,
      isArray: item.isArray,
      isSerial,
    });

    if (item.identity) {
      column.data.identity = item.identity;
      if (!item.identity.always) delete column.data.identity?.always;
    }

    if (
      primaryKey?.columns?.length === 1 &&
      primaryKey?.columns[0] === item.name
    ) {
      column = column.primaryKey();
    }

    if (indexes) {
      const columnIndexes = indexes.filter(
        (it) =>
          it.columns.length === 1 &&
          'column' in it.columns[0] &&
          it.columns[0].column === item.name,
      );
      for (const index of columnIndexes) {
        const options = index.columns[0];
        column = column.index({
          collate: options.collate,
          opclass: options.opclass,
          order: options.order,
          name:
            index.name !== getIndexName(tableName, index.columns)
              ? index.name
              : undefined,
          using: index.using === 'btree' ? undefined : index.using,
          unique: index.isUnique,
          include: index.include,
          nullsNotDistinct: index.nullsNotDistinct,
          with: index.with,
          tablespace: index.tablespace,
          where: index.where,
        });
      }
    }

    if (constraints) {
      for (const it of constraints) {
        if (!isColumnFkey(it) || it.references.columns[0] !== item.name)
          continue;

        column = column.foreignKey(
          it.references.fnOrTable as string,
          it.references.foreignColumns[0],
          it.references.options,
        );
      }
    }

    const check = checks?.[item.name];
    if (check) {
      column.data.check = raw({ raw: check });
    }

    const camelCaseName = toCamelCase(item.name);

    if (ctx.snakeCase) {
      const snakeCaseName = toSnakeCase(camelCaseName);

      if (snakeCaseName !== item.name) column.data.name = item.name;
    } else if (camelCaseName !== item.name) {
      column.data.name = item.name;
    }

    shape[camelCaseName] = column;
  }

  return shape;
};
