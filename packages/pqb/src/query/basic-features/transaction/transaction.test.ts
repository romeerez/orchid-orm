import {
  assertType,
  db,
  useTestDatabase,
  UserData,
  UserSelectAll,
} from 'test-utils';
import { AfterCommitError } from './transaction';
import { noop } from '../../../utils';
import {
  AdapterClass,
  TransactionAdapterClass,
} from '../../../adapters/adapter';

const afterCommitSampleError = {
  hookResults: [
    {
      name: 'one',
      status: 'fulfilled',
      value: 'hook ok',
    },
    {
      name: 'two',
      status: 'rejected',
      reason: expect.objectContaining({
        message: 'error',
      }),
    },
  ],
};

describe('transaction', () => {
  beforeEach(() => jest.clearAllMocks());
  afterAll(db.$close);

  it('should start and commit transaction', async () => {
    const transactionSpy = jest.spyOn(AdapterClass.prototype, 'transaction');
    const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');

    const result = await db.$transaction(async () => {
      const {
        rows: [{ a }],
      } = await db.$query`SELECT 1 AS a`;
      const {
        rows: [{ b }],
      } = await db.$query`SELECT 2 AS b`;
      return (a + b) as number;
    });

    assertType<typeof result, number>();

    expect(result).toBe(3);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(querySpy.mock.calls.map((call) => call[0])).toEqual([
      'SELECT 1 AS a',
      'SELECT 2 AS b',
    ]);
  });

  it('should rollback if error happens', async () => {
    const transactionSpy = jest.spyOn(AdapterClass.prototype, 'transaction');
    const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');

    let error: Error | undefined;

    await db
      .$transaction(async () => {
        throw new Error('error');
      })
      .catch((err) => (error = err));

    expect(error?.message).toBe('error');

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(querySpy.mock.calls).toEqual([]);
  });

  it('should accept isolation level and options', async () => {
    const transactionSpy = jest.spyOn(AdapterClass.prototype, 'transaction');

    const one = 'REPEATABLE READ' as const;
    const two = {
      level: 'READ COMMITTED' as const,
      readOnly: false,
      deferrable: false,
    };
    const three = {
      level: 'READ UNCOMMITTED' as const,
      readOnly: true,
      deferrable: true,
    };

    await db.$transaction(one, async () => {});
    await db.$transaction(two, async () => {});
    await db.$transaction(three, async () => {});

    expect(transactionSpy.mock.calls.map((call) => call[1])).toMatchObject([
      { level: one },
      two,
      three,
    ]);
  });

  describe('log option', () => {
    it('should log all the queries inside a transaction', async () => {
      const log = jest.spyOn(console, 'log').mockImplementation(noop);

      await db.$transaction({ log: true }, async () => {
        await db.user.log(false); // transaction log overrides query's log
        await db.$query`SELECT 1 AS a`;
      });

      expect(log.mock.calls).toEqual([
        [expect.stringContaining(`BEGIN`)],
        [
          expect.stringContaining(
            `SELECT ${UserSelectAll} FROM "schema"."user"`,
          ),
        ],
        [expect.stringContaining(`SELECT 1 AS a`)],
        [expect.stringContaining(`COMMIT`)],
      ]);
    });
  });

  describe('ensureTransaction', () => {
    it('should not start another transaction when already inside a transaction', async () => {
      const transactionSpy = jest.spyOn(AdapterClass.prototype, 'transaction');
      const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');

      const result = await db.$transaction(async () => {
        return db.$ensureTransaction(async () => {
          const {
            rows: [{ a }],
          } = await db.$query`SELECT 1 AS a`;
          const {
            rows: [{ b }],
          } = await db.$query`SELECT 2 AS b`;

          return a + b;
        });
      });

      expect(result).toBe(3);

      expect(transactionSpy).toHaveBeenCalledTimes(1);
      expect(querySpy.mock.calls.map((call) => call[0])).toEqual([
        'SELECT 1 AS a',
        'SELECT 2 AS b',
      ]);
    });

    it('should start a transaction if it was not started yet', async () => {
      const transactionSpy = jest.spyOn(AdapterClass.prototype, 'transaction');
      const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');

      const result = await db.$ensureTransaction(async () => {
        const {
          rows: [{ a }],
        } = await db.$query`SELECT 1 AS a`;
        const {
          rows: [{ b }],
        } = await db.$query`SELECT 2 AS b`;

        return (a + b) as number;
      });

      assertType<typeof result, number>();

      expect(result).toBe(3);

      expect(transactionSpy).toHaveBeenCalledTimes(1);
      expect(querySpy.mock.calls.map((call) => call[0])).toEqual([
        'SELECT 1 AS a',
        'SELECT 2 AS b',
      ]);
    });
  });

  describe('isInTransaction', () => {
    it("should indicate whether we're inside a transaction", async () => {
      expect(db.$isInTransaction()).toBe(false);

      await db.$transaction(async () => {
        expect(db.$isInTransaction()).toBe(true);
      });

      expect(db.$isInTransaction()).toBe(false);
    });

    describe('in testTransaction', () => {
      useTestDatabase();

      it('should trick testTransaction into thinking that we are not in transaction on the top level', async () => {
        expect(db.$isInTransaction()).toBe(false);

        await db.$transaction(async () => {
          expect(db.$isInTransaction()).toBe(true);
        });
      });
    });
  });

  describe('afterCommit hooks', () => {
    useTestDatabase(db);

    it('should not make the transaction wait for afterCommit hook to finish', async () => {
      let hookCalled = false;
      let hookAwaited = false;

      const result = await db.$transaction(async () => {
        await db.user.insert(UserData).afterCreateCommit([], async () => {
          hookCalled = true;
          await new Promise((resolve) => process.nextTick(resolve));
          hookAwaited = true;
        });

        return 'ok';
      });

      expect(result).toBe('ok');
      expect(hookCalled).toBe(true);
      expect(hookAwaited).toBe(false);
    });

    it('should catch afterCommit errors with catchAfterCommitError, should call all catches even if any of them fails', async () => {
      const catcher1 = jest.fn(() => {
        throw new Error('catcher error');
      });
      const catcher2 = jest.fn();

      const result = await db.$transaction(async () => {
        await db.user
          .insert(UserData)
          .afterCreateCommit([], function one() {
            return 'hook ok';
          })
          .afterCreateCommit([], function two() {
            throw new Error('error');
          })
          .catchAfterCommitError(catcher1)
          .catchAfterCommitError(catcher2);

        return 'ok';
      });

      expect(result).toBe('ok');

      await new Promise(queueMicrotask as never);

      expect(catcher1).toHaveBeenCalledTimes(1);
      expect(catcher2).toHaveBeenCalledTimes(1);

      const err = (catcher1.mock.calls[0] as unknown as [unknown])[0];
      expect(err).toBeInstanceOf(AfterCommitError);
      expect(err).toMatchObject({
        ...afterCommitSampleError,
        result: 'ok',
      });
    });
  });

  describe('afterCommit standalone hook', () => {
    it('should run all afterCommit hook after the outermost transaction commit', async () => {
      const hook1 = jest.fn();
      const hook2 = jest.fn();
      const hook3 = jest.fn();

      await db.$transaction(async () => {
        await db.$transaction(async () => {
          db.$afterCommit(hook1);
          db.$afterCommit(hook2);
        });
        db.$afterCommit(hook3);

        expect(hook1).not.toHaveBeenCalled();
        expect(hook2).not.toHaveBeenCalled();
        expect(hook3).not.toHaveBeenCalled();
      });

      expect(hook1).toHaveBeenCalled();
      expect(hook2).toHaveBeenCalled();
      expect(hook3).toHaveBeenCalled();
    });

    it('should not run if the transaction fails', async () => {
      const hook1 = jest.fn();
      const hook2 = jest.fn();

      await db
        .$transaction(async () => {
          await db.$transaction(async () => {
            db.$afterCommit(hook1);
          });
          db.$afterCommit(hook2);

          throw new Error('error');
        })
        .catch(() => {});

      expect(hook1).not.toHaveBeenCalled();
      expect(hook2).not.toHaveBeenCalled();
    });

    it('should run in next microtask when not in transaction', async () => {
      const hook = jest.fn();

      db.$afterCommit(hook);

      expect(hook).not.toHaveBeenCalled();

      await new Promise(queueMicrotask as never);

      expect(hook).toHaveBeenCalled();
    });
  });
});

