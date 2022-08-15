import { ColumnInfoQueryData } from './types';
import { addValue } from './common';

export const pushColumnInfoSql = (
  sql: string[],
  values: unknown[],
  table: string,
  query: ColumnInfoQueryData,
) => {
  sql.push(
    `SELECT * FROM information_schema.columns WHERE table_name = ${addValue(
      values,
      table,
    )} AND table_catalog = current_database() AND table_schema = ${
      query.schema || 'current_schema()'
    }`,
  );

  if (query.column) {
    sql.push(`AND column_name = ${addValue(values, query.column)}`);
  }
};
