import { Query } from '../query';
import { WindowDeclaration } from './types';
import { getRaw, isRaw, RawExpression } from '../common';
import { expressionToSql, q } from './common';
import { orderByToSql } from './orderBy';

export const windowToSql = <T extends Query>(
  quotedAs: string,
  window: T['windows'][number] | WindowDeclaration<T> | RawExpression,
) => {
  if (typeof window === 'object') {
    if (isRaw(window)) {
      return `(${getRaw(window)})`;
    } else {
      const sql: string[] = [];
      if (window.partitionBy) {
        sql.push(
          `PARTITION BY ${expressionToSql(quotedAs, window.partitionBy)}`,
        );
      }
      if (window.order) {
        sql.push(`ORDER BY ${orderByToSql(quotedAs, window.order)}`);
      }
      return `(${sql.join(' ')})`;
    }
  } else {
    return q(window as string);
  }
};
