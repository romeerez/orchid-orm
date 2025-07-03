import { Db, IsolationLevel, TransactionOptions } from 'pqb';
import { AfterCommitStandaloneHook } from 'orchid-core';

export function transaction<Result>(
  this: { $qb: Db },
  fn: () => Promise<Result>,
): Promise<Result>;
export function transaction<Result>(
  this: { $qb: Db },
  options: IsolationLevel | TransactionOptions,
  fn: () => Promise<Result>,
): Promise<Result>;
export function transaction<Result>(
  this: { $qb: Db },
  fnOrOptions: IsolationLevel | TransactionOptions | (() => Promise<Result>),
  fn?: () => Promise<Result>,
): Promise<Result> {
  return this.$qb.transaction(
    fnOrOptions as IsolationLevel,
    fn as () => Promise<Result>,
  );
}

export function ensureTransaction<Result>(
  this: { $qb: Db },
  cb: () => Promise<Result>,
): Promise<Result> {
  return this.$qb.ensureTransaction(cb);
}

export function isInTransaction(this: { $qb: Db }): boolean {
  return this.$qb.isInTransaction();
}

export function afterCommit(
  this: { $qb: Db },
  hook: AfterCommitStandaloneHook,
): void {
  this.$qb.afterCommit(hook);
}
