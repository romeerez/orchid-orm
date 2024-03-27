import {
  DbStructure,
  introspectDbSchema,
  IntrospectedStructure,
} from './dbStructure';
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
  instantiateColumn,
  raw,
  simplifyColumnDefault,
  TableData,
  ColumnsByType,
  Adapter,
  makeColumnsByType,
} from 'pqb';
import {
  ColumnSchemaConfig,
  RecordString,
  singleQuote,
  toCamelCase,
  toSnakeCase,
} from 'orchid-core';
import { getConstraintName, getIndexName } from '../migration/migrationUtils';
import { AnyRakeDbConfig } from 'rake-db';

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

interface Domains {
  [K: string]: ColumnType;
}

export interface StructureToAstCtx {
  snakeCase?: boolean;
  unsupportedTypes: Record<string, string[]>;
  currentSchema: string;
  columnSchemaConfig: ColumnSchemaConfig;
  columnsByType: ColumnsByType;
}

interface PrimaryKey {
  columns: string[];
  name?: string;
}

export const makeStructureToAstCtx = (
  config: AnyRakeDbConfig,
  currentSchema: string,
): StructureToAstCtx => ({
  snakeCase: config.snakeCase,
  unsupportedTypes: {},
  currentSchema,
  columnSchemaConfig: config.schemaConfig,
  columnsByType: makeColumnsByType(config.schemaConfig),
});

export const structureToAst = async (
  ctx: StructureToAstCtx,
  adapter: Adapter,
): Promise<RakeDbAst[]> => {
  const ast: RakeDbAst[] = [];

  const data = await introspectDbSchema(adapter);

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

  const domains = makeDomainsMap(ctx, data);

  for (const table of data.tables) {
    if (table.name === 'schemaMigrations') continue;

    ast.push(tableToAst(ctx, data, table, 'create', domains));
  }

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

  for (const table of data.tables) {
    for (const fkey of data.constraints) {
      if (
        fkey.references &&
        fkey.tableName === table.name &&
        fkey.schemaName === table.schemaName &&
        checkIfIsOuterRecursiveFkey(data, table, fkey.references)
      ) {
        ast.push({
          ...constraintToAst(ctx, fkey),
          type: 'constraint',
          action: 'create',
          tableSchema:
            table.schemaName === ctx.currentSchema
              ? undefined
              : table.schemaName,
          tableName: fkey.tableName,
        });
      }
    }
  }

  for (const view of data.views) {
    ast.push(viewToAst(ctx, data, domains, view));
  }

  return ast;
};

