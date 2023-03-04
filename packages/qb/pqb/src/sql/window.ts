import { WindowDeclaration } from './types';
import { expressionToSql, q } from './common';
import { orderByToSql } from './orderBy';
import { getRaw } from '../raw';
import { isRaw, RawExpression } from 'orchid-core';

export const windowToSql = (
  window: string | WindowDeclaration | RawExpression,
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
