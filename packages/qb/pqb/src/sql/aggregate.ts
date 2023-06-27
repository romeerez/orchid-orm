import { AggregateItem } from './types';
import { addValue, rawOrColumnToSql, q } from './common';
import { windowToSql } from './window';
import { pushOrderBySql } from './orderBy';
import { whereToSql } from './where';
import { ToSqlCtx } from './toSql';
import { SelectableOrExpression } from '../utils';
import { emptyObject, isExpression } from 'orchid-core';
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
        `${rawOrColumnToSql(
          table.q,
          item.arg[0],
          ctx.values,
          quotedAs,
        )}, ${addValue(ctx.values, item.arg[1])}`,
      );
    } else if (isExpression(item.arg)) {
      sql.push(item.arg.toSQL(ctx.values));
    } else {
      const args: string[] = [];
      for (const key in item.arg) {
        args.push(
          // ::text is needed to bypass "could not determine data type of parameter" postgres error
          `${addValue(ctx.values, key)}::text, ${rawOrColumnToSql(
            table.q,
            item.arg[
              key as keyof typeof item.arg
            ] as unknown as SelectableOrExpression,
            ctx.values,
            quotedAs,
          )}`,
        );
      }
      sql.push(args.join(', '));
    }
  } else if (item.arg) {
    sql.push(
      item.arg === '*'
        ? '*'
        : rawOrColumnToSql(table.q, item.arg, ctx.values, quotedAs),
    );
  }

  if (options.withinGroup) sql.push(') WITHIN GROUP (');
  else if (options.order) sql.push(' ');

  if (options.order) pushOrderBySql(ctx, table.q, quotedAs, options.order);

  sql.push(')');

  if (options.filter || options.filterOr) {
    const whereSql = whereToSql(
      ctx,
      table,
      {
        and: options.filter ? [options.filter] : undefined,
        or: options.filterOr?.map((item) => [item]),
        shape: table.q.shape,
        joinedShapes: table.q.joinedShapes,
      },
      quotedAs,
    );
    if (whereSql) {
      sql.push(` FILTER (WHERE ${whereSql})`);
    }
  }

  if (options.over) {
    sql.push(
      ` OVER ${windowToSql(table.q, options.over, ctx.values, quotedAs)}`,
    );
  }

  if (options.as) sql.push(` AS ${q(options.as)}`);

  return sql.join('');
};
