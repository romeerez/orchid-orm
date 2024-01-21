import { rawOrColumnToSql } from './common';
import { ToSQLCtx, ToSQLQuery } from './toSQL';
import { SelectQueryData } from './data';

export const pushDistinctSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  distinct: Exclude<SelectQueryData['distinct'], undefined>,
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
