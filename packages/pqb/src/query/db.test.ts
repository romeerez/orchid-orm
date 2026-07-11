import { User, userData } from '../test-utils/pqb.test-utils';
import { createDbWithAdapter, Db } from './db';
import {
  assertType,
  BaseTable,
  testDefaultColumnTypes,
  createTestDb,
  expectSql,
  sql,
  testAdapter,
  testDb,
  testDbOptions,
  useTestDatabase,
  testDefaultSchemaConfig,
} from 'test-utils';
import { raw } from './expressions/raw-sql';
import { Query } from './query';
import type { GeneratorIgnore } from './query';
import {
  DefaultSchemaConfig,
  internalSchemaConfig,
  VirtualColumn,
} from '../columns';
import { RecordUnknown } from '../utils';
import { QueryLogger } from './basic-features/log/log';
import { orchidORMWithAdapter } from 'orchid-orm';
import { Adapter, TransactionAdapterClass } from '../adapters/adapter';
import { CannotMutateReadOnlyTableError } from 'pqb/internal';

describe('db connection', () => {
  it('should be able to open connection after closing it', async () => {
    const db = createTestDb(testDbOptions);

    await db.close();

    await expect(db.adapter.query('SELECT 1')).resolves.not.toThrow();

    await db.close();
  });

  it('should support setting a searchPath via url parameters', async () => {
    const url = new URL(testDbOptions.databaseURL as string);
    url.searchParams.set('searchPath', 'schema');

    const db = createTestDb({
      ...testDbOptions,
      databaseURL: url.toString(),
    });

    await db('user');

    await db.close();
  });

  it('should support setting a default schema via config', async () => {
    const db = createTestDb({
      ...testDbOptions,
      databaseURL: testDbOptions.databaseURL,
      schema: 'schema',
    });

    await db('user');

    await db.close();
  });
});

