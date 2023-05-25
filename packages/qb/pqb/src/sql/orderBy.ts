import { OrderItem } from './types';
import { revealColumnToSql } from './common';
import { ToSqlCtx } from './toSql';
import { getRaw } from './rawSql';
import { QueryData, SelectQueryData } from './data';
import { isRaw } from 'orchid-core';

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
    return `${revealColumnToSql(data, data.shape, order, quotedAs)} ASC`;
  }

  if (isRaw(order)) {
    return getRaw(order, values);
  }

  const sql: string[] = [];
  for (const key in order) {
    const value = order[key];
    sql.push(`${revealColumnToSql(data, data.shape, key, quotedAs)} ${value}`);
  }
  return sql.join(', ');
};
