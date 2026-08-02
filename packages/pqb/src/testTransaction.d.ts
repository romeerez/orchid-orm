import { Query } from './query/query';
type Arg = {
    $qb: Query;
} | Query;
export declare const testTransaction: {
    /**
     * Start a test transaction.
     * The returned promise is resolved immediately when transaction starts, not waiting for it to end.
     *
     * @param arg - ORM instance or a queryable instance (such as db.someTable).
     */
    start(arg: Arg): Promise<void>;
    /**
     * Rollback a test transaction.
     *
     * @param arg - the same ORM or query argument passed into the `testTransaction.start`.
     */
    rollback(arg: Arg): Promise<void> | undefined;
    /**
     * Will roll back the current `testTransaction` (won't have any effect if it was rolled back already),
     * and if there's no nested test transactions left, it will close the db connection.
     *
     * @param arg - the same ORM or query argument passed into the `testTransaction.start`.
     */
    close(arg: Arg): Promise<void>;
};
export {};
