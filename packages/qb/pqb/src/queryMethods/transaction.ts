import { PickQueryQAndInternal, Query } from '../query/query';
import {
  AfterCommitHook,
  AfterCommitStandaloneHook,
  emptyArray,
  emptyObject,
  SingleSqlItem,
  TransactionAdapterBase,
  TransactionAfterCommitHook,
  TransactionState,
} from 'orchid-core';
import { logParamToLogObject } from './log';
import { OrchidOrmError } from 'orchid-core';

export const commitSql: SingleSqlItem = {
  text: 'COMMIT',
};

export const rollbackSql: SingleSqlItem = {
  text: 'ROLLBACK',
};

export type IsolationLevel =
  | 'SERIALIZABLE'
  | 'REPEATABLE READ'
  | 'READ COMMITTED'
  | 'READ UNCOMMITTED';

export interface TransactionOptions {
  level?: IsolationLevel;
  readOnly?: boolean;
  deferrable?: boolean;
  log?: boolean;
}

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

export type AfterCommitErrorHandler = (
  error: AfterCommitError,
) => void | Promise<void>;

export const _runAfterCommitHooks = async (
  result: unknown,
  promises: unknown[],
  getHookNames: () => string[],
  catchAfterCommitErrors: AfterCommitErrorHandler[] | undefined,
) => {
  const hookResults = await Promise.allSettled(promises);
  if (hookResults.some((result) => result.status === 'rejected')) {
    const hookNames = getHookNames();

    for (const [i, r] of hookResults.entries()) {
      (r as AfterCommitErrorResult).name = hookNames[i];
    }

    const err = new AfterCommitError(result, hookResults);
    if (!catchAfterCommitErrors) throw err;

    for (const fn of catchAfterCommitErrors) {
      try {
        fn(err);
      } catch {}
    }
  }
};

/**
 * Check if inside transaction started by user (not test transaction).
 */
export const isInUserTransaction = (
  trx: TransactionState | undefined,
): trx is TransactionState =>
  !!(
    trx &&
    // when inside test transactions, compare transaction counts to ensure there is a user transaction.
    (!trx.testTransactionCount || trx.transactionId >= trx.testTransactionCount)
  );

