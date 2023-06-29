import { WindowDeclaration } from './types';
import { rawOrColumnToSql } from './common';
import { orderByToSql } from './orderBy';
import { QueryData } from './data';
import { Expression, isExpression } from 'orchid-core';
import { ToSqlCtx } from './toSql';

export const windowToSql = (
  ctx: ToSqlCtx,
  data: QueryData,
  window: string | WindowDeclaration | Expression,
  quotedAs?: string,
) => {
  if (typeof window === 'string') return `"${window}"`;

  if (isExpression(window)) return `(${window.toSQL(ctx, quotedAs)})`;

  const sql: string[] = [];
  if (window.partitionBy) {
    sql.push(
      `PARTITION BY ${
        Array.isArray(window.partitionBy)
          ? window.partitionBy
              .map((partitionBy) =>
                rawOrColumnToSql(ctx, data, partitionBy, quotedAs),
              )
              .join(', ')
          : rawOrColumnToSql(ctx, data, window.partitionBy, quotedAs)
      }`,
    );
  }

  if (window.order) {
    sql.push(`ORDER BY ${orderByToSql(ctx, data, window.order, quotedAs)}`);
  }

  return `(${sql.join(' ')})`;
};
