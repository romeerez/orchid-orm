import { Query } from '../query';
import { getRaw } from '../raw';
import { Expression } from '../utils';
import { isRaw } from 'orchid-core';

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

export const expressionToSql = <T extends Query>(
  expr: Expression<T>,
  values: unknown[],
  quotedAs?: string,
) => {
  return typeof expr === 'object' && isRaw(expr)
    ? getRaw(expr, values)
    : quoteFullColumn(expr as string, quotedAs);
};

export const quoteSchemaAndTable = (
  schema: string | undefined,
  table: string,
) => {
  return schema ? `${q(schema)}.${q(table)}` : q(table);
};

export const addValue = (values: unknown[], value: unknown) => {
  values.push(value);
  return `$${values.length}`;
};
