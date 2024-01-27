import { WrapQuerySelf, WrapQueryArg } from './queryMethods';
import { _queryGetOptional } from './get.utils';
import { RawSQL } from '../sql/rawSql';
import {
  queryTypeWithLimitOne,
  SetQueryReturnsColumnOptional,
} from '../query/query';
import { SelectQueryData } from '../sql';
import { QueryColumn } from 'orchid-core';
import { queryWrap } from './queryMethods.utils';

export function queryJson<T extends WrapQueryArg & WrapQuerySelf>(
  self: T,
  coalesce?: boolean,
) {
  const q = queryWrap(self, self.baseQuery.clone()) as unknown as T;
  // json_agg is used instead of jsonb_agg because it is 2x faster, according to my benchmarks
  _queryGetOptional(
    q,
    new RawSQL(
      queryTypeWithLimitOne[self.q.returnType]
        ? `row_to_json("t".*)`
        : coalesce !== false
        ? `COALESCE(json_agg(row_to_json("t".*)), '[]')`
        : 'json_agg(row_to_json("t".*))',
    ),
  );

  // to skip LIMIT 1
  (q.q as SelectQueryData).returnsOne = true;

  return q as unknown as SetQueryReturnsColumnOptional<T, QueryColumn<string>>;
}
