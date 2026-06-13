import { BunAdapter } from './bun';

describe('bun', () => {
  const hasBunSql = Boolean(
    (globalThis as unknown as { Bun?: { SQL?: unknown } }).Bun?.SQL,
  );
  const itWithBunSql = hasBunSql ? it : it.skip;

  it('uses values() for arrays query', async () => {
    const objectResult = Object.assign([{ one: 1 }], { count: 1 });
    const arrayResult = Object.assign([[1]], { count: 1 });

    const query = Promise.resolve(objectResult) as Promise<unknown> & {
      values: jest.Mock;
    };
    query.values = jest.fn(() => Promise.resolve(arrayResult));

    const client = {
      unsafe: jest.fn(() => query),
    };

    const result = await BunAdapter.queryClient<[number]>(
      client as never,
      'SELECT 1 AS one',
      undefined,
      true,
    );

    expect(client.unsafe).toHaveBeenCalledWith('SELECT 1 AS one', undefined);
    expect(query.values).toHaveBeenCalledTimes(1);
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]).toEqual([1]);
    expect(() => result.fields).toThrow(
      'Bun does not support fields on array result',
    );
  });

  it('computes fields lazily and memoizes them', async () => {
    const keys = jest.spyOn(Object, 'keys');
    const query = Promise.resolve(
      Object.assign([{ one: 1 }], { count: 1 }),
    ) as Promise<unknown> & {
      values: jest.Mock;
    };
    query.values = jest.fn();

    const client = {
      unsafe: jest.fn(() => query),
    };

    const result = await BunAdapter.queryClient(
      client as never,
      'SELECT 1 AS one',
    );

    const keysCallsAfterQuery = keys.mock.calls.length;
    const fields = result.fields;
    const sameFields = result.fields === result.fields;
    const keysCallsAfterFields = keys.mock.calls.length;
    keys.mockRestore();

    expect(keysCallsAfterQuery).toBe(0);
    expect(fields).toEqual([{ name: 'one' }]);
    expect(sameFields).toBe(true);
    expect(keysCallsAfterFields).toBe(1);
  });

  it('returns multiple query results for semicolon-separated queries', async () => {
    const query = Promise.resolve([
      Object.assign([{ one: 1 }], { count: 1 }),
      Object.assign([{ two: 2 }], { count: 1 }),
    ]) as Promise<unknown> & {
      values: jest.Mock;
    };
    query.values = jest.fn();

    const client = {
      unsafe: jest.fn(() => query),
    };

    const result = await BunAdapter.queryClient(
      client as never,
      'SELECT 1 AS one; SELECT 2 AS two',
    );

    expect(client.unsafe).toHaveBeenCalledWith(
      'SELECT 1 AS one; SELECT 2 AS two',
      undefined,
    );
    expect(result).toMatchObject([
      {
        rowCount: 1,
        rows: [{ one: 1 }],
        fields: [{ name: 'one' }],
      },
      {
        rowCount: 1,
        rows: [{ two: 2 }],
        fields: [{ name: 'two' }],
      },
    ]);
  });

  itWithBunSql('queries SELECT 1 with Bun adapter', async () => {
    const client = BunAdapter.configure({ databaseURL: process.env.PG_URL });

    try {
      const result = await BunAdapter.queryClient<{ one: number }>(
        client,
        'SELECT 1 AS one',
      );

      expect(result.rowCount).toBe(1);
      expect([...result.rows]).toEqual([{ one: 1 }]);
      expect(result.fields).toEqual([{ name: 'one' }]);
    } finally {
      await BunAdapter.close(client);
    }
  });
});
