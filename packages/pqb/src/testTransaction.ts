import { Query } from './query/query';
import { OrchidOrmError, QueryError } from './query/errors';
import { AsyncState } from './query/basic-features/storage/storage';
import { noop } from './utils';

// The `Rollback` is not an error,
// but a command to throw by `rollback` function,
// and catch it immediately by the transaction to handle the rollback.
export class Rollback extends Error {}

/**
 * Error of a test transaction rolled back together with inner test transactions that were still open,
 * of an inner test transaction rolled back that way,
 * and of `start` of test transaction hooks called again before the previous `start` was rolled back.
 */
export class TestTransactionError extends OrchidOrmError {}

/**
 * Test transaction started by `testTransaction.start`.
 */
export interface TestTransaction {
  /**
   * Roll back this test transaction.
   * Open test transactions started inside it are rolled back as well, and then it rejects with a `TestTransactionError`.
   * Called again, it returns the rollback in progress, or does nothing once that rollback has ended.
   * After this test transaction is rolled back together with an outer one, it rejects with a `TestTransactionError`.
   */
  rollback(): Promise<void>;
  /**
   * Roll back this test transaction, and close the database connection when no test transaction is left open.
   */
  close(): Promise<void>;
}

/**
 * Functions for a pair of test hooks returned by `testTransaction.hooks`.
 * Each `start` is followed by one `rollback` or `close`, and they do nothing without a `start` to end.
 */
export interface TestTransactionHooks {
  /**
   * Start a test transaction and run the `setup` inside it.
   * It rejects with a `TestTransactionError` when the previous `start` wasn't followed by `rollback` or `close`.
   */
  start(): Promise<void>;
  /**
   * Roll back the test transaction of the latest `start` of these hooks.
   * It cancels that `start` if its transaction hasn't started yet, and waits for the `setup` to finish.
   * It rejects with an error of the `start` or the `setup`, other than the cancellation of the `start` by this call.
   */
  rollback(): Promise<void>;
  /**
   * Roll back as `rollback` does, and close the database connection when no test transaction is left open.
   */
  close(): Promise<void>;
}

// The latest `start` of test transaction hooks.
interface HooksAttempt {
  abort: AbortController;
  transaction?: TestTransaction;
  // the start and the setup
  done: Promise<void>;
  // the outcome of `done`, set as soon as it settles
  ended?: PromiseSettledResult<void>;
}

// `testTransaction` will store its state under this unique key in the `db.internal`.
const trxForTest: unique symbol = Symbol('trxForTest');

// The state of test transactions of one instance, stored in the `db.internal`.
interface TestTransactions {
  // records of `start` calls, the innermost last, including failed and starting ones.
  levels: TestTransactionLevel[];
  // `start`, `rollback`, and `close` run one at a time in the call order, chained on this promise.
  queue: Promise<void>;
  // count of started transactions whose lifecycle hasn't ended, whether or not they are still in `levels`.
  live: number;
}

// Type to store transaction data on `db.internal`.
interface Internal {
  [trxForTest]?: TestTransactions;
}

// Argument of the transaction, $qb is to use ORM instance, Query to use any other queryable instance.
type Arg = { $qb: Query } | Query;

// Get queryable instance from the transaction argument.
const argToDb = (arg: Arg): Query => ('$qb' in arg ? arg.$qb : arg);

// A record of a `start` call, it is also the handle returned by `start`.
class TestTransactionLevel implements TestTransaction {
  started?: Promise<TestTransaction>;
  // set when the start is cancelled before its transaction started, `start` rejects with the reason.
  cancelled?: { reason: unknown };
  // `BEGIN` or `SAVEPOINT` failed, or the start was cancelled: there is no transaction to roll back.
  failed?: boolean;
  // set when the transaction starts, ends it: `Rollback` won't leak outside, other errors will be brought back to the caller.
  end?: (err: unknown) => void;
  // promise of the full transaction lifecycle, settles after the rollback and the restoration of the state.
  lifecycle?: Promise<void>;
  // the rollback of this level: by its own `rollback` or by the paired `testTransaction.rollback`, resolved once it has ended,
  // or by an outer level.
  rolledBack?: Promise<void>;
  // the level is rolled back together with an outer level.
  byOuter?: boolean;

  constructor(
    private db: Query,
    private trx: TestTransactions,
  ) {}

  rollback(): Promise<void> {
    if (this.byOuter) {
      return this.rolledBack!.then(() => {
        throw new TestTransactionError(
          'Test transaction was rolled back together with an outer test transaction',
        );
      });
    }

    return (
      this.rolledBack ?? setRollback(this, rollbackWithInner(this.trx, this))
    );
  }

  close(): Promise<void> {
    return closeAfter(this.db, this.trx, this.rollback());
  }
}

// Wrap a driver error into a `QueryError`, as for a failed query.
const toQueryError = (db: Query, err: unknown) => {
  const { adapter } = db.q;
  if (!(err instanceof adapter.errorClass)) return err;

  const error = new (db.error as unknown as new () => QueryError)();
  adapter.assignError(error, err);
  error.cause = err;
  return error;
};

