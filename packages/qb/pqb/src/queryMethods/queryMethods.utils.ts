import { SetQueryTableAlias } from '../query/query';
import { _queryAs } from './as';
import { queryFrom } from './from';
import { WrapQueryArg } from './queryMethods';
import { PickQueryTableMetaResult } from 'orchid-core';

export function queryWrap<
  T extends PickQueryTableMetaResult,
  Q extends WrapQueryArg,
  As extends string = 't',
>(self: T, query: Q, as: As = 't' as As): SetQueryTableAlias<Q, As> {
  return _queryAs(queryFrom(query, [self]), as) as never;
}
