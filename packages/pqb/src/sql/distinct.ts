import { SelectQueryData } from './types';
import { expressionToSql } from './common';
import { ToSqlCtx } from './toSql';

export const pushDistinctSql = (
  ctx: ToSqlCtx,
  distinct: Exclude<SelectQueryData['distinct'], undefined>,
  quotedAs?: string,
) => {
  ctx.sql.push('DISTINCT');

  if (distinct.length) {
    const columns: string[] = [];
    distinct?.forEach((item) => {
      columns.push(expressionToSql(item, ctx.values, quotedAs));
    });
    ctx.sql.push(`ON (${columns.join(', ')})`);
  }
};