export class Transaction {
  /**
   * In Orchid ORM the method is `$transaction`, when using `pqb` on its own it is `transaction`.
   *
   * `COMMIT` happens automatically after the callback was successfully resolved, and `ROLLBACK` is done automatically if the callback fails.
   *
   * Let's consider the case of transferring money from one user to another:
   *
   * ```ts
   * export const transferMoney = async (
   *   fromId: number,
   *   toId: number,
   *   amount: number,
   * ) => {
   *   try {
   *     // db.$transaction returns data that is returned from the callback
   *     // result here is senderRemainder
   *     const result = await db.$transaction(async () => {
   *       const sender = await db.user.find(fromId);
   *       const senderRemainder = sender.balance - amount;
   *       if (senderRemainder < 0) {
   *         throw new Error('Sender does not have enough money');
   *       }
   *
   *       await db.user.find(fromId).decrement({
   *         balance: amount,
   *       });
   *       await db.user.find(toId).increment({
   *         balance: amount,
   *       });
   *
   *       return senderRemainder;
   *     });
   *   } catch (error) {
   *     // handle transaction error
   *   }
   * };
   * ```
   *
   * It performs 3 queries in a single transaction: load sender record, decrement sender's balance, increment receiver's balance.
   *
   * If sender or receiver record doesn't exist, it will throw `NotFound` error, and there is an error thrown when sender's balance is too low.
   * In such case, the transaction will be rolled back and no changes will be applied to the database.
   *
   * Internally, ORM relies on [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage) feature of node.js,
   * it allows passing the transaction object implicitly. So that any query that is done inside of callback, will run inside a transaction.
   *
   * ## nested transactions
   *
   * Transactions can be nested one in another.
   * The top level transaction is the real one,
   * and the nested ones are emulated with [savepoint](https://www.postgresql.org/docs/current/sql-savepoint.html) instead of `BEGIN`
   * and [release savepoint](https://www.postgresql.org/docs/current/sql-release-savepoint.html) instead of `COMMIT`.
   *
   * Use [ensureTransaction](#ensuretransaction) to run all queries in a single transaction.
   *
   * ```ts
   * const result = await db.$transaction(async () => {
   *   await db.table.create(...one);
   *
   *   const result = await db.$transaction(async () => {
   *     await db.table.create(...two);
   *     return 123;
   *   });
   *
   *   await db.table.create(...three);
   *
   *   return result;
   * });
   *
   * // result is returned from the inner transaction
   * result === 123;
   * ```
   *
   * If the inner transaction throws an error, and it is caught by `try/catch` of outer transaction,
   * it performs [rollback to savepoint](https://www.postgresql.org/docs/current/sql-rollback-to.html)
   * and the outer transaction can continue:
   *
   * ```ts
   * class CustomError extends Error {}
   *
   * await db.$transaction(async () => {
   *   try {
   *     await db.$transaction(async () => {
   *       throw new CustomError();
   *     });
   *   } catch (err) {
   *     if (err instanceof CustomError) {
   *       // ignore this error
   *       return;
   *     }
   *     throw err;
   *   }
   *
   *   // this transaction can continue
   *   await db.table.create(...data);
   * });
   * ```
   *
   * If the error in the inner transaction is not caught, all nested transactions are rolled back and aborted.
   */
  transaction<Result>(
    this: PickQueryQAndInternal,
    cb: () => Promise<Result>,
  ): Promise<Result>;
  transaction<Result>(
    this: PickQueryQAndInternal,
    options: IsolationLevel | TransactionOptions,
    cb: () => Promise<Result>,
  ): Promise<Result>;
  async transaction<Result>(
    this: PickQueryQAndInternal,
    cbOrOptions: IsolationLevel | TransactionOptions | (() => Promise<Result>),
    cb?: () => Promise<Result>,
  ): Promise<Result> {
    let options: TransactionOptions;
    let fn: () => Promise<Result>;
    if (typeof cbOrOptions === 'function') {
      options = emptyObject as TransactionOptions;
      fn = cbOrOptions;
    } else {
      options =
        typeof cbOrOptions === 'object' ? cbOrOptions : { level: cbOrOptions };
      fn = cb as () => Promise<Result>;
    }

    const sql = {
      values: emptyArray,
    } as unknown as SingleSqlItem;

    const log =
      options.log !== undefined
        ? this.q.log ?? logParamToLogObject(this.q.logger, options.log)
        : this.q.log;

    let logData: unknown | undefined;

    let trx = this.internal.transactionStorage.getStore();
    const transactionId = trx ? trx.transactionId + 1 : 0;

    const callback = (adapter: TransactionAdapterBase) => {
      if (log) log.afterQuery(sql, logData);
      if (log) logData = log.beforeQuery(commitSql);

      if (trx) {
        trx.transactionId = transactionId;
        return fn();
      }

      trx = {
        adapter,
        transactionId,
      };

      if (options.log !== undefined) {
        trx.log = log;
      }

      return this.internal.transactionStorage.run(trx, fn);
    };

    if (!trx) {
      sql.text = `BEGIN${
        options.level ? ` ISOLATION LEVEL ${options.level}` : ''
      }${
        options.readOnly !== undefined
          ? ` READ ${options.readOnly ? 'ONLY' : 'WRITE'}`
          : ''
      }${
        options.deferrable !== undefined
          ? ` ${options.deferrable ? '' : 'NOT '}DEFERRABLE`
          : ''
      }`;
      if (log) logData = log.beforeQuery(sql);

      const result = await this.q.adapter
        .transaction(sql, callback)
        .catch((err) => {
          if (log) log.afterQuery(rollbackSql, logData);

          throw err;
        });

      if (log) log.afterQuery(commitSql, logData);

      // trx was defined in the callback above;
      runAfterCommit((trx as unknown as TransactionState).afterCommit, result);

      return result;
    } else {
      try {
        sql.text = `SAVEPOINT "${transactionId}"`;
        if (log) logData = log.beforeQuery(sql);

        const { adapter } = trx;
        await adapter.query(sql);

        let result;
        try {
          result = await callback(adapter);
        } catch (err) {
          sql.text = `ROLLBACK TO SAVEPOINT "${transactionId}"`;
          if (log) logData = log.beforeQuery(sql);
          await adapter.query(sql);
          if (log) log.afterQuery(sql, logData);
          throw err;
        }

        sql.text = `RELEASE SAVEPOINT "${transactionId}"`;
        if (log) logData = log.beforeQuery(sql);
        await adapter.query(sql);
        if (log) log.afterQuery(sql, logData);

        // transactionId is trx.testTransactionCount when only the test transactions are left,
        // and it's time to execute after commit hooks, because they won't be executed for test transactions.
        if (transactionId === trx.testTransactionCount) {
          const { afterCommit } = trx as unknown as TransactionState;
          (trx as unknown as TransactionState).afterCommit = undefined;
          runAfterCommit(afterCommit, result);
        }

        return result;
      } finally {
        trx.transactionId = transactionId - 1;
      }
    }
  }

