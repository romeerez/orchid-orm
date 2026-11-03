import postgres from 'postgres';
import { mergeTypes, PostgresJsAdapter } from './postgres-js';

class MockRawResult extends Array<unknown> {
  count: number;
  statement: {
    columns: Array<{ name: string }>;
  };

  constructor(rows: unknown[], columns: Array<{ name: string }>) {
    super(...rows);
    this.count = rows.length;
    this.statement = { columns };
  }
}

const makeRawResult = (
  rows: unknown[],
  columns: Array<{ name: string }>,
): MockRawResult => new MockRawResult(rows, columns);

describe('postgres-js', () => {
  afterEach(() => jest.clearAllMocks());

  describe('queryClient unit', () => {
    it('wraps non-arrays query result', async () => {
      const rawResult = makeRawResult([{ one: 1 }], [{ name: 'one' }]);
      const query = { execute: () => Promise.resolve(rawResult) };
      const client = {
        unsafe: jest.fn(() => query),
      };

      const result = await PostgresJsAdapter.queryClient(
        client as unknown as postgres.TransactionSql,
        'SELECT 1 AS one',
      );

      expect(client.unsafe).toHaveBeenCalledWith('SELECT 1 AS one', undefined);
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toEqual({ one: 1 });
      expect(result.fields).toEqual([{ name: 'one' }]);
    });

    it('uses values() for arrays query', async () => {
      const objectResult = makeRawResult([{ one: 1 }], [{ name: 'one' }]);
      const arraysResult = makeRawResult([[1]], [{ name: 'one' }]);

      const query = {
        execute: () => Promise.resolve(objectResult),
        values: jest.fn(() => ({
          execute: () => Promise.resolve(arraysResult),
        })),
      };

      const client = {
        unsafe: jest.fn(() => query),
      };

      const result = await PostgresJsAdapter.queryClient(
        client as unknown as postgres.TransactionSql,
        'SELECT 1 AS one',
        undefined,
        true,
      );

      expect(query.values).toHaveBeenCalledTimes(1);
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toEqual([1]);
    });
  });

  describe('configure types', () => {
    it('keeps a caller type the adapter does not define', () => {
      const bigint = { to: 20, from: 20, parse: (x: string) => BigInt(x) };
      const merged = mergeTypes({ bigint } as never)!;

      expect(merged.bigint).toBe(bigint);
      expect(merged.json).toBeDefined();
    });

    it('lets the adapter parser win on a shared key', () => {
      const customJson = { from: [114], parse: () => 'custom' };
      const merged = mergeTypes({ json: customJson } as never)!;

      expect(merged.json).not.toBe(customJson);
      expect((merged.json as { from: number[] }).from).toEqual([114, 3802]);
    });
  });
});
