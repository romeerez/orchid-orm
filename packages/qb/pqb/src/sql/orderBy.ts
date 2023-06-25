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
      .map((item) => orderByToSql(data, item, ctx.values, quotedAs))
      .join(', ')}`,
  );
};

export const orderByToSql = (
  data: QueryData,
  order: OrderItem,
  values: unknown[],
  quotedAs?: string,
) => {
  if (typeof order === 'string') {
    return `${columnToSql(data, data.shape, order, quotedAs)} ASC`;
  }

  if (isExpression(order)) {
    return order.toSQL(values);
  }

  const sql: string[] = [];
  for (const key in order) {
    const value = order[key];
    sql.push(`${columnToSql(data, data.shape, key, quotedAs)} ${value}`);
  }
  return sql.join(', ');
};
