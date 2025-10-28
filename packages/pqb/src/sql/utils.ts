import { Sql } from '../core';

export const getSqlText = (sql: Sql) => {
  if ('text' in sql) return sql.text;
  throw new Error(`Batch SQL is not supported in this query`);
};
