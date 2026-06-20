import { raw } from 'pqb/internal';
import { expectSql, getDb, resetDb, toLine } from '../rake-db.test-utils';

const db = getDb();

beforeEach(() => resetDb(true));

const testUpAndDown = async (
  fn: (
    action: 'createMaterializedView' | 'dropMaterializedView',
  ) => Promise<void>,
  expectUp: () => void,
  expectDown: () => void,
) => {
  resetDb(true);
  await fn('createMaterializedView');
  expectUp();

  resetDb(false);
  await fn('createMaterializedView');
  expectDown();

  resetDb(true);
  await fn('dropMaterializedView');
  expectDown();

  resetDb(false);
  await fn('dropMaterializedView');
  expectUp();
};

describe('create and drop materialized view', () => {
  it('should interpolate SQL parameters because pg does not support binding params for modifying schema', async () => {
    await db.createMaterializedView(
      'name',
      raw`SELECT ${1} AS "one", ${2} AS "two"`,
    );

    expectSql(`
      CREATE MATERIALIZED VIEW "name" AS (SELECT 1 AS "one", 2 AS "two")
    `);
  });

  it('should create and drop materialized view', async () => {
    await testUpAndDown(
      (action) => db[action]('name', 'sql'),
      () =>
        expectSql(`
          CREATE MATERIALIZED VIEW "name" AS (sql)
        `),
      () =>
        expectSql(`
          DROP MATERIALIZED VIEW "name"
        `),
    );
  });

  it('should create and drop materialized view withing a schema', async () => {
    await testUpAndDown(
      (action) => db[action]('schema.name', 'sql'),
      () =>
        expectSql(`
          CREATE MATERIALIZED VIEW "schema"."name" AS (sql)
        `),
      () =>
        expectSql(`
          DROP MATERIALIZED VIEW "schema"."name"
        `),
    );
  });

  it('should create and drop materialized view with options', async () => {
    await testUpAndDown(
      (action) =>
        db[action](
          'name',
          {
            dropIfExists: true,
            dropMode: 'CASCADE',
            columns: ['one', 'two'],
            withData: false,
          },
          'sql',
        ),
      () =>
        expectSql(
          toLine(`
            CREATE MATERIALIZED VIEW "name"
            ("one", "two")
            AS (sql)
            WITH NO DATA
          `),
        ),
      () =>
        expectSql(`
          DROP MATERIALIZED VIEW IF EXISTS "name" CASCADE
        `),
    );
  });

  it('should create materialized view with explicit WITH DATA', async () => {
    await db.createMaterializedView(
      'name',
      {
        withData: true,
      },
      'sql',
    );

    expectSql(`
      CREATE MATERIALIZED VIEW "name" AS (sql) WITH DATA
    `);
  });
});

describe('refresh materialized view', () => {
  it('should refresh materialized view', async () => {
    await db.refreshMaterializedView('schema.name');

    expectSql(`
      REFRESH MATERIALIZED VIEW "schema"."name"
    `);
  });

  it('should refresh materialized view concurrently with data', async () => {
    await db.refreshMaterializedView('name', {
      concurrently: true,
      withData: true,
    });

    expectSql(`
      REFRESH MATERIALIZED VIEW CONCURRENTLY "name" WITH DATA
    `);
  });

  it('should refresh materialized view with no data', async () => {
    await db.refreshMaterializedView('name', {
      withData: false,
    });

    expectSql(`
      REFRESH MATERIALIZED VIEW "name" WITH NO DATA
    `);
  });

  it('should reject concurrent refresh with no data', async () => {
    await expect(
      db.refreshMaterializedView('name', {
        concurrently: true,
        withData: false,
      }),
    ).rejects.toThrow(
      'Cannot refresh a materialized view concurrently with WITH NO DATA',
    );
  });
});
