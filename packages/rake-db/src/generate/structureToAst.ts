import {
  DbStructure,
  introspectDbSchema,
  IntrospectedStructure,
} from './dbStructure';
import { RakeDbAst } from '../ast';
import {
  ArrayColumn,
  assignDbDataToColumn,
  ColumnFromDbParams,
  ColumnsByType,
  ColumnsShape,
  ColumnType,
  CustomTypeColumn,
  DbStructureDomainsMap,
  DomainColumn,
  EnumColumn,
  makeColumnsByType,
  PostgisGeographyPointColumn,
  raw,
  RawSQL,
  TableData,
  AdapterBase,
  ColumnSchemaConfig,
  singleQuote,
  TemplateLiteralArgs,
  toCamelCase,
  toSnakeCase,
} from 'pqb';
import {
  getConstraintName,
  getExcludeName,
  getIndexName,
} from '../migration/migration.utils';
import { AnyRakeDbConfig } from '../config';

const matchMap: Record<string, undefined | TableData.References.Match> = {
  s: undefined,
  f: 'FULL',
  p: 'PARTIAL',
};

const fkeyActionMap: Record<string, undefined | TableData.References.Action> = {
  a: undefined, // default
  r: 'RESTRICT',
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
};

export interface StructureToAstCtx {
  snakeCase?: boolean;
  unsupportedTypes: Record<string, string[]>;
  currentSchema: string;
  columnSchemaConfig: ColumnSchemaConfig;
  columnsByType: ColumnsByType;
}

export interface StructureToAstTableData {
  primaryKey?: TableData.PrimaryKey;
  indexes: DbStructure.Index[];
  excludes: DbStructure.Exclude[];
  constraints: DbStructure.Constraint[];
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
  adapter: AdapterBase,
  config: AnyRakeDbConfig,
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
      schema: it.schemaName === ctx.currentSchema ? undefined : it.schemaName,
    });
  }

  const domains = makeDomainsMap(ctx, data);

  for (const table of data.tables) {
    if (table.name === config.migrationsTable) continue;

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
): DbStructureDomainsMap => {
  const domains: DbStructureDomainsMap = {};

  for (const it of data.domains) {
    const column = instantiateDbColumn(ctx, data, domains, {
      schemaName: it.schemaName,
      name: it.name,
      type: it.type,
      typeSchema: it.typeSchema,
      arrayDims: it.arrayDims,
      tableName: '',
      isNullable: it.isNullable,
      collate: it.collate,
      default: it.default,
      typmod: -1,
    });

    if (it.checks) {
      column.data.checks = it.checks.map((check) => ({
        sql: new RawSQL([[check]] as unknown as TemplateLiteralArgs),
      }));
    }

    domains[`${it.schemaName}.${it.name}`] = column;
  }

  return domains;
};

