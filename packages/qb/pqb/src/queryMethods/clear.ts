import { Query } from '../query/query';
import { isExpression, RecordUnknown } from 'orchid-core';

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
    const q = this.clone();
    clears.forEach((clear) => {
      if (clear === 'where') {
        delete q.q.and;
        delete q.q.or;
      } else if (clear === 'counters') {
        if ('type' in q.q && q.q.type === 'update') {
          q.q.updateData = q.q.updateData.filter((item) => {
            if (!isExpression(item) && typeof item !== 'function') {
              let removed = false;
              for (const key in item) {
                const value = item[key] as RecordUnknown;
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
        delete (q.q as never as RecordUnknown)[clear];
      }
    });
    return q;
  }
}
