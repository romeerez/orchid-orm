import { Query } from './query/query';
import { QueryError } from './query/errors';

// The `Rollback` is not an error,
// but a command to throw by `rollback` function,
// and catch it immediately by the transaction to handle the rollback.
export class Rollback extends Error {}

// `testTransaction` will store its state under this unique key in the `db.internal`.
const trxForTest: unique symbol = Symbol('trxForTest');

// The state of `testTransaction` that will be stored in the `db.internal`.
interface TrxData {
  // promise of the full transaction lifecycle, from start to rollback.
  promise?: Promise<void>;
  // reject function of the transaction.
  // `Rollback` won't leak outside, other errors will be brought back to the caller.
  reject?(err: unknown): void;
  // `BEGIN` or `SAVEPOINT` failed, there is no transaction to roll back.
  failed?: boolean;
  // `rollback` was called while `BEGIN` or `SAVEPOINT` was in flight, the transaction is rolled back as soon as it starts.
  cancelled?: boolean;
  // Adapter methods are replaced inside the transaction.
  // Original methods are stored here to be restored on rollback.
  adapter: {
    query: unknown;
    arrays: unknown;
    transaction: unknown;
  };
}

// Type to store transaction data on `db.internal`.
interface Internal {
  [trxForTest]?: TrxData[];
}

// Argument of the transaction, $qb is to use ORM instance, Query to use any other queryable instance.
type Arg = { $qb: Query } | Query;

// Get queryable instance from the transaction argument.
const argToDb = (arg: Arg): Query => ('$qb' in arg ? arg.$qb : arg);

// Whether a test transaction is started or is starting.
const hasTransaction = (levels: TrxData[] | undefined) =>
  !!levels?.some((level) => !level.failed);

// Wrap a driver error into a `QueryError`, as for a failed query.
const toQueryError = (db: Query, err: unknown) => {
  const { adapter } = db.q;
  if (!(err instanceof adapter.errorClass)) return err;

  const error = new (db.error as unknown as new () => QueryError)();
  adapter.assignError(error, err);
  error.cause = err;
  return error;
};

// Methods of a test transaction.
export const testTransaction = {
  /**
   * Start a test transaction.
   * The returned promise is resolved immediately when transaction starts, not waiting for it to end.
   * It is rejected when `rollback` is called before the transaction started.
   *
   * @param arg - ORM instance or a queryable instance (such as db.someTable).
   */
  start(arg: Arg): Promise<void> {
    const db = argToDb(arg);
    const { asyncStorage } = db.internal;
    const { getStore } = asyncStorage;
    const { adapter } = db.baseQuery.q;
    const data: TrxData = {
      adapter: {
        query: adapter.query,
        arrays: adapter.arrays,
        transaction: adapter.transaction,
      },
    };
    // added even when the transaction fails to start, to be removed by the `rollback` paired with this `start`
    ((db.internal as unknown as Internal)[trxForTest] ??= []).push(data);

    return new Promise<void>((resolve, reject) => {
      let started = false;
      data.promise = db
        .transaction(() => {
          if (data.cancelled) throw new Rollback();

          started = true;
          resolve();
          return new Promise<void>((_, rej) => {
            const state = asyncStorage.getStore();
            db.internal.asyncStorage.getStore = () => state;
            const t = state?.transactionAdapter;
            if (t) {
              adapter.query = t.query.bind(t);
              adapter.arrays = t.arrays.bind(t);
              adapter.transaction = t.transaction.bind(t);

              state.testTransactionCount = state.testTransactionCount
                ? state.testTransactionCount + 1
                : 1;
            }
            data.reject = rej;
          });
        })
        .catch((err) => {
          if (!(err instanceof Rollback)) {
            if (!started) data.failed = true;
            throw toQueryError(db, err);
          }
        })
        .finally(() => {
          if (!started) return;

          const state = db.internal.asyncStorage.getStore();
          if (state?.testTransactionCount) {
            state.testTransactionCount--;
          }

          db.internal.asyncStorage.getStore = getStore;
        });

      // rejects `start` when the transaction failed to start or was rolled back while starting,
      // has no effect once it has started
      data.promise.then(() => {
        reject(
          new Error('The test transaction was rolled back before it started'),
        );
      }, reject);
    });
  },

  /**
   * Rollback a test transaction.
   * After a failed `start`, it only discards that `start`.
   * Called while `start` is in progress, it rolls the transaction back once it starts, and `start` rejects.
   *
   * @param arg - the same ORM or query argument passed into the `testTransaction.start`.
   */
  rollback(arg: Arg): Promise<void> | undefined {
    const db = argToDb(arg);
    const data = (db.internal as unknown as Internal)[trxForTest];
    const last = data?.pop();
    if (!last) return;

    if (!hasTransaction(data)) {
      Object.assign(db.baseQuery.q.adapter, last.adapter);
    }

    if (last.failed) return;

    if (last.reject) {
      last.reject(new Rollback());
    } else {
      last.cancelled = true;
    }
    return last.promise;
  },

  /**
   * Will roll back the current `testTransaction` (won't have any effect if it was rolled back already),
   * and if there's no nested test transactions left, it will close the db connection.
   *
   * @param arg - the same ORM or query argument passed into the `testTransaction.start`.
   */
  async close(arg: Arg) {
    const db = argToDb(arg);
    await this.rollback(db);
    const levels = (db.internal as unknown as Internal)[trxForTest];
    if (levels && !hasTransaction(levels)) {
      return db.q.adapter.close();
    }
  },
};
