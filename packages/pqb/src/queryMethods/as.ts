import { _setQueryAs, AsQueryArg, SetQueryTableAlias } from '../core';
import { _clone } from '../query/queryUtils';

export abstract class QueryAsMethods {
  /**
   * Sets table alias:
   *
   * ```ts
   * db.table.as('u').select('u.name');
   *
   * // Can be used in the join:
   * db.table.join(Profile.as('p'), 'p.userId', 'user.id');
   * ```
   *
   * @param as - alias for the table of this query
   */
  as<T extends AsQueryArg, As extends string>(
    this: T,
    as: As,
  ): SetQueryTableAlias<T, As> {
    return _setQueryAs(_clone(this), as) as never;
  }
}
