import { ToSQLCtx } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
import { quoteSchemaAndTable } from '../../sql/sql';

export const pushTruncateSql = (
  ctx: ToSQLCtx,
  table: string,
  query: QueryData,
) => {
  ctx.sql.push('TRUNCATE', quoteSchemaAndTable(query.schema, table));

  if (query.restartIdentity) ctx.sql.push('RESTART IDENTITY');
  if (query.cascade) ctx.sql.push('CASCADE');
};
