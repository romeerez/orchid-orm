import { TruncateQueryData } from './types';
import { quoteSchemaAndTable } from './common';

export const pushTruncateSql = (
  sql: string[],
  table: string,
  query: TruncateQueryData,
) => {
  sql.push('TRUNCATE', quoteSchemaAndTable(query?.schema, table));

  if (query.restartIdentity) sql.push('RESTART IDENTITY');
  if (query.cascade) sql.push('CASCADE');
};
