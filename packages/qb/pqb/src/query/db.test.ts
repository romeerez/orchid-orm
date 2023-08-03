import { User, userData } from '../test-utils/test-utils';
import { createDb } from './db';
import { QueryLogger } from '../queryMethods';
import {
  assertType,
  expectSql,
  testAdapter,
  testDb,
  testDbOptions,
  useTestDatabase,
} from 'test-utils';
import { TransactionState } from 'orchid-core';
import { raw } from '../sql/rawSql';

describe('db connection', () => {
  it('should be able to open connection after closing it', async () => {
    const db = createDb(testDbOptions);

    await db.close();

    await expect(db.adapter.query('SELECT 1')).resolves.not.toThrow();

    await db.close();
  });

  it('should support setting a default schema via url parameters', async () => {
    const db = createDb({
      ...testDbOptions,
      databaseURL: testDbOptions.databaseURL + '?schema=geo',
    });

    await db('city');

    await db.close();
  });

  it('should support setting a default schema via config', async () => {
    const db = createDb({
      ...testDbOptions,
      databaseURL: testDbOptions.databaseURL,
      schema: 'geo',
    });

    await db('city');

    await db.close();
  });
});

describe('db', () => {
  useTestDatabase();

  it('supports table without schema', () => {
    const table = testDb('table', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      foo: t.text(),
    }));

    const query = table.select('id', 'name').where({ foo: 'bar' });
    expectSql(
      query.toSQL(),
      `
        SELECT "table"."id", "table"."name" FROM "table"
        WHERE "table"."foo" = $1
      `,
      ['bar'],
    );
  });

  describe('primaryKeys', () => {
    it('should collect primary keys from schema', () => {
      const table = testDb('table', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text().primaryKey(),
      }));
      expect(table.primaryKeys).toEqual(['id', 'name']);
    });

    it('should set primary keys from primaryKey in schema', () => {
      const table = testDb('table', (t) => ({
        ...t.primaryKey(['id', 'name']),
      }));
      expect(table.primaryKeys).toEqual(['id', 'name']);
    });
  });

  describe('overriding column types', () => {
    it('should return date as string by default', async () => {
      await User.create(userData);

      const db = createDb({ adapter: testAdapter });
      const table = db('user', (t) => ({
        id: t.serial().primaryKey(),
        createdAt: t.timestampNoTZ(),
      }));

      const result = await table.take().get('createdAt');
      expect(typeof result).toBe('string');

      assertType<typeof result, string>();
    });

    it('should return date as Date when overridden', async () => {
      await User.create(userData);

      const db = createDb({
        adapter: testAdapter,
        columnTypes: (t) => ({
          serial: t.serial,
          timestamp() {
            return t.timestamp().parse((input) => new Date(input));
          },
        }),
      });

      const table = db('user', (t) => ({
        id: t.serial().primaryKey(),
        createdAt: t.timestamp(),
      }));

      const result = await table.take().get('createdAt');
      expect(result instanceof Date).toBe(true);

      assertType<typeof result, Date>();
    });
  });

  describe('autoPreparedStatements', () => {
    it('should be false by default', () => {
      const db = createDb({ adapter: testAdapter });

      const table = db('table');
      expect(table.q.autoPreparedStatements).toBe(false);
    });
  });

  describe('noPrimaryKey', () => {
    it('should throw error when no primary key by default', () => {
      const db = createDb({ adapter: testAdapter });

      expect(() =>
        db('table', (t) => ({
          name: t.text(0, 100),
        })),
      ).toThrow(`Table table has no primary key`);
    });

    it('should throw error when no primary key when noPrimaryKey is set to `error`', () => {
      const db = createDb({ adapter: testAdapter, noPrimaryKey: 'error' });

      expect(() =>
        db('table', (t) => ({
          name: t.text(0, 100),
        })),
      ).toThrow(`Table table has no primary key`);
    });

    it('should not throw when no column shape is provided', () => {
      const db = createDb({ adapter: testAdapter });

      expect(() => db('table')).not.toThrow();
    });

    it('should warn when no primary key and noPrimaryKey is set to `warning`', () => {
      const logger = { warn: jest.fn() };
      const db = createDb({
        adapter: testAdapter,
        noPrimaryKey: 'warning',
        logger: logger as unknown as QueryLogger,
      });

      db('table', (t) => ({
        name: t.text(0, 100),
      }));

      expect(logger.warn).toBeCalledWith('Table table has no primary key');
    });

    it('should do nothing when no primary key and noPrimaryKey is set to `ignore`', () => {
      const logger = { warn: jest.fn() };
      const db = createDb({
        adapter: testAdapter,
        noPrimaryKey: 'ignore',
        logger: logger as unknown as QueryLogger,
      });

      db('table', (t) => ({
        name: t.text(0, 100),
      }));

      expect(logger.warn).not.toBeCalled();
    });
  });

  it('should use ssl when ssl=true query parameter provided on a databaseUrl option', () => {
    const db = createDb({
      ...testDbOptions,
      databaseURL: testDbOptions.databaseURL + '?ssl=true',
    });

    expect(
      (db.adapter.pool as unknown as { options: Record<string, unknown> })
        .options.ssl,
    ).toBe(true);
  });

  describe('snakeCase option', () => {
    it('should set column names to snake case, respecting existing names', () => {
      const db = createDb({
        ...testDbOptions,
        snakeCase: true,
      });

      const table = db('table', (t) => ({
        id: t.serial().primaryKey(),
        camelCase: t.name('camelCase').integer(),
        snakeCase: t.integer(),
        ...t.timestamps(),
      }));

      const q = table.select(
        'camelCase',
        'snakeCase',
        'updatedAt',
        'createdAt',
      );

      expectSql(
        q.toSQL(),
        `
          SELECT
            "table"."camelCase",
            "table"."snake_case" AS "snakeCase",
            "table"."updated_at" AS "updatedAt",
            "table"."created_at" AS "createdAt"
          FROM "table"
        `,
      );
    });

    it('should override db snakeCase with table snakeCase', () => {
      const db = createDb(testDbOptions);

      const table = db(
        'table',
        (t) => ({
          id: t.serial().primaryKey(),
          camelCase: t.name('camelCase').integer(),
          snakeCase: t.integer(),
          ...t.timestamps(),
        }),
        {
          snakeCase: true,
        },
      );

      const q = table.select(
        'camelCase',
        'snakeCase',
        'updatedAt',
        'createdAt',
      );

      expectSql(
        q.toSQL(),
        `
          SELECT
            "table"."camelCase",
            "table"."snake_case" AS "snakeCase",
            "table"."updated_at" AS "updatedAt",
            "table"."created_at" AS "createdAt"
          FROM "table"
        `,
      );
    });
  });

  describe('query methods', () => {
    const sql = 'SELECT 1 AS one';

    it('should perform a query', async () => {
      const query = jest.spyOn(testDb.adapter, 'query');
      const original = testDb.internal.transactionStorage.getStore;
      testDb.internal.transactionStorage.getStore = jest.fn(() => undefined);

      const result = await testDb.query(raw({ raw: sql }));

      expect(result.rows).toEqual([{ one: 1 }]);
      expect(query).toBeCalledWith({ text: sql, values: [] });

      testDb.internal.transactionStorage.getStore = original;
    });

    it('should perform a query with a template string', async () => {
      const query = jest.spyOn(testDb.adapter, 'query');
      const original = testDb.internal.transactionStorage.getStore;
      testDb.internal.transactionStorage.getStore = jest.fn(() => undefined);

      const result = await testDb.query`SELECT 1 AS one`;

      expect(result.rows).toEqual([{ one: 1 }]);
      expect(query).toBeCalledWith({ text: sql, values: [] });

      testDb.internal.transactionStorage.getStore = original;
    });

    it('should perform a query in a transaction', async () => {
      const store = testDb.internal.transactionStorage.getStore();
      const query = jest.spyOn((store as TransactionState).adapter, 'query');

      const result = await testDb.query(raw({ raw: sql }));

      expect(result.rows).toEqual([{ one: 1 }]);
      expect(query).toBeCalledWith({ text: sql, values: [] });
    });

    it('should query arrays', async () => {
      const query = jest.spyOn(testDb.adapter, 'arrays');
      const original = testDb.internal.transactionStorage.getStore;
      testDb.internal.transactionStorage.getStore = jest.fn(() => undefined);

      const result = await testDb.queryArrays(raw({ raw: sql }));

      expect(result.rows).toEqual([[1]]);
      expect(query).toBeCalledWith({ text: sql, values: [] });

      testDb.internal.transactionStorage.getStore = original;
    });

    it('should query arrays with a template string', async () => {
      const query = jest.spyOn(testDb.adapter, 'arrays');
      const original = testDb.internal.transactionStorage.getStore;
      testDb.internal.transactionStorage.getStore = jest.fn(() => undefined);

      const result = await testDb.queryArrays`SELECT 1 AS one`;

      expect(result.rows).toEqual([[1]]);
      expect(query).toBeCalledWith({ text: sql, values: [] });

      testDb.internal.transactionStorage.getStore = original;
    });

    it('should query arrays in a transaction', async () => {
      const store = testDb.internal.transactionStorage.getStore();
      const query = jest.spyOn((store as TransactionState).adapter, 'arrays');

      const result = await testDb.queryArrays(raw({ raw: sql }));

      expect(result.rows).toEqual([[1]]);
      expect(query).toBeCalledWith({ text: sql, values: [] });
    });
  });
});
