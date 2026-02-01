import { asMock, testDbOptions } from 'test-utils';
import { NodePostgresAdapter } from './node-postgres';
import pg from 'pg';
import { setTimeout } from 'timers/promises';
import { QueryError } from '../query/errors';
import { RecordUnknown } from '../utils';

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

        const res = await testAdapter.transaction(undefined, async (trx) => {
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

        const res = await testAdapter.transaction('read write', async (trx) => {
          return trx.query('SELECT 1 as one');
        });

        expect(res.rows[0]).toEqual({ one: 1 });

        expect(asMock(querySpy).mock.calls.map((arr) => arr[0].text)).toEqual([
          'BEGIN read write',
          'SELECT 1 as one',
          'COMMIT',
        ]);
      });
    });

    it('should assign error properties', async () => {
      let Id;
      const dbErr = await testAdapter
        .transaction(undefined, async (trx) => {
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
});
