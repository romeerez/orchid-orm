import { IsQuery, Query } from '../../query';
import { FromQuerySelf, queryFrom } from '../from/from';
import { _setQueryAs, SetQueryTableAlias } from '../as/as';
import { _clone } from '../clone/clone';

export type WrapQueryArg = FromQuerySelf;

export function queryWrap<
  T extends IsQuery,
  Q extends WrapQueryArg,
  As extends string = 't',
>(self: T, query: Q, as: As = 't' as As): SetQueryTableAlias<Q, As> {
  return _setQueryAs(queryFrom(query, self) as never, as) as never;
}

/**
 * This function is useful when wrapping a query,
 * such as when doing `SELECT json_agg(t.*) FROM (...) AS t`,
 * to get rid of default scope conditions (WHERE deletedAt IS NULL)
 * that otherwise would be duplicated inside the `FROM` and after `AS t`.
 */
export function cloneQueryBaseUnscoped(query: Query) {
  const q = query.baseQuery.clone();
  q.q.or = q.q.and = q.q.scopes = undefined;
  return q;
}

export class QueryWrap {
  wrap<T extends IsQuery, Q extends WrapQueryArg, As extends string = 't'>(
    this: T,
    query: Q,
    as?: As,
  ): SetQueryTableAlias<Q, As> {
    return queryWrap(this, _clone(query), as) as never;
  }
}
