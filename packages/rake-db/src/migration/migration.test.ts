import {
  expectSql,
  getDb,
  makeTestUpAndDown,
  queryMock,
  resetDb,
  toLine,
} from '../rake-db.test-utils';
import { raw } from 'pqb';

const db = getDb();

jest.mock('./migrationUtils', () => ({
  ...jest.requireActual('./migrationUtils'),
  getPrimaryKeysOfTable: jest.fn(),
}));

describe('migration', () => {
  beforeEach(() => {
    resetDb();
    db.options.snakeCase = false;
  });

  describe('renameTable', () => {
    it('should call appCodeUpdater', async () => {
      await db.renameTable('from', 'to');

      expect(db.migratedAsts.length).toBe(1);
    });

    it('should rename a table', async () => {
      const fn = () => {
        return db.renameTable('from', 'to');
      };

      await fn();
      expectSql(`
        ALTER TABLE "from" RENAME TO "to"
      `);

      db.up = false;
      queryMock.mockClear();
      await fn();
      expectSql(`
        ALTER TABLE "to" RENAME TO "from"
      `);
    });
  });

  it('should rename table with schema', async () => {
    const fn = () => {
      return db.renameTable('one.from', 'two.to');
    };

    await fn();
    expectSql(`
        ALTER TABLE "one"."from" RENAME TO "two"."to"
      `);

    db.up = false;
    queryMock.mockClear();
    await fn();
    expectSql(`
        ALTER TABLE "two"."to" RENAME TO "one"."from"
      `);
  });

  describe('addColumn and dropColumn', () => {
    const testUpAndDown = makeTestUpAndDown('addColumn', 'dropColumn');

    it('should use changeTable to add and drop a column', async () => {
      await testUpAndDown(
        (action) => db[action]('table', 'column', (t) => t.text()),
        () =>
          expectSql(`
            ALTER TABLE "table"
            ADD COLUMN "column" text NOT NULL
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            DROP COLUMN "column"
          `),
      );
    });

    it('should use changeTable to add and drop a column in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) => db[action]('table', 'columnName', (t) => t.text()),
        () =>
          expectSql(`
            ALTER TABLE "table"
            ADD COLUMN "column_name" text NOT NULL
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            DROP COLUMN "column_name"
          `),
      );
    });
  });

  describe('addIndex and dropIndex', () => {
    const testUpAndDown = makeTestUpAndDown('addIndex', 'dropIndex');

    it('should use changeTable to add and drop an index', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', ['id', { column: 'name', order: 'DESC' }], {
            name: 'indexName',
            unique: true,
            nullsNotDistinct: true,
          }),
        () =>
          expectSql(`
            CREATE UNIQUE INDEX "indexName" ON "table" ("id", "name" DESC) NULLS NOT DISTINCT
          `),
        () =>
          expectSql(`
            DROP INDEX "indexName"
          `),
      );
    });

    it('should use changeTable to add and drop an index in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action](
            'table',
            [
              'idColumn',
              {
                column: 'nameColumn',
                order: 'DESC',
              },
            ],
            {
              unique: true,
              nullsNotDistinct: true,
            },
          ),
        () =>
          expectSql(`
            CREATE UNIQUE INDEX "table_id_column_name_column_idx" ON "table" ("id_column", "name_column" DESC) NULLS NOT DISTINCT
          `),
        () =>
          expectSql(`
            DROP INDEX "table_id_column_name_column_idx"
          `),
      );
    });
  });

  describe('addForeignKey and dropForeignKey', () => {
    const testUpAndDown = makeTestUpAndDown('addForeignKey', 'dropForeignKey');

    it('should use changeTable to add and drop a foreignKey', async () => {
      await testUpAndDown(
        (action) =>
          db[action](
            'table',
            ['id', 'name'],
            'otherTable',
            ['foreignId', 'foreignName'],
            {
              name: 'constraintName',
              match: 'FULL',
              onUpdate: 'CASCADE',
              onDelete: 'CASCADE',
              dropMode: 'CASCADE',
            },
          ),
        () =>
          expectSql(`
            ALTER TABLE "table"
            ${toLine(`
              ADD CONSTRAINT "constraintName"
                FOREIGN KEY ("id", "name")
                REFERENCES "otherTable"("foreignId", "foreignName")
                MATCH FULL
                ON DELETE CASCADE
                ON UPDATE CASCADE
            `)}
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            DROP CONSTRAINT "constraintName" CASCADE
          `),
      );
    });

    it('should use changeTable to add and drop a foreignKey in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', ['idColumn', 'nameColumn'], 'otherTable', [
            'foreignId',
            'foreignName',
          ]),
        () =>
          expectSql(`
            ALTER TABLE "table"
            ${toLine(`
              ADD CONSTRAINT "table_id_column_name_column_fkey"
                FOREIGN KEY ("id_column", "name_column")
                REFERENCES "otherTable"("foreign_id", "foreign_name")
            `)}
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            DROP CONSTRAINT "table_id_column_name_column_fkey"
          `),
      );
    });
  });

  describe('addCheck and dropCheck', () => {
    const testUpAndDown = makeTestUpAndDown('addCheck', 'dropCheck');

    it('should use changeTable to add and drop a check', async () => {
      await testUpAndDown(
        (action) => db[action]('table', raw({ raw: 'check' })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD CONSTRAINT "table_check" CHECK (check)
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP CONSTRAINT "table_check"
          `),
      );
    });
  });

  describe('addConstraint and dropConstraint', () => {
    const testUpAndDown = makeTestUpAndDown('addConstraint', 'dropConstraint');

    it('should use changeTable to add and drop a foreignKey', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', {
            name: 'constraint',
            references: [
              ['id', 'name'],
              'otherTable',
              ['foreignId', 'foreignName'],
              {
                match: 'FULL',
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
              },
            ],
            check: raw({ raw: 'check' }),
            dropMode: 'CASCADE',
          }),
        () =>
          expectSql(`
            ALTER TABLE "table"
            ${toLine(`
              ADD CONSTRAINT "constraint"
                FOREIGN KEY ("id", "name")
                REFERENCES "otherTable"("foreignId", "foreignName")
                MATCH FULL
                ON DELETE CASCADE
                ON UPDATE CASCADE
                CHECK (check)
            `)}
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            DROP CONSTRAINT "constraint" CASCADE
          `),
      );
    });
  });

  describe('addPrimaryKey and dropPrimaryKey', () => {
    const testUpAndDown = makeTestUpAndDown('addPrimaryKey', 'dropPrimaryKey');

    it('should use changeTable to add and drop primary key', async () => {
      await testUpAndDown(
        (action) => db[action]('table', ['id', 'name']),
        () =>
          expectSql(`
            ALTER TABLE "table"
            ADD PRIMARY KEY ("id", "name")
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            DROP CONSTRAINT "table_pkey"
          `),
      );
    });

    it('should use changeTable to add and drop primary key with constraint name', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', ['id', 'name'], {
            name: 'primaryKeyName',
          }),
        () =>
          expectSql(`
            ALTER TABLE "table"
            ADD CONSTRAINT "primaryKeyName" PRIMARY KEY ("id", "name")
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            DROP CONSTRAINT "primaryKeyName"
          `),
      );
    });

    it('should use changeTable to add and drop primary key in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) => db[action]('table', ['idColumn', 'nameColumn']),
        () =>
          expectSql(`
            ALTER TABLE "table"
            ADD PRIMARY KEY ("id_column", "name_column")
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            DROP CONSTRAINT "table_pkey"
          `),
      );
    });
  });

  describe('renameColumn', () => {
    const testUpAndDown = makeTestUpAndDown('renameColumn');

    it('should use changeTable to rename a column', async () => {
      await testUpAndDown(
        () => db.renameColumn('table', 'from', 'to'),
        () =>
          expectSql(`
            ALTER TABLE "table"
            RENAME COLUMN "from" TO "to"
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            RENAME COLUMN "to" TO "from"
          `),
      );
    });

    it('should use changeTable to rename a column in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        () => db.renameColumn('table', 'fromColumn', 'toColumn'),
        () =>
          expectSql(`
            ALTER TABLE "table"
            RENAME COLUMN "from_column" TO "to_column"
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            RENAME COLUMN "to_column" TO "from_column"
          `),
      );
    });
  });

  describe('createSchema and dropSchema', () => {
    const testUpAndDown = makeTestUpAndDown('createSchema', 'dropSchema');

    it('should call appCodeUpdater', async () => {
      await testUpAndDown(
        (action) => db[action]('schemaName'),
        () => expect(db.migratedAsts.length).toBe(1),
        () => expect(db.migratedAsts.length).toBe(1),
      );
    });

    it(`should add and drop a schema`, async () => {
      await testUpAndDown(
        (action) => db[action]('schemaName'),
        () =>
          expectSql(`
            CREATE SCHEMA "schemaName"
          `),
        () =>
          expectSql(`
            DROP SCHEMA "schemaName"
          `),
      );
    });
  });

  describe('createExtension and dropExtension', () => {
    const testUpAndDown = makeTestUpAndDown('createExtension', 'dropExtension');

    it('should call appCodeUpdater', async () => {
      await testUpAndDown(
        (action) => db[action]('extensionName'),
        () => expect(db.migratedAsts.length).toBe(1),
        () => expect(db.migratedAsts.length).toBe(1),
      );
    });

    it(`should add and drop an extension`, async () => {
      await testUpAndDown(
        (action) =>
          db[action]('extensionName', {
            dropIfExists: true,
            createIfNotExists: true,
            schema: 'schemaName',
            version: '123',
            cascade: true,
          }),
        () =>
          expectSql(`
            CREATE EXTENSION IF NOT EXISTS "extensionName" SCHEMA "schemaName" VERSION '123' CASCADE
          `),
        () =>
          expectSql(`
            DROP EXTENSION IF EXISTS "extensionName" CASCADE
          `),
      );
    });
  });

  describe('createEnum and dropEnum', () => {
    const testUpAndDown = makeTestUpAndDown('createEnum', 'dropEnum');

    it('should push ast', async () => {
      await testUpAndDown(
        (action) => db[action]('enumName', ['one']),
        () => expect(db.migratedAsts.length).toBe(1),
        () => expect(db.migratedAsts.length).toBe(1),
      );
    });

    it(`should add and drop an enum`, async () => {
      await testUpAndDown(
        (action) =>
          db[action]('schemaName.enumName', ['one', 'two'], {
            dropIfExists: true,
            cascade: true,
          }),
        () =>
          expectSql(`
            CREATE TYPE "schemaName"."enumName" AS ENUM ('one', 'two')
          `),
        () =>
          expectSql(`
            DROP TYPE IF EXISTS "schemaName"."enumName" CASCADE
          `),
      );
    });
  });

  describe('createDomain and dropDomain', () => {
    const testUpAndDown = makeTestUpAndDown('createDomain', 'dropDomain');

    it('should push ast', async () => {
      await testUpAndDown(
        (action) => db[action]('domain', (t) => t.integer()),
        () => expect(db.migratedAsts.length).toBe(1),
        () => expect(db.migratedAsts.length).toBe(1),
      );
    });

    it(`should create and drop domain`, async () => {
      await testUpAndDown(
        (action) =>
          db[action]('schema.domain', (t) => t.integer(), {
            collation: 'C',
            notNull: true,
            default: db.sql`123`,
            check: db.sql`VALUE = 42`,
            cascade: true,
          }),
        () =>
          expectSql(`
            CREATE DOMAIN "schema"."domain" AS integer
            COLLATION 'C'
            DEFAULT 123
            NOT NULL CHECK VALUE = 42
          `),
        () =>
          expectSql(`
            DROP DOMAIN "schema"."domain" CASCADE
          `),
      );
    });
  });

  describe('createCollation and dropCollation', () => {
    const testUpAndDown = makeTestUpAndDown('createCollation', 'dropCollation');

    it('should push ast', async () => {
      await testUpAndDown(
        (action) => db[action]('name', { locale: 'locale' }),
        () => expect(db.migratedAsts.length).toBe(1),
        () => expect(db.migratedAsts.length).toBe(1),
      );
    });

    it(`should create and drop collation with options`, async () => {
      await testUpAndDown(
        (action) =>
          db[action]('schema.collation', {
            locale: 'en-u-kn-true',
            lcCollate: 'C',
            lcCType: 'C',
            provider: 'icu',
            deterministic: true,
            version: '123',
            createIfNotExists: true,
            dropIfExists: true,
            cascade: true,
          }),
        () =>
          expectSql(`
            CREATE COLLATION IF NOT EXISTS "schema"."collation" (
              locale = 'en-u-kn-true',
              lc_collate = 'C',
              lc_ctype = 'C',
              provider = icu,
              deterministic = true,
              version = '123'
            )
          `),
        () =>
          expectSql(`
            DROP COLLATION IF EXISTS "schema"."collation" CASCADE
          `),
      );
    });

    it(`should create and drop collation from existing`, async () => {
      await testUpAndDown(
        (action) =>
          db[action]('schema.collation', {
            fromExisting: 'schema.other',
          }),
        () =>
          expectSql(`
            CREATE COLLATION "schema"."collation" FROM "schema"."other"
          `),
        () =>
          expectSql(`
            DROP COLLATION "schema"."collation"
          `),
      );
    });
  });

  describe('tableExists', () => {
    it('should return boolean', async () => {
      queryMock.mockResolvedValueOnce({ rowCount: 1 });
      expect(await db.tableExists('table')).toBe(true);

      queryMock.mockResolvedValueOnce({ rowCount: 0 });
      expect(await db.tableExists('table')).toBe(false);
    });
  });

  describe('columnExists', () => {
    it('should return boolean', async () => {
      queryMock.mockResolvedValueOnce({ rowCount: 1 });
      expect(await db.columnExists('table', 'colum')).toBe(true);

      queryMock.mockResolvedValueOnce({ rowCount: 0 });
      expect(await db.columnExists('table', 'colum')).toBe(false);
    });
  });

  describe('constraintExists', () => {
    it('should return boolean', async () => {
      queryMock.mockResolvedValueOnce({ rowCount: 1 });
      expect(await db.constraintExists('constraintName')).toBe(true);

      queryMock.mockResolvedValueOnce({ rowCount: 0 });
      expect(await db.constraintExists('constraintName')).toBe(false);
    });
  });
});