const getDbColumnIsSerial = (item: DbStructure.Column) => {
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

export const instantiateDbColumn = (
  ctx: StructureToAstCtx,
  data: IntrospectedStructure,
  domains: DbStructureDomainsMap,
  dbColumn: DbStructure.Column,
) => {
  const isSerial = getDbColumnIsSerial(dbColumn);
  if (isSerial) {
    dbColumn = { ...dbColumn, default: undefined };
  }

  let column: ColumnType;

  const col = instantiateColumnByDbType(ctx, dbColumn.type, isSerial, dbColumn);
  if (col) {
    column = col;
  } else {
    const { typeSchema, type: typeName } = dbColumn;
    const typeId =
      typeSchema === 'pg_catalog' ? typeName : `${typeSchema}.${typeName}`;
    const domainColumn = domains[typeId];
    if (domainColumn) {
      column = new DomainColumn(
        ctx.columnSchemaConfig,
        typeName,
        typeSchema,
        dbColumn.extension,
      ).as(domainColumn);
    } else {
      const enumType = data.enums.find(
        (x) => x.name === typeName && x.schemaName === typeSchema,
      );
      if (enumType) {
        column = new EnumColumn(
          ctx.columnSchemaConfig,
          typeSchema === ctx.currentSchema ? typeName : typeId,
          enumType.values,
          ctx.columnSchemaConfig.type,
        );
      } else {
        column = new CustomTypeColumn(
          ctx.columnSchemaConfig,
          typeName,
          typeSchema === 'pg_catalog' ? undefined : typeSchema,
          dbColumn.extension,
        );

        (ctx.unsupportedTypes[dbColumn.type] ??= []).push(
          `${dbColumn.schemaName}${
            dbColumn.tableName ? `.${dbColumn.tableName}` : ''
          }.${dbColumn.name}`,
        );
      }

      assignDbDataToColumn(column, dbColumn);
    }
  }

  column.data.name = undefined;
  if (!column.data.isNullable) column.data.isNullable = undefined;

  if (dbColumn.arrayDims) {
    const arr = new ArrayColumn(
      ctx.columnSchemaConfig,
      column,
      ctx.columnSchemaConfig.type,
    );
    arr.data.isNullable = dbColumn.isNullable as true;
    arr.data.arrayDims = dbColumn.arrayDims;
    column = arr;
  }

  return column;
};

const instantiateColumnByDbType = (
  ctx: StructureToAstCtx,
  type: string,
  isSerial: boolean,
  params: ColumnFromDbParams,
): ColumnType | undefined => {
  let columnFn =
    ctx.columnsByType[
      !isSerial
        ? type
        : type === 'int2'
        ? 'smallserial'
        : type === 'int4'
        ? 'serial'
        : 'bigserial'
    ];

  if (
    !columnFn &&
    params.extension === 'postgis' &&
    type === 'geography' &&
    PostgisGeographyPointColumn.isDefaultPoint(params.typmod)
  ) {
    columnFn = ctx.columnsByType.geographyDefaultPoint;
  }

  return columnFn
    ? (assignDbDataToColumn(columnFn(), params) as ColumnType)
    : undefined;
};

export const tableToAst = (
  ctx: StructureToAstCtx,
  data: IntrospectedStructure,
  table: DbStructure.Table,
  action: 'create' | 'drop',
  domains: DbStructureDomainsMap,
): RakeDbAst.Table => {
  const { schemaName, name: tableName } = table;

  const tableData = getDbStructureTableData(data, table);
  const { primaryKey, constraints } = tableData;

  return {
    type: 'table',
    action,
    schema: schemaName === ctx.currentSchema ? undefined : schemaName,
    comment: table.comment,
    name: tableName,
    shape: makeDbStructureColumnsShape(ctx, data, domains, table, tableData),
    noPrimaryKey: tableData.primaryKey ? 'error' : 'ignore',
    primaryKey:
      primaryKey && primaryKey.columns.length > 1
        ? { ...primaryKey, columns: primaryKey.columns.map(toCamelCase) }
        : undefined,
    indexes: indexesOrExcludesToAst<TableData.Index[]>(
      tableName,
      tableData,
      'indexes',
    ),
    excludes: indexesOrExcludesToAst<TableData.Exclude[]>(
      tableName,
      tableData,
      'excludes',
    ),
    constraints: constraints.reduce<TableData.Constraint[]>((acc, it) => {
      if (
        (it.check && it.references) ||
        (it.check && it.check.columns?.length !== 1) ||
        (it.references &&
          it.references.columns.length !== 1 &&
          !checkIfIsOuterRecursiveFkey(data, table, it.references))
      ) {
        acc.push(dbConstraintToTableConstraint(ctx, table, it));
      }

      return acc;
    }, []),
  };
};

const indexesOrExcludesToAst = <T>(
  tableName: string,
  tableData: StructureToAstTableData,
  key: 'indexes' | 'excludes',
): T => {
  return tableData[key].reduce<TableData.Index[]>((acc, item) => {
    if (
      item.columns.length > 1 ||
      item.columns.some((it) => 'expression' in it)
    ) {
      const options = makeIndexOrExcludeOptions(tableName, item, key);

      acc.push({
        columns: item.columns.map((it, i) => ({
          with: 'exclude' in item && item.exclude ? item.exclude[i] : undefined,
          ...('expression' in it
            ? { expression: it.expression }
            : { column: toCamelCase(it.column) }),
          collate: it.collate,
          opclass: it.opclass,
          order: it.order,
        })),
        options: {
          ...options,
          include: item.include?.map(toCamelCase),
        },
      });
    }
    return acc;
  }, []) as T;
};

export const getDbStructureTableData = (
  data: IntrospectedStructure,
  { name, schemaName }: DbStructure.Table,
): StructureToAstTableData => {
  const filterFn = filterByTableSchema(name, schemaName);

  const constraints = data.constraints.filter(filterFn);

  const primaryKey = constraints.find((c) => c.primaryKey);

  return {
    primaryKey: primaryKey?.primaryKey
      ? {
          columns: primaryKey.primaryKey,
          name:
            primaryKey.name === `${name}_pkey` ? undefined : primaryKey.name,
        }
      : undefined,
    indexes: data.indexes.filter(filterFn),
    excludes: data.excludes.filter(filterFn),
    constraints,
  };
};

const filterByTableSchema =
  (tableName: string, schemaName: string) =>
  (x: DbStructure.TableNameAndSchemaName) =>
    x.tableName === tableName && x.schemaName === schemaName;

const constraintToAst = (
  ctx: StructureToAstCtx,
  item: DbStructure.Constraint,
): TableData.Constraint => {
  const result: TableData.Constraint = {};

  const { references, check } = item;

  if (references) {
    const options: TableData.References.Options = {};
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

  if (
    item.name &&
    item.name !== getConstraintName(item.tableName, result, ctx.snakeCase)
  ) {
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
  domains: DbStructureDomainsMap,
  view: DbStructure.View,
): RakeDbAst.View => {
  const shape = makeDbStructureColumnsShape(ctx, data, domains, view);

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

export const makeDbStructureColumnsShape = (
  ctx: StructureToAstCtx,
  data: IntrospectedStructure,
  domains: DbStructureDomainsMap,
  table: DbStructure.Table | DbStructure.View,
  tableData?: StructureToAstTableData,
): ColumnsShape => {
  const shape: ColumnsShape = {};
  const checks = tableData ? getDbTableColumnsChecks(tableData) : undefined;

  for (const item of table.columns) {
    const [key, column] = dbColumnToAst(
      ctx,
      data,
      domains,
      table.name,
      item,
      table,
      tableData,
      checks,
    );
    shape[key] = column;
  }

  return shape;
};

export interface ColumnChecks {
  [K: string]: string[];
}

export const getDbTableColumnsChecks = (tableData: StructureToAstTableData) =>
  tableData.constraints.reduce<ColumnChecks>((acc, item) => {
    if (isColumnCheck(item)) {
      (acc[item.check.columns[0]] ??= []).push(item.check.expression);
    }
    return acc;
  }, {});

export const dbColumnToAst = (
  ctx: StructureToAstCtx,
  data: IntrospectedStructure,
  domains: DbStructureDomainsMap,
  tableName: string,
  item: DbStructure.Column,
  table?: DbStructure.Table,
  tableData?: StructureToAstTableData,
  checks?: ColumnChecks,
): [key: string, column: ColumnType] => {
  let column = instantiateDbColumn(ctx, data, domains, item);
  column.data.name = item.name;

  if (item.identity) {
    column.data.identity = item.identity;
    if (!item.identity.always) delete column.data.identity?.always;
  }

  if (
    tableData?.primaryKey?.columns?.length === 1 &&
    tableData?.primaryKey?.columns[0] === item.name
  ) {
    column = column.primaryKey();
  }

  collectColumnIndexesOrExcludes(item, column, tableName, tableData, 'indexes');
  collectColumnIndexesOrExcludes(
    item,
    column,
    tableName,
    tableData,
    'excludes',
  );

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

  const columnChecks = checks?.[item.name];
  if (columnChecks) {
    column.data.checks = columnChecks.map((check) => ({
      sql: new RawSQL([[check]] as unknown as TemplateLiteralArgs),
    }));
  }

  const camelCaseName = toCamelCase(item.name);

  if (ctx.snakeCase) {
    const snakeCaseName = toSnakeCase(camelCaseName);

    if (snakeCaseName !== item.name) column.data.name = item.name;
  } else if (camelCaseName !== item.name) {
    column.data.name = item.name;
  }

  return [camelCaseName, column];
};

const collectColumnIndexesOrExcludes = (
  dbColumn: DbStructure.Column,
  column: ColumnType,
  tableName: string,
  tableData: StructureToAstTableData | undefined,
  key: 'indexes' | 'excludes',
) => {
  const items = tableData?.[key];
  if (!items) return;

  const columnItems = items.filter(
    (it) =>
      it.columns.length === 1 &&
      'column' in it.columns[0] &&
      it.columns[0].column === dbColumn.name,
  );
  for (const item of columnItems) {
    const columnOptions = item.columns[0];
    const { name, ...itemOptions } = makeIndexOrExcludeOptions(
      tableName,
      item,
      key,
    );
    (column.data[key] ??= []).push({
      with: ('exclude' in item && item.exclude
        ? (item as DbStructure.Exclude).exclude[0]
        : undefined) as never,
      options: {
        name,
        collate: columnOptions.collate,
        opclass: columnOptions.opclass,
        order: columnOptions.order,
        ...itemOptions,
      },
    });
  }
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
    item.name &&
    item.name !== getConstraintName(table.name, constraint, ctx.snakeCase)
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

const makeIndexOrExcludeOptions = (
  tableName: string,
  index: DbStructure.Index,
  key: 'indexes' | 'excludes',
) => {
  return {
    name:
      index.name !==
      (key === 'indexes' ? getIndexName : getExcludeName)(
        tableName,
        index.columns,
      )
        ? index.name
        : undefined,
    using: index.using === 'btree' ? undefined : index.using,
    unique: index.unique || undefined,
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
