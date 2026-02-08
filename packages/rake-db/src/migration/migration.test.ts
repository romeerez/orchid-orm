import {
  expectSql,
  getDb,
  makeTestUpAndDown,
  queryMock,
  toLine,
} from '../rake-db.test-utils';
import { raw, singleQuote } from 'pqb';
import { sql } from 'test-utils';

const db = getDb();

describe('migration', () => {
  describe('renameTable', () => {
    const testRenameTable = makeTestUpAndDown('renameTable');

    it('should pick schema name from the config', async () => {
      db.options.schema = 'schema';

      await testRenameTable(
        (action) => db[action]('from', 'to'),
        () =>
          expectSql(`
            ALTER TABLE "schema"."from" RENAME TO "to"
          `),
        () =>
          expectSql(`
            ALTER TABLE "schema"."to" RENAME TO "from"
          `),
      );

      db.options.schema = undefined;
    });

    it('should rename a table', async () => {
      await testRenameTable(
        (action) => db[action]('from', 'to'),
        () =>
          expectSql(`
            ALTER TABLE "from" RENAME TO "to"
          `),
        () =>
          expectSql(`
            ALTER TABLE "to" RENAME TO "from"
          `),
      );
    });

    it('should rename a table and change schema', async () => {
      await testRenameTable(
        (action) => db[action]('a.from', 'b.to'),
        () =>
          expectSql([
            `ALTER TABLE "a"."from" RENAME TO "to"`,
            `ALTER TABLE "a"."to" SET SCHEMA "b"`,
          ]),
        () =>
          expectSql([
            `ALTER TABLE "b"."to" RENAME TO "from"`,
            `ALTER TABLE "b"."from" SET SCHEMA "a"`,
          ]),
      );
    });

    it('should only change schema', async () => {
      await testRenameTable(
        (action) => db[action]('a.t', 'b.t'),
        () =>
          expectSql(`
            ALTER TABLE "a"."t" SET SCHEMA "b"
          `),
        () =>
          expectSql(`
            ALTER TABLE "b"."t" SET SCHEMA "a"
          `),
      );
    });

    it('should set default schema when it is not set', async () => {
      await testRenameTable(
        (action) => db[action]('a.from', 'to'),
        () =>
          expectSql([
            `ALTER TABLE "a"."from" RENAME TO "to"`,
            `ALTER TABLE "a"."to" SET SCHEMA "public"`,
          ]),
        () =>
          expectSql([
            `ALTER TABLE "to" RENAME TO "from"`,
            `ALTER TABLE "from" SET SCHEMA "a"`,
          ]),
      );
    });
  });

  describe('changeTableSchema', () => {
    it('should change table schema', async () => {
      await makeTestUpAndDown('changeTableSchema')(
        (action) => db[action]('table', 'from', 'to'),
        () =>
          expectSql(`
            ALTER TABLE "from"."table" SET SCHEMA "to"
          `),
        () =>
          expectSql(`
            ALTER TABLE "to"."table" SET SCHEMA "from"
          `),
      );
    });
  });

  describe('addColumn and dropColumn', () => {
    const testUpAndDown = makeTestUpAndDown('addColumn', 'dropColumn');

    it('should pick the schema from the config', async () => {
      db.options.schema = 'schema';

      await testUpAndDown(
        (action) => db[action]('table', 'colUmn', (t) => t.text()),
        () =>
          expectSql(`
            ALTER TABLE "schema"."table"
            ADD COLUMN "col_umn" text NOT NULL
          `),
        () =>
          expectSql(`
            ALTER TABLE "schema"."table"
            DROP COLUMN "col_umn"
          `),
      );

      db.options.schema = undefined;
    });

    it('should use changeTable to add and drop a column', async () => {
      await testUpAndDown(
        (action) => db[action]('table', 'colUmn', (t) => t.text()),
        () =>
          expectSql(`
            ALTER TABLE "table"
            ADD COLUMN "col_umn" text NOT NULL
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            DROP COLUMN "col_umn"
          `),
      );
    });
  });

  describe('addIndex and dropIndex', () => {
    const testUpAndDown = makeTestUpAndDown('addIndex', 'dropIndex');

    it('should pick the schema from the config', async () => {
      db.options.schema = 'schema';

      await testUpAndDown(
        (action) => db[action]('table', ['iD']),
        () =>
          expectSql(`
            CREATE INDEX "table_i_d_idx" ON "schema"."table" ("i_d")
          `),
        () =>
          expectSql(`
            DROP INDEX "table_i_d_idx"
          `),
      );

      db.options.schema = undefined;
    });

    it('should use changeTable to add and drop an index (deprecated name argument)', async () => {
      await testUpAndDown(
        (action) =>
          db[action](
            'table',
            ['iD', { column: 'naMe', order: 'DESC' }],
            'indexName',
            // @ts-expect-error name as argument is deprecated
            {
              unique: true,
              nullsNotDistinct: true,
            },
          ),
        () =>
          expectSql(`
            CREATE UNIQUE INDEX "indexName" ON "table" ("i_d", "na_me" DESC) NULLS NOT DISTINCT
          `),
        () =>
          expectSql(`
            DROP INDEX "indexName"
          `),
      );
    });

    it('should use changeTable to add and drop an index', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', ['iD', { column: 'naMe', order: 'DESC' }], {
            name: 'indexName',
            unique: true,
            nullsNotDistinct: true,
          }),
        () =>
          expectSql(`
            CREATE UNIQUE INDEX "indexName" ON "table" ("i_d", "na_me" DESC) NULLS NOT DISTINCT
          `),
        () =>
          expectSql(`
            DROP INDEX "indexName"
          `),
      );
    });
  });

  describe('renameIndex', () => {
    const test = makeTestUpAndDown('renameIndex');

    it('should pick the schema from the config', async () => {
      db.options.schema = 'schema';

      await test(
        (action) => db[action]('table', 'from', 'to'),
        () =>
          expectSql(`
            ALTER INDEX "schema"."from" RENAME TO "to"
          `),
        () =>
          expectSql(`
            ALTER INDEX "schema"."to" RENAME TO "from"
          `),
      );

      db.options.schema = undefined;
    });

    it('should rename an index', async () => {
      await test(
        (action) => db[action]('schema.table', 'from', 'to'),
        () =>
          expectSql(`
            ALTER INDEX "schema"."from" RENAME TO "to"
          `),
        () =>
          expectSql(`
            ALTER INDEX "schema"."to" RENAME TO "from"
          `),
      );
    });
  });

  describe('addForeignKey and dropForeignKey', () => {
    const testUpAndDown = makeTestUpAndDown('addForeignKey', 'dropForeignKey');

    it('should pick the schema from the config', async () => {
      db.options.schema = 'schema';

      await testUpAndDown(
        (action) => db[action]('table', ['iD'], 'otherTable', ['foreignId']),
        () =>
          expectSql(`
            ALTER TABLE "schema"."table"
            ${toLine(`
              ADD CONSTRAINT "table_i_d_fkey"
                FOREIGN KEY ("i_d")
                REFERENCES "schema"."otherTable"("foreign_id")
            `)}
          `),
        () =>
          expectSql(`
            ALTER TABLE "schema"."table"
            DROP CONSTRAINT "table_i_d_fkey"
          `),
      );

      db.options.schema = undefined;
    });

    it('should use changeTable to add and drop a foreignKey', async () => {
      await testUpAndDown(
        (action) =>
          db[action](
            'schema.table',
            ['iD', 'naMe'],
            'schema.otherTable',
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
            ALTER TABLE "schema"."table"
            ${toLine(`
              ADD CONSTRAINT "constraintName"
                FOREIGN KEY ("i_d", "na_me")
                REFERENCES "schema"."otherTable"("foreign_id", "foreign_name")
                MATCH FULL
                ON DELETE CASCADE
                ON UPDATE CASCADE
            `)}
          `),
        () =>
          expectSql(`
            ALTER TABLE "schema"."table"
            DROP CONSTRAINT "constraintName" CASCADE
          `),
      );
    });
  });

  describe('addCheck and dropCheck', () => {
    const testUpAndDown = makeTestUpAndDown('addCheck', 'dropCheck');

    it('should pick the schema from the config', async () => {
      db.options.schema = 'schema';

      await testUpAndDown(
        (action) => db[action]('table', raw({ raw: 'check' })),
        () =>
          expectSql(`
            ALTER TABLE "schema"."table"
              ADD CONSTRAINT "table_check" CHECK (check)
          `),
        () =>
          expectSql(`
            ALTER TABLE "schema"."table"
              DROP CONSTRAINT "table_check"
          `),
      );

      db.options.schema = undefined;
    });

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

  describe('renameConstraint', () => {
    const testUpAndDown = makeTestUpAndDown('renameConstraint');

    it('should pick the schema from the config', async () => {
      db.options.schema = 'schema';

      await testUpAndDown(
        (action) => db[action]('table', 'from', 'to'),
        () =>
          expectSql(
            `ALTER TABLE "schema"."table" RENAME CONSTRAINT "from" TO "to"`,
          ),
        () =>
          expectSql(
            `ALTER TABLE "schema"."table" RENAME CONSTRAINT "to" TO "from"`,
          ),
      );

      db.options.schema = undefined;
    });

    it('should rename a constraint', async () => {
      await testUpAndDown(
        (action) => db[action]('schema.table', 'from', 'to'),
        () =>
          expectSql(
            `ALTER TABLE "schema"."table" RENAME CONSTRAINT "from" TO "to"`,
          ),
        () =>
          expectSql(
            `ALTER TABLE "schema"."table" RENAME CONSTRAINT "to" TO "from"`,
          ),
      );
    });
  });

  describe('addPrimaryKey and dropPrimaryKey', () => {
    const testUpAndDown = makeTestUpAndDown('addPrimaryKey', 'dropPrimaryKey');

    it('should pick the schema from the config', async () => {
      db.options.schema = 'schema';

      await testUpAndDown(
        (action) => db[action]('table', ['iD', 'naMe']),
        () =>
          expectSql(`
            ALTER TABLE "schema"."table"
            ADD PRIMARY KEY ("i_d", "na_me")
          `),
        () =>
          expectSql(`
            ALTER TABLE "schema"."table"
            DROP CONSTRAINT "table_pkey"
          `),
      );

      db.options.schema = undefined;
    });

    it('should use changeTable to add and drop primary key', async () => {
      await testUpAndDown(
        (action) => db[action]('table', ['iD', 'naMe']),
        () =>
          expectSql(`
            ALTER TABLE "table"
            ADD PRIMARY KEY ("i_d", "na_me")
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
        (action) => db[action]('table', ['iD', 'naMe'], 'primaryKeyName'),
        () =>
          expectSql(`
            ALTER TABLE "table"
            ADD CONSTRAINT "primaryKeyName" PRIMARY KEY ("i_d", "na_me")
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            DROP CONSTRAINT "primaryKeyName"
          `),
      );
    });
  });

  describe('renameColumn', () => {
    const testUpAndDown = makeTestUpAndDown('renameColumn');

    it('should pick the schema from the config', async () => {
      db.options.schema = 'schema';

      await testUpAndDown(
        () => db.renameColumn('table', 'frOm', 'tO'),
        () =>
          expectSql(`
            ALTER TABLE "schema"."table"
            RENAME COLUMN "fr_om" TO "t_o"
          `),
        () =>
          expectSql(`
            ALTER TABLE "schema"."table"
            RENAME COLUMN "t_o" TO "fr_om"
          `),
      );

      db.options.schema = undefined;
    });

    it('should use changeTable to rename a column', async () => {
      await testUpAndDown(
        () => db.renameColumn('table', 'frOm', 'tO'),
        () =>
          expectSql(`
            ALTER TABLE "table"
            RENAME COLUMN "fr_om" TO "t_o"
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            RENAME COLUMN "t_o" TO "fr_om"
          `),
      );
    });
  });

  describe('createSchema and dropSchema', () => {
    const testUpAndDown = makeTestUpAndDown('createSchema', 'dropSchema');

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

  describe('renameSchema', () => {
    it('should rename a schema', async () => {
      await makeTestUpAndDown('renameSchema')(
        (action) => db[action]('from', 'to'),
        () =>
          expectSql(`
            ALTER SCHEMA "from" RENAME TO "to"
          `),
        () =>
          expectSql(`
            ALTER SCHEMA "to" RENAME TO "from"
          `),
      );
    });
  });

  describe('createExtension and dropExtension', () => {
    const testUpAndDown = makeTestUpAndDown('createExtension', 'dropExtension');

    it('should pick the schema from the config', async () => {
      db.options.schema = 'schema';

      await testUpAndDown(
        (action) => db[action]('extensionName'),
        () =>
          expectSql(`
            CREATE EXTENSION "extensionName" SCHEMA "schema"
          `),
        () =>
          expectSql(`
            DROP EXTENSION "extensionName"
          `),
      );

      db.options.schema = undefined;
    });

    it(`should add and drop an extension`, async () => {
      await testUpAndDown(
        (action) =>
          db[action]('schemaName.extensionName', {
            dropIfExists: true,
            createIfNotExists: true,
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

    it('should pick the schema from the config', async () => {
      db.options.schema = 'schema';

      await testUpAndDown(
        (action) => db[action]('enumName', ['one', 'two']),
        () =>
          expectSql(`
            CREATE TYPE "schema"."enumName" AS ENUM ('one', 'two')
          `),
        () =>
          expectSql(`
            DROP TYPE "schema"."enumName"
          `),
      );

      db.options.schema = undefined;
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

  describe('renameType', () => {
    const testRenameType = makeTestUpAndDown('renameType');

    it('should pick the schema from the config', async () => {
      db.options.schema = 'schema';

      await testRenameType(
        (action) => db[action]('from', 'to'),
        () =>
          expectSql(`
            ALTER TYPE "schema"."from" RENAME TO "to"
          `),
        () =>
          expectSql(`
            ALTER TYPE "schema"."to" RENAME TO "from"
          `),
      );

      db.options.schema = undefined;
    });

    it('should rename a type', async () => {
      await testRenameType(
        (action) => db[action]('from', 'to'),
        () =>
          expectSql(`
            ALTER TYPE "from" RENAME TO "to"
          `),
        () =>
          expectSql(`
            ALTER TYPE "to" RENAME TO "from"
          `),
      );
    });

    it('should rename a type and change schema', async () => {
      await testRenameType(
        (action) => db[action]('a.from', 'b.to'),
        () =>
          expectSql([
            `ALTER TYPE "a"."from" RENAME TO "to"`,
            `ALTER TYPE "a"."to" SET SCHEMA "b"`,
          ]),
        () =>
          expectSql([
            `ALTER TYPE "b"."to" RENAME TO "from"`,
            `ALTER TYPE "b"."from" SET SCHEMA "a"`,
          ]),
      );
    });

    it('should only change schema', async () => {
      await testRenameType(
        (action) => db[action]('a.t', 'b.t'),
        () =>
          expectSql(`
            ALTER TYPE "a"."t" SET SCHEMA "b"
          `),
        () =>
          expectSql(`
            ALTER TYPE "b"."t" SET SCHEMA "a"
          `),
      );
    });

    it('should set default schema when it is not set', async () => {
      await testRenameType(
        (action) => db[action]('a.from', 'to'),
        () =>
          expectSql([
            `ALTER TYPE "a"."from" RENAME TO "to"`,
            `ALTER TYPE "a"."to" SET SCHEMA "public"`,
          ]),
        () =>
          expectSql([
            `ALTER TYPE "to" RENAME TO "from"`,
            `ALTER TYPE "from" SET SCHEMA "a"`,
          ]),
      );
    });
  });

  describe('changeTypeSchema', () => {
    it('should change type schema', async () => {
      await makeTestUpAndDown('changeTypeSchema')(
        (action) => db[action]('type', 'from', 'to'),
        () =>
          expectSql(`
            ALTER TYPE "from"."type" SET SCHEMA "to"
          `),
        () =>
          expectSql(`
            ALTER TYPE "to"."type" SET SCHEMA "from"
          `),
      );
    });
  });

  describe('addEnumValues, dropEnumValues, changeEnumValues', () => {
    const testUpAndDown = makeTestUpAndDown('addEnumValues', 'dropEnumValues');

    beforeAll(() => {
      queryMock.mockImplementation((arg) => {
        const q = arg as string;
        if (q.includes('enum_range')) {
          return {
            rows: [{ value: 'one' }, { value: 'two' }, { value: 'four' }],
          };
        }

        if (q.includes('columns')) {
          return {
            rows: [
              {
                schema: 'public',
                table: 'one',
                columns: [
                  { name: 'columnOne', arrayDims: 0 },
                  { name: 'columnTwo', arrayDims: 0 },
                ],
              },
              {
                schema: 'custom',
                table: 'two',
                columns: [{ name: 'columnThree', arrayDims: 0 }],
              },
            ],
          };
        }

        return;
      });
    });

    afterAll(() => queryMock.mockReset());

    const changeEnumTemplateSql = (values: string[]) => [
      `SELECT n.nspname AS "schema",
  c.relname AS "table",
  json_agg(
    json_build_object('name', a.attname, 'arrayDims', a.attndims)
    ORDER BY a.attnum
  ) AS "columns"
FROM pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = relnamespace
JOIN pg_type bt ON bt.typname = 'enumName'
JOIN pg_type t ON t.oid = bt.oid OR t.typelem = bt.oid
JOIN pg_attribute a ON a.attrelid = c.oid AND a.atttypid = t.oid
JOIN pg_namespace tn ON tn.oid = t.typnamespace AND tn.nspname = 'schema'
WHERE c.relkind IN ('r', 'm')
GROUP BY n.nspname, c.relname`,
      `ALTER TABLE "public"."one"
  ALTER COLUMN "columnOne" TYPE text,
  ALTER COLUMN "columnTwo" TYPE text;
ALTER TABLE "custom"."two"
  ALTER COLUMN "columnThree" TYPE text;
DROP TYPE "schema"."enumName";
CREATE TYPE "schema"."enumName" AS ENUM (${values
        .map(singleQuote)
        .join(', ')})`,
      `ALTER TABLE "public"."one"
  ALTER COLUMN "columnOne" TYPE "schema"."enumName" USING "columnOne"::"schema"."enumName"`,
      `ALTER TABLE "public"."one"
  ALTER COLUMN "columnTwo" TYPE "schema"."enumName" USING "columnTwo"::"schema"."enumName"`,
      `ALTER TABLE "custom"."two"
  ALTER COLUMN "columnThree" TYPE "schema"."enumName" USING "columnThree"::"schema"."enumName"`,
    ];

    it('should add and drop enum value using schema from the config', async () => {
      db.options.schema = 'schema';

      await testUpAndDown(
        (action) =>
          db[action]('enumName', ['three'], {
            after: 'two',
            ifNotExists: true,
          }),
        () =>
          expectSql(`
            ALTER TYPE "schema"."enumName" ADD VALUE IF NOT EXISTS 'three' AFTER 'two'
          `),
        () =>
          expectSql([
            `SELECT unnest(enum_range(NULL::"schema"."enumName"))::text value`,
            ...changeEnumTemplateSql(['one', 'two', 'four']),
          ]),
      );

      db.options.schema = undefined;
    });

    it('should add and drop enum value', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('schema.enumName', ['three'], {
            after: 'two',
            ifNotExists: true,
          }),
        () =>
          expectSql(`
            ALTER TYPE "schema"."enumName" ADD VALUE IF NOT EXISTS 'three' AFTER 'two'
          `),
        () =>
          expectSql([
            `SELECT unnest(enum_range(NULL::"schema"."enumName"))::text value`,
            ...changeEnumTemplateSql(['one', 'two', 'four']),
          ]),
      );
    });

    it('should change enum values using schema from the config', async () => {
      db.options.schema = 'schema';

      await makeTestUpAndDown('changeEnumValues')(
        (action) => db[action]('enumName', ['one', 'two'], ['three', 'four']),
        () => expectSql(changeEnumTemplateSql(['three', 'four'])),
        () => expectSql(changeEnumTemplateSql(['one', 'two'])),
      );

      db.options.schema = undefined;
    });

    it('should change enum values', async () => {
      await makeTestUpAndDown('changeEnumValues')(
        (action) =>
          db[action]('schema.enumName', ['one', 'two'], ['three', 'four']),
        () => expectSql(changeEnumTemplateSql(['three', 'four'])),
        () => expectSql(changeEnumTemplateSql(['one', 'two'])),
      );
    });
  });

  describe('renameEnumValues', () => {
    it('should use schema from the config', async () => {
      db.options.schema = 'schema';

      await makeTestUpAndDown('renameEnumValues')(
        (action) => db[action]('enum', { a: 'b', c: 'd' }),
        () =>
          expectSql([
            `ALTER TYPE "schema"."enum" RENAME VALUE "a" TO "b"`,
            `ALTER TYPE "schema"."enum" RENAME VALUE "c" TO "d"`,
          ]),
        () =>
          expectSql([
            `ALTER TYPE "schema"."enum" RENAME VALUE "b" TO "a"`,
            `ALTER TYPE "schema"."enum" RENAME VALUE "d" TO "c"`,
          ]),
      );

      db.options.schema = undefined;
    });

    it('should rename enum values', async () => {
      await makeTestUpAndDown('renameEnumValues')(
        (action) => db[action]('schema.enum', { a: 'b', c: 'd' }),
        () =>
          expectSql([
            `ALTER TYPE "schema"."enum" RENAME VALUE "a" TO "b"`,
            `ALTER TYPE "schema"."enum" RENAME VALUE "c" TO "d"`,
          ]),
        () =>
          expectSql([
            `ALTER TYPE "schema"."enum" RENAME VALUE "b" TO "a"`,
            `ALTER TYPE "schema"."enum" RENAME VALUE "d" TO "c"`,
          ]),
      );
    });
  });

  describe('createDomain and dropDomain', () => {
    const testUpAndDown = makeTestUpAndDown('createDomain', 'dropDomain');

    it('should use schema from the config', async () => {
      db.options.schema = 'schema';

      await testUpAndDown(
        (action) => db[action]('domain', (t) => t.integer()),
        () =>
          expectSql(`
            CREATE DOMAIN "schema"."domain" AS int4
            NOT NULL
          `),
        () =>
          expectSql(`
            DROP DOMAIN "schema"."domain"
          `),
      );

      db.options.schema = undefined;
    });

    it(`should create and drop domain`, async () => {
      await testUpAndDown(
        (action) =>
          db[action]('schema.domain', (t) =>
            t
              .integer()
              .collate('C')
              .default(sql`1 + ${2}`)
              .check(t.sql`VALUE = 10`)
              .check(t.sql`VALUE = 20`),
          ),
        () =>
          expectSql(`
            CREATE DOMAIN "schema"."domain" AS int4
            COLLATE "C"
            DEFAULT 1 + 2
            NOT NULL CHECK (VALUE = 10) CHECK (VALUE = 20)
          `),
        () =>
          expectSql(`
            DROP DOMAIN "schema"."domain"
          `),
      );
    });

    it(`should create and drop nullable domain`, async () => {
      await testUpAndDown(
        (action) => db[action]('schema.domain', (t) => t.integer().nullable()),
        () =>
          expectSql(`
            CREATE DOMAIN "schema"."domain" AS int4
          `),
        () =>
          expectSql(`
            DROP DOMAIN "schema"."domain"
          `),
      );
    });
  });

  describe('renameDomain', () => {
    const testRenameType = makeTestUpAndDown('renameDomain');

    it('should use schema from the config', async () => {
      db.options.schema = 'schema';

      await testRenameType(
        (action) => db[action]('from', 'to'),
        () =>
          expectSql(`
            ALTER DOMAIN "schema"."from" RENAME TO "to"
          `),
        () =>
          expectSql(`
            ALTER DOMAIN "schema"."to" RENAME TO "from"
          `),
      );

      db.options.schema = undefined;
    });

    it('should rename a domain', async () => {
      await testRenameType(
        (action) => db[action]('from', 'to'),
        () =>
          expectSql(`
            ALTER DOMAIN "from" RENAME TO "to"
          `),
        () =>
          expectSql(`
            ALTER DOMAIN "to" RENAME TO "from"
          `),
      );
    });

    it('should rename a domain and change schema', async () => {
      await testRenameType(
        (action) => db[action]('a.from', 'b.to'),
        () =>
          expectSql([
            `ALTER DOMAIN "a"."from" RENAME TO "to"`,
            `ALTER DOMAIN "a"."to" SET SCHEMA "b"`,
          ]),
        () =>
          expectSql([
            `ALTER DOMAIN "b"."to" RENAME TO "from"`,
            `ALTER DOMAIN "b"."from" SET SCHEMA "a"`,
          ]),
      );
    });

    it('should only change schema', async () => {
      await testRenameType(
        (action) => db[action]('a.t', 'b.t'),
        () =>
          expectSql(`
            ALTER DOMAIN "a"."t" SET SCHEMA "b"
          `),
        () =>
          expectSql(`
            ALTER DOMAIN "b"."t" SET SCHEMA "a"
          `),
      );
    });

    it('should set default schema when it is not set', async () => {
      await testRenameType(
        (action) => db[action]('a.from', 'to'),
        () =>
          expectSql([
            `ALTER DOMAIN "a"."from" RENAME TO "to"`,
            `ALTER DOMAIN "a"."to" SET SCHEMA "public"`,
          ]),
        () =>
          expectSql([
            `ALTER DOMAIN "to" RENAME TO "from"`,
            `ALTER DOMAIN "from" SET SCHEMA "a"`,
          ]),
      );
    });
  });

  describe('createCollation and dropCollation', () => {
    const testUpAndDown = makeTestUpAndDown('createCollation', 'dropCollation');

    it('should use schema from the config', async () => {
      db.options.schema = 'schema';

      await testUpAndDown(
        (action) =>
          db[action]('collation', {
            locale: 'en-u-kn-true',
          }),
        () =>
          expectSql(`
            CREATE COLLATION "schema"."collation" (
              locale = 'en-u-kn-true'
            )
          `),
        () =>
          expectSql(`
            DROP COLLATION "schema"."collation"
          `),
      );

      db.options.schema = undefined;
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
    beforeEach(jest.clearAllMocks);

    it('should use schema from the config', async () => {
      db.options.schema = 'schema';

      queryMock.mockResolvedValueOnce({ rowCount: 1 });
      await db.tableExists('table');
      expectSql(
        `SELECT 1 FROM "information_schema"."tables" WHERE "table_name" = $1 AND "table_schema" = $2`,
      );

      db.options.schema = undefined;
    });

    it('should support table with schema', async () => {
      queryMock.mockResolvedValueOnce({ rowCount: 1 });
      await db.tableExists('schema.table');
      expectSql(
        `SELECT 1 FROM "information_schema"."tables" WHERE "table_name" = $1 AND "table_schema" = $2`,
      );
    });

    it('should return boolean', async () => {
      queryMock.mockResolvedValueOnce({ rowCount: 1 });
      expect(await db.tableExists('table')).toBe(true);

      queryMock.mockResolvedValueOnce({ rowCount: 0 });
      expect(await db.tableExists('table')).toBe(false);
    });
  });

  describe('columnExists', () => {
    beforeEach(jest.clearAllMocks);

    it('should use schema from the config', async () => {
      db.options.schema = 'schema';

      queryMock.mockResolvedValueOnce({ rowCount: 1 });
      expect(await db.columnExists('table', 'colum')).toBe(true);
      expectSql(
        `SELECT 1 FROM "information_schema"."columns" WHERE "table_name" = $1 AND "column_name" = $2 AND "table_schema" = $3`,
      );

      db.options.schema = undefined;
    });

    it('should support table with schema', async () => {
      queryMock.mockResolvedValueOnce({ rowCount: 1 });
      expect(await db.columnExists('schema.table', 'colum')).toBe(true);
      expectSql(
        `SELECT 1 FROM "information_schema"."columns" WHERE "table_name" = $1 AND "column_name" = $2 AND "table_schema" = $3`,
      );
    });

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
