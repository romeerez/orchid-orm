import { setTimeout } from 'timers/promises';
import { asMock, testDbOptions } from 'test-utils';
import { describeIfBun } from 'test-utils/runtime';
import { QueryError } from '../query/errors';
import {
  BunSqlAdapter,
  BunSqlClient,
  BunSqlTransactionAdapter,
} from './bun-sql';

describeIfBun('bun-sql', () => {
  afterEach(() => jest.clearAllMocks());

  describe('queries', () => {
    let testAdapter: BunSqlAdapter;

    beforeAll(() => {
      testAdapter = new BunSqlAdapter({
        databaseURL: process.env.PG_URL,
      });
    });

    afterAll(() => testAdapter.close());

    it('should run a query', async () => {
      const res = await testAdapter.query('SELECT 1 as num');

      expect(res.rowCount).toBe(1);
      // Normalize SQLResultArray for test comparison.
      expect([...res.rows]).toEqual([{ num: 1 }]);
      expect(res.fields).toMatchObject([{ name: 'num' }]);
    });

    it('should query arrays', async () => {
      const res = await testAdapter.arrays('SELECT 1 as num');

      expect(res.rowCount).toBe(1);
      // Normalize SQLResultArray for test comparison.
      expect([...res.rows]).toEqual([[1]]);
      // Bun SQL does not expose column metadata yet.
      // See https://github.com/oven-sh/bun/issues/18866
      expect(res.fields).toEqual([]);
    });

    it('should connect successfully', async () => {
      const result = await testAdapter.connect();
      expect(result).toBeDefined();
    });

    it('should report isInTransaction as false', () => {
      expect(testAdapter.isInTransaction()).toBe(false);
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

      it('rollbacks a transaction on error', async () => {
        await expect(
          testAdapter.transaction(undefined, async () => {
            throw new Error('error');
          }),
        ).rejects.toThrow('error');
      });

      it('should query arrays inside a transaction', async () => {
        const res = await testAdapter.transaction(undefined, async (trx) => {
          return trx.arrays('SELECT 1 as num, 2 as val');
        });

        expect(res.rows[0]).toEqual([1, 2]);
      });

      it('should report isInTransaction as true', async () => {
        await testAdapter.transaction(undefined, async (trx) => {
          expect(trx.isInTransaction()).toBe(true);
          return trx.query('SELECT 1');
        });
      });

      it('should delegate getters to parent adapter', async () => {
        await testAdapter.transaction(undefined, async (trx) => {
          expect(trx.getDatabase()).toBe(testAdapter.getDatabase());
          expect(trx.getUser()).toBe(testAdapter.getUser());
          expect(trx.getHost()).toBe(testAdapter.getHost());
          return trx.query('SELECT 1');
        });
      });
    });

    it('should assign error properties', async () => {
      let id;
      const dbErr = await testAdapter
        .transaction(undefined, async (trx) => {
          const res = await trx.query(
            `INSERT INTO "schema"."user"("name", "password") VALUES ('name', 'password') RETURNING "id"`,
          );
          id = res.rows[0].id;

          await trx.query(
            `INSERT INTO "schema"."user"("id", "name", "password") VALUES (${id}, 'name', 'password') RETURNING "id"`,
          );
        })
        .catch((err) => err);

      class Err extends QueryError {}

      const err = new Err({} as never);

      testAdapter.assignError(err, dbErr);

      expect(err).toMatchObject({
        message: 'duplicate key value violates unique constraint "user_pkey"',
        code: '23505',
        detail: `Key (id)=(${id}) already exists.`,
        severity: 'ERROR',
        schema: 'schema',
        table: 'user',
        constraint: 'user_pkey',
      });
    });

    it('should assign error from error with errno field (Bun-style)', () => {
      const dbError = Object.assign(new Error('unique violation'), {
        errno: '23505',
        code: 'ERR_POSTGRES_SERVER_ERROR',
        severity: 'ERROR',
        detail: 'Key (id)=(1) already exists.',
        schema: 'public',
        table: 'users',
        constraint: 'users_pkey',
      });

      class Err extends QueryError {}
      const err = new Err({} as never);

      testAdapter.assignError(err, dbError);

      expect(err.code).toBe('23505');
      expect(err.severity).toBe('ERROR');
      expect(err.table).toBe('users');
      expect(err.constraint).toBe('users_pkey');
    });

    it('should handle duplicate column aliases in arrays mode', async () => {
      const res = await testAdapter.arrays('SELECT 1 AS x, 2 AS x');

      expect(res.rows[0]).toEqual([1, 2]);
    });

    it('should handle empty query results', async () => {
      const res = await testAdapter.query('SELECT 1 AS num WHERE false');

      expect(res.rowCount).toBe(0);
      // Normalize SQLResultArray for test comparison.
      expect([...res.rows]).toEqual([]);
      // Bun SQL does not expose column metadata yet.
      // See https://github.com/oven-sh/bun/issues/18866
      expect(res.fields).toEqual([]);
    });
  });

  it('should use SSL from connection string', async () => {
    const noSSL = new BunSqlAdapter({
      databaseURL: 'postgres://user:@host:123/db?ssl=false',
    });

    expect(noSSL.config.tls).toBe(false);

    const ssl = new BunSqlAdapter({
      databaseURL: 'postgres://user:@host:123/db?ssl=true',
    });

    expect(ssl.config.tls).toBe(true);

    await noSSL.close();
    await ssl.close();
  });

  describe('search path', () => {
    it('should support setting a default schema via url parameters', async () => {
      const url = new URL(testDbOptions.databaseURL as string);
      url.searchParams.set('searchPath', 'custom');
      const adapter = new BunSqlAdapter({
        ...testDbOptions,
        databaseURL: url.toString(),
      });

      const res = await adapter.query('SHOW search_path');

      expect(res.rows[0]).toEqual({ search_path: 'custom' });

      await adapter.close();
    });

    it('should support setting a default schema via config', async () => {
      const adapter = new BunSqlAdapter({
        ...testDbOptions,
        databaseURL: testDbOptions.databaseURL,
        searchPath: 'custom',
      });

      const res = await adapter.query('SHOW search_path');

      expect(res.rows[0]).toEqual({ search_path: 'custom' });

      await adapter.close();
    });

    it('should ignore public search path', () => {
      const adapter = new BunSqlAdapter({
        databaseURL: 'postgres://user:@host:123/db',
        searchPath: 'public',
      });

      expect(adapter.getSearchPath()).toBeUndefined();
    });
  });

  describe('connectRetry', () => {
    const err = new Error('FailedToOpenSocket failed to connect to postgresql');

    it('should handle default connect retry strategy', async () => {
      const adapter = new BunSqlAdapter({
        databaseURL: testDbOptions.databaseURL,
        connectRetry: true,
      });

      jest.spyOn(adapter.sql, 'unsafe').mockImplementation(() => {
        throw err;
      });

      await expect(adapter.query('SELECT 1')).rejects.toThrow(err);

      const attempts = 10;
      const delay = 50;
      const factor = 1.5;
      expect(asMock(setTimeout).mock.calls).toEqual(
        Array.from({ length: attempts - 1 }).map((_, i) => [
          factor ** i * delay,
        ]),
      );

      await adapter.close();
    });

    it('should use custom strategy', async () => {
      const strategy = jest.fn();

      const adapter = new BunSqlAdapter({
        databaseURL: testDbOptions.databaseURL,
        connectRetry: {
          attempts: 3,
          strategy,
        },
      });

      jest.spyOn(adapter.sql, 'unsafe').mockImplementation(() => {
        throw err;
      });

      await expect(adapter.query('SELECT 1')).rejects.toThrow(err);

      expect(strategy.mock.calls).toEqual([
        [1, 3],
        [2, 3],
      ]);

      await adapter.close();
    });
  });

  describe('config helpers', () => {
    it('should reconfigure URL and expose getters', async () => {
      const adapter = new BunSqlAdapter({
        databaseURL: 'postgres://user:pass@localhost:5432/db?searchPath=one',
      });

      expect(adapter.getDatabase()).toBe('db');
      expect(adapter.getUser()).toBe('user');
      expect(adapter.getHost()).toBe('localhost');
      expect(adapter.getSearchPath()).toBe('one');

      const next = adapter.reconfigure({
        database: 'db2',
        user: 'user2',
        password: 'pass2',
        searchPath: 'two',
      }) as BunSqlAdapter;

      expect(next.getDatabase()).toBe('db2');
      expect(next.getUser()).toBe('user2');
      expect(next.getSearchPath()).toBe('two');

      await next.close();

      await adapter.close();
    });

    it('should update config', async () => {
      const adapter = new BunSqlAdapter({
        databaseURL: 'postgres://user:pass@localhost:5432/db?searchPath=one',
      });

      await adapter.updateConfig({
        databaseURL: 'postgres://user2:pass2@localhost:5432/db2?searchPath=two',
      });

      expect(adapter.getDatabase()).toBe('db2');
      expect(adapter.getUser()).toBe('user2');
      expect(adapter.getSearchPath()).toBe('two');

      await adapter.close();
    });

    it('should expose getters for non-url config', async () => {
      const adapter = new BunSqlAdapter({
        hostname: 'myhost',
        user: 'myuser',
        database: 'mydb',
      });

      expect(adapter.getDatabase()).toBe('mydb');
      expect(adapter.getUser()).toBe('myuser');
      expect(adapter.getHost()).toBe('myhost');

      await adapter.close();
    });
  });

  // This intentionally uses mocked low-level Bun query promises instead of a real
  // DB, because we need deterministic control over resolution timing to prove the
  // adapter's internal per-transaction lock (`__lock`) serializes concurrent calls.
  describe('transaction locking', () => {
    it('serializes concurrent object queries on a transaction client', async () => {
      const releases: (() => void)[] = [];
      let nextValue = 0;

      const unsafe = jest.fn(() => {
        const value = ++nextValue;
        const query = Object.assign(
          new Promise<unknown[]>((resolve) => {
            releases.push(() => resolve([{ one: value }]));
          }),
          {
            count: 1,
            values: jest.fn(),
          },
        );

        return query;
      });

      const sql = {
        unsafe,
        begin: jest.fn(),
        close: jest.fn(async () => {}),
        options: {},
      } as unknown as BunSqlClient;

      const trx = new BunSqlTransactionAdapter({} as BunSqlAdapter, sql);

      const first = trx.query('SELECT 1 AS one');
      const second = trx.query('SELECT 2 AS one');

      expect(unsafe).toHaveBeenCalledTimes(1);

      releases.shift()?.();
      await expect(first).resolves.toMatchObject({
        rowCount: 1,
        rows: [{ one: 1 }],
      });
      await Promise.resolve();

      expect(unsafe).toHaveBeenCalledTimes(2);

      releases.shift()?.();

      await expect(second).resolves.toMatchObject({
        rowCount: 1,
        rows: [{ one: 2 }],
      });
    });

    it('serializes concurrent arrays queries on a transaction client', async () => {
      const releases: (() => void)[] = [];
      let nextValue = 0;

      const unsafe = jest.fn(() => {
        const value = ++nextValue;
        const query = Object.assign(Promise.resolve([]), {
          count: 1,
          values: jest.fn(
            () =>
              new Promise<unknown[][]>((resolve) => {
                releases.push(() => resolve([[value]]));
              }),
          ),
        });

        return query;
      });

      const sql = {
        unsafe,
        begin: jest.fn(),
        close: jest.fn(async () => {}),
        options: {},
      } as unknown as BunSqlClient;

      const trx = new BunSqlTransactionAdapter({} as BunSqlAdapter, sql);

      const first = trx.arrays('SELECT 1');
      const second = trx.arrays('SELECT 2');

      expect(unsafe).toHaveBeenCalledTimes(1);

      releases.shift()?.();
      await expect(first).resolves.toMatchObject({ rowCount: 1, rows: [[1]] });
      await Promise.resolve();

      expect(unsafe).toHaveBeenCalledTimes(2);

      releases.shift()?.();

      await expect(second).resolves.toMatchObject({ rowCount: 1, rows: [[2]] });
    });
  });
});
