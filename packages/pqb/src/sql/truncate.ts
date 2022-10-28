import { TruncateQueryData } from './types';
import { quoteSchemaAndTable } from './common';
import { ToSqlCtx } from './toSql';

export const pushTruncateSql = (
  ctx: ToSqlCtx,
  table: string,
  query: TruncateQueryData,
) => {
  ctx.sql.push('TRUNCATE', quoteSchemaAndTable(query.schema, table));

  if (query.restartIdentity) ctx.sql.push('RESTART IDENTITY');
  if (query.cascade) ctx.sql.push('CASCADE');
};
