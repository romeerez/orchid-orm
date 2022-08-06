import { Query } from '../query';
import { WindowDeclaration } from './types';
import { getRaw, isRaw, RawExpression } from '../common';
import { expressionToSql, q } from './common';
import { orderByToSql } from './orderBy';

export const windowToSql = <T extends Query>(
  window: T['windows'][number] | WindowDeclaration<T> | RawExpression,
  quotedAs?: string,
) => {
  if (typeof window === 'object') {
    if (isRaw(window)) {
      return `(${getRaw(window)})`;
    } else {
      const sql: string[] = [];
      if (window.partitionBy) {
        sql.push(
          `PARTITION BY ${
            Array.isArray(window.partitionBy)
              ? window.partitionBy
                  .map((partitionBy) => expressionToSql(partitionBy, quotedAs))
                  .join(', ')
              : expressionToSql(window.partitionBy, quotedAs)
          }`,
        );
      }
      if (window.order) {
        sql.push(`ORDER BY ${orderByToSql(window.order, quotedAs)}`);
      }
      return `(${sql.join(' ')})`;
    }
  } else {
    return q(window as string);
  }
};
