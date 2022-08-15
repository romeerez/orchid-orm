import { Query } from '../query';
import { WindowDeclaration } from './types';
import { getRaw, isRaw, RawExpression } from '../common';
import { expressionToSql, q } from './common';
import { orderByToSql } from './orderBy';

export const windowToSql = <T extends Query>(
  window: T['windows'][number] | WindowDeclaration | RawExpression,
  values: unknown[],
  quotedAs?: string,
) => {
  if (typeof window === 'object') {
    if (isRaw(window)) {
      return `(${getRaw(window, values)})`;
    } else {
      const sql: string[] = [];
      if (window.partitionBy) {
        sql.push(
          `PARTITION BY ${
            Array.isArray(window.partitionBy)
              ? window.partitionBy
                  .map((partitionBy) =>
                    expressionToSql(partitionBy, values, quotedAs),
                  )
                  .join(', ')
              : expressionToSql(window.partitionBy, values, quotedAs)
          }`,
        );
      }
      if (window.order) {
        sql.push(`ORDER BY ${orderByToSql(window.order, values, quotedAs)}`);
      }
      return `(${sql.join(' ')})`;
    }
  } else {
    return q(window as string);
  }
};