// Run the operation after the previous operation of the instance has settled, whether it succeeded or failed.
const enqueue = <T>(trx: TestTransactions, op: () => Promise<T>) => {
  const result = trx.queue.then(op);
  trx.queue = result.then(noop, noop);
  return result;
};

// Start the transaction of the level in its turn of the queue, resolves once it started.
const begin = (
  db: Query,
  trx: TestTransactions,
  level: TestTransactionLevel,
): Promise<TestTransaction> => {
  if (level.cancelled) {
    level.failed = true;
    return Promise.reject(level.cancelled.reason);
  }

  const { asyncStorage } = db.internal;
  const { adapter } = db.baseQuery.q;
  return new Promise((resolve, reject) => {
    let state: AsyncState | undefined;
    let fallback: AsyncState | undefined;
    // adapter methods replaced by the outermost level, to restore when it ends
    let adapterMethods:
      | Pick<typeof adapter, 'query' | 'arrays' | 'transaction'>
      | undefined;
    level.lifecycle = db
      .transaction(() => {
        if (level.cancelled) throw new Rollback();

        const ended = new Promise<void>((_, end) => {
          level.end = end;
        });

        state = asyncStorage.getStore();
        fallback = asyncStorage.fallback;
        asyncStorage.fallback = state;
        const t = state?.transactionAdapter;
        if (state && t) {
          // routes queries of other instances that share the adapter, nested levels use the same `t`
          if (!fallback) {
            adapterMethods = {
              query: adapter.query,
              arrays: adapter.arrays,
              transaction: adapter.transaction,
            };
            adapter.query = t.query.bind(t);
            adapter.arrays = t.arrays.bind(t);
            adapter.transaction = t.transaction.bind(t);
          }

          state.testTransactionCount = state.testTransactionCount
            ? state.testTransactionCount + 1
            : 1;
        }

        trx.live++;
        resolve(level);
        return ended;
      })
      .catch((err) => {
        if (!(err instanceof Rollback)) throw toQueryError(db, err);
      })
      .finally(() => {
        if (!level.end) return;

        if (state?.testTransactionCount) {
          state.testTransactionCount--;
        }

        asyncStorage.fallback = fallback;
        if (adapterMethods) Object.assign(adapter, adapterMethods);
        trx.live--;
      });

    // rejects `start` when the transaction failed to start or was cancelled, has no effect once it has started
    const fail = (err: unknown) => {
      if (level.end) return;

      level.failed = true;
      reject(err);
    };
    level.lifecycle.then(() => fail(level.cancelled?.reason), fail);
  });
};

// Set the rollback of the level: repeated calls get it while it is in progress, and do nothing after it has ended.
const setRollback = (level: TestTransactionLevel, rollback: Promise<void>) => {
  level.rolledBack = rollback;
  const ended = () => {
    level.rolledBack = Promise.resolve();
  };
  rollback.then(ended, ended);
  return rollback;
};

// Cancel a start that hasn't started its transaction, settles once that start settles.
const cancel = (level: TestTransactionLevel, reason: unknown) => {
  level.cancelled ??= { reason };
  const cancelled = level.cancelled;
  return level.started!.then(noop, (err) => {
    if (err !== cancelled.reason) throw err;
  });
};

// Take the level and the levels started inside it off the stack,
// and roll them back in one turn of the queue, the innermost first.
const rollbackWithInner = (
  trx: TestTransactions,
  level: TestTransactionLevel,
): Promise<void> => {
  const levels = trx.levels.splice(trx.levels.indexOf(level)).reverse();

  const rollback = enqueue(trx, async () => {
    let open = 0;
    let failure: { error: unknown } | undefined;
    for (const item of levels) {
      // a failed start has no transaction
      if (!item.end) continue;

      if (item !== level) open++;
      item.end(new Rollback());
      await item.lifecycle!.catch((error) => {
        failure ??= { error };
      });
    }

    if (failure) throw failure.error;

    if (open) {
      throw new TestTransactionError(
        open === 1
          ? 'Test transaction had an inner test transaction still open, it was rolled back as well'
          : `Test transaction had ${open} inner test transactions still open, they were rolled back as well`,
      );
    }
  });

  const rolledBack = rollback.then(noop, noop);
  for (const inner of levels) {
    if (inner === level) continue;

    inner.byOuter = true;
    inner.rolledBack = rolledBack;
  }

  return rollback;
};

// Close the database connection in the next turn of the queue, after the rollback,
// when no test transaction is left open.
const closeAfter = (
  db: Query,
  trx: TestTransactions,
  rollback: Promise<void>,
) => {
  const rolledBack = Promise.allSettled([rollback]);

  return enqueue(trx, async () => {
    const [result] = await rolledBack;
    if (!trx.live) {
      const closing = db.q.adapter.close();
      if (result.status === 'fulfilled') return closing;

      await closing.catch(noop);
    }

    if (result.status === 'rejected') throw result.reason;
  });
};

