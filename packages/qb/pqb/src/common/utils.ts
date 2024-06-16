import { cloneQuery, QueryData, toSQLCacheKey, ToSQLQuery } from '../sql';
import type { Query } from '../query/query';
import type { QueryColumn } from 'orchid-core';
import { RelationQuery } from '../relations';
import { Expression, PickQueryMeta } from 'orchid-core';
import { PickQueryMetaTable } from '../query/query';

export type AliasOrTable<T extends PickQueryMetaTable> =
  T['meta']['as'] extends string
    ? T['meta']['as']
    : T['table'] extends string
    ? T['table']
    : never;

export type SelectableOrExpression<
  T extends PickQueryMeta = PickQueryMeta,
  C extends QueryColumn = QueryColumn,
> = '*' | keyof T['meta']['selectable'] | Expression<C>;

export type SelectableOrExpressions<
  T extends PickQueryMeta = PickQueryMeta,
  C extends QueryColumn = QueryColumn,
> = ('*' | keyof T['meta']['selectable'] | Expression<C>)[];

export type ExpressionOutput<
  T extends PickQueryMeta,
  Expr extends SelectableOrExpression<T>,
> = Expr extends keyof T['meta']['selectable']
  ? T['meta']['selectable'][Expr]['column']
  : Expr extends Expression
  ? Expr['result']['value']
  : never;

export const getClonedQueryData = (query: QueryData): QueryData => {
  const cloned = { ...query };
  delete cloned[toSQLCacheKey];
  if (cloned.parsers) cloned.parsers = { ...cloned.parsers };
  cloneQuery(cloned);
  return cloned as QueryData;
};

export const getQueryAs = (q: { table?: string; q: { as?: string } }) => {
  return q.q.as || (q.table as string);
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
  q: ToSQLQuery,
  cb: (q: ToSQLQuery) => ToSQLQuery,
): ToSQLQuery => {
  const { subQuery, relChain } = q.q;
  q.q.subQuery = 1;
  q.q.relChain = undefined;
  const result = cb(q);
  q.q.subQuery = subQuery;
  q.q.relChain = relChain;
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
export const joinSubQuery = (q: ToSQLQuery, sub: ToSQLQuery): Query => {
  if (!('relationConfig' in sub)) return sub as Query;

  return (sub as unknown as RelationQuery).relationConfig.joinQuery(
    sub as unknown as Query,
    q as Query,
  );
};
