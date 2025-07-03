import { QueryData, ToSQLQuery } from '../sql';
import type { Query } from '../query/query';
import { PickQueryMetaTable } from '../query/query';
import { Expression, PickQueryMeta, QueryColumn } from 'orchid-core';
import { RelationConfigBase } from '../relations';
import { _clone } from '../query/queryUtils';
import { _chain } from '../queryMethods/chain';

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
  T extends { meta: { selectable: unknown } } = {
    meta: { selectable: unknown };
  },
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
  return { ...query };
};

export const getQueryAs = (q: { table?: string; q: { as?: string } }) => {
  return q.q.as || (q.table as string);
};

export const makeRegexToFindInSql = (value: string) => {
  return new RegExp(`${value}(?=(?:[^']*'[^']*')*[^']*$)`, 'g');
};

/**
 * In `select`, `update`, `create` it's possible to pass a callback with a sub-query.
 * This function resolves such a sub-query.
 *
 * @param q - main query object to pass to a callback as argument
 * @param cb - sub-query callback
 */
export const resolveSubQueryCallbackV2 = (
  q: ToSQLQuery,
  cb: (q: ToSQLQuery) => ToSQLQuery,
): ToSQLQuery => {
  let base;
  // `with` can pass a generic `queryBuilder` here, it has no table.
  // Do not memoize anything into `internal` of a common `queryBuilder`,
  // because it is common and will be re-used.
  if (q.table) {
    base = q.internal.callbackArg;
    if (!base) {
      base = Object.create(q.baseQuery) as Query;
      base.baseQuery = base;

      const { relations } = q;
      for (const key in relations) {
        Object.defineProperty(base, key, {
          get() {
            const rel = relations[key as string];
            const relQuery = _clone(rel.query);
            relQuery.q.withShapes = this.q.withShapes;
            return _chain(this, relQuery, rel);
          },
        });
      }

      q.internal.callbackArg = base;
    }
  } else {
    base = q;
  }

  const arg = Object.create(base);

  arg.q = getClonedQueryData(q.q);
  arg.q.subQuery = 1;
  arg.q.relChain = undefined;
  arg.q.outerAliases = q.q.aliases;

  return cb(arg as Query);
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
  if (!('joinQuery' in sub)) return sub as never;

  return (sub as unknown as RelationConfigBase).joinQuery(sub, q) as never;
};
