import { rawOrColumnToSql } from '../../sql/column-to-sql';
import { orderByToSql, OrderItem } from '../order/order.sql';
import { QueryData } from '../../query-data';
import { ToSQLCtx } from '../../sql/to-sql';
import {
  Expression,
  isExpression,
  SelectableOrExpression,
} from '../../expressions/expression';

export interface WindowItem {
  [K: string]: WindowDeclaration | Expression;
}

export interface WindowDeclaration {
  partitionBy?: SelectableOrExpression | SelectableOrExpression[];
  order?: OrderItem;
}

export const windowToSql = (
  ctx: ToSQLCtx,
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
