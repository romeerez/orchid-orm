import {
  assertType,
  createTestDb,
  db,
  testDb,
  testDbOptions,
  useTestDatabase,
  UserData,
} from 'test-utils';
import {
  TestTransaction,
  TestTransactionError,
  testTransaction,
} from './testTransaction';
import { QueryError } from './query/errors';
import {
  Adapter,
  getDriverErrorCode,
  HackySavepointState,
  TransactionAdapter,
  TransactionAdapterClass,
} from './adapters/adapter';
import { createDbWithAdapter, Db } from './query/db';
import { noop } from './utils';

const getSetting = async (db: Db, name = 'app.setting') => {
  const { rows } = await db.query<{
    setting: string | null;
  }>`SELECT current_setting(${name}, true) AS setting`;
  return rows[0].setting;
};

const setSetting = (db: Db, value: string) =>
  db.query`SELECT set_config('app.setting', ${value}, true)`;

// abort the current transaction: a failing query outside of a savepoint
const abortTransaction = (db: Db) =>
  db.$getAdapter().query('SELECT 1/0').catch(noop);

const innerOpen = {
  kind: 'innerOpen',
  message:
    'Test transaction had an inner test transaction still open, it was rolled back as well',
};
const byOuter = {
  kind: 'byOuter',
  message:
    'Test transaction was rolled back together with an outer test transaction',
};
const startedAgain = {
  kind: 'startedAgain',
  message:
    'Test transaction hooks were started again before the previous start was rolled back',
};

const expectTestTransactionError = async (
  promise: Promise<unknown>,
  expected: { kind: string; message?: string },
) => {
  const err = await promise.catch((err: unknown) => err);
  expect(err).toBeInstanceOf(TestTransactionError);
  expect(err).toMatchObject(expected);
  return err as TestTransactionError;
};

// Make the next `transaction` of the adapter wait for `release`, `called` resolves once it is called.
const holdNextTransaction = (
  adapter: Adapter,
  run: Adapter['transaction'] = adapter.transaction.bind(adapter),
) => {
  const called = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  jest
    .spyOn(adapter, 'transaction')
    .mockImplementationOnce((...args: Parameters<Adapter['transaction']>) => {
      called.resolve();
      return release.promise.then(() => run(...args));
    });
  return { called: called.promise, release: release.resolve };
};

// Start a transaction that stays open until `release` is called, `opened` resolves once it has started.
const holdTransaction = (
  db: Db,
  cb: () => Promise<unknown> = async () => {},
) => {
  const opened = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const transaction = db.transaction(async () => {
    opened.resolve();
    await release.promise;
    return cb();
  });
  return { opened: opened.promise, release: release.resolve, transaction };
};

// Resolves once the next query reaches a transaction adapter.
const onNextQuery = () => {
  const called = Promise.withResolvers<void>();
  const { query } = TransactionAdapterClass.prototype;
  jest
    .spyOn(TransactionAdapterClass.prototype, 'query')
    .mockImplementationOnce(function (
      this: TransactionAdapterClass,
      ...args: Parameters<typeof query>
    ) {
      called.resolve();
      return query.apply(this, args);
    } as typeof query);
  return called.promise;
};

// Run `inFlight` right after the next savepoint is requested, and pass its result through `mapResult`.
const onNextSavepoint = (
  inFlight: () => void,
  mapResult = (result: Promise<unknown>) => result,
) => {
  const { savepoint } = TransactionAdapterClass.prototype;
  return jest
    .spyOn(TransactionAdapterClass.prototype, 'savepoint')
    .mockImplementationOnce(function (
      this: TransactionAdapterClass,
      ...args: Parameters<typeof savepoint>
    ) {
      const result = savepoint.apply(this, args);
      inFlight();
      return mapResult(result);
    } as typeof savepoint);
};

