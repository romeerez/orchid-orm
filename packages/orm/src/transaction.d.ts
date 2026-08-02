import { IsolationLevel, TransactionOptions, AfterCommitStandaloneHook } from 'pqb/internal';
import { Db } from 'pqb';
export declare function transaction<Result>(this: {
    $qb: Db;
}, fn: () => Promise<Result>): Promise<Result>;
export declare function transaction<Result>(this: {
    $qb: Db;
}, options: IsolationLevel | TransactionOptions, fn: () => Promise<Result>): Promise<Result>;
export declare function ensureTransaction<Result>(this: {
    $qb: Db;
}, cb: () => Promise<Result>): Promise<Result>;
export declare function isInTransaction(this: {
    $qb: Db;
}): boolean;
export declare function afterCommit(this: {
    $qb: Db;
}, hook: AfterCommitStandaloneHook): void;
