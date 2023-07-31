import { Query } from './query';
import { SelectAggMethods, SelectQueryBuilder } from './queryMethods';
import { getClonedQueryData } from './utils';

/**
 * Used to build relation sub queries where agg methods such as `count` can be chained with column operators such as `gt`, `lt`.
 * See {@link RelationSubQueries}.
 */
export type SubQueryBuilder<T extends Query, Agg = SelectAggMethods<T>> = Omit<
  T,
  keyof Agg
> &
  Agg;

// Lazy plain object containing agg methods.
let selectAggMethods: SelectAggMethods | undefined;

// Simply moving agg methods from the prototype of class into a plain object `selectAggMethods`.
const getSelectAggMethods = (): SelectAggMethods => {
  if (selectAggMethods) return selectAggMethods;

  selectAggMethods = {} as SelectAggMethods;
  for (const key of Object.getOwnPropertyNames(SelectAggMethods.prototype)) {
    (selectAggMethods as unknown as Record<string, unknown>)[key] =
      SelectAggMethods.prototype[key as keyof SelectAggMethods];
  }

  return selectAggMethods;
};

/**
 * Build and memoize a query builder to use in the argument of select callback.
 * See {@link SubQueryBuilder}
 *
 * @param q - query object to base the query builder upon
 */
export const getSubQueryBuilder = <T extends Query>(
  q: T,
): SubQueryBuilder<T> => {
  // Memoize query builder assigning agg methods to a cloned base query
  let qb = q.internal.selectQueryBuilder;
  if (!qb) {
    qb = Object.assign(
      Object.create(q.baseQuery),
      getSelectAggMethods(),
    ) as SelectQueryBuilder<Query>;
    qb.baseQuery = qb as never;
    q.internal.selectQueryBuilder = qb;
  }

  // clone query builder for each invocation so that query data won't persist between calls
  const cloned = Object.create(qb);
  cloned.q = getClonedQueryData(q.q);
  return cloned;
};
