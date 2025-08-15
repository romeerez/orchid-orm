import { ToSQLCtx } from './toSQL';
import { templateLiteralToSQL } from './rawSql';
import { Expression, TemplateLiteralArgs } from 'orchid-core';
import { QueryData } from '../sql/data';

export const pushHavingSql = (
  ctx: ToSQLCtx,
  query: QueryData,
  quotedAs?: string,
) => {
  const conditions = havingToSql(ctx, query, quotedAs);
  if (conditions?.length) ctx.sql.push('HAVING', conditions);
};

export const havingToSql = (
  ctx: ToSQLCtx,
  query: QueryData,
  quotedAs?: string,
): string | undefined => {
  return query.having
    ?.map((it) =>
      'raw' in it[0]
        ? templateLiteralToSQL(it as TemplateLiteralArgs, ctx, quotedAs)
        : it
            .map((item) => (item as Expression).toSQL(ctx, quotedAs))
            .join(' AND '),
    )
    .join(' AND ');
};
