import { User, userData, UserRecord } from '../test-utils/test-utils';
import { NotFoundError, QueryError, QueryResultRow } from '../core';
import {
  assertType,
  db,
  testAdapter,
  testDb,
  UserData,
  useTestDatabase,
} from 'test-utils';
import { noop, TransactionState } from '../core';
import { MAX_BINDING_PARAMS } from '../sql/constants';

const setMaxBindingParams = (value: number) => {
  (MAX_BINDING_PARAMS as unknown as { value: number }).value = value;
};

jest.mock('../sql/constants', () => ({
  // Behold the power of JS coercions
  MAX_BINDING_PARAMS: {
    value: 10,
    toString() {
      return this.value;
    },
  },
}));

describe('then', () => {
  useTestDatabase();

  describe('catch', () => {
    it('should catch error', async () => {
      const err = await User.select({
        column: testDb.sql`koko`.type((t) => t.boolean()),
      }).catch((err) => {
        expect(err.message).toBe(`column "koko" does not exist`);
        expect(err.cause.stack).toContain('then.test.ts');
        return 'err' as const;
      });

      assertType<typeof err, { column: boolean }[] | 'err'>();

      expect(err).toBe('err');
    });

    it('should not prevent the query from executing', async () => {
      const fn = jest.fn();

      const user = await User.create(userData).catch(fn);

      expect(user.name).toBe(userData.name);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should not mutate the query', async () => {
      await User.catch(() => 'ok');

      expect(User.q.catch).toBe(undefined);
    });

    it('should catch error in transaction using a save-points', async () => {
      const transactionCatch = jest.fn(() => {
        throw new Error('should not be called');
      });

      const res = await testDb
        .transaction(async () => {
          const failedThenResult = await User.get('invalid' as 'name').then(
            () => {
              throw new Error('should not be called');
            },
            () => 'caught',
          );

          const failedCatchResult = await User.get('invalid' as 'name').catch(
            () => 'caught',
          );

          const subsequentQueryResult = await testDb.query`SELECT 'ok' ok`;

          return {
            failedThenResult,
            failedCatchResult,
            subsequentQueryResult: subsequentQueryResult.rows[0],
          };
        })
        .catch(transactionCatch);

      expect(transactionCatch).not.toBeCalled();

      assertType<
        typeof res,
        {
          failedThenResult: string;
          failedCatchResult: string;
          subsequentQueryResult: QueryResultRow;
        }
      >();

      expect(res).toEqual({
        failedThenResult: 'caught',
        failedCatchResult: 'caught',
        subsequentQueryResult: { ok: 'ok' },
      });
    });
  });

  describe('catchUniqueError', () => {
    it('should catch unique error', async () => {
      const Id = await db.user.get('Id').insert(UserData);

      const catcher = jest.fn();

      const result = await db.user
        .insert({ ...UserData, Id })
        .catchUniqueError((err) => {
          expect(err.columns).toEqual({ Id: true });
          catcher(err);

          return false;
        });

      assertType<typeof result, number | boolean>();

      expect(result).toBe(false);

      expect(catcher).toBeCalledWith(expect.any(QueryError));
    });

    it('should not catch other errors', async () => {
      const uniqueCatcher = jest.fn();
      const anyCatcher = jest.fn();

      const err = await User.select({
        column: testDb.sql`koko`.type((t) => t.boolean()),
      })
        .catchUniqueError((err) => {
          uniqueCatcher(err);
          return 'not returned';
        })
        .catch((err) => {
          anyCatcher(err);
          return { err: err as unknown };
        });

      assertType<
        typeof err,
        { column: boolean }[] | { err: unknown } | string
      >();

      expect(uniqueCatcher).not.toBeCalled();
      expect(anyCatcher).toBeCalled();

      expect(err).toEqual({ err: expect.any(QueryError) });
    });

    it('should catch error in transaction using a save-points', async () => {
      const id = await User.get('id').create(userData);

      const transactionCatch = jest.fn(() => {
        throw new Error('should not be called');
      });

      const res = await testDb
        .transaction(async () => {
          const failedResult = await User.create({
            ...userData,
            id,
          }).catchUniqueError(() => 'caught');

          const subsequentQueryResult = await testDb.query`SELECT 'ok' ok`;

          return {
            failedResult,
            subsequentQueryResult: subsequentQueryResult.rows[0],
          };
        })
        .catch(transactionCatch);

      expect(transactionCatch).not.toBeCalled();

      assertType<
        typeof res,
        {
          failedResult: string | UserRecord;
          subsequentQueryResult: QueryResultRow;
        }
      >();

      expect(res).toEqual({
        failedResult: 'caught',
        subsequentQueryResult: { ok: 'ok' },
      });
    });
  });

  it('should throw NotFoundError with proper stack trace', async () => {
    let error: Error | undefined;
    try {
      await User.take();
    } catch (err) {
      error = err as Error;
    }

    expect(error instanceof NotFoundError).toBe(true);
    expect(((error as Error).cause as Error).stack).toContain('then.test.ts');
  });

  it('should handle .then callback properly', async () => {
    let isThenCalled = false;

    const len = await User.select('id').then((x) => {
      isThenCalled = true;
      return x.length;
    });

    assertType<typeof len, number>();

    expect(isThenCalled).toBe(true);
    expect(len).toBe(0);
  });

  it('should throw when there is no `.catch`', async () => {
    // @ts-expect-error wrong column
    expect(User.select('wrong').then(noop)).rejects.toThrow(
      'column user.wrong does not exist',
    );
  });

  it('should not throw when there is `onrejected` callback', async () => {
    let error: Error | undefined;

    // @ts-expect-error wrong column
    await User.select('wrong').then(noop, (err) => (error = err));

    expect(error?.message).toEqual('column user.wrong does not exist');
  });
});

