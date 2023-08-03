import { Query } from './query/query';

class Rollback extends Error {}

const trxForTest: unique symbol = Symbol('trxForTest');

type TrxData = {
  promise?: Promise<void>;
  reject?(err: unknown): void;
  adapter: {
    query: unknown;
    arrays: unknown;
    transaction: unknown;
  };
};

type Internal = {
  [trxForTest]?: TrxData[];
};

type Arg = { $queryBuilder: Query } | Query;

const argToDb = (arg: Arg): Query =>
  '$queryBuilder' in arg ? arg.$queryBuilder : arg;

export const testTransaction = {
  start(arg: Arg) {
    const db = argToDb(arg);
    const { transactionStorage } = db.internal;
    const { getStore } = transactionStorage;
    const adapter = db.baseQuery.q as Record<string, unknown>;
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
              const t = trx.adapter;
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
  rollback(arg: Arg) {
    const db = argToDb(arg);
    const data = (db.internal as unknown as Internal)[trxForTest]?.pop();
    if (data) {
      data.reject?.(new Rollback());
      Object.assign(db.baseQuery.q.adapter, data.adapter);
      return data.promise;
    }
    return;
  },
  async close(arg: Arg) {
    const db = argToDb(arg);
    await this.rollback(db);
    if ((db.internal as unknown as Internal)[trxForTest]?.length === 0) {
      return db.q.adapter.close();
    }
  },
};
