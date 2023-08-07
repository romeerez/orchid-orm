import { Query } from './query/query';

// The `Rollback` is not an error,
// but a command to throw by `rollback` function,
// and catch it immediately by the transaction to handle the rollback.
class Rollback extends Error {}

// `testTransaction` will store its state under this unique key in the `db.internal`.
const trxForTest: unique symbol = Symbol('trxForTest');

// The state of `testTransaction` that will be stored in the `db.internal`.
type TrxData = {
  // promise of the full transaction lifecycle, from start to rollback.
  promise?: Promise<void>;
  // reject function of the transaction.
  // `Rollback` won't leak outside, other errors will be brought back to the caller.
  reject?(err: unknown): void;
  // Adapter methods are replaced inside the transaction.
  // Original methods are stored here to be restored on rollback.
  adapter: {
    query: unknown;
    arrays: unknown;
    transaction: unknown;
  };
};

// Type to store transaction data on `db.internal`.
type Internal = {
  [trxForTest]?: TrxData[];
};

// Argument of the transaction, $queryBuilder is to use ORM instance, Query to use any other queryable instance.
type Arg = { $queryBuilder: Query } | Query;

// Get queryable instance from the transaction argument.
const argToDb = (arg: Arg): Query =>
  '$queryBuilder' in arg ? arg.$queryBuilder : arg;

// Methods of a test transaction.
export const testTransaction = {
  /**
   * Start a test transaction.
   * The returned promise is resolved immediately when transaction starts, not waiting for it to end.
   *
   * @param arg - ORM instance or a queryable instance (such as db.someTable).
   */
  start(arg: Arg): Promise<void> {
    const db = argToDb(arg);
    const { transactionStorage } = db.internal;
    const { getStore } = transactionStorage;
    const { adapter } = db.baseQuery.q;
    const data: TrxData = {
      adapter: {
        query: adapter.query,
        arrays: adapter.arrays,
        transaction: adapter.transaction,
      },
    };
    ((db.internal as unknown as Internal)[trxForTest] ??= []).push(data);

    return new Promise<void>((resolve) => {
      data.promise = db
        .transaction(() => {
          resolve();
          return new Promise<void>((_, rej) => {
            const trx = transactionStorage.getStore();
            db.internal.transactionStorage.getStore = () => trx;
            if (trx) {
              const t = trx.adapter as unknown as typeof adapter;
              adapter.query = t.query.bind(t);
              adapter.arrays = t.arrays.bind(t);
              adapter.transaction = t.transaction.bind(t);
            }
            data.reject = rej;
          });
        })
        .catch((err) => {
          if (!(err instanceof Rollback)) {
            throw err;
          }
        })
        .finally(() => {
          db.internal.transactionStorage.getStore = getStore;
        });
    });
  },

  /**
   * Rollback a test transaction.
   *
   * @param arg - the same ORM or query argument passed into the `testTransaction.start`.
   */
  rollback(arg: Arg): Promise<void> | undefined {
    const db = argToDb(arg);
    const data = (db.internal as unknown as Internal)[trxForTest];
    const last = data?.pop();
    if (!last) return;

    // if there's only one transaction left, restore the adapter methods.
    if (data?.length === 1) {
      Object.assign(db.baseQuery.q.adapter, data[0].adapter);
    }

    last.reject?.(new Rollback());
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
    if ((db.internal as unknown as Internal)[trxForTest]?.length === 0) {
      return db.q.adapter.close();
    }
  },
};
