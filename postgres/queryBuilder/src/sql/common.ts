// quote table or column
import { Query } from '../query';
import { Expression, getRaw, isRaw } from '../common';

export const q = (sql: string) => `"${sql}"`;

// quote column with table or as
export const qc = (column: string, quotedAs?: string) =>
  quotedAs ? `${quotedAs}.${q(column)}` : column;

export const quoteFullColumn = (fullColumn: string, quotedAs?: string) => {
  const index = fullColumn.indexOf('.');
  if (index !== -1) {
    return `${q(fullColumn.slice(0, index))}.${q(fullColumn.slice(index + 1))}`;
  } else if (quotedAs) {
    return `${quotedAs}.${q(fullColumn)}`;
  } else {
    return q(fullColumn);
  }
};

export const EMPTY_OBJECT = {};

export const expressionToSql = <T extends Query>(
  expr: Expression<T>,
  quotedAs?: string,
) => {
  return typeof expr === 'object' && isRaw(expr)
    ? getRaw(expr)
    : quoteFullColumn(expr as string, quotedAs);
};
