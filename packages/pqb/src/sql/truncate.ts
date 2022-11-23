import { quoteSchemaAndTable } from './common';
import { ToSqlCtx } from './toSql';
import { TruncateQueryData } from './data';

export const pushTruncateSql = (
  ctx: ToSqlCtx,
  table: string,
  query: TruncateQueryData,
) => {
  ctx.sql.push('TRUNCATE', quoteSchemaAndTable(query.schema, table));

  if (query.restartIdentity) ctx.sql.push('RESTART IDENTITY');
  if (query.cascade) ctx.sql.push('CASCADE');
};
