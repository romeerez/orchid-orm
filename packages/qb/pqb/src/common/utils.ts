import { QueryData, ToSQLQuery } from '../sql';
import type { Query } from '../query/query';
import {
  _setSubQueryAliases,
  Expression,
  isRelationQuery,
  PickQueryMeta,
  QueryColumn,
} from 'orchid-core';
import { _clone } from '../query/queryUtils';
import { _chain } from '../queryMethods/chain';

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
  // `with` can pass a generic `qb` here, it has no table.
  // Do not memoize anything into `internal` of a common `qb`,
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
  // Deleting `with` because sub-query should duplicate WITH statements of the parent query in its SQL
  arg.q.with = arg.q.relChain = undefined;
  _setSubQueryAliases(arg);

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
export const joinSubQuery = (q: ToSQLQuery, sub: ToSQLQuery): Query =>
  (isRelationQuery(sub) ? sub.joinQuery(sub, q) : sub) as never;
