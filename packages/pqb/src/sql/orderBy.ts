import { OrderBy } from './types';
import { Query } from '../query';
import { getRaw, isRaw } from '../common';
import { qc } from './common';

export const orderByToSql = (order: OrderBy<Query>, quotedAs?: string) => {
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
