import { AggregateItem } from './types';
import { addValue, expressionToSql, q } from './common';
import { EMPTY_OBJECT, Expression, getRaw, isRaw } from '../common';
import { windowToSql } from './window';
import { pushOrderBySql } from './orderBy';
import { whereToSql } from './where';
import { QueryBase } from '../query';
import { ToSqlCtx } from './toSql';

export const aggregateToSql = (
  ctx: ToSqlCtx,
  table: QueryBase,
  item: AggregateItem,
  quotedAs?: string,
) => {
  const sql: string[] = [`${item.function}(`];
  ctx = { ...ctx, sql };

  const options = item.options || EMPTY_OBJECT;

  if (options.distinct && !options.withinGroup) sql.push('DISTINCT ');

  if (typeof item.arg === 'object') {
    if (Array.isArray(item.arg)) {
      sql.push(
        `${expressionToSql(item.arg[0], ctx.values, quotedAs)}, ${addValue(
          ctx.values,
          item.arg[1],
        )}`,
      );
    } else if (isRaw(item.arg)) {
      sql.push(getRaw(item.arg, ctx.values));
    } else {
      const args: string[] = [];
      for (const key in item.arg) {
        args.push(
          // ::text is needed to bypass "could not determine data type of parameter" postgres error
          `${addValue(ctx.values, key)}::text, ${expressionToSql(
            item.arg[key as keyof typeof item.arg] as unknown as Expression,
            ctx.values,
            quotedAs,
          )}`,
        );
      }
      sql.push(args.join(', '));
    }
  } else if (item.arg) {
    sql.push(expressionToSql(item.arg, ctx.values, quotedAs));
  }

  if (options.withinGroup) sql.push(') WITHIN GROUP (');
  else if (options.order) sql.push(' ');

  if (options.order) pushOrderBySql(ctx, quotedAs, options.order);

  sql.push(')');

  if (options.filter || options.filterOr) {
    const whereSql = whereToSql(
      ctx,
      table,
      {
        and: options.filter ? [options.filter] : undefined,
        or: options.filterOr?.map((item) => [item]),
      },
      quotedAs,
    );
    if (whereSql) {
      sql.push(` FILTER (WHERE ${whereSql})`);
    }
  }

  if (options.over) {
    sql.push(` OVER ${windowToSql(options.over, ctx.values, quotedAs)}`);
  }

  if (options.as) sql.push(` AS ${q(options.as)}`);

  return sql.join('');
};
