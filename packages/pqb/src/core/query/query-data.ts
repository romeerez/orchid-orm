import { QueryDataAliases } from './query-aliases';
import { QueryColumnsInit } from '../index';
import { PickQueryDataParsers } from './query-column-parsers';
import { HasHookSelect } from './hook-select';

export interface QueryDataBase
  extends QueryDataAliases,
    PickQueryDataParsers,
    HasHookSelect {
  shape: QueryColumnsInit;
  select?: unknown;
}
