import { WindowDeclaration } from './types';
import { q, rawOrColumnToSql } from './common';
import { orderByToSql } from './orderBy';
import { QueryData } from './data';
import { Expression, isExpression } from 'orchid-core';

export const windowToSql = (
  data: QueryData,
  window: string | WindowDeclaration | Expression,
  values: unknown[],
  quotedAs?: string,
) => {
  if (typeof window === 'object') {
    if (isExpression(window)) {
      return `(${window.toSQL(values)})`;
    } else {
      const sql: string[] = [];
      if (window.partitionBy) {
        sql.push(
          `PARTITION BY ${
            Array.isArray(window.partitionBy)
              ? window.partitionBy
                  .map((partitionBy) =>
                    rawOrColumnToSql(data, partitionBy, values, quotedAs),
                  )
                  .join(', ')
              : rawOrColumnToSql(data, window.partitionBy, values, quotedAs)
          }`,
        );
      }
      if (window.order) {
        sql.push(
          `ORDER BY ${orderByToSql(data, window.order, values, quotedAs)}`,
        );
      }
      return `(${sql.join(' ')})`;
    }
  } else {
    return q(window as string);
  }
};
