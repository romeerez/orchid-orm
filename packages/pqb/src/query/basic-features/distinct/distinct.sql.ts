import { rawOrColumnToSql } from '../../sql/column-to-sql';
import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { QueryData } from '../../query-data';

export const pushDistinctSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  distinct: Exclude<QueryData['distinct'], undefined>,
  quotedAs?: string,
) => {
  ctx.sql.push('DISTINCT');

  if (distinct.length) {
    const columns = distinct?.map((item) =>
      rawOrColumnToSql(ctx, table.q, item, quotedAs),
    );
    ctx.sql.push(`ON (${columns?.join(', ') || ''})`);
  }
};