describe('testTransaction', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('using test database', () => {
    useTestDatabase();

    it('should handle successful transactions', async () => {
      await expect(() =>
        testDb.transaction(async () => {
          await db.user.getOptional('Id');
        }),
      ).resolves;
    });

    it('should handle failed transactions', async () => {
      await expect(() =>
        testDb.transaction(async () => {
          await db.user.get(db.user.sql`wrong`);
        }),
      ).rejects.toThrow(`column "wrong" does not exist`);
    });

    it('should reject start when the transaction is aborted and keep the aborted transaction for its own rollback', async () => {
      await testTransaction.start(testDb);
      // abort the transaction: a failing query outside of a savepoint
      await testDb
        .$getAdapter()
        .query('SELECT 1/0')
        .catch(() => {});

      const err = await testTransaction.start(testDb).catch((err) => err);

      expect(err).toBeInstanceOf(QueryError);
      expect(err).toMatchObject({ code: '25P02' });
      expect(getDriverErrorCode(err.cause)).toBe('25P02');

      // the rollback paired with the failed start keeps the aborted transaction
      await testTransaction.rollback(testDb);
      await expect(db.user.count()).rejects.toMatchObject({ code: '25P02' });

      // rolls back the aborted transaction, the outer one becomes usable
      await testTransaction.rollback(testDb);
      expect(await db.user.count()).toBe(0);
    });

    describe('nested describe', () => {
      useTestDatabase();

      beforeAll(async () => {
        await db.user.create(UserData);
      });

      it('should have a user', async () => {
        expect(await db.user.count()).toBe(1);
      });

      it('should also have a user', async () => {
        expect(await db.user.count()).toBe(1);
      });
    });

    it('should have a clear state', async () => {
      expect(await db.user.count()).toBe(0);
    });
  });

  describe('start', () => {
    it('should resolve `start` with the test transaction', () => {
      assertType<
        Awaited<ReturnType<typeof testTransaction.start>>,
        TestTransaction
      >();
    });

    it('should reject start when the transaction cannot begin', async () => {
      const unreachableDb = createTestDb({
        databaseURL: 'postgres://user@localhost:1/db',
      });

      await expect(testTransaction.start(unreachableDb)).rejects.toThrow();

      await testTransaction.close(unreachableDb);
    });

    it('should start a test transaction of another instance sharing the adapter inside the outer one', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');

      const inner = await testTransaction.start(other);
      await setSetting(other, 'inner');
      expect(await getSetting(localDb)).toBe('inner');
      await inner.rollback();

      expect(await getSetting(localDb)).toBe('root');
      await root.close();
    });

    it('should start a nested test transaction inside a test transaction of another instance sharing the adapter', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');

      const inner = await testTransaction.start(other);
      const nested = await testTransaction.start(localDb);
      await setSetting(localDb, 'nested');
      await nested.rollback();
      await inner.rollback();

      expect(await getSetting(localDb)).toBe('root');
      await root.close();
    });
  });

  describe('rollback', () => {
    it('should roll back a test transaction once', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');

      const a = await testTransaction.start(localDb);
      await setSetting(localDb, 'a');
      await a.rollback();
      await a.rollback();
      expect(await getSetting(localDb)).toBe('root');

      const b = await testTransaction.start(localDb);
      await setSetting(localDb, 'b');
      await testTransaction.rollback(localDb);
      await b.rollback();
      expect(await getSetting(localDb)).toBe('root');

      await root.close();
    });

    it('should roll back open inner test transactions together with the outer one', async () => {
      const localDb = createTestDb(testDbOptions);
      const close = jest.spyOn(localDb.q.adapter, 'close');
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');
      const a = await testTransaction.start(localDb);
      await setSetting(localDb, 'a');
      // the test transaction of the next test starts before `a` is rolled back
      const b = await testTransaction.start(localDb);

      await expectTestTransactionError(a.rollback(), innerOpen);
      await expectTestTransactionError(b.rollback(), byOuter);
      expect(await getSetting(localDb)).toBe('root');
      expect(localDb.isInTransaction()).toBe(false);

      // the error is reported once, but a test transaction rolled back with an outer one keeps rejecting
      await a.rollback();
      await expectTestTransactionError(b.rollback(), byOuter);

      await root.close();
      expect(close).toHaveBeenCalled();
    });

    it('should leave inner test transactions to the outer rollback in progress', async () => {
      const localDb = createTestDb(testDbOptions);
      const close = jest.spyOn(localDb.q.adapter, 'close');
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');
      const a = await testTransaction.start(localDb);
      // hold the end of the rollback of `b`
      const hold = Promise.withResolvers<void>();
      onNextSavepoint(noop, (result) =>
        result.catch(async (err) => {
          await hold.promise;
          throw err;
        }),
      );
      const b = await testTransaction.start(localDb);

      const aRollback = expectTestTransactionError(a.rollback(), innerOpen);
      let bRolledBack = false;
      const bRollback = expectTestTransactionError(
        b.rollback().finally(() => {
          bRolledBack = true;
        }),
        byOuter,
      );
      const bClose = expectTestTransactionError(b.close(), byOuter);
      const c = testTransaction.start(localDb);

      await new Promise(setImmediate);
      expect(bRolledBack).toBe(false);

      hold.resolve();
      await Promise.all([aRollback, bRollback, bClose]);
      expect(close).not.toHaveBeenCalled();

      await c;
      await setSetting(localDb, 'c');
      expect(await getSetting(localDb)).toBe('c');
      await testTransaction.rollback(localDb);
      expect(await getSetting(localDb)).toBe('root');

      await root.close();
      expect(close).toHaveBeenCalled();
    });

    it('should not count a failed start as an open inner test transaction', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      await abortTransaction(localDb);

      await expect(testTransaction.start(localDb)).rejects.toMatchObject({
        code: '25P02',
      });

      await root.rollback();

      await testTransaction.start(localDb);
      await setSetting(localDb, 'next');
      expect(await getSetting(localDb)).toBe('next');
      await testTransaction.close(localDb);
    });

    it('should take a test transaction off the stack when its rollback fails', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');
      const a = await testTransaction.start(localDb);
      // the rollback of `b` fails with a database error that aborts `a`
      jest
        .spyOn(TransactionAdapterClass.prototype, 'savepoint')
        .mockImplementationOnce(async function (
          this: TransactionAdapterClass,
          _name: string,
          _log: unknown,
          cb: () => Promise<unknown>,
        ) {
          await cb().catch(() => this.query('ROLLBACK TO SAVEPOINT "missing"'));
        } as never);
      const b = await testTransaction.start(localDb);

      await expect(b.rollback()).rejects.toBeInstanceOf(QueryError);
      // the error is reported once
      await b.rollback();
      await expect(testTransaction.start(localDb)).rejects.toMatchObject({
        code: '25P02',
      });

      await a.rollback();
      expect(await getSetting(localDb)).toBe('root');

      await root.close();
    });
  });

  describe('cancelling a start', () => {
    it('should roll back a transaction that is rolled back while starting', async () => {
      const localDb = createTestDb(testDbOptions);
      const begin = holdNextTransaction(localDb.q.adapter);

      const start = testTransaction.start(localDb);
      await begin.called;
      const rollback = testTransaction.rollback(localDb);
      begin.release();

      await expect(start).rejects.toThrow('rolled back before it started');
      await rollback;
      await testTransaction.close(localDb);
    });

    it('should reject a start that is rolled back while starting with the error of its failed transaction', async () => {
      const localDb = createTestDb(testDbOptions);
      const begin = holdNextTransaction(localDb.q.adapter, () => {
        throw new Error('failed to begin');
      });

      const start = testTransaction.start(localDb);
      await begin.called;
      const rollback = testTransaction.rollback(localDb);
      begin.release();

      await expect(start).rejects.toThrow('failed to begin');
      await expect(rollback).rejects.toThrow('failed to begin');
      await testTransaction.close(localDb);
    });

    it('should reject a start that is rolled back while starting and keep the outer transaction', async () => {
      const localDb = createTestDb(testDbOptions);
      await testTransaction.start(localDb);
      await localDb.query`SELECT set_config('app.setting', 'outer', true)`;

      const begin = holdNextTransaction(localDb.q.adapter);

      const start = testTransaction.start(localDb);
      await begin.called;
      const rollback = testTransaction.rollback(localDb);
      begin.release();

      await expect(start).rejects.toThrow('rolled back before it started');
      await rollback;

      expect(await getSetting(localDb)).toBe('outer');
      expect(localDb.isInTransaction()).toBe(false);

      await testTransaction.close(localDb);
    });

    it('should cancel a start waiting in the queue when its rollback is called', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');
      const a = await testTransaction.start(localDb);

      const query = localDb.query`SELECT pg_sleep(0.05)`;
      const rollback = a.rollback();
      const savepoint = jest.spyOn(
        TransactionAdapterClass.prototype,
        'savepoint',
      );
      const start = testTransaction.start(localDb);
      const cancel = testTransaction.rollback(localDb);

      await expect(start).rejects.toThrow('rolled back before it started');
      await Promise.all([query, rollback, cancel]);
      expect(savepoint).not.toHaveBeenCalled();

      const b = await testTransaction.start(localDb);
      await setSetting(localDb, 'b');
      await b.rollback();
      expect(await getSetting(localDb)).toBe('root');

      await root.close();
    });

    it('should cancel a start aborted before its turn', async () => {
      const localDb = createTestDb(testDbOptions);
      const close = jest.spyOn(localDb.q.adapter, 'close');
      const root = await testTransaction.start(localDb);
      const abort = new AbortController();
      const reason = new Error('aborted');

      const start = expect(
        testTransaction.start(localDb, { signal: abort.signal }),
      ).rejects.toBe(reason);
      abort.abort(reason);
      const b = await testTransaction.start(localDb);
      await start;

      await b.rollback();
      // a test transaction left by the aborted start would make it reject
      await root.close();
      expect(close).toHaveBeenCalled();
    });

    it.each(['rollback', 'signal'])(
      'should reject a start waiting for its turn at once when it is cancelled by %s',
      async (by) => {
        const localDb = createTestDb(testDbOptions);
        const root = await testTransaction.start(localDb);
        const a = await testTransaction.start(localDb);
        let queryEnded = false;
        const query = localDb.query`SELECT pg_sleep(0.05)`.then(() => {
          queryEnded = true;
        });
        // waits for the query in flight
        const aRollback = a.rollback();
        const abort = new AbortController();
        const start = testTransaction.start(localDb, { signal: abort.signal });
        const reason = new Error('aborted');

        const cancel =
          by === 'rollback'
            ? testTransaction.rollback(localDb)
            : abort.abort(reason);

        await expect(start).rejects.toThrow(
          by === 'rollback' ? 'rolled back before it started' : reason,
        );
        expect(queryEnded).toBe(false);

        await Promise.all([query, aRollback, cancel]);
        await root.close();
      },
    );

    it('should roll back a start aborted while its savepoint is in flight', async () => {
      const localDb = createTestDb(testDbOptions);
      const close = jest.spyOn(localDb.q.adapter, 'close');
      const root = await testTransaction.start(localDb);
      const abort = new AbortController();
      const reason = new Error('aborted');
      const savepoint = onNextSavepoint(() => abort.abort(reason));

      const start = expect(
        testTransaction.start(localDb, { signal: abort.signal }),
      ).rejects.toBe(reason);
      const b = await testTransaction.start(localDb);
      await start;
      expect(savepoint).toHaveBeenCalled();

      await b.rollback();
      // a test transaction left by the aborted start would make it reject
      await root.close();
      expect(close).toHaveBeenCalled();
    });

    it('should roll back a root start aborted while its transaction begins', async () => {
      const localDb = createTestDb(testDbOptions);
      const { adapter } = localDb.q;
      const close = jest.spyOn(adapter, 'close');
      const transaction = adapter.transaction.bind(adapter);
      const abort = new AbortController();
      const reason = new Error('aborted');
      const begin = jest
        .spyOn(adapter, 'transaction')
        .mockImplementationOnce((...args: Parameters<typeof transaction>) => {
          const result = transaction(...args);
          abort.abort(reason);
          return result;
        });

      const start = expect(
        testTransaction.start(localDb, { signal: abort.signal }),
      ).rejects.toBe(reason);
      const b = await testTransaction.start(localDb);
      await start;
      expect(begin).toHaveBeenCalled();

      await b.close();
      expect(close).toHaveBeenCalled();
    });

    it('should keep a test transaction open when its start is aborted after it started', async () => {
      const localDb = createTestDb(testDbOptions);
      const abort = new AbortController();
      const root = await testTransaction.start(localDb, {
        signal: abort.signal,
      });

      abort.abort();
      await setSetting(localDb, 'root');
      expect(await getSetting(localDb)).toBe('root');

      await root.close();
    });

    it('should reject an aborted start with the error of its failed savepoint', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      await abortTransaction(localDb);
      const abort = new AbortController();
      onNextSavepoint(() => abort.abort(new Error('aborted')));

      await expect(
        testTransaction.start(localDb, { signal: abort.signal }),
      ).rejects.toMatchObject({ code: '25P02' });

      await root.close();
    });

    it('should reject an aborted start with the error of its failed cleanup', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      const abort = new AbortController();
      const error = new Error('cleanup failed');
      const savepoint = onNextSavepoint(
        () => abort.abort(new Error('aborted')),
        (result) =>
          result.catch(() => {
            throw error;
          }),
      );

      await expect(
        testTransaction.start(localDb, { signal: abort.signal }),
      ).rejects.toBe(error);
      expect(savepoint).toHaveBeenCalled();

      await root.close();
    });
  });

  describe('order of operations', () => {
    it('should start a test transaction after a rollback that waits for a query', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      const a = await testTransaction.start(localDb);

      const query = localDb.query`SELECT pg_sleep(0.05)`;
      const rollback = a.rollback();
      const b = await testTransaction.start(localDb);
      await Promise.all([query, rollback]);

      expect(localDb.isInTransaction()).toBe(false);
      expect(
        await localDb.transaction(async () => localDb.isInTransaction()),
      ).toBe(true);

      await b.rollback();
      await root.close();
    });

    it('should start a new root test transaction while the previous one is rolling back', async () => {
      const localDb = createTestDb(testDbOptions);
      const { adapter } = localDb.q;
      const { query } = adapter;

      const first = await testTransaction.start(localDb);
      await setSetting(localDb, 'first');
      const firstRollback = first.rollback();

      const second = await testTransaction.start(localDb);
      expect(await getSetting(localDb)).not.toBe('first');
      await setSetting(localDb, 'second');
      const secondRollback = second.rollback();

      const third = await testTransaction.start(localDb);
      expect(await getSetting(localDb)).not.toBe('second');

      await Promise.all([firstRollback, secondRollback]);
      await third.rollback();
      expect(adapter.query).toBe(query);

      await testTransaction.close(localDb);
    });
  });

  describe('close', () => {
    it('should support starting and closing multiple times', async () => {
      await testTransaction.start(testDb);
      await testTransaction.close(testDb);
      await testTransaction.start(testDb);
      await testTransaction.close(testDb);
    });

    it('should restore the adapter and close the connection when only failed starts are left', async () => {
      const localDb = createTestDb(testDbOptions);
      const { adapter } = localDb.q;
      jest
        .spyOn(adapter, 'transaction')
        .mockRejectedValueOnce(new Error('failed to begin'));
      const close = jest.spyOn(adapter, 'close');

      await expect(testTransaction.start(localDb)).rejects.toThrow(
        'failed to begin',
      );

      await testTransaction.start(localDb);
      await testTransaction.rollback(localDb);

      // the adapter is restored, so a new transaction can start
      await testTransaction.start(localDb);
      await testTransaction.close(localDb);

      expect(close).toHaveBeenCalled();
    });

    it('should close the connection after a failed rollback and reject with the rollback error', async () => {
      const localDb = createTestDb(testDbOptions);
      const { adapter } = localDb.q;
      const transaction = adapter.transaction.bind(adapter);
      const rollbackError = new Error('rollback failed');
      jest
        .spyOn(adapter, 'transaction')
        .mockImplementationOnce((...args: Parameters<typeof transaction>) =>
          transaction(...args).catch(() => {
            throw rollbackError;
          }),
        );
      const closeAdapter = adapter.close;
      const close = jest
        .spyOn(adapter, 'close')
        .mockImplementationOnce(async () => {
          await closeAdapter();
          throw new Error('close failed');
        });

      const root = await testTransaction.start(localDb);

      await expect(root.close()).rejects.toBe(rollbackError);
      expect(close).toHaveBeenCalled();
    });

    it('should close the connection after the rollback in progress', async () => {
      const localDb = createTestDb(testDbOptions);
      const { adapter } = localDb.q;
      const { query } = adapter;
      const closeAdapter = adapter.close;
      let rolledBackOnClose: boolean | undefined;
      jest.spyOn(adapter, 'close').mockImplementationOnce(() => {
        rolledBackOnClose = adapter.query === query;
        return closeAdapter();
      });

      const root = await testTransaction.start(localDb);
      const rollback = root.rollback();
      await testTransaction.close(localDb);
      await rollback;

      expect(rolledBackOnClose).toBe(true);
    });

    it('should not close the connection while an outer test transaction is open', async () => {
      const localDb = createTestDb(testDbOptions);
      const close = jest.spyOn(localDb.q.adapter, 'close');
      const root = await testTransaction.start(localDb);
      const inner = await testTransaction.start(localDb);

      const innerClose = inner.close();
      const rootRollback = root.rollback();

      await innerClose;
      expect(close).not.toHaveBeenCalled();
      await rootRollback;

      await testTransaction.close(localDb);
      expect(close).toHaveBeenCalled();
    });

    it('should start a test transaction while the connection is closing', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);

      const closing = root.close();
      const next = await testTransaction.start(localDb);
      await setSetting(localDb, 'next');
      expect(await getSetting(localDb)).toBe('next');

      await closing;
      await next.close();
    });
  });

  describe('withOptions', () => {
    it('should apply `withOptions` inside a test transaction started on the same instance', async () => {
      const localDb = createTestDb(testDbOptions);
      await testTransaction.start(localDb);

      const setting = await localDb.withOptions(
        { setConfig: { 'app.setting': 'value' } },
        () => getSetting(localDb),
      );

      expect(setting).toBe('value');

      await testTransaction.close(localDb);
    });

    it('should use a test transaction started inside `withOptions` with its options until it is rolled back', async () => {
      const localDb = createTestDb(testDbOptions);
      await testTransaction.start(localDb);
      await localDb.query`SELECT set_config('app.setting', 'outer', true), set_config('app.other', 'outer', true)`;

      await localDb.withOptions({ setConfig: { 'app.setting': 'scope' } }, () =>
        testTransaction.start(localDb),
      );
      expect(await getSetting(localDb)).toBe('scope');

      await localDb.query`SELECT set_config('app.other', 'inner', true)`;
      await testTransaction.start(localDb);
      await testTransaction.rollback(localDb);
      await testTransaction.rollback(localDb);

      expect(await getSetting(localDb)).toBe('outer');
      expect(await getSetting(localDb, 'app.other')).toBe('outer');

      await testTransaction.rollback(localDb);
      expect(localDb.isInTransaction()).toBe(false);

      await testTransaction.start(localDb);
      await testTransaction.close(localDb);
    });

    it('should not keep a rolled back test transaction for code that called `withOptions`', async () => {
      const localDb = createTestDb(testDbOptions);
      await testTransaction.start(localDb);
      await localDb.withOptions({ log: false }, async () => {});

      await testTransaction.rollback(localDb);

      expect(localDb.isInTransaction()).toBe(false);

      await testTransaction.close(localDb);
    });

    it('should reject queries of a `withOptions` scope that outlives its test transaction', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      const release = Promise.withResolvers<void>();
      const scope = localDb.withOptions({ log: false }, async () => {
        await release.promise;
        return localDb.query`SELECT 1`;
      });
      const query = localDb.query`SELECT pg_sleep(0.05)`;
      let closed = false;
      // waits for the query in flight
      const close = root.close().then(() => {
        closed = true;
      });

      release.resolve();

      await expectTestTransactionError(scope, { kind: 'rolledBack' });
      expect(closed).toBe(false);
      await Promise.all([query, close]);
    });
  });

  describe('code that outlives its test transaction', () => {
    it('should reject queries of a transaction of another instance sharing the adapter that outlives its test transaction', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      let query: Promise<unknown> | undefined;
      const late = holdTransaction(
        other,
        () => (query = other.query`SELECT 1`),
      );
      await late.opened;

      await root.close();

      late.release();
      await late.transaction.catch(noop);
      await expectTestTransactionError(query!, { kind: 'rolledBack' });
    });

    it('should reject a test transaction of another instance sharing the adapter started once the rollback is called', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      const query = localDb.query`SELECT pg_sleep(0.05)`;
      // waits for the query in flight
      const rollback = root.rollback();

      await expectTestTransactionError(testTransaction.start(other), {
        kind: 'rolledBack',
      });
      await Promise.all([query, rollback]);

      // the adapter is restored for the next test transaction
      const next = await testTransaction.start(localDb);
      await setSetting(localDb, 'next');
      expect(await getSetting(localDb)).toBe('next');
      await next.close();
    });

    it('should restore the SQL session settings of a query in flight before the rollback', async () => {
      // one connection, so that the next test transaction reuses the connection of the rolled back one
      const localDb = createTestDb({ ...testDbOptions, max: 1 });
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'outer');
      const called = onNextQuery();
      const late = localDb.withOptions(
        { setConfig: { 'app.setting': 'inner' } },
        () => localDb.query`SELECT pg_sleep(0.05)`,
      );
      await called;

      const rollback = root.rollback();
      const next = await testTransaction.start(localDb);
      await Promise.all([late, rollback]);

      // the settings captured before the query would remain on the connection if restored after the rollback
      expect(await getSetting(localDb)).toBe('');

      await next.close();
    });

    it('should roll back after a savepoint held by a query in flight is released', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      const state: HackySavepointState = { name: 'held' };
      await (localDb.$getAdapter() as TransactionAdapter).hackySavepoint(
        state,
        'SELECT 1',
      );

      let rolledBack = false;
      const rollback = root.rollback().then(() => {
        rolledBack = true;
      });
      await new Promise(setImmediate);
      expect(rolledBack).toBe(false);

      await state.activeSavepoint!.release();
      await rollback;

      await (await testTransaction.start(localDb)).close();
    });
  });

  describe('hooks', () => {
    it('should cancel a pending start on rollback', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      const setup = jest.fn();
      const hooks = testTransaction.hooks(localDb, { setup });

      const start = expect(hooks.start()).rejects.toMatchObject({
        name: 'AbortError',
      });
      await hooks.rollback();
      await start;

      expect(setup).not.toHaveBeenCalled();
      // a test transaction left by the start would make it reject
      await root.close();
    });

    it('should rethrow the error of a start that failed after the rollback cancelled it', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      await abortTransaction(localDb);
      const hooks = testTransaction.hooks(localDb);
      let rollback!: Promise<void>;
      onNextSavepoint(() => {
        rollback = hooks.rollback();
      });

      await expect(hooks.start()).rejects.toMatchObject({ code: '25P02' });
      await expect(rollback).rejects.toMatchObject({ code: '25P02' });

      await root.close();
    });

    it('should reject a start called again before the rollback and keep the previous start', async () => {
      const localDb = createTestDb(testDbOptions);
      const { adapter } = localDb.q;
      const { query } = adapter;
      const hooks = testTransaction.hooks(localDb);
      await hooks.start();

      await expectTestTransactionError(hooks.start(), startedAgain);
      await hooks.rollback();
      expect(adapter.query).toBe(query);

      await testTransaction.close(localDb);
    });

    it('should wait for the setup before rolling back', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const hooks = testTransaction.hooks(localDb, {
        async setup() {
          started.resolve();
          await release.promise;
          await setSetting(localDb, 'setup');
        },
      });

      const start = hooks.start();
      await started.promise;
      const rollback = hooks.rollback();
      release.resolve();
      await Promise.all([start, rollback]);

      expect(await getSetting(localDb)).toBe('root');

      await root.close();
    });

    it('should reject start and rollback with the error of the setup', async () => {
      const localDb = createTestDb(testDbOptions);
      const { adapter } = localDb.q;
      const { query } = adapter;
      const error = new Error('setup failed');
      const hooks = testTransaction.hooks(localDb, {
        setup() {
          throw error;
        },
      });

      await expect(hooks.start()).rejects.toBe(error);
      await expect(hooks.rollback()).rejects.toBe(error);
      expect(adapter.query).toBe(query);

      await testTransaction.close(localDb);
    });

    it('should roll back the test transaction of its own start when the rollback waits for the setup', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const hooks = testTransaction.hooks(localDb, {
        async setup() {
          started.resolve();
          await release.promise;
        },
      });
      const next = testTransaction.hooks(localDb);

      const start = hooks.start();
      await started.promise;
      const rollback = hooks.rollback();
      // the next hook starts while the rollback waits for the setup
      await next.start();
      await setSetting(localDb, 'next');
      release.resolve();
      await start;

      await expectTestTransactionError(rollback, innerOpen);
      await expectTestTransactionError(next.rollback(), byOuter);
      expect(await getSetting(localDb)).toBe('root');

      await root.close();
    });

    it('should close the connection after a start cancelled by close', async () => {
      const localDb = createTestDb(testDbOptions);
      const close = jest.spyOn(localDb.q.adapter, 'close');
      const hooks = testTransaction.hooks(localDb);

      const start = expect(hooks.start()).rejects.toMatchObject({
        name: 'AbortError',
      });
      await hooks.close();
      await start;

      expect(close).toHaveBeenCalled();
    });

    it('should close the connection after a failed start and reject with its error', async () => {
      const localDb = createTestDb(testDbOptions);
      const { adapter } = localDb.q;
      const error = new Error('failed to begin');
      jest.spyOn(adapter, 'transaction').mockRejectedValueOnce(error);
      const close = jest.spyOn(adapter, 'close');
      const hooks = testTransaction.hooks(localDb);

      await expect(hooks.start()).rejects.toBe(error);
      await expect(hooks.close()).rejects.toBe(error);

      expect(close).toHaveBeenCalled();
    });

    it('should close the connection before a start called after close', async () => {
      const localDb = createTestDb(testDbOptions);
      const close = jest.spyOn(localDb.q.adapter, 'close');
      const hooks = testTransaction.hooks(localDb);
      await hooks.start();

      const closing = hooks.close();
      const next = testTransaction.start(localDb);
      await closing;
      expect(close).toHaveBeenCalled();

      await (await next).close();
    });
  });
});
