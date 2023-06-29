import { OrderItem } from './types';
import { columnToSql } from './common';
import { ToSqlCtx } from './toSql';
import { QueryData, SelectQueryData } from './data';
import { isExpression } from 'orchid-core';

export const pushOrderBySql = (
  ctx: ToSqlCtx,
  data: QueryData,
  quotedAs: string | undefined,
  order: Exclude<SelectQueryData['order'], undefined>,
) => {
  ctx.sql.push(
    `ORDER BY ${order
      .map((item) => orderByToSql(ctx, data, item, quotedAs))
      .join(', ')}`,
  );
};

export const orderByToSql = (
  ctx: ToSqlCtx,
  data: QueryData,
  order: OrderItem,
  quotedAs?: string,
) => {
  if (typeof order === 'string') {
    return `${columnToSql(data, data.shape, order, quotedAs)} ASC`;
  }

  if (isExpression(order)) {
    return order.toSQL(ctx, quotedAs);
  }

  const sql: string[] = [];
  for (const key in order) {
    const value = order[key];
    sql.push(`${columnToSql(data, data.shape, key, quotedAs)} ${value}`);
  }
  return sql.join(', ');
};
