import pg, { Client } from 'pg';
import { testDb } from 'test-utils';

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
      return a + b;
    });

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
});
