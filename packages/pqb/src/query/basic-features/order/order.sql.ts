import { maybeSelectedColumnToSql } from '../../sql/column-to-sql';
import { ToSQLCtx } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
import { Expression, isExpression } from '../../expressions/expression';
import { addValue, emptyObject } from '../../../utils';
import { OrderTsQueryConfig } from '../../extra-features/search/search.sql';

export type SortDir = 'ASC' | 'DESC' | 'ASC NULLS FIRST' | 'DESC NULLS LAST';

export type OrderItem = string | { [K: string]: SortDir } | Expression;

export const pushOrderBySql = (
  ctx: ToSQLCtx,
  data: QueryData,
  quotedAs: string | undefined,
  order: Exclude<QueryData['order'], undefined>,
) => {
  ctx.sql.push(
    `ORDER BY ${order
      .map((item) => orderByToSql(ctx, data, item, quotedAs))
      .join(', ')}`,
  );
};

export const orderByToSql = (
  ctx: ToSQLCtx,
  data: QueryData,
  order: OrderItem,
  quotedAs?: string,
) => {
  if (typeof order === 'string') {
    return addOrder(ctx, data, order, quotedAs);
  }

  if (isExpression(order)) {
    return order.toSQL(ctx, quotedAs);
  }

  const sql: string[] = [];
  for (const key in order) {
    const value = order[key];
    sql.push(addOrder(ctx, data, key, quotedAs, value as SortDir));
  }
  return sql.join(', ');
};

const addOrder = (
  ctx: ToSQLCtx,
  data: QueryData,
  column: string,
  quotedAs?: string,
  dir?: SortDir | OrderTsQueryConfig,
): string => {
  if (data.sources?.[column]) {
    const search = data.sources[column];
    const order: OrderTsQueryConfig =
      dir ||
      (!search.order || search.order === true ? emptyObject : search.order);

    return `${order.coverDensity ? 'ts_rank_cd' : 'ts_rank'}(${
      order.weights ? `${addValue(ctx.values, `{${order.weights}}`)}, ` : ''
    }${search.vectorSQL}, "${column}"${
      order.normalization !== undefined
        ? `, ${addValue(ctx.values, order.normalization)}`
        : ''
    }) ${order.dir || 'DESC'}`;
  }

  return `${maybeSelectedColumnToSql(ctx, data, column, quotedAs)} ${
    dir || 'ASC'
  }`;
};
