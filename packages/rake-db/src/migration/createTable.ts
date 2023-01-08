import {
  ColumnsShape,
  columnTypes,
  getColumnTypes,
  getTableData,
  NoPrimaryKeyOption,
  quote,
  raw,
  Sql,
  TableData,
} from 'pqb';
import {
  ColumnComment,
  ColumnIndex,
  ColumnsShapeCallback,
  Migration,
  TableOptions,
} from './migration';
import {
  addColumnComment,
  addColumnIndex,
  columnToSql,
  commentToQuery,
  constraintToSql,
  indexToQuery,
  primaryKeyToSql,
} from './migrationUtils';
import { quoteTable } from '../common';
import { RakeDbAst } from '../ast';

const types = Object.assign(Object.create(columnTypes), {
  raw,
});

export const createTable = async (
  migration: Migration,
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
  for (const query of queries) {
    await migration.query(query);
  }

  await migration.options.appCodeUpdater?.(ast);
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

  return {
    type: 'table',
    action: up ? 'create' : 'drop',
    name: tableName,
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
      const message = `Table ${ast.name} has no primary key`;
      if (ast.noPrimaryKey === 'error') {
        throw new Error(message);
      } else {
        console.warn(message);
      }
    }
  }
};

const astToQueries = (ast: RakeDbAst.Table): Sql[] => {
  if (ast.action === 'drop') {
    return [
      {
        text: `DROP TABLE ${quoteTable(ast.name)}${
          ast.dropMode ? ` ${ast.dropMode}` : ''
        }`,
        values: [],
      },
    ];
  }

  const lines: string[] = [];
  const values: unknown[] = [];
  const indexes: ColumnIndex[] = [];
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
    lines.push(`\n  ${constraintToSql(ast.name, true, foreignKey)}`);
  });

  indexes.push(...ast.indexes);

  const result: Sql[] = [
    {
      text: `CREATE TABLE ${quoteTable(ast.name)} (${lines.join(',')}\n)`,
      values,
    },
    ...indexes.map((index) => indexToQuery(true, ast.name, index)),
    ...comments.map((comment) => commentToQuery(ast.name, comment)),
  ];

  if (ast.comment) {
    result.push({
      text: `COMMENT ON TABLE ${quoteTable(ast.name)} IS ${quote(ast.comment)}`,
      values: [],
    });
  }

  return result;
};
