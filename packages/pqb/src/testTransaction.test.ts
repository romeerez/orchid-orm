import vm from 'node:vm';
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
    'Test transaction rollback found an inner test transaction still open or starting',
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
  expected: { kind: string; message?: string; cause?: unknown },
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

// Make the callback of the next savepoint wait for `release`, `created` resolves once the savepoint is created.
const holdNextSavepoint = () => {
  const created = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const { savepoint } = TransactionAdapterClass.prototype;
  jest
    .spyOn(TransactionAdapterClass.prototype, 'savepoint')
    .mockImplementationOnce(function (
      this: TransactionAdapterClass,
      name,
      log,
      cb,
    ) {
      return savepoint.call(this, name, log, async () => {
        created.resolve();
        await release.promise;
        return cb();
      });
    } as typeof savepoint);
  return { created: created.promise, release: release.resolve };
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

    it('should roll back open inner test transactions together with the outer one and block the adapter', async () => {
      const localDb = createTestDb(testDbOptions);
      const close = jest.spyOn(localDb.q.adapter, 'close');
      const root = await testTransaction.start(localDb);
      const a = await testTransaction.start(localDb);
      await setSetting(localDb, 'a');
      // the test transaction of the next test starts before `a` is rolled back
      const b = await testTransaction.start(localDb);

      const cause = await expectTestTransactionError(a.rollback(), innerOpen);
      await expectTestTransactionError(b.rollback(), byOuter);
      expect(localDb.isInTransaction()).toBe(false);

      // the error is reported once, but a test transaction rolled back with an outer one keeps rejecting
      await a.rollback();
      await expectTestTransactionError(b.rollback(), byOuter);

      const blocked = { kind: 'blocked', cause };
      await expectTestTransactionError(getSetting(localDb), blocked);
      await expectTestTransactionError(
        localDb.transaction(async () => {}),
        blocked,
      );
      await expectTestTransactionError(testTransaction.start(localDb), blocked);

      // the connection can be closed, the adapter stays blocked
      await root.close();
      expect(close).toHaveBeenCalled();
      await expectTestTransactionError(testTransaction.start(localDb), blocked);
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
      // the adapter is blocked as soon as the rollback is called
      await expectTestTransactionError(testTransaction.start(localDb), {
        kind: 'blocked',
      });

      await new Promise(setImmediate);
      expect(bRolledBack).toBe(false);

      hold.resolve();
      await Promise.all([aRollback, bRollback, bClose]);
      expect(close).not.toHaveBeenCalled();

      await testTransaction.rollback(localDb);
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

  describe('blocked adapter', () => {
    it('should reject starts of instances sharing the adapter at once when it is blocked', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      // the rollback of the root waits for this savepoint to be released
      const held: HackySavepointState = { name: 'held' };
      await (localDb.$getAdapter() as TransactionAdapter).hackySavepoint(
        held,
        'SELECT 1',
      );
      const outer = await testTransaction.start(other);
      await testTransaction.start(other);
      const rootRollback = root.rollback();
      const begin = jest.spyOn(localDb, 'transaction');
      // waits for the rollback of the root
      const next = testTransaction.start(localDb).catch((err: unknown) => err);

      const cause = await expectTestTransactionError(
        outer.rollback(),
        innerOpen,
      );

      // rejected while the rollback of the root still waits
      const blocked = { kind: 'blocked', cause };
      await expectTestTransactionError(next, blocked);

      await held.activeSavepoint!.release();
      await rootRollback;
      expect(begin).not.toHaveBeenCalled();
      await root.close();
      // a repeated close keeps the block
      await root.close();
      await expectTestTransactionError(testTransaction.start(localDb), blocked);
    });

    it('should reject queries and starts of an instance without a test transaction', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      // has no test transaction, its queries go through the shared adapter
      const outside = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      const outer = await testTransaction.start(other);
      await testTransaction.start(other);

      const cause = await expectTestTransactionError(
        outer.rollback(),
        innerOpen,
      );

      const blocked = { kind: 'blocked', cause };
      await expectTestTransactionError(testTransaction.start(localDb), blocked);
      // only discards the rejected start
      await testTransaction.rollback(localDb);
      await root.close();

      await expectTestTransactionError(outside.query`SELECT 1`, blocked);
      await expectTestTransactionError(
        outside.transaction(async () => {}),
        blocked,
      );
      await expectTestTransactionError(testTransaction.start(outside), blocked);
      await testTransaction.rollback(outside);
    });

    it('should block the adapter when the root ended before the cascade', async () => {
      const localDb = createTestDb(testDbOptions);
      const close = jest.spyOn(localDb.q.adapter, 'close');
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      // has no test transaction, its queries go through the shared adapter
      const outside = createDbWithAdapter({ adapter: localDb.q.adapter });
      await testTransaction.start(localDb);
      const outer = await testTransaction.start(other);
      await testTransaction.start(other);
      await testTransaction.rollback(localDb);
      // a new root start in its turn, paused before its transaction begins
      const begin = holdNextTransaction(localDb.q.adapter);
      const next = testTransaction.start(localDb);
      await begin.called;

      // their savepoints are gone with the root, so their rollback fails as well
      await outer.rollback().catch(noop);
      begin.release();

      const error = await expectTestTransactionError(next, { kind: 'blocked' });
      expect(error.cause).toMatchObject(innerOpen);
      await expectTestTransactionError(outside.query`SELECT 1`, {
        kind: 'blocked',
        cause: error.cause,
      });

      // the transaction of the cancelled start is rolled back, nothing is left to keep the connection open
      await testTransaction.close(localDb);
      expect(close).toHaveBeenCalled();
    });

    it('should block the adapter when the inner test transaction is still starting', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      const a = await testTransaction.start(localDb);
      const { created, release } = holdNextSavepoint();
      const b = testTransaction.start(localDb).catch((err: unknown) => err);
      await created;

      const rollback = a.rollback();
      const error = await expectTestTransactionError(getSetting(localDb), {
        kind: 'blocked',
      });
      expect(error.cause).toMatchObject(innerOpen);
      release();

      await expectTestTransactionError(b, { kind: 'blocked' });
      await expect(rollback).rejects.toBe(error.cause);
      await root.close();
    });

    it('should not block the adapter for an inner start cancelled before the rollback', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      const a = await testTransaction.start(localDb);
      const { created, release } = holdNextSavepoint();
      const abort = new AbortController();
      const reason = new Error('aborted');
      const b = testTransaction.start(localDb, { signal: abort.signal });
      await created;
      abort.abort(reason);

      const rollback = a.rollback();
      release();

      await expect(b).rejects.toBe(reason);
      await rollback;
      await setSetting(localDb, 'root');
      expect(await getSetting(localDb)).toBe('root');
      await root.close();
    });

    it('should reject queries of a `withOptions` scope that outlives the block', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      const release = Promise.withResolvers<void>();
      const late = localDb.withOptions({ log: false }, async () => {
        await release.promise;
        return localDb.query`SELECT 1`;
      });
      const a = await testTransaction.start(localDb);
      await testTransaction.start(localDb);

      const cause = await expectTestTransactionError(a.rollback(), innerOpen);

      // the scope keeps the adapter of the root test transaction, which is not rolled back yet
      release.resolve();
      await expectTestTransactionError(late, { kind: 'blocked', cause });
      await root.close();
    });

    it('should keep the first cause when the rollback that blocked the adapter fails', async () => {
      const localDb = createTestDb(testDbOptions);
      const root = await testTransaction.start(localDb);
      const a = await testTransaction.start(localDb);
      // the rollback of `b` fails with a database error
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
      await testTransaction.start(localDb);

      await expect(a.rollback()).rejects.toBeInstanceOf(QueryError);

      const error = await expectTestTransactionError(getSetting(localDb), {
        kind: 'blocked',
      });
      expect(error.cause).toMatchObject(innerOpen);
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
        message:
          'A test transaction of another instance cannot start while a test transaction is rolling back',
      });
      await Promise.all([query, rollback]);

      // the adapter is restored for the next test transaction
      const next = await testTransaction.start(localDb);
      await setSetting(localDb, 'next');
      expect(await getSetting(localDb)).toBe('next');
      await next.close();
    });

    it('should roll back a test transaction of another instance sharing the adapter to its own savepoint when a transaction of a third instance outlives it', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const third = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');
      const inner = await testTransaction.start(other);
      await setSetting(other, 'inner');
      const late = holdTransaction(third);
      await late.opened;

      await inner.rollback();
      expect(await getSetting(localDb)).toBe('root');

      // the late end of the transaction must not release the savepoint of the next test transaction:
      // its own savepoint is gone, so its `RELEASE` fails (postgres-js sends no `RELEASE`)
      const next = await testTransaction.start(other);
      late.release();
      await late.transaction.catch(noop);
      await next.rollback();
      expect(await getSetting(localDb)).toBe('root');

      await root.close();
    });

    it('should allow a new test transaction when the root is rolled back first', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const third = createDbWithAdapter({ adapter: localDb.q.adapter });
      await testTransaction.start(localDb);
      const inner = await testTransaction.start(other);
      const innermost = await testTransaction.start(third);

      await testTransaction.rollback(localDb);
      // their savepoints are gone with the root
      await expect(inner.rollback()).rejects.toThrow();
      await expect(innermost.rollback()).rejects.toThrow();

      const next = await testTransaction.start(localDb);
      await setSetting(localDb, 'next');
      expect(await getSetting(localDb)).toBe('next');
      await next.close();
    });

    it('should keep the adapter routed to the new root when an old test transaction of another instance ends late', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      // has no test transaction, its queries go through the shared adapter
      const outside = createDbWithAdapter({ adapter: localDb.q.adapter });
      await testTransaction.start(localDb);
      // let the savepoint roll back, but delay the end of the test transaction of `other` until the next root started
      const rolledBack = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      onNextSavepoint(noop, (result) =>
        result.finally(() => {
          rolledBack.resolve();
          return release.promise;
        }),
      );
      const inner = await testTransaction.start(other);
      const rollback = inner.rollback();
      await rolledBack.promise;
      await testTransaction.rollback(localDb);

      const next = await testTransaction.start(localDb);
      await setSetting(localDb, 'next');
      release.resolve();
      await rollback;

      expect(await getSetting(outside)).toBe('next');
      await next.close();
    });

    it('should reject a start of another instance that resumes after the root is rolled back', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      // has no test transaction, its queries go through the shared adapter
      const outside = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      // create the savepoint, then delay the start until the root is rolled back
      const { created, release } = holdNextSavepoint();
      const inner = testTransaction.start(other);
      await created;

      await root.rollback();
      release();

      // its savepoint is gone with the root, so the rollback of the savepoint fails as well
      await expect(inner).rejects.toThrow();
      // the adapter is not routed to the test transaction of `other`
      await outside.query`SELECT 1`;
      await root.close();
    });

    it('should reject queries through the shared adapter after a middle test transaction ends', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const third = createDbWithAdapter({ adapter: localDb.q.adapter });
      // has no test transaction, its queries go through the shared adapter
      const outside = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      await testTransaction.start(other);
      const innermost = await testTransaction.start(third);

      await testTransaction.rollback(other);
      await expectTestTransactionError(outside.query`SELECT 1`, {
        kind: 'rolledBack',
      });

      // its savepoint is gone with the test transaction of `other`
      await innermost.rollback().catch(noop);
      await root.close();
    });

    it('should wait for queries through the shared adapter before rolling back a test transaction of another instance', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      // has no test transaction, its queries go through the shared adapter
      const outside = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');
      const inner = await testTransaction.start(other);
      await setSetting(other, 'inner');
      const called = onNextQuery();
      const late = outside.withOptions(
        { setConfig: { 'app.setting': 'late' } },
        () => outside.query`SELECT pg_sleep(0.05)`,
      );
      await called;

      await Promise.all([late, inner.rollback()]);

      // restoring the settings after the rollback would leave 'inner' in the root
      expect(await getSetting(localDb)).toBe('root');
      await root.close();
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

  describe('after-commit hooks', () => {
    const createLocalDb = () => createTestDb(testDbOptions);
    type TestDb = ReturnType<typeof createLocalDb>;

    // a table for queries with after-commit hooks, it exists inside the test transaction that creates it
    const createTable = (db: Db) =>
      db.query`CREATE TEMP TABLE hooked (id int PRIMARY KEY)`;
    const hooked = (db: TestDb) =>
      db('hooked', (t) => ({ id: t.integer().primaryKey() }));

    // Resolves with `rolledBack` that is `false` while the rollback waits, after a turn of the event loop.
    const isRolledBack = async (rollback: Promise<unknown>) => {
      let rolledBack = false;
      rollback.then(
        () => (rolledBack = true),
        () => (rolledBack = true),
      );
      await new Promise(setImmediate);
      return rolledBack;
    };

    // the places that run after-commit hooks, each adds the hook and resolves once it has been called
    const sites = [
      [
        'of a transaction',
        (db: TestDb, hook: () => unknown) =>
          db.transaction(async () => db.afterCommit(hook)),
      ],
      [
        'of a query outside of a transaction',
        async (db: TestDb, hook: () => unknown) => {
          await createTable(db);
          await hooked(db).insert({ id: 1 }).afterCreateCommit([], hook);
        },
      ],
      [
        'added outside of a transaction',
        async (db: TestDb, hook: () => unknown) => db.afterCommit(hook),
      ],
    ] as const;

    it.each(sites)(
      'should roll back after the promise returned by an after-commit hook %s settles',
      async (_, addHook) => {
        const localDb = createLocalDb();
        const root = await testTransaction.start(localDb);
        await setSetting(localDb, 'root');
        const level = await testTransaction.start(localDb);
        const release = Promise.withResolvers<void>();
        let work: Promise<unknown> | undefined;
        await addHook(
          localDb,
          () =>
            (work = release.promise.then(() => setSetting(localDb, 'hook'))),
        );

        const rollback = level.rollback();
        expect(await isRolledBack(rollback)).toBe(false);

        release.resolve();
        await Promise.all([rollback, work]);
        // the setting of the hook ended with the test transaction rather than landing in the outer one
        expect(await getSetting(localDb)).toBe('root');
        await root.close();
      },
    );

    it.each(sites)(
      'should let an after-commit hook %s run queries in the test transaction after it calls the rollback',
      async (_, addHook) => {
        const localDb = createLocalDb();
        const root = await testTransaction.start(localDb);
        let close: Promise<void> | undefined;
        let work: Promise<unknown> | undefined;
        await addHook(localDb, () => {
          close = root.close();
          return (work = localDb.transaction(async () => {
            await setSetting(localDb, 'hook');
            return getSetting(localDb);
          }));
        });

        expect(await work).toBe('hook');
        await close;
      },
    );

    it('should roll back a test transaction of another instance sharing the adapter after the promise returned by its after-commit hook settles', async () => {
      const localDb = createLocalDb();
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');
      const inner = await testTransaction.start(other);
      const release = Promise.withResolvers<void>();
      let work: Promise<unknown> | undefined;
      await other.transaction(async () =>
        other.afterCommit(
          () =>
            (work = release.promise.then(() =>
              other.transaction(async () => {
                await setSetting(other, 'hook');
                return getSetting(other);
              }),
            )),
        ),
      );

      const rollback = inner.rollback();
      expect(await isRolledBack(rollback)).toBe(false);

      release.resolve();
      expect(await work).toBe('hook');
      await rollback;
      expect(await getSetting(localDb)).toBe('root');
      await root.close();
    });

    it('should not run a query builder returned by an after-commit hook added outside of a transaction', async () => {
      const localDb = createLocalDb();
      const root = await testTransaction.start(localDb);
      await createTable(localDb);
      localDb.afterCommit(() => hooked(localDb).insert({ id: 1 }));
      // the hook has been called
      await new Promise(setImmediate);

      expect(await hooked(localDb).count()).toBe(0);
      await root.close();
    });

    it('should roll back after a promise of another realm returned by an after-commit hook added outside of a transaction settles', async () => {
      const localDb = createLocalDb();
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');
      const level = await testTransaction.start(localDb);
      const realm: { resolve?: () => void } = {};
      const released: Promise<void> = vm.runInNewContext(
        'new Promise((resolve) => { this.resolve = resolve })',
        realm,
      );
      expect(released).not.toBeInstanceOf(Promise);
      let work: Promise<unknown> | undefined;
      // `then` of a promise of another realm returns a promise of that realm
      localDb.afterCommit(
        () => (work = released.then(() => setSetting(localDb, 'hook'))),
      );
      // the hook has been called
      await new Promise(setImmediate);

      const rollback = level.rollback();
      expect(await isRolledBack(rollback)).toBe(false);

      realm.resolve!();
      await Promise.all([rollback, work]);
      expect(await getSetting(localDb)).toBe('root');
      await root.close();
    });

    it('should wait for after-commit hooks of queries run by an after-commit hook', async () => {
      const localDb = createLocalDb();
      const root = await testTransaction.start(localDb);
      await createTable(localDb);
      await setSetting(localDb, 'root');
      const level = await testTransaction.start(localDb);
      let inserted: Promise<unknown> | undefined;
      let work: Promise<unknown> | undefined;
      await localDb.transaction(async () =>
        localDb.afterCommit(
          () =>
            (inserted = hooked(localDb)
              .insert({ id: 1 })
              // starts its query once the first hook has ended, after the rollback would have been sent
              .afterCreateCommit(
                [],
                () =>
                  (work = inserted!
                    .then(() => new Promise(setImmediate))
                    .then(() => setSetting(localDb, 'hook'))),
              )
              .then(noop)),
        ),
      );

      await level.rollback();
      await work;
      // the setting of the second hook ended with the test transaction rather than landing in the outer one
      expect(await getSetting(localDb)).toBe('root');
      await root.close();
    });

    it('should reject a test transaction of another instance sharing the adapter started while the rollback waits for after-commit hooks', async () => {
      const localDb = createLocalDb();
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      const release = Promise.withResolvers<void>();
      await localDb.transaction(async () =>
        localDb.afterCommit(() => release.promise),
      );

      const close = root.close();
      await expectTestTransactionError(testTransaction.start(other), {
        kind: 'rolledBack',
      });

      release.resolve();
      await close;
    });

    it('should reject a test transaction of another instance sharing the adapter started while the rollback of an inner test transaction waits for after-commit hooks', async () => {
      const localDb = createLocalDb();
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      await setSetting(localDb, 'root');
      const level = await testTransaction.start(localDb);
      const release = Promise.withResolvers<void>();
      await localDb.transaction(async () =>
        localDb.afterCommit(() => release.promise),
      );

      // it would start inside the test transaction being rolled back, and be rolled back with it
      const rollback = level.rollback();
      await expectTestTransactionError(testTransaction.start(other), {
        kind: 'rolledBack',
        message:
          'A test transaction of another instance cannot start while a test transaction is rolling back',
      });
      // discards the record of the failed start
      await testTransaction.rollback(other);

      release.resolve();
      await rollback;
      const inner = await testTransaction.start(other);
      await setSetting(other, 'inner');
      await inner.rollback();
      expect(await getSetting(localDb)).toBe('root');
      await root.close();
    });

    it('should reject a start of another instance through a test transaction of a third one that resumes while the rollback waits for after-commit hooks', async () => {
      const localDb = createLocalDb();
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const third = createDbWithAdapter({ adapter: localDb.q.adapter });
      const root = await testTransaction.start(localDb);
      const inner = await testTransaction.start(other);
      const release = Promise.withResolvers<void>();
      await localDb.transaction(async () =>
        localDb.afterCommit(() => release.promise),
      );
      // create the savepoint, then delay the start until the rollback of the root is called
      const held = holdNextSavepoint();
      const innermost = testTransaction.start(third);
      await held.created;

      const rollback = root.rollback();
      held.release();
      await expectTestTransactionError(innermost, { kind: 'rolledBack' });

      release.resolve();
      await rollback;
      // its savepoint is gone with the root
      await expect(inner.rollback()).rejects.toThrow();
      await root.close();
    });

    it('should block the adapter when an after-commit hook does not end within the teardownTimeout', async () => {
      const localDb = createLocalDb();
      const hooks = testTransaction.hooks(localDb, { teardownTimeout: 20 });
      await hooks.start();
      const release = Promise.withResolvers<void>();
      await localDb.transaction(async () =>
        localDb.afterCommit(() => release.promise),
      );

      await expectTestTransactionError(hooks.close(), {
        kind: 'teardownTimeout',
      });

      release.resolve();
      await expectTestTransactionError(localDb.query`SELECT 1`, {
        kind: 'blocked',
      });
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

      const cause = await expectTestTransactionError(rollback, innerOpen);
      await expectTestTransactionError(next.rollback(), byOuter);
      await expectTestTransactionError(getSetting(localDb), {
        kind: 'blocked',
        cause,
      });

      // the hooks of the following test reject with the block
      const following = testTransaction.hooks(localDb);
      const error = await expectTestTransactionError(following.start(), {
        kind: 'blocked',
        cause,
      });
      await expect(following.rollback()).rejects.toBe(error);

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

  describe('teardownTimeout', () => {
    const teardownTimeout = {
      kind: 'teardownTimeout',
      message: "Test transaction teardown didn't end within 20 ms",
    };

    it('should throw for a teardownTimeout that `setTimeout` does not support', () => {
      for (const value of [0, -1, NaN, Infinity, 2 ** 31]) {
        expect(() =>
          testTransaction.hooks(db, { teardownTimeout: value }),
        ).toThrow(RangeError);
      }
    });

    it('should block the adapter when the rollback waits for a query longer than the teardownTimeout', async () => {
      const localDb = createTestDb(testDbOptions);
      const hooks = testTransaction.hooks(localDb, { teardownTimeout: 20 });
      await hooks.start();
      const query = localDb.query`SELECT pg_sleep(0.2)`;

      const error = await expectTestTransactionError(
        hooks.rollback(),
        teardownTimeout,
      );
      await expectTestTransactionError(getSetting(localDb), {
        kind: 'blocked',
        cause: error,
      });
      await expectTestTransactionError(hooks.start(), {
        kind: 'blocked',
        cause: error,
      });

      // the rollback goes on once the query ends
      await query;
      await testTransaction.close(localDb);
    });

    it('should reject when fake timers are enabled before the teardown', async () => {
      const localDb = createTestDb(testDbOptions);
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const hooks = testTransaction.hooks(localDb, {
        teardownTimeout: 20,
        async setup() {
          started.resolve();
          await release.promise;
        },
      });
      const start = hooks.start();
      await started.promise;

      jest.useFakeTimers();
      try {
        await expectTestTransactionError(hooks.rollback(), teardownTimeout);
      } finally {
        jest.useRealTimers();
      }

      release.resolve();
      await start;
      await testTransaction.close(localDb);
    });

    it('should count the teardownTimeout from the call through all the steps of the teardown', async () => {
      const localDb = createTestDb(testDbOptions);
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const hooks = testTransaction.hooks(localDb, {
        teardownTimeout: 200,
        async setup() {
          started.resolve();
          await release.promise;
        },
      });
      const start = hooks.start();
      await started.promise;

      // the wait for the setup and the rollback waiting for a query take 120 ms each, each of them fits in the time on its own
      const rollback = hooks.rollback();
      await new Promise((resolve) => setTimeout(resolve, 120));
      const query = localDb.query`SELECT pg_sleep(0.12)`;
      release.resolve();
      await start;

      await expectTestTransactionError(rollback, {
        kind: 'teardownTimeout',
      });

      await query;
      await testTransaction.close(localDb);
    });

    it('should not block the adapter after a teardown that ended in time', async () => {
      const localDb = createTestDb(testDbOptions);
      const hooks = testTransaction.hooks(localDb, { teardownTimeout: 500 });
      await hooks.start();
      await hooks.rollback();

      await new Promise((resolve) => setTimeout(resolve, 550));
      await hooks.start();
      expect(await getSetting(localDb)).toBe(null);

      await hooks.close();
    });

    it('should block the adapter when the transaction of the start begins later than the teardownTimeout', async () => {
      const localDb = createTestDb(testDbOptions);
      const { adapter } = localDb.q;
      const begin = holdNextTransaction(adapter);
      const hooks = testTransaction.hooks(localDb, { teardownTimeout: 20 });
      const start = hooks.start().catch((err: unknown) => err);
      await begin.called;

      const error = await expectTestTransactionError(
        hooks.rollback(),
        teardownTimeout,
      );
      await expectTestTransactionError(adapter.query('SELECT 1'), {
        kind: 'blocked',
        cause: error,
      });

      // cancelled by the rollback before the timeout
      begin.release();
      expect(await start).toMatchObject({ name: 'AbortError' });
      await testTransaction.close(localDb);
    });

    it('should block the adapter when closing the connection takes longer than the teardownTimeout', async () => {
      const localDb = createTestDb(testDbOptions);
      const { adapter } = localDb.q;
      const { close } = adapter;
      const closing = Promise.withResolvers<void>();
      const closed = closing.promise.then(() => close.call(adapter));
      jest.spyOn(adapter, 'close').mockReturnValueOnce(closed);
      const hooks = testTransaction.hooks(localDb, { teardownTimeout: 20 });
      await hooks.start();

      const error = await expectTestTransactionError(
        hooks.close(),
        teardownTimeout,
      );
      await expectTestTransactionError(adapter.query('SELECT 1'), {
        kind: 'blocked',
        cause: error,
      });

      closing.resolve();
      await closed;
    });

    it('should keep the first cause when the adapter was blocked before the teardownTimeout', async () => {
      const localDb = createTestDb(testDbOptions);
      const other = createDbWithAdapter({ adapter: localDb.q.adapter });
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const hooks = testTransaction.hooks(localDb, {
        teardownTimeout: 20,
        async setup() {
          started.resolve();
          await release.promise;
        },
      });
      const start = hooks.start();
      await started.promise;
      const outer = await testTransaction.start(other);
      await testTransaction.start(other);
      const cause = await expectTestTransactionError(
        outer.rollback(),
        innerOpen,
      );

      await expectTestTransactionError(hooks.rollback(), teardownTimeout);
      await expectTestTransactionError(getSetting(localDb), {
        kind: 'blocked',
        cause,
      });

      release.resolve();
      await start;
      await testTransaction.close(localDb);
    });

    // the test runner fails the test when the late failure is left unhandled
    it('should ignore a failure of the teardown after the teardownTimeout', async () => {
      const localDb = createTestDb(testDbOptions);
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const failure = new Error('setup failed');
      const hooks = testTransaction.hooks(localDb, {
        teardownTimeout: 20,
        async setup() {
          started.resolve();
          await release.promise;
          throw failure;
        },
      });
      const start = hooks.start().catch((err: unknown) => err);
      await started.promise;

      await expectTestTransactionError(hooks.rollback(), teardownTimeout);
      release.resolve();
      expect(await start).toBe(failure);
      await testTransaction.close(localDb);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });
});
