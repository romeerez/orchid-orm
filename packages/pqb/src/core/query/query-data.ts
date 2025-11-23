import { QueryDataAliases } from './query-aliases';
import { PickQueryDataParsers } from './query-column-parsers';
import { HasHookSelect } from './hook-select';
import { Column } from '../../columns/column';

export interface QueryDataBase
  extends QueryDataAliases,
    PickQueryDataParsers,
    HasHookSelect {
  shape: Column.QueryColumnsInit;
  select?: unknown;
}
