import { IsQuery, QueryBase } from './query';

import { Column } from '../../columns/column';

export interface HasCteHooks {
  cteHooks?: CteHooks;
}

export interface CteHooks {
  hasSelect: boolean;
  tableHooks: CteTableHooks;
}

export interface CteTableHooks {
  [K: string]: CteTableHook;
}

export interface CteTableHook {
  table: string;
  shape: Column.Shape.Data;
  tableHook: TableHook;
}

export interface TableHook {
  select?: HookSelect;
  // TODO: unify types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  after?: ((data: unknown, query: any) => unknown | Promise<unknown>)[];
  afterCommit?: ((
    data: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: any,
  ) => unknown | Promise<unknown>)[];
}

export type HookSelect = Map<string, HookSelectValue>;

export interface HookSelectValue {
  select: string | { sql: string };
  as?: string;
  temp?: string;
}

export interface HasTableHook {
  tableHook?: TableHook;
}

export interface HasHookSelect {
  // additional columns to select for `after` hooks
  hookSelect?: HookSelect;
}

export const _addToHookSelect = (query: IsQuery, selects: string[]) => {
  const map: HookSelect = ((query as QueryBase).q.hookSelect = new Map(
    (query as QueryBase).q.hookSelect,
  ));
  for (const key of selects) {
    map.set(key, { select: key });
  }
};

export const _addToHookSelectWithTable = (
  query: IsQuery,
  selects: string[],
  table: string,
) => {
  const map: HookSelect = ((query as QueryBase).q.hookSelect = new Map(
    (query as QueryBase).q.hookSelect,
  ));
  for (const column of selects) {
    map.set(column, { select: `${table}.${column}` });
  }
};
