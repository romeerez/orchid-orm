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
import { getSchemaAndTableFromName, quoteWithSchema } from '../common';
import { RakeDbAst } from '../ast';

const types = Object.assign(Object.create(columnTypes), {
  raw,
});

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
  for (const query of queries) {
    await migration.adapter.query(query);
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
        text: `DROP TABLE ${quoteWithSchema(ast)}${
          ast.dropMode ? ` ${ast.dropMode}` : ''
        }`,
        values: [],
      },
    ];
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

  const result: Sql[] = [
    {
      text: `CREATE TABLE ${quoteWithSchema(ast)} (${lines.join(',')}\n)`,
      values,
    },
    ...indexesToQuery(true, ast, indexes),
    ...commentsToQuery(ast, comments),
  ];

  if (ast.comment) {
    result.push({
      text: `COMMENT ON TABLE ${quoteWithSchema(ast)} IS ${quote(ast.comment)}`,
      values: [],
    });
  }

  return result;
};