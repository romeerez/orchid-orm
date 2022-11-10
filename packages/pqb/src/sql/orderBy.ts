import { OrderItem, SelectQueryData } from './types';
import { qc } from './common';
import { ToSqlCtx } from './toSql';
import { getRaw, isRaw } from '../common';

export const pushOrderBySql = (
  ctx: ToSqlCtx,
  quotedAs: string | undefined,
  order: Exclude<SelectQueryData['order'], undefined>,
) => {
  ctx.sql.push(
    `ORDER BY ${order
      .map((item) => orderByToSql(item, ctx.values, quotedAs))
      .join(', ')}`,
  );
};

export const orderByToSql = (
  order: OrderItem,
  values: unknown[],
  quotedAs?: string,
) => {
  if (typeof order === 'string') {
    return `${qc(order, quotedAs)} ASC`;
  }

  if (isRaw(order)) {
    return getRaw(order, values);
  }

  const sql: string[] = [];
  for (const key in order) {
    const value = order[key];
    if (typeof value === 'string') {
      sql.push(`${qc(key, quotedAs)} ${value}`);
    } else if (value) {
      sql.push(`${qc(key, quotedAs)} ${value.dir} NULLS ${value.nulls}`);
    }
  }
  return sql.join(', ');
};