describe('hooks with no test transaction', () => {
  beforeEach(() => {
    jest
      .spyOn(db.user.adapterNotInTransaction, 'query')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({ rowCount: 1, rows: [] } as any);
  });

  it('should not make the transaction wait for afterCommit hook to finish', async () => {
    let hookCalled = false;
    let hookAwaited = false;

    const result = await db.user
      .all()
      .delete()
      .afterDeleteCommit([], async () => {
        hookCalled = true;
        await new Promise((resolve) => process.nextTick(resolve));
        hookAwaited = true;
      });

    expect(result).toBe(1);
    expect(hookCalled).toBe(true);
    expect(hookAwaited).toBe(false);
  });

  it('should catch afterCommit errors with catchAfterCommitError, should call all catchers even if any of them fails', async () => {
    const catcher1 = jest.fn(() => {
      throw new Error('catcher error');
    });
    const catcher2 = jest.fn();

    const result = await db.user
      .all()
      .delete()
      .afterDeleteCommit([], function one() {
        return 'hook ok';
      })
      .afterDeleteCommit([], function two() {
        throw new Error('error');
      })
      .catchAfterCommitError(catcher1)
      .catchAfterCommitError(catcher2);

    expect(result).toBe(1);

    await new Promise(queueMicrotask as never);

    expect(catcher1).toHaveBeenCalledTimes(1);
    expect(catcher2).toHaveBeenCalledTimes(1);

    const err = (catcher1.mock.calls[0] as unknown as [unknown])[0];
    expect(err).toBeInstanceOf(AfterCommitError);
    expect(err).toMatchObject({
      ...afterCommitSampleError,
      result: [{}],
    });
  });
});
