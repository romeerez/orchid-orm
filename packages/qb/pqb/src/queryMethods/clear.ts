import { Query } from '../query';
import { isRaw } from '../../../common/src/raw';

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
        delete this.query.and;
        delete this.query.or;
      } else if (clear === 'counters') {
        if ('type' in this.query && this.query.type === 'update') {
          this.query.updateData = this.query.updateData.filter((item) => {
            if (!isRaw(item) && typeof item !== 'function') {
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
        delete (this.query as Record<string, unknown>)[clear];
      }
    });
    return this;
  }
}
