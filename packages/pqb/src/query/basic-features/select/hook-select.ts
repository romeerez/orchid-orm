import { Column } from '../../../columns/column';
import { HookPurpose } from '../../extra-features/hooks/hooks.sql';
import { IsQuery, Query } from '../../query';
import { QueryAfterHook } from '../../query-data';

export interface HasCteHooks {
  cteHooks?: CteHooks;
}

export interface CteHooks {
  hasSelect: boolean;
  tableHooks: CteTableHooks;
  ensureCount?: {
    [cteName: string]: number;
  };
}

export interface CteTableHooks {
  [K: string]: CteTableHook;
}

export interface CteTableHook {
  table: string;
  shape: Column.Shape.Data;
  tableHook: TableHook;
  throwOnNotFound?: boolean;
}

export interface TableHook {
  hookPurpose?: HookPurpose;
  select?: HookSelect;
  afterCreate?: QueryAfterHook[];
  afterUpdate?: QueryAfterHook[];
  afterSave?: QueryAfterHook[];
  afterDelete?: QueryAfterHook[];
  afterCreateCommit?: QueryAfterHook[];
  afterUpdateCommit?: QueryAfterHook[];
  afterSaveCommit?: QueryAfterHook[];
  afterDeleteCommit?: QueryAfterHook[];
}

export type HookSelect = Map<string, HookSelectValue>;

export interface HookSelectValue {
  select: string | { sql: string };
  as?: string;
  temp?: string;
  onAs?: ((as: string) => void)[];
}

export interface HasTableHook {
  tableHook?: TableHook;
}

export interface HasHookSelect {
  // additional columns to select for `after` hooks
  hookSelect?: HookSelect;
}

export const _addToHookSelect = (query: IsQuery, selects: string[]) => {
  const { q } = query as Query;
  const map: HookSelect = (q.hookSelect = new Map(q.hookSelect));
  for (const key of selects) {
    map.set(key, { select: key });
  }
};

export const _addToHookSelectWithTable = (
  query: IsQuery,
  selects: string[],
  table: string,
) => {
  const { q } = query as Query;
  const map: HookSelect = (q.hookSelect = new Map(q.hookSelect));
  for (const column of selects) {
    map.set(column, { select: `${table}.${column}` });
  }
};
