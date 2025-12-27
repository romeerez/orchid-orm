import { _clone } from '../../basic-features/clone/clone';
import { PickQueryMeta } from '../../pick-query-types';
import { SetQueryReturnsVoidKind } from '../../query';
import { _queryExec } from '../../query.utils';

export class QueryTruncate {
  /**
   * Truncates the specified table.
   *
   * ```ts
   * // simply truncate
   * await db.table.truncate();
   *
   * // restart autoincrementing columns:
   * await db.table.truncate({ restartIdentity: true });
   *
   * // truncate also dependant tables:
   * await db.table.truncate({ cascade: true });
   * ```
   *
   * @param options - truncate options, may have `cascade: true` and `restartIdentity: true`
   */
  truncate<T extends PickQueryMeta>(
    this: T,
    options?: { restartIdentity?: boolean; cascade?: boolean },
  ): SetQueryReturnsVoidKind<T, 'truncate'> {
    const query = _clone(this);
    const { q } = query;
    q.type = 'truncate';
    if (options?.restartIdentity) {
      q.restartIdentity = true;
    }
    if (options?.cascade) {
      q.cascade = true;
    }
    return _queryExec(query) as never;
  }
}
