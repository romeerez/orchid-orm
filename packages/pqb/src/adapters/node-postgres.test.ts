import { asMock, testDbOptions } from 'test-utils';
import { NodePostgresAdapter } from './node-postgres';
import pg from 'pg';
import { setTimeout } from 'timers/promises';
import { QueryError } from '../query/errors';
import { noop, RecordUnknown } from '../utils';
import { AdapterBase } from './adapter';

const testAdapter = new NodePostgresAdapter(testDbOptions);

describe('adapter', () => {
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
        const originalConnect = testAdapter.connect;
        let querySpy;
        testAdapter.connect = async () => {
          const client = await originalConnect.call(testAdapter);
          querySpy = jest.spyOn(client, 'query');
          return client;
        };

        const res = await testAdapter.transaction(async (trx) => {
          return trx.query('SELECT 1 as one');
        });

        expect(res.rows[0]).toEqual({ one: 1 });

        expect(asMock(querySpy).mock.calls.map((arr) => arr[0].text)).toEqual([
          'BEGIN',
          'SELECT 1 as one',
          'COMMIT',
        ]);
      });

      it('executes a transaction with custom options', async () => {
        const originalConnect = testAdapter.connect;
        let querySpy;
        testAdapter.connect = async () => {
          const client = await originalConnect.call(testAdapter);
          querySpy = jest.spyOn(client, 'query');
          return client;
        };

        const res = await testAdapter.transaction(
          {
            options: 'read write',
          },
          async (trx) => {
            return trx.query('SELECT 1 as one');
          },
        );

        expect(res.rows[0]).toEqual({ one: 1 });

        expect(asMock(querySpy).mock.calls.map((arr) => arr[0].text)).toEqual([
          'BEGIN read write',
          'SELECT 1 as one',
          'COMMIT',
        ]);
      });

      it('sets a searchPath', async () => {
        const res = await testAdapter.transaction(
          {
            locals: {
              search_path: 'schema',
            },
          },
          async (trx) => {
            return trx.query('SHOW search_path');
          },
        );

        expect(res.rows[0].search_path).toBe('schema');
      });

      it('sets searchPath in a nested transaction call', async () => {
        const getSearchPath = (adapter: AdapterBase) =>
          adapter
            .query('SHOW search_path')
            .then((result) => result.rows[0].search_path);

        const res = await testAdapter.transaction(
          { locals: { search_path: 'public' } },
          async (trx) => {
            const before = await getSearchPath(trx);
            const nested = await trx.transaction(
              {
                locals: {
                  search_path: 'schema',
                },
              },
              async (trx) => {
                return getSearchPath(trx);
              },
            );
            const after = await getSearchPath(trx);
            return { before, nested, after };
          },
        );

        expect(res).toEqual({
          before: 'public',
          nested: 'schema',
          after: 'public',
        });
      });

      it('sets arbitrary locals', async () => {
        const getLocal = (adapter: AdapterBase) =>
          adapter
            .query('SHOW app.user_id')
            .then((result) => result.rows[0]['app.user_id']);

        const res = await testAdapter.transaction(
          { locals: { 'app.user_id': 1 } },
          async (trx) => {
            const before = await getLocal(trx);
            const nested = await trx.transaction(
              {
                locals: {
                  'app.user_id': 2,
                },
              },
              async (trx) => {
                return getLocal(trx);
              },
            );
            const after = await getLocal(trx);
            return { before, nested, after };
          },
        );

        expect(res).toEqual({
          before: '1',
          nested: '2',
          after: '1',
        });
      });
    });

    describe('savepoint', () => {
      it('should support `startingSavepoint`', async () => {
        await testAdapter.transaction(async (trx) => {
          await trx.query(
            `INSERT INTO "schema"."user"("name", "password") VALUES ('name', 'password')`,
            undefined,
            'savepoint',
          );

          const { rows } = await trx.query(`SELECT * FROM "schema"."user"`);
          expect(rows.length).toEqual(1);

          await trx.query(`ROLLBACK TO SAVEPOINT "savepoint"`);

          const { rows: rows2 } = await trx.query(
            `SELECT * FROM "schema"."user"`,
          );
          expect(rows2.length).toEqual(0);
        });
      });

      it('should rollback to `releasingSavepoint` if query fails', async () => {
        await testAdapter.transaction(async (trx) => {
          await trx.query(
            `INSERT INTO "schema"."user"("name", "password") VALUES ('name', 'password')`,
            undefined,
            'savepoint',
          );

          const { rows } = await trx.query(`SELECT * FROM "schema"."user"`);
          expect(rows.length).toEqual(1);

          await trx
            .query(
              `SELECT * FROM "non-existing"`,
              undefined,
              undefined,
              'savepoint',
            )
            .catch(noop);

          const { rows: rows2 } = await trx.query(
            `SELECT * FROM "schema"."user"`,
          );
          expect(rows2.length).toEqual(0);
        });
      });

      it('should set and release a savepoint when both `startingSavepoint` and `releasingSavepoint` are provided', async () => {
        await testAdapter.transaction(async (trx) => {
          await trx.query(
            `INSERT INTO "schema"."user"("name", "password") VALUES ('name', 'password')`,
            undefined,
            'savepoint',
            'savepoint',
          );

          const { rows } = await trx.query(`SELECT * FROM "schema"."user"`);
          expect(rows.length).toEqual(1);

          await expect(
            trx.query(`ROLLBACK TO SAVEPOINT "savepoint"`),
          ).rejects.toThrow('savepoint "savepoint" does not exist');
        });
      });
    });

    describe('sql session state', () => {
      describe('query with sqlSessionState', () => {
        it('should set role via sqlSessionState and restore after query', async () => {
          // Get the default role to verify restoration
          const beforeRes = await testAdapter.query('SELECT current_user');
          const defaultRole = beforeRes.rows[0].current_user;

          // Query with the 'app-user' role - should capture, set, query, restore
          const res = await testAdapter.query(
            'SELECT current_user',
            undefined,
            undefined,
            undefined,
            { role: 'app-user' },
          );

          expect(res.rows[0].current_user).toBe('app-user');

          // Verify role was restored to the default role
          const afterRes = await testAdapter.query('SELECT current_user');
          expect(afterRes.rows[0].current_user).toBe(defaultRole);
        });

        it('should set config via sqlSessionState and restore after query', async () => {
          // Pre-set one config to test proper recovery
          await testAdapter.query(
            `SELECT set_config('app.preset_key', 'preset_value', false)`,
          );

          const res = await testAdapter.query(
            `SELECT
              current_setting('app.preset_key', true) as preset,
              current_setting('app.new_key', true) as new`,
            undefined,
            undefined,
            undefined,
            {
              setConfig: {
                'app.preset_key': 'new_preset_value',
                'app.new_key': 'new_value',
              },
            },
          );

          // During query, values should be the new ones
          expect(res.rows[0].preset).toBe('new_preset_value');
          expect(res.rows[0].new).toBe('new_value');

          // After query, values should be restored
          const afterRes = await testAdapter.query(
            `SELECT
              current_setting('app.preset_key', true) as preset,
              current_setting('app.new_key', true) as new`,
          );

          expect(afterRes.rows[0].preset).toBe('preset_value');
          expect(afterRes.rows[0].new).toBe('');
        });

        it('should handle multiple config keys in sqlSessionState', async () => {
          // Pre-set one config to test proper recovery
          await testAdapter.query(
            `SELECT set_config('app.key1', 'original1', false)`,
          );

          const res = await testAdapter.query(
            `SELECT
              current_setting('app.key1', true) as key1,
              current_setting('app.key2', true) as key2`,
            undefined,
            undefined,
            undefined,
            {
              setConfig: {
                'app.key1': 'value1',
                'app.key2': 'value2',
              },
            },
          );

          expect(res.rows[0].key1).toBe('value1');
          expect(res.rows[0].key2).toBe('value2');

          // After query, values should be restored
          const afterRes = await testAdapter.query(
            `SELECT
              current_setting('app.key1', true) as key1,
              current_setting('app.key2', true) as key2`,
          );

          expect(afterRes.rows[0].key1).toBe('original1');
          expect(afterRes.rows[0].key2).toBe('');
        });
      });

      describe('arrays with sqlSessionState', () => {
        it('should execute arrays query with sqlSessionState', async () => {
          // Pre-set one config to test proper recovery
          await testAdapter.query(
            `SELECT set_config('app.arr_preset', 'preset_val', false)`,
          );

          const res = await testAdapter.arrays(
            `SELECT
              current_setting('app.arr_preset', true) as preset,
              current_setting('app.arr_new', true) as new`,
            undefined,
            undefined,
            undefined,
            {
              setConfig: {
                'app.arr_preset': 'new_preset',
                'app.arr_new': 'new_val',
              },
            },
          );

          expect(res.rows[0]).toEqual(['new_preset', 'new_val']);

          // Verify restoration
          const afterRes = await testAdapter.query(
            `SELECT
              current_setting('app.arr_preset', true) as preset,
              current_setting('app.arr_new', true) as new`,
          );

          expect(afterRes.rows[0].preset).toBe('preset_val');
          expect(afterRes.rows[0].new).toBe('');
        });
      });

      describe('transaction with sqlSessionState', () => {
        it('should handle sqlSessionState in transaction queries', async () => {
          // Pre-set one config outside transaction
          await testAdapter.query(
            `SELECT set_config('app.trx_preset', 'original', false)`,
          );

          await testAdapter.transaction(async (trx) => {
            // Query with sqlSessionState inside transaction
            const res = await trx.query(
              `SELECT
                current_setting('app.trx_preset', true) as preset,
                current_setting('app.trx_new', true) as new`,
              undefined,
              undefined,
              undefined,
              {
                setConfig: {
                  'app.trx_preset': 'trx_preset_val',
                  'app.trx_new': 'trx_new_val',
                },
              },
            );

            expect(res.rows[0].preset).toBe('trx_preset_val');
            expect(res.rows[0].new).toBe('trx_new_val');
          });

          // After transaction, config should be restored to original
          const afterRes = await testAdapter.query(
            `SELECT
              current_setting('app.trx_preset', true) as preset,
              current_setting('app.trx_new', true) as new`,
          );

          expect(afterRes.rows[0].preset).toBe('original');
          expect(afterRes.rows[0].new).toBe('');
        });

        it('should set role in transaction and restore after', async () => {
          await testAdapter.transaction(async (trx) => {
            // Set role to 'app-user' and verify
            const res = await trx.query(
              'SELECT current_user',
              undefined,
              undefined,
              undefined,
              { role: 'app-user' },
            );

            expect(res.rows[0].current_user).toBe('app-user');
          });

          // After transaction, role should be restored
          const afterRes = await testAdapter.query('SELECT current_user');
          expect(afterRes.rows[0].current_user).not.toBe('app-user');
        });
      });
    });

    it('should assign error properties', async () => {
      let Id;
      const dbErr = await testAdapter
        .transaction(async (trx) => {
          const res = await trx.query(
            `INSERT INTO "schema"."user"("name", "password") VALUES ('name', 'password') RETURNING "id"`,
          );
          Id = res.rows[0].id;

          await trx.query(
            `INSERT INTO "schema"."user"("id", "name", "password") VALUES (${Id}, 'name', 'password') RETURNING "id"`,
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
        schema: 'schema',
        table: 'user',
        constraint: 'user_pkey',
      });
    });
  });

  it('should use ssl from connection string', () => {
    const noSSL = new NodePostgresAdapter({
      databaseURL: 'postgres://user:@host:123/db?ssl=false',
    });

    expect((noSSL.pool as unknown as RecordUnknown).options).not.toHaveProperty(
      'ssl',
    );

    const ssl = new NodePostgresAdapter({
      databaseURL: 'postgres://user:@host:123/db?ssl=true',
    });

    expect((ssl.pool as unknown as RecordUnknown).options).toMatchObject({
      ssl: true,
    });
  });

  describe('search path', () => {
    it('should support setting a default schema via url parameters', async () => {
      const url = new URL(testDbOptions.databaseURL as string);
      url.searchParams.set('searchPath', 'custom');
      const adapter = new NodePostgresAdapter({
        ...testDbOptions,
        databaseURL: url.toString(),
      });

      const res = await adapter.query('SHOW search_path');

      expect(res.rows[0]).toEqual({ search_path: 'custom' });

      await adapter.close();
    });

    it('should support setting a default schema via config', async () => {
      const adapter = new NodePostgresAdapter({
        ...testDbOptions,
        databaseURL: testDbOptions.databaseURL,
        searchPath: 'custom',
      });

      const res = await adapter.query('SHOW search_path');

      expect(res.rows[0]).toEqual({ search_path: 'custom' });

      await adapter.close();
    });
  });

  describe('connectRetry', () => {
    const err = Object.assign(new Error(), {
      code: 'ECONNREFUSED',
    });

    beforeAll(() => {
      pg.Pool.prototype.connect = () => {
        throw err;
      };
    });

    it('should handle default connect retry strategy', async () => {
      const adapter = new NodePostgresAdapter({
        connectRetry: true,
      });

      await expect(() => adapter.connect()).rejects.toThrow(err);

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

      const adapter = new NodePostgresAdapter({
        connectRetry: {
          attempts: 3,
          strategy,
        },
      });

      await expect(() => adapter.connect()).rejects.toThrow(err);

      expect(strategy.mock.calls).toEqual([
        [1, 3],
        [2, 3],
      ]);
    });
  });

  describe('getters', () => {
    it('should have getDatabase', () => {
      const adapter = new NodePostgresAdapter({
        databaseURL: 'postgres://user:@host:123/db',
      });
      expect(adapter.getDatabase()).toBe('db');

      const adapter2 = new NodePostgresAdapter({
        database: 'db',
      });
      expect(adapter2.getDatabase()).toBe('db');
    });

    it('should have getUser', () => {
      const adapter = new NodePostgresAdapter({
        databaseURL: 'postgres://user:@host:123/db',
      });
      expect(adapter.getUser()).toBe('user');

      const adapter2 = new NodePostgresAdapter({
        user: 'user',
      });
      expect(adapter2.getUser()).toBe('user');
    });

    it('should have getSearchPath', () => {
      const adapter = new NodePostgresAdapter({
        databaseURL: 'postgres://user:@host:123/db?searchPath=path',
      });
      expect(adapter.getSearchPath()).toBe('path');

      const adapter2 = new NodePostgresAdapter({
        searchPath: 'path',
      });
      expect(adapter2.getSearchPath()).toBe('path');
    });

    it('should have getHost', () => {
      const adapter = new NodePostgresAdapter({
        databaseURL: 'postgres://user:@host:123/db',
      });
      expect(adapter.getHost()).toBe('host');

      const adapter2 = new NodePostgresAdapter({
        host: 'host',
      });
      expect(adapter2.getHost()).toBe('host');
    });

    it('should have getSchema', () => {
      const adapter = new NodePostgresAdapter({
        schema: 'schema',
      });
      expect(adapter.getSchema()).toBe('schema');
    });
  });
});