describe('batch queries', () => {
  beforeAll(async () => {
    setMaxBindingParams(2);

    await testAdapter.query(
      `CREATE TABLE IF NOT EXISTS "tmp.then" ( num INTEGER )`,
    );
  });

  afterAll(async () => {
    await testAdapter.query(`DROP TABLE IF EXISTS "tmp.then"`);
    await testAdapter.close();
  });

  afterEach(jest.clearAllMocks);

  it('should wrap batch queries in transaction', async () => {
    const Table = testDb('tmp.then', (t) => ({
      num: t.integer().primaryKey(),
    }));

    const q = Table.insertMany(
      Array.from({ length: 3 }, (_, i) => ({
        num: i,
      })),
    ).pluck('num');

    const queryArrays = jest.spyOn(q.q.adapter, 'arrays');

    const result = await q;

    expect(queryArrays.mock.calls).toEqual([
      [
        `INSERT INTO "tmp.then"("num") VALUES ($1), ($2) RETURNING "tmp.then"."num"`,
        [0, 1],
      ],
      [
        `INSERT INTO "tmp.then"("num") VALUES ($1) RETURNING "tmp.then"."num"`,
        [2],
      ],
    ]);

    expect(result).toEqual([0, 1, 2]);
  });

  it('should not wrap into transaction when it is already wrapped', async () => {
    const Table = testDb('tmp.then', (t) => ({
      num: t.integer().primaryKey(),
    }));

    const q = Table.insertMany(
      Array.from({ length: 3 }, (_, i) => ({
        num: i,
      })),
    ).pluck('num');

    const { queryArrays, result } = await Table.transaction(async () => {
      const trx =
        Table.internal.transactionStorage.getStore() as TransactionState;
      const queryArrays = jest.spyOn(trx.adapter, 'arrays');

      const result = await q;

      return { queryArrays, result };
    });

    expect(queryArrays.mock.calls).toEqual([
      [
        `INSERT INTO "tmp.then"("num") VALUES ($1), ($2) RETURNING "tmp.then"."num"`,
        [0, 1],
        '1',
      ],
      [
        `INSERT INTO "tmp.then"("num") VALUES ($1) RETURNING "tmp.then"."num"`,
        [2],
        '2',
      ],
    ]);

    expect(result).toEqual([0, 1, 2]);
  });
});
