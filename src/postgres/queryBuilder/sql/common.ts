// quote table or column
import { Query } from '../query';
import { Expression, getRaw, isRaw } from '../common';

export const q = (sql: string) => `"${sql}"`;

// quote column with table or as
export const qc = (quotedAs: string, column: string) =>
  `${quotedAs}.${q(column)}`;

export const quoteFullColumn = (quotedAs: string, fullColumn: string) => {
  const index = fullColumn.indexOf('.');
  if (index === -1) {
    return `${quotedAs}.${q(fullColumn)}`;
  } else {
    return `${q(fullColumn.slice(0, index))}.${q(fullColumn.slice(index + 1))}`;
  }
};

export const EMPTY_OBJECT = {};

export const expressionToSql = <T extends Query>(
  quotedAs: string,
  expr: Expression<T>,
) => {
  return typeof expr === 'object' && isRaw(expr)
    ? getRaw(expr)
    : qc(quotedAs, expr as string);
};
