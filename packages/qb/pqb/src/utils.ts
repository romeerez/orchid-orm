import { cloneQueryArrays, QueryData, toSqlCacheKey } from './sql';
import type { Query, Selectable } from './query';
import type { ColumnOutput, ColumnTypeBase, StringKey } from 'orchid-core';
import { BaseRelation } from './relations';
import { Expression } from 'orchid-core';

export type AliasOrTable<T extends Pick<Query, 'table' | 'meta'>> =
  T['meta']['as'] extends string
    ? T['meta']['as']
    : T['table'] extends string
    ? T['table']
    : never;

export type SelectableOrExpression<
  T extends Query = Query,
  C extends ColumnTypeBase = ColumnTypeBase,
> = '*' | StringKey<keyof T['selectable']> | Expression<C>;

export type ExpressionOfType<T extends Query, C extends ColumnTypeBase, Type> =
  | {
      [K in keyof T['selectable']]: ColumnOutput<
        T['selectable'][K]['column']
      > extends Type | null
        ? K
        : never;
    }[Selectable<T>]
  | Expression<C>;

export type NumberExpression<
  T extends Query,
  C extends ColumnTypeBase = ColumnTypeBase,
> = ExpressionOfType<T, C, number>;

export type StringExpression<
  T extends Query,
  C extends ColumnTypeBase = ColumnTypeBase,
> = ExpressionOfType<T, C, string>;

export type BooleanExpression<
  T extends Query,
  C extends ColumnTypeBase = ColumnTypeBase,
> = ExpressionOfType<T, C, boolean>;

export type ExpressionOutput<
  T extends Query,
  Expr extends SelectableOrExpression<T>,
> = Expr extends keyof T['selectable']
  ? T['selectable'][Expr]['column']
  : Expr extends Expression<infer ColumnTypeBase>
  ? ColumnTypeBase
  : never;

export const getClonedQueryData = (query: QueryData): QueryData => {
  const cloned = { ...query };
  delete cloned[toSqlCacheKey];
  if (cloned.parsers) cloned.parsers = { ...cloned.parsers };
  cloneQueryArrays(cloned);
  return cloned as QueryData;
};

export const getQueryAs = (q: { table?: string; query: { as?: string } }) => {
  return q.query.as || (q.table as string);
};

export const makeRegexToFindInSql = (value: string) => {
  return new RegExp(`${value}(?=(?:[^']*'[^']*')*[^']*$)`, 'g');
};

/**
 * In `select`, `update`, `create` it's possible to pass a callback with a sub-query.
 * This function resolves such sub-query.
 *
 * @param q - main query object to pass to a callback as argument
 * @param cb - sub-query callback
 */
export const resolveSubQueryCallback = (
  q: Query,
  cb: (q: Query) => Query,
): Query => {
  const { isSubQuery } = q;
  q.isSubQuery = true;
  const result = cb(q);
  q.isSubQuery = isSubQuery;
  return result;
};

/**
 * After getting a query from a sub-query callback,
 * join it to the main query in case it's a relation query.
 *
 * If it's not a relation query, it will be returned as is.
 *
 * @param q - main query object
 * @param sub - sub-query query object
 */
export const joinSubQuery = (q: Query, sub: Query): Query => {
  if (!('joinQuery' in sub)) return sub;

  return (sub as unknown as BaseRelation).joinQuery(q, sub);
};
