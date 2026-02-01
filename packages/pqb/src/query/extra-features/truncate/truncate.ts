import { Query, SetQueryReturnsVoid } from '../../query';
import { _queryExec } from '../../query.utils';
import { makeTruncateSql } from './truncate.sql';
import { _clone } from '../../basic-features/clone/clone';

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
  truncate<T>(
    this: T,
    options?: { restartIdentity?: boolean; cascade?: boolean },
  ): SetQueryReturnsVoid<T> {
    const query = Object.create(_clone(this)) as Query;

    query.toSQL = () => makeTruncateSql(query, options);

    return _queryExec(query) as never;
  }
}
