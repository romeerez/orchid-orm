import { rawOrRevealColumnToSql } from './common';
import { ToSqlCtx } from './toSql';
import { SelectQueryData } from './data';
import { QueryBase } from '../queryBase';

export const pushDistinctSql = (
  ctx: ToSqlCtx,
  table: QueryBase,
  distinct: Exclude<SelectQueryData['distinct'], undefined>,
  quotedAs?: string,
) => {
  ctx.sql.push('DISTINCT');

  if (distinct.length) {
    const columns = distinct?.map((item) =>
      rawOrRevealColumnToSql(table.query, item, ctx.values, quotedAs),
    );
    ctx.sql.push(`ON (${columns?.join(', ') || ''})`);
  }
};
