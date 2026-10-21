import { Query } from './query/query';
import { OrchidOrmError, QueryError } from './query/errors';
import {
  AsyncState,
  AsyncStateStorage,
} from './query/basic-features/storage/storage';
import { QueryLogObject } from './query/basic-features/log/log';
import { QuerySchema } from './query/basic-features/schema/schema';
import {
  Adapter,
  AdapterConfigBase,
  AdapterTransactionOptions,
  DriverAdapter,
  HackySavepointState,
  QueryResult,
  QueryResultRow,
  TransactionAdapter,
} from './adapters/adapter';
import { SqlSessionState } from './adapters/features/sql-session-context';
import { noop } from './utils';

// The `Rollback` is not an error,
// but a command to throw by `rollback` function,
// and catch it immediately by the transaction to handle the rollback.
export class Rollback extends Error {}

/**
 * Kind of a `TestTransactionError`:
 * - `startedAgain`: `start` of test transaction hooks was called again before the previous `start` was rolled back
 * - `innerOpen`: a test transaction was rolled back while test transactions started inside it were still open, they were rolled back as well
 * - `byOuter`: the test transaction was rolled back together with an outer one
 * - `rolledBack`: a query or a transaction of a test transaction whose rollback was called
 */
export type TestTransactionErrorKind =
  | 'startedAgain'
  | 'innerOpen'
  | 'byOuter'
  | 'rolledBack';

/**
 * Error of test transactions, `kind` tells what happened.
 */
export class TestTransactionError extends OrchidOrmError {
  constructor(
    public kind: TestTransactionErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

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
  // the adapter of the outermost started transaction whose lifecycle hasn't ended.
  adapter?: TestTransactionAdapter;
}

// Type to store transaction data on `db.internal`.
interface Internal {
  [trxForTest]?: TestTransactions;
}

// Argument of the transaction, $qb is to use ORM instance, Query to use any other queryable instance.
type Arg = { $qb: Query } | Query;

// Get queryable instance from the transaction argument.
const argToDb = (arg: Arg): Query => ('$qb' in arg ? arg.$qb : arg);

// Callbacks of the transactions of test transactions, mapped to the test transactions of their instance:
// the adapter of the outermost one passes those of its own nested test transactions to the adapter it wraps.
const levelStarts = new WeakMap<object, TestTransactions>();

// A record of a `start` call, it is also the handle returned by `start`.
class TestTransactionLevel implements TestTransaction {
  started?: Promise<TestTransaction>;
  // rejects `started` while the start waits for its turn in the queue.
  rejectStart?: (reason: unknown) => void;
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
  // the adapter created by this level when it is the outermost one.
  adapter?: TestTransactionAdapter;

  constructor(
    private db: Query,
    private trx: TestTransactions,
  ) {}