// Methods of a test transaction.
export const testTransaction = {
  /**
   * Start a test transaction.
   * The returned promise is resolved with the test transaction as soon as it starts, not waiting for it to end.
   * It is rejected when `rollback` is called before the transaction started.
   *
   * `start`, `rollback`, and `close` of one instance run one at a time in the call order.
   *
   * @param arg - ORM instance or a queryable instance (such as db.someTable).
   * @param options - `signal`: aborting it before the transaction started cancels the start, and it rejects with the signal's reason.
   */
  start(
    arg: Arg,
    options?: { signal?: AbortSignal },
  ): Promise<TestTransaction> {
    const db = argToDb(arg);
    const trx = ((db.internal as unknown as Internal)[trxForTest] ??= {
      levels: [],
      queue: Promise.resolve(),
      live: 0,
    });
    const level = new TestTransactionLevel(db, trx);
    // added even when the transaction fails to start, to be removed by the `rollback` paired with this `start`
    trx.levels.push(level);

    const started = enqueue(trx, () => begin(db, trx, level));

    const signal = options?.signal;
    if (!signal) return (level.started = started);

    const abort = () => {
      if (!level.end) level.cancelled ??= { reason: signal.reason };
    };
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort);

    return (level.started = started.finally(() =>
      signal.removeEventListener('abort', abort),
    ));
  },

  /**
   * Rollback the test transaction of the latest `start`.
   * After a failed `start`, it only discards that `start`.
   * Called before the transaction of `start` started, it cancels that `start`, which rejects.
   *
   * @param arg - the same ORM or query argument passed into the `testTransaction.start`.
   */
  rollback(arg: Arg): Promise<void> {
    const db = argToDb(arg);
    const trx = (db.internal as unknown as Internal)[trxForTest];
    const level = trx?.levels.pop();
    if (!level || level.failed) return Promise.resolve();

    if (!level.end) {
      return cancel(
        level,
        new Error('The test transaction was rolled back before it started'),
      );
    }

    return setRollback(
      level,
      enqueue(trx!, () => {
        level.end!(new Rollback());
        return level.lifecycle!;
      }),
    );
  },

  /**
   * Will roll back the test transaction of the latest `start` (won't have any effect if it was rolled back already),
   * and if there's no test transactions left open, it will close the db connection.
   *
   * @param arg - the same ORM or query argument passed into the `testTransaction.start`.
   */
  close(arg: Arg): Promise<void> {
    const db = argToDb(arg);
    const trx = (db.internal as unknown as Internal)[trxForTest];
    if (!trx) return Promise.resolve();

    return closeAfter(db, trx, testTransaction.rollback(db));
  },

  /**
   * Create functions for test hooks: `start` for `beforeAll` or `beforeEach`, `rollback` or `close` for `afterEach` or `afterAll`.
   * `rollback` and `close` end the test transaction of their own `start`, also when a hook outlives its timeout.
   *
   * @param arg - ORM instance or a queryable instance (such as db.someTable).
   * @param options - `setup`: runs inside the started test transaction, `rollback` and `close` wait for it to finish.
   */
  hooks(arg: Arg, options?: { setup?: () => unknown }): TestTransactionHooks {
    const db = argToDb(arg);
    let attempt: HooksAttempt | undefined;

    const end = async (close: boolean) => {
      const current = attempt;
      attempt = undefined;
      if (!current) return;

      current.abort.abort();
      // a timed-out start or setup may still be running, it would write past the rollback;
      // once they have ended, no await: the rollback takes its test transaction before a `start` called right after
      const ended =
        current.ended ?? (await Promise.allSettled([current.done]))[0];

      const { transaction } = current;
      if (transaction) {
        await (close ? transaction.close() : transaction.rollback());
      } else if (close) {
        // a failed start has no test transaction: close without taking a record of another start off the stack
        await closeAfter(
          db,
          (db.internal as unknown as Internal)[trxForTest]!,
          Promise.resolve(),
        );
      }

      if (
        ended.status === 'rejected' &&
        ended.reason !== current.abort.signal.reason
      ) {
        throw ended.reason;
      }
    };

    return {
      start() {
        // replacing the attempt would leave its test transaction open without an error
        if (attempt) {
          return Promise.reject(
            new TestTransactionError(
              'Test transaction hooks were started again before the previous start was rolled back',
            ),
          );
        }

        const abort = new AbortController();
        const current: HooksAttempt = {
          abort,
          done: testTransaction
            .start(db, { signal: abort.signal })
            .then(async (transaction) => {
              current.transaction = transaction;
              await options?.setup?.();
            }),
        };
        current.done.then(
          (value) => {
            current.ended = { status: 'fulfilled', value };
          },
          (reason: unknown) => {
            current.ended = { status: 'rejected', reason };
          },
        );
        attempt = current;
        return current.done;
      },
      rollback: () => end(false),
      close: () => end(true),
    };
  },
};
