import { ColumnInfoQueryData } from './types';
import { quote } from '../quote';

export const pushColumnInfoSql = (
  sql: string[],
  table: string,
  query: ColumnInfoQueryData,
) => {
  sql.push(
    `SELECT * FROM information_schema.columns WHERE table_name = ${quote(
      table,
    )} AND table_catalog = current_database() AND table_schema = ${
      query.schema || 'current_schema()'
    }`,
  );

  if (query.column) {
    sql.push(`AND column_name = ${quote(query.column)}`);
  }
};
