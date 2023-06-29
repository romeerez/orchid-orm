import { ToSqlCtx } from './toSql';
import { SelectQueryData } from './data';
import { templateLiteralToSQL } from './rawSql';
import { Expression, TemplateLiteralArgs } from 'orchid-core';

export const pushHavingSql = (
  ctx: ToSqlCtx,
  query: SelectQueryData,
  quotedAs?: string,
) => {
  const conditions = havingToSql(ctx, query, quotedAs);
  if (conditions?.length) ctx.sql.push('HAVING', conditions);
};

export const havingToSql = (
  ctx: ToSqlCtx,
  query: SelectQueryData,
  quotedAs?: string,
): string | undefined => {
  return query.having
    ?.map((it) =>
      'raw' in it[0]
        ? templateLiteralToSQL(it as TemplateLiteralArgs, ctx.values)
        : it
            .map((item) => (item as Expression).toSQL(ctx, quotedAs))
            .join(' AND '),
    )
    .join(' AND ');
};