  rollback(): Promise<void> {
    if (this.byOuter) {
      return this.rolledBack!.then(() => {
        throw new TestTransactionError(
          'byOuter',
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

// Route the methods of the adapter shared by instances to the wrapper.
const bindAdapter = (adapter: Adapter, wrapper: TestTransactionAdapter) => {
  adapter.query = wrapper.query.bind(wrapper);
  adapter.arrays = wrapper.arrays.bind(wrapper);
  adapter.transaction = wrapper.transaction.bind(wrapper);
};

// Transaction adapter of the outermost test transaction of an instance, used by the tested code for queries, transactions, and savepoints:
// it rejects them once the test transaction is rolled back, and keeps queries and savepoints in flight for rollbacks to wait for them.
// The root is the wrapper of the outermost test transaction on the connection; wrappers of other instances start inside it and route through it.
class TestTransactionAdapter implements TransactionAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorClass: new (...args: any[]) => Error;
  driverAdapter: DriverAdapter;
  // set when the rollback of its test transaction is called.
  rolledBack?: boolean;
  // the root, set on wrappers of other instances started inside it.
  private root?: TestTransactionAdapter;
  // of the root: the methods of the shared adapter it replaced.
  private replaced?: Pick<Adapter, 'query' | 'arrays' | 'transaction'>;
  // of the root: the wrappers of other instances started inside it, the innermost last.
  private nested: TestTransactionAdapter[] = [];
  // queries and savepoints in flight.
  private inFlight = new Set<Promise<unknown>>();

  constructor(
    private trx: TestTransactions,
    private adapter: TransactionAdapter,
  ) {
    this.errorClass = adapter.errorClass;
    this.driverAdapter = adapter.driverAdapter;
  }

  // Wait for the operations that are in flight now.
  async settle(): Promise<void> {
    await Promise.allSettled(this.inFlight);
  }

  // Route the methods of the shared adapter through this wrapper.
  attach(shared: Adapter) {
    const outer = this.adapter;
    if (outer instanceof TestTransactionAdapter) {
      this.root = outer.root ?? outer;
      this.root.nested.push(this);
    } else {
      this.replaced = {
        query: shared.query,
        arrays: shared.arrays,
        transaction: shared.transaction,
      };
    }
    bindAdapter(shared, this);
  }

  // Stop routing through this wrapper when its test transaction ends:
  // the root restores the replaced methods, a wrapper of another instance routes to the innermost wrapper left, or to the root.
  // A wrapper ending after the root leaves the methods alone.
  detach(shared: Adapter) {
    const { root } = this;
    if (!root) {
      Object.assign(shared, this.replaced);
      this.nested.length = 0;
      return;
    }

    const { nested } = root;
    const i = nested.indexOf(this);
    // the root has ended and cleared the list
    if (i === -1) return;

    nested.splice(i, 1);
    bindAdapter(shared, nested.at(-1) ?? root);
  }

  // Get the error to reject an operation with.
  private getError() {
    if (this.rolledBack) {
      return new TestTransactionError(
        'rolledBack',
        'Test transaction was rolled back, it cannot run queries anymore',
      );
    }

    return;
  }

  private track<T>(promise: Promise<T>): Promise<T> {
    this.inFlight.add(promise);
    const remove = () => this.inFlight.delete(promise);
    promise.then(remove, remove);
    return promise;
  }

  // Run the operation unless rejected, keep it while it is in flight.
  private run<T>(op: () => Promise<T>): Promise<T> {
    const error = this.getError();
    return error ? Promise.reject(error) : this.track(op());
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    sqlSessionState?: SqlSessionState,
    prepare?: true,
  ): Promise<QueryResult<T>> {
    return this.run(() =>
      this.adapter.query<T>(text, values, sqlSessionState, prepare),
    );
  }

  arrays<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    R extends any[] = any[],
  >(
    text: string,
    values?: unknown[],
    sqlSessionState?: SqlSessionState,
    prepare?: true,
  ): Promise<QueryResult<R>> {
    return this.run(() =>
      this.adapter.arrays<R>(text, values, sqlSessionState, prepare),
    );
  }

  transaction<T>(
    asyncStorage: AsyncStateStorage | undefined,
    options: AdapterTransactionOptions | undefined,
    cb: (adapter: TransactionAdapter) => Promise<T>,
  ): Promise<T> {
    // a test transaction of another instance sharing the adapter is a transaction of the tested code for this one
    if (levelStarts.get(cb) === this.trx) {
      return this.adapter.transaction(asyncStorage, options, cb);
    }

    const error = this.getError();
    if (error) return Promise.reject(error);

    const outer = asyncStorage?.getStore();
    return this.adapter.transaction(asyncStorage, options, () => {
      // the rollback may have been called while the transaction was starting
      const error = this.getError();
      if (error) throw error;

      // an instance with another storage gets a new state with the adapter of the transaction, route its queries through this adapter;
      // tell it by identity: an existing state may hold the adapter passed here, in a chain of these adapters
      const state = asyncStorage?.getStore();
      if (state && state !== outer) {
        state.transactionAdapter = this;
      }
      return cb(this);
    });
  }

  savepoint<T>(
    name: string,
    log: QueryLogObject | undefined,
    cb: () => Promise<T>,
  ): Promise<T> {
    return this.run(() => this.adapter.savepoint(name, log, cb));
  }

  hackySavepoint<T extends QueryResultRow = QueryResultRow>(
    state: HackySavepointState,
    text: string,
    values?: unknown[],
    arraysMode?: boolean,
    prepare?: true,
    log?: QueryLogObject,
  ): Promise<QueryResult<T>> {
    const error = this.getError();
    if (error) return Promise.reject(error);

    const result = this.adapter.hackySavepoint<T>(
      state,
      text,
      values,
      arraysMode,
      prepare,
      log,
    );

    // the savepoint stays open after the query until a following query releases or rolls it back
    const savepoint = state.activeSavepoint!;
    const { release, rollback } = savepoint;
    this.track(
      new Promise<void>((resolve) => {
        savepoint.release = () => release.call(savepoint).finally(resolve);
        savepoint.rollback = (err) =>
          rollback.call(savepoint, err).finally(resolve);
      }),
    );
    // a failed query rolls back the savepoint by itself, nothing would roll it back otherwise
    result.catch((err) => savepoint.rollback(err)).catch(noop);

    return result;
  }

  isInTransaction(this: Adapter): this is TransactionAdapter {
    return true;
  }

  assignError(to: QueryError, from: Error): void {
    return this.adapter.assignError(to, from);
  }

  close(): Promise<void> {
    return this.adapter.close();
  }

  getDatabase(): string {
    return this.adapter.getDatabase();
  }

  getUser(): string {
    return this.adapter.getUser();
  }

  getSearchPath(): string | undefined {
    return this.adapter.getSearchPath();
  }

  getHost(): string {
    return this.adapter.getHost();
  }

  getSchema(): QuerySchema | undefined {
    return this.adapter.getSchema();
  }

  clone(params?: AdapterConfigBase): Adapter {
    return this.adapter.clone(params);
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

  // from now on, a cancellation rolls back the transaction once it starts
  level.rejectStart = undefined;

  const { asyncStorage } = db.internal;
  const { adapter } = db.baseQuery.q;
  return new Promise((resolve, reject) => {
    let state: AsyncState | undefined;
    let fallback: AsyncState | undefined;
    // the transaction adapter of the state, restored when the outermost test transaction of the instance ends
    let stateAdapter: TransactionAdapter | undefined;
    const run = () => {
      if (level.cancelled) throw new Rollback();

      const ended = new Promise<void>((_, end) => {
        level.end = end;
      });

      state = asyncStorage.getStore();
      fallback = asyncStorage.fallback;
      asyncStorage.fallback = state;
      const t = state?.transactionAdapter;
      if (state && t) {
        // routes the tested code of this and other instances that share the adapter through a `TestTransactionAdapter`,
        // nested levels use the same one
        if (!fallback) {
          const wrapper = new TestTransactionAdapter(trx, t);
          level.adapter = trx.adapter = wrapper;
          stateAdapter = t;
          state.transactionAdapter = wrapper;
          wrapper.attach(adapter);
        }

        state.testTransactionCount = state.testTransactionCount
          ? state.testTransactionCount + 1
          : 1;
      }

      trx.live++;
      resolve(level);
      return ended;
    };
    levelStarts.set(run, trx);

    level.lifecycle = db
      .transaction(run)
      .catch((err) => {
        if (!(err instanceof Rollback)) throw toQueryError(db, err);
      })
      .finally(() => {
        if (!level.end) return;

        if (state?.testTransactionCount) {
          state.testTransactionCount--;
        }

        asyncStorage.fallback = fallback;
        if (stateAdapter) {
          state!.transactionAdapter = stateAdapter;
          level.adapter!.detach(adapter);
          trx.adapter = undefined;
        }
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

// Cancel a start that hasn't started its transaction:
// one waiting for its turn rejects at once and is skipped in its turn, one whose `BEGIN` or `SAVEPOINT` is in flight is rolled back once it starts.
const cancelStart = (level: TestTransactionLevel, reason: unknown) => {
  level.cancelled ??= { reason };
  level.rejectStart?.(level.cancelled.reason);
};

// Cancel a start that hasn't started its transaction, settles once that start settles.
const cancel = (level: TestTransactionLevel, reason: unknown) => {
  cancelStart(level, reason);
  const cancelled = level.cancelled!;
  return level.started!.then(noop, (err) => {
    if (err !== cancelled.reason) throw err;
  });
};

// Roll back the levels taken off the stack in one turn of the queue, the innermost first.
// `level` is the outermost of them, the others are the levels started inside it.
const rollbackLevels = (
  trx: TestTransactions,
  level: TestTransactionLevel,
  levels: TestTransactionLevel[],
): Promise<void> => {
  if (level.adapter) level.adapter.rolledBack = true;

  return enqueue(trx, async () => {
    // let queries and savepoints in flight finish in the transactions they started in
    await trx.adapter?.settle();

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
        'innerOpen',
        open === 1
          ? 'Test transaction had an inner test transaction still open, it was rolled back as well'
          : `Test transaction had ${open} inner test transactions still open, they were rolled back as well`,
      );
    }
  });
};

// Take the level and the levels started inside it off the stack, and roll them back.
const rollbackWithInner = (
  trx: TestTransactions,
  level: TestTransactionLevel,
): Promise<void> => {
  const levels = trx.levels.splice(trx.levels.indexOf(level)).reverse();
  const rollback = rollbackLevels(trx, level, levels);

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

    const started = new Promise<TestTransaction>((resolve, reject) => {
      level.rejectStart = reject;
      enqueue(trx, () => begin(db, trx, level)).then(resolve, reject);
    });

    const signal = options?.signal;
    if (!signal) return (level.started = started);

    const abort = () => {
      if (!level.end) cancelStart(level, signal.reason);
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

    return setRollback(level, rollbackLevels(trx!, level, [level]));
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
              'startedAgain',
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
        // a start cancelled by its teardown rejects, so that code after `await start()` in a timed-out hook stops
        // rather than writing outside the test transaction; Bun reports this late rejection as an error between tests
        return current.done;
      },
      rollback: () => end(false),
      close: () => end(true),
    };
  },
};
