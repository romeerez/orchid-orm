import { _clone } from '../clone/clone';
import { IsQuery, IsSubQuery } from '../../query';

interface SubQueryReturningSingle extends IsSubQuery {
  returnType: 'one' | 'oneOrThrow';
}

export class QueryLimitOffset {
  /**
   * Adds a limit clause to the query.
   *
   * ```ts
   * db.table.limit(10);
   * ```
   *
   * @param arg - limit number
   */
  limit<T>(
    this: T,
    arg: T extends SubQueryReturningSingle
      ? 'Cannot apply limit on the query returning a single record'
      : number | undefined,
  ): T {
    const q = _clone(this);
    q.q.limit = arg as number;
    return q as T;
  }

  /**
   * Adds an offset clause to the query.
   *
   * ```ts
   * db.table.offset(10);
   * ```
   *
   * @param arg - offset number
   */
  offset<T extends IsQuery>(this: T, arg: number | undefined): T {
    const q = _clone(this);
    q.q.offset = arg;
    return q as never;
  }
}
