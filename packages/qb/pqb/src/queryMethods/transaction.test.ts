import pg, { Client } from 'pg';
import { assertType, testDb, useTestDatabase } from 'test-utils';
import { User, userColumnsSql } from '../test-utils/test-utils';
import { AfterCommitError, noop } from 'orchid-core';

describe('transaction', () => {
  beforeEach(() => jest.clearAllMocks());
  afterAll(testDb.close);

  it('should start and commit transaction', async () => {
    const spy = jest.spyOn(pg.Client.prototype, 'query');

    const result = await testDb.transaction(async () => {
      const {
        rows: [{ a }],
      } = await testDb.query`SELECT 1 AS a`;
      const {
        rows: [{ b }],
      } = await testDb.query`SELECT 2 AS b`;
      return (a + b) as number;
    });

    assertType<typeof result, number>();

    expect(result).toBe(3);

    expect(
      spy.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual(['BEGIN', 'SELECT 1 AS a', 'SELECT 2 AS b', 'COMMIT']);
  });

  it('should rollback if error happens', async () => {
    const spy = jest.spyOn(pg.Client.prototype, 'query');

    let error: Error | undefined;

    await testDb
      .transaction(async () => {
        throw new Error('error');
      })
      .catch((err) => (error = err));

    expect(error?.message).toBe('error');

    expect(
      spy.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('should accept isolation level and options', async () => {
    const spy = jest.spyOn(pg.Client.prototype, 'query');

    await testDb.transaction('REPEATABLE READ', async () => {});
    await testDb.transaction(
      {
        level: 'READ COMMITTED',
        readOnly: false,
        deferrable: false,
      },
      async () => {},
    );
    await testDb.transaction(
      {
        level: 'READ UNCOMMITTED',
        readOnly: true,
        deferrable: true,
      },
      async () => {},
    );

    expect(
      spy.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual([
      'BEGIN ISOLATION LEVEL REPEATABLE READ',
      'COMMIT',
      'BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE NOT DEFERRABLE',
      'COMMIT',
      'BEGIN ISOLATION LEVEL READ UNCOMMITTED READ ONLY DEFERRABLE',
      'COMMIT',
    ]);
  });

  it('should run a nested transaction with SAVEPOINT and RELEASE SAVEPOINT', async () => {
    const query = jest.spyOn(Client.prototype, 'query');

    const result = await testDb.transaction(
      async () =>
        await testDb.transaction(async () =>
          testDb.queryBuilder.get(testDb.sql`123`),
        ),
    );

    expect(result).toBe(123);

    expect(
      query.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual([
      'BEGIN',
      'SAVEPOINT "1"',
      'SELECT 123 LIMIT 1',
      'RELEASE SAVEPOINT "1"',
      'COMMIT',
    ]);
  });

  it('should rollback a nested transaction with ROLLBACK TO SAVEPOINT', async () => {
    const query = jest.spyOn(Client.prototype, 'query');

    await expect(() =>
      testDb.transaction(
        async () =>
          await testDb.transaction(async () => {
            throw new Error('error');
          }),
      ),
    ).rejects.toThrow('error');

    expect(
      query.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual([
      'BEGIN',
      'SAVEPOINT "1"',
      'ROLLBACK TO SAVEPOINT "1"',
      'ROLLBACK',
    ]);
  });

  it('should expose a `client` object of the database adapter', async () => {
    let client: unknown;
    await testDb.transaction(async () => {
      client = testDb.internal.transactionStorage.getStore()?.adapter.client;
    });

    expect(client).toBeInstanceOf(Client);
  });

  describe('log option', () => {
    it('should log all the queries inside a transaction', async () => {
      const log = jest.spyOn(console, 'log').mockImplementation(noop);

      await testDb.transaction({ log: true }, async () => {
        await User.log(false); // transaction log overrides query's log
        await testDb.query`SELECT 1 AS a`;
      });

      expect(log.mock.calls).toEqual([
        [expect.stringContaining(`BEGIN`)],
        [expect.stringContaining(`SELECT ${userColumnsSql} FROM "user"`)],
        [expect.stringContaining(`SELECT 1 AS a`)],
        [expect.stringContaining(`COMMIT`)],
      ]);
    });
  });

  describe('ensureTransaction', () => {
    it('should not start another transaction when already inside a transaction', async () => {
      const spy = jest.spyOn(pg.Client.prototype, 'query');

      const result = await testDb.transaction(async () => {
        return testDb.ensureTransaction(async () => {
          const {
            rows: [{ a }],
          } = await testDb.query`SELECT 1 AS a`;
          const {
            rows: [{ b }],
          } = await testDb.query`SELECT 2 AS b`;

          return a + b;
        });
      });

      expect(result).toBe(3);

      expect(
        spy.mock.calls.map(
          (call) => (call[0] as unknown as { text: string }).text,
        ),
      ).toEqual(['BEGIN', 'SELECT 1 AS a', 'SELECT 2 AS b', 'COMMIT']);
    });

    it('should start a transaction if it was not started yet', async () => {
      const spy = jest.spyOn(pg.Client.prototype, 'query');

      const result = await testDb.ensureTransaction(async () => {
        const {
          rows: [{ a }],
        } = await testDb.query`SELECT 1 AS a`;
        const {
          rows: [{ b }],
        } = await testDb.query`SELECT 2 AS b`;

        return (a + b) as number;
      });

      assertType<typeof result, number>();

      expect(result).toBe(3);

      expect(
        spy.mock.calls.map(
          (call) => (call[0] as unknown as { text: string }).text,
        ),
      ).toEqual(['BEGIN', 'SELECT 1 AS a', 'SELECT 2 AS b', 'COMMIT']);
    });
  });

  describe('isInTransaction', () => {
    it("should indicate whether we're inside a transaction", async () => {
      expect(testDb.isInTransaction()).toBe(false);

      await testDb.transaction(async () => {
        expect(testDb.isInTransaction()).toBe(true);
      });

      expect(testDb.isInTransaction()).toBe(false);
    });

    describe('in testTransaction', () => {
      useTestDatabase();

      it('should trick testTransaction into thinking that we are not in transaction on the top level', async () => {
        expect(testDb.isInTransaction()).toBe(false);

        await testDb.transaction(async () => {
          expect(testDb.isInTransaction()).toBe(true);
        });
      });
    });
  });

  describe('afterCommit', () => {
    afterEach(() => {
      const t = testDb.internal.transactionStorage.getStore();
      if (t) {
        delete t.afterCommit;
        delete t.catchAfterCommitError;
      }
    });

    // Async hook is a jest mock which only records the call only after it has been awaited.
    const createAsyncHook = () => {
      const mock = jest.fn();
      return new Proxy(mock, {
        apply: async (...args) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return mock.apply(args);
        },
      });
    };

    it('should run immediately without transaction', async () => {
      const hook = createAsyncHook();

      await testDb.afterCommit(hook);
      expect(hook).toHaveBeenCalledTimes(1);
    });

    it('runs multiple hooks after transaction commits', async () => {
      const hooks = [createAsyncHook(), createAsyncHook(), jest.fn()];

      await testDb.transaction(async () => {
        for (const hook of hooks) {
          await testDb.afterCommit(hook);
        }
        for (const hook of hooks) {
          expect(hook).toHaveBeenCalledTimes(0);
        }
      });
      for (const hook of hooks) {
        expect(hook).toHaveBeenCalledTimes(1);
      }
    });

    it('works inside nested transaction', async () => {
      const hook = createAsyncHook();

      await testDb.transaction(async () => {
        await testDb.afterCommit(hook);
        expect(hook).toHaveBeenCalledTimes(0);
        await testDb.transaction(async () => {
          await testDb.afterCommit(hook);
          expect(hook).toHaveBeenCalledTimes(0);
        });
        expect(hook).toHaveBeenCalledTimes(0);
      });
      expect(hook).toHaveBeenCalledTimes(2);
    });

    it('ignores hooks if transaction rolls back', async () => {
      const hook = jest.fn();

      await testDb
        .transaction(async () => {
          await testDb.afterCommit(hook);
          throw new Error('Rollback');
        })
        .catch((err) => err);
      expect(hook).toHaveBeenCalledTimes(0);
    });

    it('should throw AfterCommitError with transaction result and hook results from Promise.allSettled', async () => {
      const err = await testDb
        .transaction(async () => {
          await testDb.afterCommit(function one() {
            return 'ok';
          });
          await testDb.afterCommit(function two() {
            throw new Error('error');
          });
          return 'transaction result';
        })
        .catch((err) => err);

      expect(err).toBeInstanceOf(AfterCommitError);
      expect(err).toMatchObject({
        result: 'transaction result',
        hookResults: [
          {
            status: 'fulfilled',
            value: 'ok',
            name: 'one',
          },
          {
            status: 'rejected',
            reason: expect.objectContaining({
              message: 'error',
            }),
          },
        ],
      });
    });

    describe('works in testTransaction', () => {
      useTestDatabase();

      it('should run immediately in test transaction', async () => {
        const hook = createAsyncHook();

        await testDb.afterCommit(hook);
        expect(hook).toHaveBeenCalledTimes(1);
      });

      it('runs hooks after user transaction commits', async () => {
        const hook = createAsyncHook();

        await testDb.transaction(async () => {
          await testDb.afterCommit(hook);
          expect(hook).toHaveBeenCalledTimes(0);
        });
        expect(hook).toHaveBeenCalledTimes(1);
      });
    });
  });
});
