import { Query } from '../query';
import { removeFromQuery } from '../queryDataUtils';
import { isRaw } from '../common';

export type ClearStatement =
  | 'with'
  | 'select'
  | 'where'
  | 'union'
  | 'using'
  | 'join'
  | 'group'
  | 'order'
  | 'having'
  | 'limit'
  | 'offset'
  | 'counters';

export class Clear {
  clear<T extends Query>(this: T, ...clears: ClearStatement[]): T {
    return this.clone()._clear(...clears);
  }

  _clear<T extends Query>(this: T, ...clears: ClearStatement[]): T {
    clears.forEach((clear) => {
      if (clear === 'where') {
        removeFromQuery(this, 'and');
        removeFromQuery(this, 'or');
      } else if (clear === 'counters') {
        if ('type' in this.query && this.query.type === 'update') {
          this.query.data = this.query.data.filter((item) => {
            if (!isRaw(item)) {
              let removed = false;
              for (const key in item) {
                const value = item[key] as Record<string, unknown>;
                if (
                  typeof value === 'object' &&
                  (value.op === '+' || value.op === '-')
                ) {
                  delete item[key];
                  removed = true;
                }
              }
              if (removed && !Object.keys(item).length) {
                return false;
              }
            }

            return true;
          });
        }
      } else {
        removeFromQuery(this, clear);
      }
    });
    return this;
  }
}
