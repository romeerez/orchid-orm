import { PoolClient } from 'pg';
import { NodePostgresAdapter } from './node-postgres';

interface MockQueryResult<Row = unknown> {
  rowCount: number;
  rows: Row[];
  fields: Array<{ name: string }>;
}

const makeQueryResult = <Row>(
  rows: Row[],
  columns: Array<{ name: string }>,
): MockQueryResult<Row> => ({
  rowCount: rows.length,
  rows,
  fields: columns,
});

describe('node-postgres', () => {
  afterEach(() => jest.clearAllMocks());

  describe('queryClient unit', () => {
    it('passes query config object and returns query result', async () => {
      const rawResult = makeQueryResult([{ one: 1 }], [{ name: 'one' }]);
      const client = {
        query: jest.fn(() => Promise.resolve(rawResult)),
      };

      const result = await NodePostgresAdapter.queryClient(
        client as unknown as PoolClient,
        'SELECT 1 AS one',
      );

      expect(client.query).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'SELECT 1 AS one',
          values: undefined,
          rowMode: undefined,
          types: expect.objectContaining({
            getTypeParser: expect.any(Function),
          }),
        }),
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toEqual({ one: 1 });
      expect(result.fields).toEqual([{ name: 'one' }]);
    });

    it('uses rowMode=array in arrays mode', async () => {
      const rawResult = makeQueryResult([[1]], [{ name: 'one' }]);
      const client = {
        query: jest.fn(() => Promise.resolve(rawResult)),
      };

      const result = await NodePostgresAdapter.queryClient(
        client as unknown as PoolClient,
        'SELECT 1 AS one',
        undefined,
        true,
      );

      expect(client.query).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'SELECT 1 AS one',
          values: undefined,
          rowMode: 'array',
        }),
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toEqual([1]);
      expect(result.fields).toEqual([{ name: 'one' }]);
    });
  });
});
