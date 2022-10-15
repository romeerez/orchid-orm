import { columnTypes, getColumnTypes, getTableData, quote } from 'pqb';
import { joinColumns } from '../common';
import {
  TableOptions,
  ColumnsShapeCallback,
  Migration,
  ColumnIndex,
  ColumnComment,
} from './migration';
import {
  addColumnComment,
  addColumnIndex,
  columnToSql,
  constraintToSql,
  migrateComments,
  migrateIndexes,
} from './migrationUtils';

export const createTable = async (
  migration: Migration,
  up: boolean,
  tableName: string,
  options: TableOptions,
  fn: ColumnsShapeCallback,
) => {
  const shape = getColumnTypes(columnTypes, fn);

  if (!up) {
    const { dropMode } = options;
    await migration.query(
      `DROP TABLE "${tableName}"${dropMode ? ` ${dropMode}` : ''}`,
    );
    return;
  }

  const lines: string[] = [];

  const state: {
    migration: Migration;
    tableName: string;
    values: unknown[];
    indexes: ColumnIndex[];
    comments: ColumnComment[];
  } = {
    migration,
    tableName,
    values: [],
    indexes: [],
    comments: [],
  };

  for (const key in shape) {
    const item = shape[key];
    addColumnIndex(state.indexes, key, item);
    addColumnComment(state.comments, key, item);
    lines.push(`\n  ${columnToSql(key, item, state)}`);
  }

  const tableData = getTableData();
  if (tableData.primaryKey) {
    lines.push(`\n  PRIMARY KEY (${joinColumns(tableData.primaryKey)})`);
  }

  tableData.foreignKeys.forEach((foreignKey) => {
    lines.push(`\n  ${constraintToSql(state.tableName, up, foreignKey)}`);
  });

  await migration.query({
    text: `CREATE TABLE "${tableName}" (${lines.join(',')}\n)`,
    values: state.values,
  });

  state.indexes.push(...tableData.indexes);

  await migrateIndexes(state, state.indexes, up);
  await migrateComments(state, state.comments);

  if (options.comment) {
    await migration.query(
      `COMMENT ON TABLE "${tableName}" IS ${quote(options.comment)}`,
    );
  }
};
