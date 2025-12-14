import { QueryBase } from './query';
import { Column } from '../../columns/column';

export interface QueryInternalColumnNameToKey {
  // cache `columnNameToKey` method that's available on table instances
  columnNameToKeyMap?: Map<string, string>;
}

/**
 * In snake case mode, or when columns have custom names,
 * use this method to exchange a db column name to its runtime key.
 */
export const queryColumnNameToKey = (
  q: QueryBase,
  name: string,
): string | undefined => {
  let map = q.internal.columnNameToKeyMap;
  if (!map) {
    q.internal.columnNameToKeyMap = map = new Map<string, string>();

    const { shape } = q;
    for (const key in q.shape) {
      const column = shape[key];
      map.set((column as Column.Pick.QueryInit).data.name ?? key, key);
    }
  }

  return map.get(name);
};
