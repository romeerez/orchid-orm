import { quoteSchemaAndTable } from './common';
import { ToSQLCtx } from './toSQL';
import { QueryData } from './data';

export const pushTruncateSql = (
  ctx: ToSQLCtx,
  table: string,
  query: QueryData,
) => {
  ctx.sql.push('TRUNCATE', quoteSchemaAndTable(query.schema, table));

  if (query.restartIdentity) ctx.sql.push('RESTART IDENTITY');
  if (query.cascade) ctx.sql.push('CASCADE');
};
