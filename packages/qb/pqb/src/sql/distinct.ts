import { rawOrColumnToSql } from './common';
import { ToSQLCtx } from './toSQL';
import { SelectQueryData } from './data';
import { QueryBase } from '../queryBase';

export const pushDistinctSql = (
  ctx: ToSQLCtx,
  table: QueryBase,
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
