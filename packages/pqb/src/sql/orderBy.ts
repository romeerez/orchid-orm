import { OrderItem, SelectQueryData } from './types';
import { getRaw, isRaw } from '../common';
import { qc } from './common';

export const pushOrderBySql = (
  sql: string[],
  quotedAs: string | undefined,
  order: Exclude<SelectQueryData['order'], undefined>,
) => {
  sql.push(
    `ORDER BY ${order.map((item) => orderByToSql(item, quotedAs)).join(', ')}`,
  );
};

export const orderByToSql = (order: OrderItem, quotedAs?: string) => {
  if (isRaw(order)) {
    return getRaw(order);
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
