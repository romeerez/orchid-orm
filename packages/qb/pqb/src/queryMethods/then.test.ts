import { User } from '../test-utils/test-utils';
import { NotFoundError } from '../errors';
import { assertType, testAdapter, testDb, useTestDatabase } from 'test-utils';
import { TransactionState } from 'orchid-core';

jest.mock('../sql/constants', () => ({
  MAX_BINDING_PARAMS: 2,
}));

describe('then', () => {
  useTestDatabase();
  afterAll(testDb.close);

  describe('catch', () => {
    it('should catch error', (done) => {
      const q = User.select({
        column: testDb.sql`koko`.type((t) => t.boolean()),
      }).catch((err) => {
        expect(err.message).toBe(`column "koko" does not exist`);
        expect(err.cause.stack).toContain('then.test.ts');
        done();
      });

      assertType<Awaited<typeof q>, { column: boolean }[] | void>();
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
});

describe('batch queries', () => {
  beforeAll(async () => {
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
      [{ text: 'BEGIN' }],
      [
        {
          text: `INSERT INTO "tmp.then"("num") VALUES ($1),($2) RETURNING "tmp.then"."num"`,
          values: [0, 1],
        },
      ],
      [
        {
          text: `INSERT INTO "tmp.then"("num") VALUES ($1) RETURNING "tmp.then"."num"`,
          values: [2],
        },
      ],
      [{ text: 'COMMIT' }],
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
        {
          text: `INSERT INTO "tmp.then"("num") VALUES ($1),($2) RETURNING "tmp.then"."num"`,
          values: [0, 1],
        },
      ],
      [
        {
          text: `INSERT INTO "tmp.then"("num") VALUES ($1) RETURNING "tmp.then"."num"`,
          values: [2],
        },
      ],
    ]);

    expect(result).toEqual([0, 1, 2]);
  });
});
