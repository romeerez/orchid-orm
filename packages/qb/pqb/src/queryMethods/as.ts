import { SetQueryTableAlias } from '../query';
import { QueryBase } from '../queryBase';

export abstract class AsMethods extends QueryBase {
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
  as<T extends AsMethods, As extends string>(
    this: T,
    as: As,
  ): SetQueryTableAlias<T, As> {
    return this.clone()._as(as) as unknown as SetQueryTableAlias<T, As>;
  }
  _as<T extends AsMethods, As extends string>(
    this: T,
    as: As,
  ): SetQueryTableAlias<T, As> {
    this.query.as = as;
    return this as unknown as SetQueryTableAlias<T, As>;
  }
}
