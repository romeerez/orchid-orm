import { cloneQuery, QueryData, toSQLCacheKey, ToSQLQuery } from '../sql';
import type { Query } from '../query/query';
import type { QueryColumn, StringKey } from 'orchid-core';
import { RelationQuery } from '../relations';
import { Expression } from 'orchid-core';
import { QueryBase } from '../query/queryBase';

export type AliasOrTable<T extends Pick<Query, 'table' | 'meta'>> =
  T['meta']['as'] extends string
    ? T['meta']['as']
    : T['table'] extends string
    ? T['table']
    : never;

export type SelectableOrExpression<
  T extends Pick<QueryBase, 'selectable'> = QueryBase,
  C extends QueryColumn = QueryColumn,
> = '*' | StringKey<keyof T['selectable']> | Expression<C>;

export type ExpressionOutput<
  T extends QueryBase,
  Expr extends SelectableOrExpression<T>,
> = Expr extends keyof T['selectable']
  ? T['selectable'][Expr]['column']
  : Expr extends Expression
  ? Expr['_type']
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
  const { isSubQuery, relChain } = q.q;
  q.q.isSubQuery = true;
  q.q.relChain = undefined;
  const result = cb(q);
  q.q.isSubQuery = isSubQuery;
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
