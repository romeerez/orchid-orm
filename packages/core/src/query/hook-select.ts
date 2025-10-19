import { IsQuery, QueryBase } from './query';

export type HookSelect = Map<string, HookSelectValue>;

export interface HookSelectValue {
  select: string | { sql: string };
  as?: string;
  temp?: string;
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
