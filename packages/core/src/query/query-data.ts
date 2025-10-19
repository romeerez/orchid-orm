import { QueryDataAliases } from './query-aliases';
import { QueryColumnsInit } from 'orchid-core';
import { PickQueryDataParsers } from './query-column-parsers';
import { HasHookSelect } from './hook-select';

export interface QueryDataBase
  extends QueryDataAliases,
    PickQueryDataParsers,
    HasHookSelect {
  shape: QueryColumnsInit;
  select?: unknown;
}
