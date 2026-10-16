import {
  createTestDb,
  db,
  testDb,
  testDbOptions,
  useTestDatabase,
  UserData,
} from 'test-utils';
import { testTransaction } from './testTransaction';
import { QueryError } from './query/errors';
import { getDriverErrorCode } from './adapters/adapter';

describe('testTransaction', () => {
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

  it('should support starting and closing multiple times', async () => {
    await testTransaction.start(testDb);
    await testTransaction.close(testDb);
    await testTransaction.start(testDb);
    await testTransaction.close(testDb);
  });

  it('should reject start when the transaction cannot begin', async () => {
    const unreachableDb = createTestDb({
      databaseURL: 'postgres://user@localhost:1/db',
    });

    await expect(testTransaction.start(unreachableDb)).rejects.toThrow();

    await testTransaction.close(unreachableDb);
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

  it('should roll back a transaction that is rolled back while starting', async () => {
    const localDb = createTestDb(testDbOptions);
    const { adapter } = localDb.q;
    const transaction = adapter.transaction.bind(adapter);
    const begin = Promise.withResolvers<void>();
    jest
      .spyOn(adapter, 'transaction')
      .mockImplementationOnce((...args: Parameters<typeof transaction>) =>
        begin.promise.then(() => transaction(...args)),
      );

    const start = testTransaction.start(localDb);
    const rollback = testTransaction.rollback(localDb);
    begin.resolve();

    await expect(start).rejects.toThrow('rolled back before it started');
    await rollback;
    await testTransaction.close(localDb);
  });

  it('should reject a start that is rolled back while starting with the error of its failed transaction', async () => {
    const localDb = createTestDb(testDbOptions);
    const begin = Promise.withResolvers<void>();
    jest.spyOn(localDb.q.adapter, 'transaction').mockImplementationOnce(() =>
      begin.promise.then(() => {
        throw new Error('failed to begin');
      }),
    );

    const start = testTransaction.start(localDb);
    const rollback = testTransaction.rollback(localDb);
    begin.resolve();

    await expect(start).rejects.toThrow('failed to begin');
    await expect(rollback).rejects.toThrow('failed to begin');
    await testTransaction.close(localDb);
  });

  it('should reject a start that is rolled back while starting and keep the outer transaction', async () => {
    const localDb = createTestDb(testDbOptions);
    await testTransaction.start(localDb);
    await localDb.query`SELECT set_config('app.setting', 'outer', true)`;

    const { adapter } = localDb.q;
    const transaction = adapter.transaction.bind(adapter);
    const begin = Promise.withResolvers<void>();
    jest
      .spyOn(adapter, 'transaction')
      .mockImplementationOnce((...args: Parameters<typeof transaction>) =>
        begin.promise.then(() => transaction(...args)),
      );

    const start = testTransaction.start(localDb);
    const rollback = testTransaction.rollback(localDb);
    begin.resolve();

    await expect(start).rejects.toThrow('rolled back before it started');
    await rollback;

    const { rows } = await localDb.query<{
      setting: string;
    }>`SELECT current_setting('app.setting', true) AS setting`;
    expect(rows[0].setting).toBe('outer');

    await testTransaction.close(localDb);
  });
});
