import { Query } from '../query';
import { isExpression } from 'orchid-core';

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
        delete this.q.and;
        delete this.q.or;
      } else if (clear === 'counters') {
        if ('type' in this.q && this.q.type === 'update') {
          this.q.updateData = this.q.updateData.filter((item) => {
            if (!isExpression(item) && typeof item !== 'function') {
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
        delete (this.q as Record<string, unknown>)[clear];
      }
    });
    return this;
  }
}
