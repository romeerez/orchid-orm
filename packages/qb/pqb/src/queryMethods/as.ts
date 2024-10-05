import {
  PickQueryMetaTableShape,
  Query,
  SetQueryTableAlias,
} from '../query/query';
import { RecordString } from 'orchid-core';
import { _clone } from '../query/queryUtils';

export type AsQueryArg = PickQueryMetaTableShape;

export const _queryAs = <T extends AsQueryArg, As extends string>(
  self: T,
  as: As,
): SetQueryTableAlias<T, As> => {
  const { q } = self as unknown as Query;
  q.as = as;
  q.aliases = {
    ...q.aliases!,
    [as]: q.aliases ? _queryResolveAlias(q.aliases, as) : as,
  };

  return self as SetQueryTableAlias<T, As>;
};

export const _queryResolveAlias = (
  aliases: RecordString,
  as: string,
): string => {
  if (!aliases[as]) return as;

  let suffix = 2;
  let privateAs;
  while (aliases[(privateAs = as + suffix)]) {
    suffix++;
  }

  return privateAs;
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
    return _queryAs(_clone(this), as) as never;
  }
}
