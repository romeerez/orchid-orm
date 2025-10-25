import { PostgresJsAdapter } from './postgres-js';
import { asMock, testDb, testDbOptions } from 'test-utils';
import { setTimeout } from 'timers/promises';
import { QueryError } from 'orchid-core';

const testAdapter = new PostgresJsAdapter({
  databaseURL: process.env.PG_URL,
});

testDb.adapter = testAdapter;

jest.mock('timers/promises', () => ({
  setTimeout: jest.fn(),
}));

describe('postgres-js', () => {
  afterEach(() => jest.clearAllMocks());

  describe('queries', () => {
    afterAll(() => testAdapter.close());

    it('should run query and close connection by calling .close()', async () => {
      const res = await testAdapter.query('SELECT 1 as num');

      expect(res).toMatchObject({
        rowCount: 1,
        rows: [{ num: 1 }],
        fields: [
          {
            name: 'num',
          },
        ],
      });
    });

    it('should not parse certain types', async () => {
      const res = await testAdapter.query(`
        SELECT
          now()::date as date,
          now()::timestamp as timestamp,
          now()::timestamptz as timestamptz,
          '((3,4),5)'::circle as circle
      `);

      expect(res.rows[0]).toEqual({
        date: expect.any(String),
        timestamp: expect.any(String),
        timestamptz: expect.any(String),
        circle: expect.any(String),
      });
    });

    it('should can query arrays', async () => {
      const res = await testAdapter.arrays('SELECT 1 as num');

      expect(res).toMatchObject({
        rowCount: 1,
        rows: [[1]],
        fields: [
          {
            name: 'num',
          },
        ],
      });
    });

    describe('transaction', () => {
      it('executes a transaction', async () => {
        const sqlSpy = jest.spyOn(testAdapter.sql, 'begin');

        const res = await testAdapter.transaction(undefined, async (trx) => {
          return trx.query('SELECT 1 as one');
        });

        expect(res.rows[0]).toEqual({ one: 1 });

        expect(sqlSpy.mock.calls.map((arr) => arr[0])).toEqual([
          expect.any(Function),
        ]);
      });

      it('executes a transaction with custom options', async () => {
        const sqlSpy = jest.spyOn(testAdapter.sql, 'begin');

        const res = await testAdapter.transaction('read write', async (trx) => {
          return trx.query('SELECT 1 as one');
        });

        expect(res.rows[0]).toEqual({ one: 1 });

        expect(sqlSpy.mock.calls.map((arr) => arr[0])).toEqual(['read write']);
      });
    });

    it('should assign error properties', async () => {
      let Id;
      const dbErr = await testAdapter
        .transaction(undefined, async (trx) => {
          const res = await trx.query(
            `INSERT INTO "user"("name", "password") VALUES ('name', 'password') RETURNING "id"`,
          );
          Id = res.rows[0].id;

          await trx.query(
            `INSERT INTO "user"("id", "name", "password") VALUES (${Id}, 'name', 'password') RETURNING "id"`,
          );
        })
        .catch((err) => err);

      class Err extends QueryError {}

      const err = new Err({} as never);

      testAdapter.assignError(err, dbErr);

      expect(err).toMatchObject({
        message: 'duplicate key value violates unique constraint "user_pkey"',
        code: '23505',
        detail: `Key (id)=(${Id}) already exists.`,
        severity: 'ERROR',
        schema: 'public',
        table: 'user',
        constraint: 'user_pkey',
        file: 'nbtinsert.c',
        line: '666',
        routine: '_bt_check_unique',
      });
    });
  });

  it('should use ssl from connection string', () => {
    const noSSL = new PostgresJsAdapter({
      databaseURL: 'postgres://user:@host:123/db?ssl=false',
    });

    expect(noSSL.sql.options.ssl).toBe(false);

    const ssl = new PostgresJsAdapter({
      databaseURL: 'postgres://user:@host:123/db?ssl=true',
    });

    expect(ssl.sql.options.ssl).toBe(true);
  });

  describe('search path', () => {
    it('should support setting a default schema via url parameters', async () => {
      const url = new URL(testDbOptions.databaseURL as string);
      url.searchParams.set('schema', 'custom');
      const testAdapter = new PostgresJsAdapter({
        ...testDbOptions,
        databaseURL: url.toString(),
      });

      const res = await testAdapter.query('SHOW search_path');

      expect(res.rows[0]).toEqual({ search_path: 'custom' });

      await testAdapter.close();
    });

    it('should support setting a default schema via config', async () => {
      const testAdapter = new PostgresJsAdapter({
        ...testDbOptions,
        databaseURL: testDbOptions.databaseURL,
        schema: 'custom',
        connection: {
          search_path: 'custom',
        },
      });

      const res = await testAdapter.query('SHOW search_path');

      expect(res.rows[0]).toEqual({ search_path: 'custom' });

      await testAdapter.close();
    });
  });

  describe('connectRetry', () => {
    const err = Object.assign(new Error(), { code: 'ECONNREFUSED' });

    it('should handle default connect retry strategy', async () => {
      const testAdapter = new PostgresJsAdapter({
        databaseURL: testDbOptions.databaseURL,
        connectRetry: true,
      });

      jest.spyOn(testAdapter.sql, 'unsafe').mockImplementation(() => {
        throw err;
      });

      await expect(() => testAdapter.query('SELECT 1')).rejects.toThrow(err);

      const attempts = 10;
      const delay = 50;
      const factor = 1.5;
      expect(asMock(setTimeout).mock.calls).toEqual(
        Array.from({ length: attempts - 1 }).map((_, i) => [
          factor ** i * delay,
        ]),
      );
    });

    it('should use custom strategy', async () => {
      const strategy = jest.fn();

      const testAdapter = new PostgresJsAdapter({
        connectRetry: {
          attempts: 3,
          strategy,
        },
      });

      jest.spyOn(testAdapter.sql, 'unsafe').mockImplementation(() => {
        throw err;
      });

      await expect(() => testAdapter.query('SELECT 1')).rejects.toThrow(err);

      expect(strategy.mock.calls).toEqual([
        [1, 3],
        [2, 3],
      ]);
    });
  });
});
