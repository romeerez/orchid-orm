import { QueryData } from '../../query-data';
import { queryTypeWithLimitOne } from '../../index';
import { addValue } from '../../../utils';
import { SubQueryForSql } from '../../sub-query/sub-query-for-sql';
import { ToSQLCtx } from '../../sql/to-sql';

export function pushLimitOffsetSql(
  ctx: ToSQLCtx,
  query: QueryData,
  fromQuery?: SubQueryForSql,
) {
  if (query.useFromLimitOffset) {
    const q = fromQuery?.q as QueryData;
    if (q.limit) {
      ctx.sql.push(`LIMIT ${addValue(ctx.values, q.limit)}`);
    }
    if (q.offset) {
      ctx.sql.push(`OFFSET ${addValue(ctx.values, q.offset)}`);
    }
  } else {
    pushLimitSQL(ctx.sql, ctx.values, query);

    if (query.offset && !query.returnsOne) {
      ctx.sql.push(`OFFSET ${addValue(ctx.values, query.offset)}`);
    }
  }
}

export function pushLimitSQL(sql: string[], values: unknown[], q: QueryData) {
  if (!q.returnsOne) {
    if (queryTypeWithLimitOne[q.returnType as string] && !q.returning) {
      sql.push(`LIMIT 1`);
    } else if (q.limit) {
      sql.push(`LIMIT ${addValue(values, q.limit)}`);
    }
  }
}
