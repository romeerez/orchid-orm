import {
  ColumnsShape,
  columnTypes,
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
  MigrationBase,
  runCodeUpdater,
  TableOptions,
} from './migration';
import {
  addColumnComment,
  addColumnIndex,
  columnToSql,
  commentsToQuery,
  constraintToSql,
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

const types = Object.assign(Object.create(columnTypes), tableMethods);

export type TableQuery = {
  text: string;
  values?: unknown[];
  then?(result: QueryArraysResult): void;
};

export const createTable = async (
  migration: MigrationBase,
  up: boolean,
  tableName: string,
  options: TableOptions,
  fn: ColumnsShapeCallback,
) => {
  const shape = getColumnTypes(types, fn);
  const tableData = getTableData();
  const ast = makeAst(
    up,
    tableName,
    shape,
    tableData,
    options,
    migration.options.noPrimaryKey,
  );

  validatePrimaryKey(ast);

  const queries = astToQueries(ast);
  for (const { then, ...query } of queries) {
    const result = await migration.adapter.arrays(query);
    then?.(result);
  }

  await runCodeUpdater(migration, ast);
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
    if (shape[key].isPrimaryKey) {
      shapePKeys.push(key);
    }
  }

  const primaryKey = tableData.primaryKey;

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
        if (ast.shape[key].isPrimaryKey) {
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

const astToQueries = (ast: RakeDbAst.Table): TableQuery[] => {
  const queries: TableQuery[] = [];

  for (const key in ast.shape) {
    const item = ast.shape[key];
    if (!(item instanceof EnumColumn)) continue;

    queries.push(makePopulateEnumQuery(item));
  }

  if (ast.action === 'drop') {
    queries.push({
      text: `DROP TABLE ${quoteWithSchema(ast)}${
        ast.dropMode ? ` ${ast.dropMode}` : ''
      }`,
    });
    return queries;
  }

  const lines: string[] = [];
  const values: unknown[] = [];
  const indexes: TableData.Index[] = [];
  const comments: ColumnComment[] = [];

  for (const key in ast.shape) {
    const item = ast.shape[key];
    addColumnIndex(indexes, key, item);
    addColumnComment(comments, key, item);
    lines.push(`\n  ${columnToSql(key, item, values, !!ast.primaryKey)}`);
  }

  if (ast.primaryKey) {
    lines.push(`\n  ${primaryKeyToSql(ast.primaryKey)}`);
  }

  ast.foreignKeys.forEach((foreignKey) => {
    lines.push(`\n  ${constraintToSql(ast, true, foreignKey)}`);
  });

  indexes.push(...ast.indexes);

  queries.push(
    {
      text: `CREATE TABLE ${quoteWithSchema(ast)} (${lines.join(',')}\n)`,
      values,
    },
    ...indexesToQuery(true, ast, indexes),
    ...commentsToQuery(ast, comments),
  );

  if (ast.comment) {
    queries.push({
      text: `COMMENT ON TABLE ${quoteWithSchema(ast)} IS ${quote(ast.comment)}`,
    });
  }

  return queries;
};