describe('db', () => {
  useTestDatabase();

  describe('createDb', () => {
    // for https://github.com/romeerez/orchid-orm/issues/719
    it('should be assignable to Db type', () => {
      const db: Db = createDbWithAdapter({
        adapter: testAdapter,
      });
      expect(db).toBeDefined();
    });
  });

  it('should define `selectAllShape` to ignore virtual columns', () => {
    class Virtual extends VirtualColumn<DefaultSchemaConfig> {}

    const Table = testDb('table', () => ({
      id: testDefaultColumnTypes.identity().primaryKey(),
      virtual: new Virtual(internalSchemaConfig),
    }));

    expect(Table.q.selectAllShape).toEqual({
      id: Table.shape.id,
    });
  });

  it('should have `sql` method bound to column types', () => {
    const { sql } = testDb;

    const s = sql``;

    expect(s.columnTypes).toBe(testDb.columnTypes);
  });

  it('should support ignoring views in generator options', () => {
    const generatorIgnore: GeneratorIgnore = {
      tables: ['legacy_table'],
      views: ['legacy_view', /^external_/],
    };

    const db = createDbWithAdapter({
      adapter: testAdapter,
      generatorIgnore,
    });

    expect(db.internal.generatorIgnore).toEqual(generatorIgnore);
  });

  it('tracks direct table queries as not read-only by default', () => {
    const table = testDb('table', (t) => ({
      id: t.identity().primaryKey(),
    }));

    assertType<typeof table.__readOnly, undefined>();
    assertType<typeof table.__materialized, undefined>();
    const expectMutable = <T extends Query.Pick.IsNotReadOnly>(query: T) =>
      query;
    expectMutable(table);
  });

  it('tracks materialized query metadata through db construction and read query transformations', () => {
    const view = testDb(
      'materialized_view',
      (t) => ({
        id: t.identity().primaryKey(),
      }),
      undefined,
      { materialized: true, readOnly: true },
    );

    const selected = view.select('id');
    const filtered = view.where({ id: 1 });
    const cloned = view.clone();

    assertType<typeof view.__materialized, true>();
    assertType<typeof selected.__materialized, true>();
    assertType<typeof filtered.__materialized, true>();
    assertType<typeof cloned.__materialized, true>();
    const expectMaterialized = <T extends Query.Pick.IsMaterialized>(
      query: T,
    ) => query;
    expectMaterialized(view);
    expectMaterialized(selected);
    expectMaterialized(filtered);
    expectMaterialized(cloned);

    expect(view.internal.materialized).toBe(true);
    expect(selected.internal.materialized).toBe(true);
    expect(filtered.internal.materialized).toBe(true);
    expect(cloned.internal.materialized).toBe(true);
  });

  it('tracks definition-side generator ignore metadata through query construction and cloning', () => {
    const table = testDb(
      'ignored_table',
      (t) => ({
        id: t.identity().primaryKey(),
      }),
      undefined,
      { generatorIgnore: true },
    );

    const selected = table.select('id');
    const filtered = table.where({ id: 1 });
    const cloned = table.clone();

    expect(table.internal.generatorIgnored).toBe(true);
    expect(selected.internal.generatorIgnored).toBe(true);
    expect(filtered.internal.generatorIgnored).toBe(true);
    expect(cloned.internal.generatorIgnored).toBe(true);
  });

  it('keeps read APIs and rejects mutation APIs for read-only query types', () => {
    const User = testDb(
      'user',
      (t) => ({
        id: t.identity().primaryKey(),
        name: t.text().unique(),
        password: t.text().select(false),
      }),
      undefined,
      { readOnly: true },
    );

    const ReadOnlySoftDeleteUser = testDb(
      'user',
      (t) => ({
        id: t.identity().primaryKey(),
        name: t.string(),
        deletedAt: t.timestamp().nullable(),
      }),
      undefined,
      {
        readOnly: true,
        softDelete: true,
      },
    );

    const readOnlyError = CannotMutateReadOnlyTableError;
    // @ts-expect-error read-only query cannot create
    expect(() => User.create(userData)).toThrow(readOnlyError);
    // @ts-expect-error read-only query cannot insert
    expect(() => User.insert(userData)).toThrow(readOnlyError);
    // @ts-expect-error read-only query cannot create many
    expect(() => User.createMany([userData])).toThrow(readOnlyError);
    // @ts-expect-error read-only query cannot insert many
    expect(() => User.insertMany([userData])).toThrow(readOnlyError);
    expect(() =>
      // @ts-expect-error read-only query cannot create from a query
      User.createOneFrom(User.select('name', 'password').take()),
    ).toThrow(readOnlyError);
    expect(() =>
      // @ts-expect-error read-only query cannot insert from a query
      User.insertOneFrom(User.select('name', 'password')),
    ).toThrow(readOnlyError);
    expect(() =>
      // @ts-expect-error read-only query cannot create many from a query
      User.createManyFrom(User.select('name', 'password')),
    ).toThrow(readOnlyError);
    expect(() =>
      // @ts-expect-error read-only query cannot insert many from a query
      User.insertManyFrom(User.select('name', 'password')),
    ).toThrow(readOnlyError);
    expect(() =>
      // @ts-expect-error read-only query cannot create for each source row
      User.createForEachFrom(User.select('name', 'password')),
    ).toThrow(readOnlyError);
    expect(() =>
      // @ts-expect-error read-only query cannot insert for each source row
      User.insertForEachFrom(User.select('name', 'password')),
    ).toThrow(readOnlyError);
    // @ts-expect-error read-only query cannot update
    expect(() => User.all().update({ name: 'name' })).toThrow(readOnlyError);
    // @ts-expect-error read-only query cannot update or throw
    expect(() => User.find(1).updateOrThrow({ name: 'name' })).toThrow(
      readOnlyError,
    );
    // @ts-expect-error read-only query cannot update from another query
    expect(() => User.updateFrom(() => User)).toThrow(readOnlyError);
    // @ts-expect-error read-only query cannot set after updateFrom
    expect(() => User.all().set({ name: 'name' })).toThrow(readOnlyError);
    // @ts-expect-error read-only query cannot increment
    expect(() => User.all().increment('id')).toThrow(readOnlyError);
    // @ts-expect-error read-only query cannot decrement
    expect(() => User.all().decrement('id')).toThrow(readOnlyError);
    // @ts-expect-error read-only query cannot update many
    expect(() => User.updateMany([{ id: 1, name: 'name' }])).toThrow(
      readOnlyError,
    );
    expect(() =>
      // @ts-expect-error read-only query cannot optionally update many
      User.updateManyOptional([{ id: 1, name: 'name' }]),
    ).toThrow(readOnlyError);
    expect(() =>
      // @ts-expect-error read-only query cannot update many by unique keys
      User.updateManyBy('name', [{ name: 'name', password: 'password' }]),
    ).toThrow(readOnlyError);
    expect(() =>
      // @ts-expect-error read-only query cannot optionally update many by unique keys
      User.updateManyByOptional('name', {
        name: 'name',
        password: 'password',
      }),
    ).toThrow(readOnlyError);
    // @ts-expect-error read-only query cannot delete
    expect(() => User.all().delete()).toThrow(readOnlyError);
    expect(() =>
      // @ts-expect-error read-only query cannot upsert
      User.find(1).upsert({ create: userData, update: { name: 'name' } }),
    ).toThrow(readOnlyError);
    // @ts-expect-error read-only query cannot orCreate
    expect(() => User.find(1).orCreate(userData)).toThrow(readOnlyError);
    // @ts-expect-error read-only query cannot truncate
    expect(() => User.truncate()).toThrow(readOnlyError);
    // @ts-expect-error read-only soft-delete query cannot soft delete
    expect(() => ReadOnlySoftDeleteUser.all().delete()).toThrow(readOnlyError);
    // @ts-expect-error read-only soft-delete query cannot hard delete
    expect(() => ReadOnlySoftDeleteUser.all().hardDelete()).toThrow(
      readOnlyError,
    );
  });

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
        SELECT "table"."id", "table"."name" FROM "schema"."table"
        WHERE "table"."foo" = $1
      `,
      ['bar'],
    );
  });

  it('should omit relation columns from `selectAllShape` when not having named columns', () => {
    class SomeTable extends BaseTable {
      table = 'some';
      columns = this.setColumns((t) => ({ id: t.identity().primaryKey() }));
      relations = {
        rel: this.belongsTo(() => SomeTable, {
          columns: ['id'],
          references: ['id'],
        }),
      };
    }

    const db = orchidORMWithAdapter(
      {
        adapter: testAdapter,
      },
      {
        some: SomeTable,
      },
    );

    expect(Object.keys(db.some.q.selectAllShape)).not.toContain('rel');
  });

  describe('overriding column types', () => {
    it('should return date as string by default unless it is Bun SQL', async () => {
      await User.create(userData);

      const db = createDbWithAdapter({
        adapter: testAdapter,
        snakeCase: true,
        schemaConfig: () => testDefaultSchemaConfig,
      });
      const table = db(
        'user',
        (t) => ({
          id: t.identity().primaryKey(),
          createdAt: t.timestampNoTZ(),
        }),
        undefined,
        {
          schema: () => 'schema',
        },
      );

      const result = await table.take().get('createdAt');
      expect(typeof result).toBe('string');

      assertType<typeof result, string>();
    });

    it('should return date as Date when overridden', async () => {
      await User.create(userData);

      const db = createDbWithAdapter({
        snakeCase: true,
        adapter: testAdapter,
        columnTypes: (t) => ({
          identity: t.identity,
          timestamp() {
            return t.timestamp().parse((input) => new Date(input));
          },
        }),
      });

      const table = db(
        'user',
        (t) => ({
          id: t.identity().primaryKey(),
          createdAt: t.timestamp(),
        }),
        undefined,
        {
          schema: () => 'schema',
        },
      );

      const result = await table.take().get('createdAt');
      expect(result instanceof Date).toBe(true);

      assertType<typeof result, Date>();
    });
  });

  describe('autoPreparedStatements', () => {
    it('should be false by default', () => {
      const db = createDbWithAdapter({ adapter: testAdapter });

      const table = db('table');
      expect(table.q.autoPreparedStatements).toBe(false);
    });
  });

  describe('grants', () => {
    it('should store grantor metadata with normalized grants', () => {
      const db = createDbWithAdapter({
        adapter: testAdapter,
        defaultGrantedBy: 'owner',
        grants: [
          {
            to: 'app_user',
            grantedBy: 'admin',
            tables: ['project'],
            privileges: ['SELECT'],
          },
        ],
      });

      expect(db.internal.defaultGrantedBy).toBe('owner');
      expect(db.internal.grants).toEqual([
        {
          to: ['app_user'],
          grantedBy: 'admin',
          tables: ['project'],
          privileges: ['SELECT'],
        },
      ]);
    });
  });

  describe('noPrimaryKey', () => {
    it('should throw error when no primary key by default', () => {
      const db = createDbWithAdapter({ adapter: testAdapter });

      expect(() =>
        db('table', (t) => ({
          name: t.text(),
        })),
      ).toThrow(`Table table has no primary key`);
    });

    it('should throw error when no primary key when noPrimaryKey is set to `error`', () => {
      const db = createDbWithAdapter({
        adapter: testAdapter,
        noPrimaryKey: 'error',
      });

      expect(() =>
        db('table', (t) => ({
          name: t.text(),
        })),
      ).toThrow(`Table table has no primary key`);
    });

    it('should not throw when no column shape is provided', () => {
      const db = createDbWithAdapter({ adapter: testAdapter });

      expect(() => db('table')).not.toThrow();
    });

    it('should warn when no primary key and noPrimaryKey is set to `warning`', () => {
      const logger = { warn: jest.fn() };
      const db = createDbWithAdapter({
        adapter: testAdapter,
        noPrimaryKey: 'warning',
        logger: logger as unknown as QueryLogger,
      });

      db('table', (t) => ({
        name: t.text(),
      }));

      expect(logger.warn).toHaveBeenCalledWith(
        'Table table has no primary key',
      );
    });

    it('should do nothing when no primary key and noPrimaryKey is set to `ignore`', () => {
      const logger = { warn: jest.fn() };
      const db = createDbWithAdapter({
        adapter: testAdapter,
        noPrimaryKey: 'ignore',
        logger: logger as unknown as QueryLogger,
      });

      db('table', (t) => ({
        name: t.text(),
      }));

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('snakeCase option', () => {
    it('should set column names to snake case, respecting existing names', () => {
      const db = createTestDb({
        ...testDbOptions,
        snakeCase: true,
      });

      const table = db('table', (t) => ({
        id: t.identity().primaryKey(),
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
            "table"."snake_case" "snakeCase",
            "table"."updated_at" "updatedAt",
            "table"."created_at" "createdAt"
          FROM "table"
        `,
      );
    });

    it('should override db snakeCase with table snakeCase', () => {
      const db = createTestDb(testDbOptions);

      const table = db(
        'table',
        (t) => ({
          id: t.identity().primaryKey(),
          camelCase: t.name('camelCase').integer(),
          snakeCase: t.integer(),
          ...t.timestamps(),
        }),
        () => [],
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
            "table"."snake_case" "snakeCase",
            "table"."updated_at" "updatedAt",
            "table"."created_at" "createdAt"
          FROM "table"
        `,
      );
    });
  });

  describe('query methods', () => {
    const sql = 'SELECT 1 AS one';

    it('should perform a query', async () => {
      const query = jest.spyOn(testDb.adapter, 'query');
      const original = testDb.internal.asyncStorage.getStore;
      testDb.internal.asyncStorage.getStore = jest.fn(() => undefined);

      const result = await testDb.query(raw({ raw: sql }));

      expect(result.rows).toEqual([{ one: 1 }]);
      expect(query).toHaveBeenCalledWith(sql, [], undefined);

      testDb.internal.asyncStorage.getStore = original;
    });

    it('should perform a query with a template string', async () => {
      const query = jest.spyOn(testDb.adapter, 'query');
      const original = testDb.internal.asyncStorage.getStore;
      testDb.internal.asyncStorage.getStore = jest.fn(() => undefined);

      const result = await testDb.query`SELECT 1 AS one`;

      expect(result.rows).toEqual([{ one: 1 }]);
      expect(query).toHaveBeenCalledWith(sql, [], undefined);

      testDb.internal.asyncStorage.getStore = original;
    });

    it('should perform a query in a transaction', async () => {
      const state = testDb.internal.asyncStorage.getStore();
      const query =
        state?.transactionAdapter &&
        jest.spyOn(state.transactionAdapter, 'query');

      const result = await testDb.query(raw({ raw: sql }));

      expect(result.rows).toEqual([{ one: 1 }]);
      expect(query).toHaveBeenCalledWith(sql, [], undefined);
    });

    it('should query arrays', async () => {
      const query = jest.spyOn(testDb.adapter, 'arrays');
      const original = testDb.internal.asyncStorage.getStore;
      testDb.internal.asyncStorage.getStore = jest.fn(() => undefined);

      const result = await testDb.queryArrays(raw({ raw: sql }));

      expect(result.rows).toEqual([[1]]);
      expect(query).toHaveBeenCalledWith(sql, [], undefined);

      testDb.internal.asyncStorage.getStore = original;
    });

    it('should query arrays with a template string', async () => {
      const query = jest.spyOn(testDb.adapter, 'arrays');
      const original = testDb.internal.asyncStorage.getStore;
      testDb.internal.asyncStorage.getStore = jest.fn(() => undefined);

      const result = await testDb.queryArrays`SELECT 1 AS one`;

      expect(result.rows).toEqual([[1]]);
      expect(query).toHaveBeenCalledWith(sql, [], undefined);

      testDb.internal.asyncStorage.getStore = original;
    });

    it('should query arrays in a transaction', async () => {
      const state = testDb.internal.asyncStorage.getStore();
      const query =
        state?.transactionAdapter &&
        jest.spyOn(state.transactionAdapter, 'arrays');

      const result = await testDb.queryArrays(raw({ raw: sql }));

      expect(result.rows).toEqual([[1]]);
      expect(query).toHaveBeenCalledWith(sql, [], undefined);
    });

    it('should support query modifiers', async () => {
      const user = await User.create(userData);

      const records = await testDb.query.records<{
        name: string;
      }>`SELECT * FROM "schema"."user"`;
      assertType<typeof records, { name: string }[]>();
      expect(records).toMatchObject([userData]);

      const take = await testDb.query.take<{
        name: string;
      }>`SELECT * FROM "schema"."user"`;
      assertType<typeof take, { name: string }>();
      expect(take).toMatchObject(userData);

      await expect(
        () => testDb.query.take`SELECT * FROM "schema"."user" WHERE id = 0`,
      ).rejects.toThrow('Record is not found');

      const takeOptional = await testDb.query.takeOptional<{
        name: string;
      }>`SELECT * FROM "schema"."user"`;
      assertType<typeof takeOptional, { name: string } | undefined>();
      expect(takeOptional).toMatchObject(userData);

      const takeOptionalNotFound = await testDb.query.takeOptional<{
        name: string;
      }>`SELECT * FROM "schema"."user" WHERE id = 0`;
      expect(takeOptionalNotFound).toBe(undefined);

      const rows = await testDb.query.rows<
        [number, string]
      >`SELECT id, name FROM "schema"."user"`;
      assertType<typeof rows, [number, string][]>();
      expect(rows).toEqual([[user.id, user.name]]);

      const pluck = await testDb.query
        .pluck<number>`SELECT id FROM "schema"."user"`;
      assertType<typeof pluck, number[]>();
      expect(pluck).toEqual([user.id]);

      const get = await testDb.query
        .get<number>`SELECT id FROM "schema"."user"`;
      assertType<typeof get, number>();
      expect(get).toEqual(user.id);

      await expect(
        () => testDb.query.get`SELECT * FROM "schema"."user" WHERE id = 0`,
      ).rejects.toThrow('Record is not found');

      const getOptional = await testDb.query
        .getOptional<number>`SELECT id FROM "schema"."user"`;
      assertType<typeof getOptional, number | undefined>();
      expect(getOptional).toEqual(user.id);

      const getOptionalNotFound = await testDb.query
        .getOptional<number>`SELECT id FROM "schema"."user" WHERE id = 0`;
      assertType<typeof getOptionalNotFound, number | undefined>();
      expect(getOptionalNotFound).toBe(undefined);
    });
  });

  describe('qb', () => {
    useTestDatabase();
    const { qb } = testDb;

    it('should support create', async () => {
      const created = await qb
        .withSchema('schema')
        .from('user')
        .create(userData);
      assertType<typeof created, RecordUnknown>();
      expect(created).toMatchObject(userData);

      const inserted = await qb
        .withSchema('schema')
        .from('user')
        .insert(userData);
      assertType<typeof inserted, number>();
      expect(inserted).toBe(1);

      const createdMany = await qb
        .withSchema('schema')
        .from('user')
        .createMany([userData]);
      assertType<typeof createdMany, RecordUnknown[]>();
      expect(createdMany).toMatchObject([userData]);

      const insertedMany = await qb
        .withSchema('schema')
        .from('user')
        .insertMany([userData, userData]);
      assertType<typeof insertedMany, number>();
      expect(insertedMany).toBe(2);

      const createdFrom = await qb
        .withSchema('schema')
        .from('user')
        .createOneFrom(
          qb.withSchema('schema').from('user').select('name').take(),
          {
            password: userData.password,
          },
        );
      assertType<typeof createdFrom, RecordUnknown>();
      expect(createdFrom).toMatchObject(userData);

      const insertedFrom = await qb
        .withSchema('schema')
        .from('user')
        .insertOneFrom(
          qb.withSchema('schema').from('user').select('name').take(),
          {
            password: userData.password,
          },
        );
      assertType<typeof insertedFrom, number>();
      expect(insertedFrom).toBe(1);

      const createdManyFrom = await qb
        .withSchema('schema')
        .from('user')
        .createForEachFrom(
          qb
            .withSchema('schema')
            .from('user')
            .select('name', 'password')
            .limit(1),
        );
      assertType<typeof createdManyFrom, RecordUnknown[]>();
      expect(createdManyFrom).toMatchObject([userData]);

      const insertedManyFrom = await qb
        .withSchema('schema')
        .from('user')
        .insertForEachFrom(
          qb
            .withSchema('schema')
            .from('user')
            .select('name', 'password')
            .limit(1),
        );
      assertType<typeof insertedManyFrom, number>();
      expect(insertedManyFrom).toBe(1);
    });

    it('should support update', async () => {
      const user = await qb.from('schema.user').create({ ...userData, age: 1 });

      const updatedCount = await qb
        .from('schema.user')
        .findBy({ id: user.id })
        .update(userData);
      assertType<typeof updatedCount, number>();
      expect(updatedCount).toBe(1);

      const updated = await qb
        .from('schema.user')
        .selectAll()
        .findBy({ id: user.id })
        .update(userData);
      assertType<typeof updated, RecordUnknown>();
      expect(updated).toMatchObject(userData);

      const updatedSql = await qb
        .from('schema.user')
        .findBy({ id: user.id })
        .update({ name: sql`${'name'}` });
      assertType<typeof updatedSql, number>();
      expect(updatedSql).toBe(1);

      const incremented = await qb
        .from('schema.user')
        .findBy({ id: user.id })
        .select('age')
        .increment('age');
      assertType<typeof incremented, RecordUnknown>();
      expect(incremented.age).toBe(2);

      const decremented = await qb
        .from('schema.user')
        .findBy({ id: user.id })
        .select('age')
        .decrement('age');
      assertType<typeof decremented, RecordUnknown>();
      expect(decremented.age).toBe(1);
    });

    it('should support delete', async () => {
      const user = await qb.from('schema.user').create(userData);

      const deleted = await qb
        .from('schema.user')
        .selectAll()
        .findBy({ id: user.id })
        .delete();
      assertType<typeof deleted, RecordUnknown>();
      expect(deleted).toMatchObject(userData);
    });
  });

  describe('$getAdapter', () => {
    it('returns a default adapter when not in transaction', () => {
      const db = createDbWithAdapter({
        adapter: testAdapter,
      });

      expect(db.$getAdapter()).toBe(testAdapter);
    });

    it('returns a current transaction adapter when not in transaction', async () => {
      let adapter: Adapter | undefined;

      await testDb.transaction(async () => {
        adapter = testDb.$getAdapter();
      });

      expect(adapter).not.toBe(testAdapter);
      expect(adapter).toBeInstanceOf(TransactionAdapterClass);
    });
  });
});
