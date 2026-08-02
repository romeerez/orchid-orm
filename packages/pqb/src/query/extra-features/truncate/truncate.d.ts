import { Query, SetQueryReturnsVoid } from '../../query';
export declare class QueryTruncate {
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
    truncate<T extends Query.Pick.IsNotReadOnly>(this: T, options?: {
        restartIdentity?: boolean;
        cascade?: boolean;
    }): SetQueryReturnsVoid<T>;
}
