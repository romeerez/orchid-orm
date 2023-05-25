import { WindowDeclaration } from './types';
import { q, rawOrRevealColumnToSql } from './common';
import { orderByToSql } from './orderBy';
import { getRaw } from './rawSql';
import { isRaw, RawExpression } from 'orchid-core';
import { QueryData } from './data';

export const windowToSql = (
  data: QueryData,
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
                    rawOrRevealColumnToSql(data, partitionBy, values, quotedAs),
                  )
                  .join(', ')
              : rawOrRevealColumnToSql(
                  data,
                  window.partitionBy,
                  values,
                  quotedAs,
                )
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
