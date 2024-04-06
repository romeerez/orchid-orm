import { _queryGetOptional } from './get.utils';
import { RawSQL } from '../sql/rawSql';
import {
  Query,
  queryTypeWithLimitOne,
  SetQueryReturnsColumnOptional,
} from '../query/query';
import { SelectQueryData } from '../sql';
import { QueryColumn } from 'orchid-core';
import { cloneQueryBaseUnscoped, queryWrap } from './queryMethods.utils';

export function queryJson<T>(
  self: T,
  coalesce?: boolean,
): SetQueryReturnsColumnOptional<T, QueryColumn<string>> {
  const q = queryWrap(
    self as Query,
    cloneQueryBaseUnscoped(self as Query),
  ) as unknown as Query;
  // json_agg is used instead of jsonb_agg because it is 2x faster, according to my benchmarks
  _queryGetOptional(
    q,
    new RawSQL(
      queryTypeWithLimitOne[(self as Query).q.returnType]
        ? `row_to_json("t".*)`
        : coalesce !== false
        ? `COALESCE(json_agg(row_to_json("t".*)), '[]')`
        : 'json_agg(row_to_json("t".*))',
    ),
  );

  // to skip LIMIT 1
  (q.q as SelectQueryData).returnsOne = true;

  return q as never;
}
