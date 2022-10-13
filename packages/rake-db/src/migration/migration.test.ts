import { Migration } from './migration';
import { MaybeArray, raw, toArray, TransactionAdapter } from 'pqb';

const db = new Migration({} as unknown as TransactionAdapter, true);
const queryMock = jest.fn();
db.query = queryMock;

const trim = (s: string) => {
  return s.trim().replace(/\n\s+/g, '\n');
};

const toLine = (s: string) => {
  return s.trim().replace(/\n\s*/g, ' ');
};

const expectSql = (sql: MaybeArray<string>) => {
  expect(
    queryMock.mock.calls.map((call) =>
      trim(
        typeof call[0] === 'string'
          ? call[0]
          : (call[0] as { text: string }).text,
      ),
    ),
  ).toEqual(toArray(sql).map(trim));
};

describe('migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryMock.mockResolvedValue(undefined);
    db.up = true;
  });

  describe('createTable', () => {
    it('should create table, drop table on rollback', async () => {
      const createTable = () => {
        return db.createTable('table', (t) => ({
          id: t.serial().primaryKey(),
          nullable: t.text().nullable(),
          nonNullable: t.text(),
          withDefault: t.boolean().default(false),
          withDefaultRaw: t.date().default(raw(`now()`)),
          withIndex: t.text().index({
            name: 'indexName',
            unique: true,
            using: 'gin',
            expression: 10,
            collate: 'utf-8',
            operator: 'operator',
            order: 'ASC',
            include: 'id',
            with: 'fillfactor = 70',
            tablespace: 'tablespace',
            where: 'column = 123',
          }),
          uniqueColumn: t.text().unique(),
          columnWithComment: t.text().comment('this is a column comment'),
          varcharWithLength: t.varchar(20),
          decimalWithPrecisionAndScale: t.decimal(10, 5),
          columnWithCompression: t.text().compression('compression'),
          columnWithCollate: t.text().collate('utf-8'),
          columnWithForeignKey: t.integer().foreignKey('table', 'column', {
            name: 'fkeyConstraint',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          }),
        }));
      };

      await createTable();

      expectSql([
        `
          CREATE TABLE "table" (
            "id" serial PRIMARY KEY,
            "nullable" text,
            "nonNullable" text NOT NULL,
            "withDefault" boolean NOT NULL DEFAULT false,
            "withDefaultRaw" date NOT NULL DEFAULT now(),
            "withIndex" text NOT NULL,
            "uniqueColumn" text NOT NULL,
            "columnWithComment" text NOT NULL,
            "varcharWithLength" varchar(20) NOT NULL,
            "decimalWithPrecisionAndScale" decimal(10, 5) NOT NULL,
            "columnWithCompression" text COMPRESSION compression NOT NULL,
            "columnWithCollate" text COLLATE 'utf-8' NOT NULL,
            "columnWithForeignKey" integer NOT NULL CONSTRAINT "fkeyConstraint" REFERENCES "table"("column") MATCH FULL ON DELETE CASCADE ON UPDATE CASCADE
          )
        `,
        toLine(`
          CREATE UNIQUE INDEX "indexName"
            ON "table"
            USING gin
            ("withIndex"(10) COLLATE 'utf-8' operator ASC)
            INCLUDE ("id")
            WITH (fillfactor = 70)
            TABLESPACE tablespace
            WHERE column = 123
        `),
        toLine(`
          CREATE UNIQUE INDEX "tableUniqueColumnIndex"
            ON "table"
            ("uniqueColumn")
        `),
        `COMMENT ON COLUMN "table"."columnWithComment" IS 'this is a column comment'`,
      ]);

      queryMock.mockClear();
      db.up = false;

      await createTable();

      expectSql(`
        DROP TABLE "table" CASCADE
      `);
    });

    it('should support composite primary key', async () => {
      await db.createTable('table', (t) => ({
        id: t.integer(),
        name: t.text(),
        active: t.boolean(),
        ...t.primaryKey('id', 'name', 'active'),
      }));

      expectSql(`
        CREATE TABLE "table" (
          "id" integer NOT NULL,
          "name" text NOT NULL,
          "active" boolean NOT NULL,
          PRIMARY KEY ("id", "name", "active")
        )
      `);
    });

    it('should support composite index', async () => {
      await db.createTable('table', (t) => ({
        id: t.integer(),
        name: t.text(),
        ...t.index(['id', { column: 'name', order: 'DESC' }], {
          name: 'compositeIndexOnTable',
        }),
      }));

      expectSql([
        `
          CREATE TABLE "table" (
            "id" integer NOT NULL,
            "name" text NOT NULL
          )
        `,
        `
          CREATE INDEX "compositeIndexOnTable" ON "table" ("id", "name" DESC)
        `,
      ]);
    });

    it('should support composite unique index', async () => {
      await db.createTable('table', (t) => ({
        id: t.integer(),
        name: t.text(),
        ...t.unique(['id', { column: 'name', order: 'DESC' }], {
          name: 'compositeIndexOnTable',
        }),
      }));

      expectSql([
        `
          CREATE TABLE "table" (
            "id" integer NOT NULL,
            "name" text NOT NULL
          )
        `,
        `
          CREATE UNIQUE INDEX "compositeIndexOnTable" ON "table" ("id", "name" DESC)
        `,
      ]);
    });

    it('should support composite foreign key', async () => {
      await db.createTable('table', (t) => ({
        id: t.integer(),
        name: t.text(),
        ...t.foreignKey(
          ['id', 'name'],
          'otherTable',
          ['foreignId', 'foreignName'],
          {
            name: 'constraintName',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
        ),
      }));

      const expectedConstraint = toLine(`
        CONSTRAINT "constraintName"
          FOREIGN KEY ("id", "name")
          REFERENCES "otherTable"("foreignId", "foreignName")
          MATCH FULL
          ON DELETE CASCADE
          ON UPDATE CASCADE
      `);

      expectSql([
        `
          CREATE TABLE "table" (
            "id" integer NOT NULL,
            "name" text NOT NULL,
            ${expectedConstraint}
          )
        `,
      ]);
    });

    it('should create table with comment', async () => {
      await db.createTable(
        'name',
        { comment: 'this is a table comment' },
        () => ({}),
      );

      expectSql([
        `
          CREATE TABLE "name" (
          )
        `,
        `COMMENT ON TABLE "name" IS 'this is a table comment'`,
      ]);
    });
  });
});
