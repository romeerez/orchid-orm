import { Adapter } from './adapter';
import { adapter } from './test-utils';
import * as mysql from 'mysql2';

const { Connection } = mysql as unknown as {
  Connection: { prototype: mysql.Connection };
};

describe('adapter', () => {
  beforeEach(jest.clearAllMocks);
  afterAll(() => adapter.close());

  it('should parse databaseURL into config', () => {
    const adapter = new Adapter({
      databaseURL: 'mysql://user:pass@localhost:3306/dbname?ssl=true',
    });

    expect(adapter.config).toMatchObject({
      user: 'user',
      password: 'pass',
      host: 'localhost',
      port: 3306,
      database: 'dbname',
      ssl: {},
    });
  });

  it('should return records as object by calling .query', async () => {
    const result = await adapter.query('SELECT 1 as num');
    expect(result[0]).toEqual([{ num: 1 }]);
  });

  it('should return records as arrays by calling .arrays', async () => {
    const result = await adapter.arrays('SELECT 1 as num');
    expect(result[0]).toEqual([[1]]);
  });

  describe('transaction', () => {
    it('should have query and arrays in transaction, commit successful transaction', async () => {
      const query = jest.spyOn(Connection.prototype, 'query');

      const result = await adapter.transaction(async (t) => {
        const [[{ 1: one }]] = await t.query('SELECT 1');
        const [[[two]]] = await t.arrays('SELECT 2');
        return one + two;
      });

      expect(result).toBe(3);
      expect(query).toBeCalledWith({ sql: 'BEGIN' }, expect.any(Function));
      expect(query).toBeCalledWith({ sql: 'SELECT 1' }, expect.any(Function));
      expect(query).toBeCalledWith(
        { sql: 'SELECT 2', rowsAsArray: true },
        expect.any(Function),
      );
      expect(query).toBeCalledWith({ sql: 'COMMIT' }, expect.any(Function));
    });

    it('should rollback if error happens', async () => {
      const query = jest.spyOn(Connection.prototype, 'query');
      const err = new Error('error');

      await expect(() =>
        adapter.transaction(() => {
          throw err;
        }),
      ).rejects.toThrow(err);

      expect(query).toBeCalledWith({ sql: 'BEGIN' }, expect.any(Function));
      expect(query).toBeCalledWith({ sql: 'ROLLBACK' }, expect.any(Function));
    });
  });
});
