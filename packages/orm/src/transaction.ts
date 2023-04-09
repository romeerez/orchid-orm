import { Db, IsolationLevel, TransactionOptions } from 'pqb';

export function transaction<T extends { $queryBuilder: Db }, Result>(
  this: T,
  fn: () => Promise<Result>,
): Promise<Result>;
export function transaction<T extends { $queryBuilder: Db }, Result>(
  this: T,
  options: IsolationLevel | TransactionOptions,
  fn: () => Promise<Result>,
): Promise<Result>;
export function transaction<T extends { $queryBuilder: Db }, Result>(
  this: T,
  fnOrOptions: IsolationLevel | TransactionOptions | (() => Promise<Result>),
  fn?: () => Promise<Result>,
): Promise<Result> {
  return this.$queryBuilder.transaction(
    fnOrOptions as IsolationLevel,
    fn as () => Promise<Result>,
  );
}
