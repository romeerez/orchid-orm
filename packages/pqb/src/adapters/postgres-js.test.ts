import postgres from 'postgres';
import { PostgresJsAdapter } from './postgres-js';

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
      const client = {
        unsafe: jest.fn(() => Promise.resolve(rawResult)),
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

    it('uses values() in arrays mode', async () => {
      const objectResult = makeRawResult([{ one: 1 }], [{ name: 'one' }]);
      const arraysResult = makeRawResult([[1]], [{ name: 'one' }]);

      const query = Promise.resolve(objectResult) as Promise<MockRawResult> & {
        values: jest.Mock;
      };
      query.values = jest.fn(() => Promise.resolve(arraysResult));

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
      expect(result.fields).toEqual([{ name: 'one' }]);
    });
  });
});
