import { quoteSchemaAndTable } from './common';
import { ToSQLCtx } from './toSQL';
import { TruncateQueryData } from './data';

export const pushTruncateSql = (
  ctx: ToSQLCtx,
  table: string,
  query: TruncateQueryData,
) => {
  ctx.sql.push('TRUNCATE', quoteSchemaAndTable(query.schema, table));

  if (query.restartIdentity) ctx.sql.push('RESTART IDENTITY');
  if (query.cascade) ctx.sql.push('CASCADE');
};
