import { SetQueryTableAlias } from '../query/query';
import { _queryAs } from './as';
import { queryFrom } from './from';
import { WrapQuerySelf, WrapQueryArg } from './queryMethods';

export function queryWrap<
  T extends WrapQuerySelf,
  Q extends WrapQueryArg,
  As extends string = 't',
>(self: T, query: Q, as: As = 't' as As): SetQueryTableAlias<Q, As> {
  return _queryAs(
    queryFrom(query, [self]),
    as,
  ) as unknown as SetQueryTableAlias<Q, As>;
}
