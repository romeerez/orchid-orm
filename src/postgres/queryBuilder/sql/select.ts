import { QueryData } from './types';
import { Expression, getRaw, isRaw } from '../common';
import { Query } from '../query';
import { q, qc } from './common';
import { aggregateToSql } from './aggregate';

export const pushSelectSql = (
  sql: string[],
  quotedAs: string,
  select: QueryData['select'],
) => {
  if (select) {
    const list: string[] = [];
    if (select) {
      select.forEach((item) => {
        if (typeof item === 'object') {
          if ('selectAs' in item) {
            const obj = item.selectAs as Record<string, Expression | Query>;
            for (const as in obj) {
              const value = obj[as];
              if (typeof value === 'object') {
                if (isRaw(value)) {
                  list.push(`${getRaw(value)} AS ${q(as)}`);
                } else {
                  list.push(`(${(value as Query).json().toSql()}) AS ${q(as)}`);
                }
              } else {
                list.push(`${qc(quotedAs, value as string)} AS ${q(as)}`);
              }
            }
          } else {
            list.push(aggregateToSql(quotedAs, item));
          }
        } else {
          list.push(qc(quotedAs, item as string));
        }
      });
    }
    sql.push(list.join(', '));
  } else {
    sql.push(`${quotedAs}.*`);
  }
};