export const makeDomainsMap = (
  ctx: StructureToAstCtx,
  data: IntrospectedStructure,
): Domains => {
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

  return domains;
};

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
  data: IntrospectedStructure,
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
    column = instantiateColumn(typeFn, params) as ColumnType;
  } else {
    const domainId = `${typeSchema}.${type}`;
    const domainColumn = domains[domainId];
    if (domainColumn) {
      column = new DomainColumn(ctx.columnSchemaConfig, domainId).as(
        domainColumn,
      );
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

export const tableToAst = (
  ctx: StructureToAstCtx,
  data: IntrospectedStructure,
  table: DbStructure.Table,
  action: 'create' | 'drop',
  domains: Domains,
): RakeDbAst.Table => {
  const { schemaName, name: tableName, columns } = table;

  const tableIndexes = data.indexes.filter(
    (it) => it.tableName === table.name && it.schemaName === table.schemaName,
  );

  const primaryKey = getPrimaryKey(data, table);

  return {
    type: 'table',
    action,
    schema: schemaName === ctx.currentSchema ? undefined : schemaName,
    comment: table.comment,
    name: tableName,
    shape: makeColumnsShape(
      ctx,
      data,
      domains,
      tableName,
      columns,
      table,
      primaryKey,
      tableIndexes,
    ),
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
    indexes: tableIndexes.reduce<TableData.Index[]>((acc, index) => {
      if (
        index.columns.length > 1 ||
        index.columns.some((it) => 'expression' in it)
      ) {
        acc.push({
          columns: index.columns.map((it) => ({
            ...('column' in it
              ? { column: it.column }
              : { expression: it.expression }),
            collate: it.collate,
            opclass: it.opclass,
            order: it.order,
          })),
          options: makeIndexOptions(tableName, index),
        });
      }
      return acc;
    }, []),
    constraints: data.constraints.reduce<TableData.Constraint[]>((acc, it) => {
      if (
        it.schemaName === table.schemaName &&
        it.tableName === table.name &&
        ((it.check && it.references) ||
          (it.check && it.check.columns?.length !== 1) ||
          (it.references &&
            it.references.columns.length !== 1 &&
            !checkIfIsOuterRecursiveFkey(data, table, it.references)))
      ) {
        acc.push(dbConstraintToTableConstraint(ctx, table, it));
      }

      return acc;
    }, []),
  };
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

const viewToAst = (
  ctx: StructureToAstCtx,
  data: IntrospectedStructure,
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
    deps: view.deps,
  };
};

const getPrimaryKey = (
  data: IntrospectedStructure,
  table: DbStructure.Table,
): PrimaryKey | undefined => {
  for (const item of data.constraints) {
    if (
      item.tableName === table.name &&
      item.schemaName === table.schemaName &&
      item.primaryKey
    )
      return { columns: item.primaryKey, name: item.name };
  }
  return undefined;
};

const makeColumnsShape = (
  ctx: StructureToAstCtx,
  data: IntrospectedStructure,
  domains: Domains,
  tableName: string,
  columns: DbStructure.Column[],
  table?: DbStructure.Table,
  primaryKey?: { columns: string[]; name?: string },
  indexes?: DbStructure.Index[],
): ColumnsShape => {
  const shape: ColumnsShape = {};

  let checks: RecordString | undefined;
  if (table) {
    checks = data.constraints.reduce<RecordString>((acc, item) => {
      if (
        item.tableName === table.name &&
        item.schemaName === table.schemaName &&
        isColumnCheck(item)
      ) {
        acc[item.check.columns[0]] = item.check.expression;
      }
      return acc;
    }, {});
  }

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
          ...makeIndexOptions(tableName, index),
        });
      }
    }

    if (table) {
      for (const it of data.constraints) {
        if (
          it.tableName !== table.name ||
          it.schemaName !== table.schemaName ||
          it.check ||
          it.references?.columns.length !== 1 ||
          it.references.columns[0] !== item.name ||
          checkIfIsOuterRecursiveFkey(data, table, it.references)
        ) {
          continue;
        }

        const c = dbConstraintToTableConstraint(ctx, table, it);

        column = column.foreignKey(
          c.references?.fnOrTable as string,
          it.references.foreignColumns[0],
          c.references?.options,
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

const dbConstraintToTableConstraint = (
  ctx: StructureToAstCtx,
  table: DbStructure.Table,
  item: DbStructure.Constraint,
) => {
  const { references, check } = item;

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
    item.name && item.name !== getConstraintName(table.name, constraint)
      ? item.name
      : undefined;

  if (name) {
    constraint.name = name;
    if (constraint.references?.options) {
      constraint.references.options.name = name;
    }
  }

  return constraint;
};

const makeIndexOptions = (tableName: string, index: DbStructure.Index) => {
  return {
    name:
      index.name !== getIndexName(tableName, index.columns)
        ? index.name
        : undefined,
    using: index.using === 'btree' ? undefined : index.using,
    unique: index.isUnique || undefined,
    include: index.include,
    nullsNotDistinct: index.nullsNotDistinct || undefined,
    with: index.with,
    tablespace: index.tablespace,
    where: index.where,
  };
};

const checkIfIsOuterRecursiveFkey = (
  data: IntrospectedStructure,
  table: DbStructure.Table,
  references: DbStructure.References,
) => {
  const referencesId = `${references.foreignSchema}.${references.foreignTable}`;
  const tableId = `${table.schemaName}.${table.name}`;
  for (const other of data.tables) {
    const id = `${other.schemaName}.${other.name}`;
    if (referencesId === id) {
      for (const c of data.constraints) {
        if (
          c.tableName === other.name &&
          c.schemaName === other.schemaName &&
          c.references?.foreignTable === table.name &&
          c.references.foreignSchema === table.schemaName &&
          tableId < id
        ) {
          return true;
        }
      }
      break;
    }
  }
  return false;
};
