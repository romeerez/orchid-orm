import {
  ColumnsShape,
  Db,
  EnumColumn,
  getColumnTypes,
  getTableData,
  NoPrimaryKeyOption,
  QueryArraysResult,
  quote,
  TableData,
} from 'pqb';
import {
  ColumnComment,
  ColumnsShapeCallback,
  DbMigration,
  Migration,
  TableOptions,
} from './migration';
import {
  addColumnComment,
  addColumnIndex,
  columnToSql,
  commentsToQuery,
  constraintToSql,
  getColumnName,
  indexesToQuery,
  primaryKeyToSql,
} from './migrationUtils';
import {
  getSchemaAndTableFromName,
  makePopulateEnumQuery,
  quoteWithSchema,
} from '../common';
import { RakeDbAst } from '../ast';
import { tableMethods } from './tableMethods';
import { NoPrimaryKey } from '../errors';
import { ColumnTypesBase, emptyObject, snakeCaseKey } from 'orchid-core';

export type TableQuery = {
  text: string;
  values?: unknown[];
  then?(result: QueryArraysResult): void;
};

export type CreateTableResult<
  Table extends string,
  Shape extends ColumnsShape,
> = {
  table: Db<Table, Shape>;
};

export const createTable = async <
  CT extends ColumnTypesBase,
  Table extends string,
  Shape extends ColumnsShape,
>(
  migration: Migration<CT>,
  up: boolean,
  tableName: Table,
  options: TableOptions,
  fn?: ColumnsShapeCallback<CT, Shape>,
): Promise<CreateTableResult<Table, Shape>> => {
  const snakeCase =
    'snakeCase' in options ? options.snakeCase : migration.options.snakeCase;
  const language =
    'language' in options ? options.language : migration.options.language;

  const types = Object.assign(
    Object.create(migration.columnTypes),
    tableMethods,
  );
  types[snakeCaseKey] = snakeCase;

  const shape = !fn
    ? emptyObject
    : getColumnTypes(types, fn, migration.options.baseTable?.nowSQL, language);

  const tableData = getTableData();
  const ast = makeAst(
    up,
    tableName,
    shape,
    tableData,
    options,
    migration.options.noPrimaryKey,
  );

  fn && validatePrimaryKey(ast);

  const queries = astToQueries(ast, snakeCase, language);
  for (const { then, ...query } of queries) {
    const result = await migration.adapter.arrays(query);
    then?.(result);
  }

  migration.migratedAsts.push(ast);

  let table: Db<Table, Shape> | undefined;

  return {
    get table(): Db<Table, Shape> {
      return (table ??= (migration as unknown as DbMigration)(
        tableName,
        shape,
        {
          noPrimaryKey: options.noPrimaryKey ? 'ignore' : undefined,
          snakeCase: options.snakeCase,
        },
      ) as unknown as Db<Table, Shape>);
    },
  };
};

const makeAst = (
  up: boolean,
  tableName: string,
  shape: ColumnsShape,
  tableData: TableData,
  options: TableOptions,
  noPrimaryKey?: NoPrimaryKeyOption,
): RakeDbAst.Table => {
  const shapePKeys: string[] = [];
  for (const key in shape) {
    const column = shape[key];
    if (column.data.isPrimaryKey) {
      shapePKeys.push(key);
    }
  }

  const { primaryKey } = tableData;
  const [schema, table] = getSchemaAndTableFromName(tableName);

  return {
    type: 'table',
    action: up ? 'create' : 'drop',
    schema,
    name: table,
    shape,
    ...tableData,
    primaryKey:
      shapePKeys.length <= 1
        ? primaryKey
        : primaryKey
        ? { ...primaryKey, columns: [...shapePKeys, ...primaryKey.columns] }
        : { columns: shapePKeys },
    ...options,
    noPrimaryKey: options.noPrimaryKey ? 'ignore' : noPrimaryKey || 'error',
  };
};

const validatePrimaryKey = (ast: RakeDbAst.Table) => {
  if (ast.noPrimaryKey !== 'ignore') {
    let hasPrimaryKey = !!ast.primaryKey?.columns?.length;
    if (!hasPrimaryKey) {
      for (const key in ast.shape) {
        if (ast.shape[key].data.isPrimaryKey) {
          hasPrimaryKey = true;
          break;
        }
      }
    }

    if (!hasPrimaryKey) {
      const error = new NoPrimaryKey(
        `Table ${ast.name} has no primary key.\nYou can suppress this error by setting { noPrimaryKey: true } after a table name.`,
      );
      if (ast.noPrimaryKey === 'error') {
        throw error;
      } else {
        console.warn(error.message);
      }
    }
  }
};

const astToQueries = (
  ast: RakeDbAst.Table,
  snakeCase?: boolean,
  language?: string,
): TableQuery[] => {
  const queries: TableQuery[] = [];
  const { shape } = ast;

  for (const key in shape) {
    const item = shape[key];
    if (!(item instanceof EnumColumn)) continue;

    queries.push(makePopulateEnumQuery(item));
  }

  if (ast.action === 'drop') {
    queries.push({
      text: `DROP TABLE${
        ast.dropIfExists ? ' IF EXISTS' : ''
      } ${quoteWithSchema(ast)}${ast.dropMode ? ` ${ast.dropMode}` : ''}`,
    });
    return queries;
  }

  const lines: string[] = [];
  const values: unknown[] = [];
  const indexes: TableData.Index[] = [];
  const comments: ColumnComment[] = [];

  for (const key in shape) {
    const item = shape[key];
    const name = getColumnName(item, key, snakeCase);
    addColumnIndex(indexes, name, item);
    addColumnComment(comments, name, item);
    lines.push(
      `\n  ${columnToSql(name, item, values, !!ast.primaryKey, snakeCase)}`,
    );
  }

  if (ast.primaryKey) {
    lines.push(
      `\n  ${primaryKeyToSql({
        options: ast.primaryKey.options,
        columns: ast.primaryKey.columns.map((key) =>
          getColumnName(shape[key], key, snakeCase),
        ),
      })}`,
    );
  }

  ast.constraints?.forEach((item) => {
    lines.push(
      `\n  ${constraintToSql(
        ast,
        true,
        {
          ...item,
          references: item.references
            ? {
                ...item.references,
                columns: item.references.columns.map((column) =>
                  getColumnName(shape[column], column, snakeCase),
                ),
              }
            : undefined,
        },
        values,
        snakeCase,
      )}`,
    );
  });

  indexes.push(
    ...(ast.indexes?.map((index) => ({
      ...index,
      columns: index.columns.map((item) => ({
        ...item,
        ...('column' in item
          ? {
              column: getColumnName(shape[item.column], item.column, snakeCase),
            }
          : {}),
      })),
    })) || []),
  );

  queries.push(
    {
      text: `CREATE TABLE${
        ast.createIfNotExists ? ' IF NOT EXISTS' : ''
      } ${quoteWithSchema(ast)} (${lines.join(',')}\n)`,
      values,
    },
    ...indexesToQuery(true, ast, indexes, language),
    ...commentsToQuery(ast, comments),
  );

  if (ast.comment) {
    queries.push({
      text: `COMMENT ON TABLE ${quoteWithSchema(ast)} IS ${quote(ast.comment)}`,
    });
  }

  return queries;
};