  /**
   * Use the `$ensureTransaction` when you want to ensure the sequence of queries is running in a transaction, but there is no need for Postgres [savepoints](https://www.postgresql.org/docs/current/sql-savepoint.html).
   *
   * ```ts
   * async function updateUserBalance(userId: string, amount: number) {
   *   await db.$ensureTransaction(async () => {
   *     await db.transfer.create({ userId, amount })
   *     await db.user.find(userId).increment({ balance: amount })
   *   })
   * }
   *
   * async function saveDeposit(userId: string, deposit: { ... }) {
   *   await db.$ensureTransaction(async () => {
   *     await db.deposit.create(deposit)
   *     // transaction in updateUserBalance won't be started
   *     await updateUserBalance(userId, deposit.amount)
   *   })
   * }
   * ```
   */
  ensureTransaction<Result>(
    this: PickQueryQAndInternal,
    cb: () => Promise<Result>,
  ): Promise<Result> {
    const trx = this.internal.transactionStorage.getStore();
    if (trx) return cb();

    return (
      Transaction.prototype.transaction as (cb: unknown) => Promise<Result>
    ).call(this, cb) as Promise<Result>;
  }

  isInTransaction(): boolean {
    const trx = (
      this as unknown as Query
    ).internal.transactionStorage.getStore();

    return isInUserTransaction(trx);
  }

  /**
   * Schedules a hook to run after the outermost transaction commits:
   *
   * ```ts
   * await db.$transaction(async () => {
   *   await db.table.create(data)
   *   await db.table.where({ ...conditions }).update({ key: 'value' })
   *
   *   db.$afterCommit(() => { // can be sync or async
   *     console.log('after commit')
   *   })
   * })
   * ```
   *
   * If used outside the transaction, the hook will be executed almost immediately, on the next microtask:
   *
   * ```ts
   * db.$afterCommit(async () => { // can be sync or async
   *   console.log('after commit')
   * })
   * ```
   *
   * If the callback has no `try/catch` and throws an error,
   * this will cause `uncaughtException` if the callback is sync and `unhandledRejection` if it is async.
   */
  afterCommit(this: Query, hook: AfterCommitStandaloneHook): void {
    const trx = this.internal.transactionStorage.getStore();
    if (isInUserTransaction(trx)) {
      (trx.afterCommit ??= []).push(hook);
    } else {
      queueMicrotask(hook);
    }
  }
}

// `afterCommit` hooks are detached from the main flow, this function won't throw.
const runAfterCommit = (
  afterCommit: TransactionAfterCommitHook[] | undefined,
  result: unknown,
) => {
  // to suppress throws of sync afterCommit hooks.
  queueMicrotask(async () => {
    if (afterCommit) {
      const promises = [];

      let catchAfterCommitErrors: AfterCommitErrorHandler[] | undefined;
      for (let i = 0, len = afterCommit.length; i < len; ) {
        const first = afterCommit[i];
        if (typeof first === 'function') {
          try {
            promises.push(first());
          } catch (err) {
            promises.push(Promise.reject(err));
          }
          i++;
        } else {
          const q = afterCommit[i + 1] as Query;
          if (q.q.catchAfterCommitErrors) {
            (catchAfterCommitErrors ??= []).push(...q.q.catchAfterCommitErrors);
          }

          for (const fn of afterCommit[i + 2] as AfterCommitHook[]) {
            try {
              promises.push(fn(first as unknown[], q));
            } catch (err) {
              promises.push(Promise.reject(err));
            }
          }
          i += 3;
        }
      }

      const getHookNames = () => {
        const hookNames = [];
        for (let i = 0, len = afterCommit.length; i < len; ) {
          const first = afterCommit[i];
          if (typeof first === 'function') {
            hookNames.push(first.name);
            i++;
          } else {
            for (const fn of afterCommit[i + 2] as AfterCommitHook[]) {
              hookNames.push(fn.name);
            }
            i += 3;
          }
        }
        return hookNames;
      };

      await _runAfterCommitHooks(
        result,
        promises,
        getHookNames,
        catchAfterCommitErrors,
      );
    }
  });
};
