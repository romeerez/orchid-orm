import { Query, SetQueryTableAlias } from '../query/query';

export type AsQueryArg = Pick<
  Query,
  'table' | 'meta' | 'q' | 'clone' | 'baseQuery' | 'shape'
>;

export const _queryAs = <T extends AsQueryArg, As extends string>(
  self: T,
  as: As,
): SetQueryTableAlias<T, As> => {
  self.q.as = as;
  return self as SetQueryTableAlias<T, As>;
};

export abstract class AsMethods {
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
    return _queryAs(this.clone(), as);
  }
}
