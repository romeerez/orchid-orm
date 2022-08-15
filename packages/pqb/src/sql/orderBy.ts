import { OrderItem, SelectQueryData } from './types';
import { getRaw, isRaw } from '../common';
import { qc } from './common';

export const pushOrderBySql = (
  sql: string[],
  values: unknown[],
  quotedAs: string | undefined,
  order: Exclude<SelectQueryData['order'], undefined>,
) => {
  sql.push(
    `ORDER BY ${order
      .map((item) => orderByToSql(item, values, quotedAs))
      .join(', ')}`,
  );
};

export const orderByToSql = (
  order: OrderItem,
  values: unknown[],
  quotedAs?: string,
) => {
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
