import { AggregateItem } from './types';
import { addValue, rawOrRevealColumnToSql, q } from './common';
import { getRaw } from './rawSql';
import { windowToSql } from './window';
import { pushOrderBySql } from './orderBy';
import { whereToSql } from './where';
import { ToSqlCtx } from './toSql';
import { Expression } from '../utils';
import { isRaw, emptyObject } from 'orchid-core';
import { QueryBase } from '../queryBase';

export const aggregateToSql = (
  ctx: ToSqlCtx,
  table: QueryBase,
  item: AggregateItem,
  quotedAs?: string,
) => {
  const sql: string[] = [`${item.function}(`];
  ctx = { ...ctx, sql };

  const options = item.options || emptyObject;

  if (options.distinct && !options.withinGroup) sql.push('DISTINCT ');

  if (typeof item.arg === 'object') {
    if (Array.isArray(item.arg)) {
      sql.push(
        `${rawOrRevealColumnToSql(
          table.query,
          item.arg[0],
          ctx.values,
          quotedAs,
        )}, ${addValue(ctx.values, item.arg[1])}`,
      );
    } else if (isRaw(item.arg)) {
      sql.push(getRaw(item.arg, ctx.values));
    } else {
      const args: string[] = [];
      for (const key in item.arg) {
        args.push(
          // ::text is needed to bypass "could not determine data type of parameter" postgres error
          `${addValue(ctx.values, key)}::text, ${rawOrRevealColumnToSql(
            table.query,
            item.arg[key as keyof typeof item.arg] as unknown as Expression,
            ctx.values,
            quotedAs,
          )}`,
        );
      }
      sql.push(args.join(', '));
    }
  } else if (item.arg) {
    sql.push(
      rawOrRevealColumnToSql(table.query, item.arg, ctx.values, quotedAs),
    );
  }

  if (options.withinGroup) sql.push(') WITHIN GROUP (');
  else if (options.order) sql.push(' ');

  if (options.order) pushOrderBySql(ctx, table.query, quotedAs, options.order);

  sql.push(')');

  if (options.filter || options.filterOr) {
    const whereSql = whereToSql(
      ctx,
      table,
      {
        and: options.filter ? [options.filter] : undefined,
        or: options.filterOr?.map((item) => [item]),
        shape: table.query.shape,
        joinedShapes: table.query.joinedShapes,
      },
      quotedAs,
    );
    if (whereSql) {
      sql.push(` FILTER (WHERE ${whereSql})`);
    }
  }

  if (options.over) {
    sql.push(
      ` OVER ${windowToSql(table.query, options.over, ctx.values, quotedAs)}`,
    );
  }

  if (options.as) sql.push(` AS ${q(options.as)}`);

  return sql.join('');
};
