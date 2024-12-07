import { TransactionAdapterBase } from './adapter';
import { OrchidOrmError } from './errors';
import { QueryLogObject } from './log';
import { MaybePromise } from './utils';

// Wrapper type for transactions.
export interface TransactionState {
  // Database adapter that is connected to a currently running transaction.
  adapter: TransactionAdapterBase;
  // Number of transaction nesting.
  // Top transaction has id = 0, transaction inside of transaction will have id = 1, and so on.
  transactionId: number;
  // Array of functions to call after commit.
  afterCommit?: AfterCommitHook[];
  // The last attached catchAfterCommitError handler.
  catchAfterCommitError?: AfterCommitErrorHandler;
  // To log all the queries inside a transaction.
  log?: QueryLogObject;
  // number of test transaction wrapping the current one
  testTransactionCount?: number;
}

/**
 * Check if inside transaction started by user (not test transaction).
 */
export function isInUserTransaction(trx: TransactionState): boolean {
  return (
    !trx.testTransactionCount || trx.transactionId >= trx.testTransactionCount
  );
}

/**
 * Element of `afterCommit` transaction array. See {@link TransactionState.afterCommit}.
 */
export type AfterCommitHook = () => MaybePromise<unknown>;

export type AfterCommitErrorHandler = (error: AfterCommitError) => void;

export interface AfterCommitErrorFulfilledResult
  extends PromiseFulfilledResult<unknown> {
  name?: string;
}

export interface AfterCommitErrorRejectedResult extends PromiseRejectedResult {
  name?: string;
}

export type AfterCommitErrorResult =
  | AfterCommitErrorFulfilledResult
  | AfterCommitErrorRejectedResult;

/**
 * `AfterCommitError` is thrown when one of after commit hooks throws.
 *
 * ```ts
 * interface AfterCommitError extends OrchidOrmError {
 *   // the result of transaction functions
 *   result: unknown;
 *
 *   // Promise.allSettled result + optional function names
 *   hookResults: (
 *     | {
 *         status: 'fulfilled';
 *         value: unknown;
 *         name?: string;
 *       }
 *     | {
 *         status: 'rejected';
 *         reason: any; // the error object thrown by a hook
 *         name?: string;
 *       }
 *   )[];
 * }
 * ```
 *
 * Use `function name() {}` function syntax for hooks to give them names,
 * so later they can be identified when handling after commit errors.
 *
 * ```ts
 * class SomeTable extends BaseTable {
 *   readonly table = 'someTable';
 *   columns = this.setColumns((t) => ({
 *     ...someColumns,
 *   }));
 *
 *   init(orm: typeof db) {
 *     // anonymous funciton - has no name
 *     this.afterCreateCommit([], async () => {
 *       // ...
 *     });
 *
 *     // named function
 *     this.afterCreateCommit([], function myHook() => {
 *       // ...
 *     });
 *   }
 * }
 * ```
 */
export class AfterCommitError extends OrchidOrmError {
  constructor(
    public result: unknown,
    public hookResults: AfterCommitErrorResult[],
  ) {
    super('After commit hooks have failed');
  }
}

export const handleAfterCommitError = (
  result: unknown,
  hookResults: AfterCommitErrorResult[],
  catchAfterCommitError?: AfterCommitErrorHandler,
) => {
  const err = new AfterCommitError(result, hookResults);
  if (catchAfterCommitError) {
    catchAfterCommitError(err);
  } else {
    throw err;
  }
};
