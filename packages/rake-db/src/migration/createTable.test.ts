import { expectSql, getDb, queryMock, resetDb, toLine } from '../test-utils';

const db = getDb();

(['createTable', 'dropTable'] as const).forEach((action) => {
  describe(action, () => {
    beforeEach(resetDb);

    it(`should ${action} with comment`, async () => {
      await db[action](
        'name',
        { comment: 'this is a table comment' },
        () => ({}),
      );

      if (action === 'createTable') {
        expectSql([
          `
            CREATE TABLE "name" (
            )
          `,
          `COMMENT ON TABLE "name" IS 'this is a table comment'`,
        ]);
      } else {
        expectSql(`
          DROP TABLE "name"
        `);
      }
    });

    it(`should ${action} and revert on rollback`, async () => {
      const fn = () => {
        return db[action]('table', { dropMode: 'CASCADE' }, (t) => ({
          id: t.serial().primaryKey(),
          nullable: t.text().nullable(),
          nonNullable: t.text(),
          withDefault: t.boolean().default(false),
          withDefaultRaw: t.date().default(t.raw(`now()`)),
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
          ...t.timestamps(),
        }));
      };

      const expectCreateTable = () => {
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
              "columnWithForeignKey" integer NOT NULL CONSTRAINT "fkeyConstraint" REFERENCES "table"("column") MATCH FULL ON DELETE CASCADE ON UPDATE CASCADE,
              "createdAt" timestamp NOT NULL DEFAULT now(),
              "updatedAt" timestamp NOT NULL DEFAULT now()
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
      };

      const expectDropTable = () => {
        expectSql(`
          DROP TABLE "table" CASCADE
        `);
      };

      await fn();
      (action === 'createTable' ? expectCreateTable : expectDropTable)();

      db.up = false;
      queryMock.mockClear();
      await fn();
      (action === 'createTable' ? expectDropTable : expectCreateTable)();
    });

    it('should support composite primary key', async () => {
      await db[action]('table', (t) => ({
        id: t.integer(),
        name: t.text(),
        active: t.boolean(),
        ...t.primaryKey(['id', 'name', 'active']),
      }));

      if (action === 'createTable') {
        expectSql(`
          CREATE TABLE "table" (
            "id" integer NOT NULL,
            "name" text NOT NULL,
            "active" boolean NOT NULL,
            PRIMARY KEY ("id", "name", "active")
          )
        `);
      } else {
        expectSql(`
          DROP TABLE "table"
        `);
      }
    });

    it('should support composite primary key with constraint name', async () => {
      await db[action]('table', (t) => ({
        id: t.integer(),
        name: t.text(),
        active: t.boolean(),
        ...t.primaryKey(['id', 'name', 'active'], { name: 'primaryKeyName' }),
      }));

      if (action === 'createTable') {
        expectSql(`
          CREATE TABLE "table" (
            "id" integer NOT NULL,
            "name" text NOT NULL,
            "active" boolean NOT NULL,
            CONSTRAINT "primaryKeyName" PRIMARY KEY ("id", "name", "active")
          )
        `);
      } else {
        expectSql(`
          DROP TABLE "table"
        `);
      }
    });

    it('should support composite index', async () => {
      await db[action]('table', (t) => ({
        id: t.integer(),
        name: t.text(),
        ...t.index(['id', { column: 'name', order: 'DESC' }], {
          name: 'compositeIndexOnTable',
        }),
      }));

      if (action === 'createTable') {
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
      } else {
        expectSql(`
          DROP TABLE "table"
        `);
      }
    });

    it('should support composite unique index', async () => {
      await db[action]('table', (t) => ({
        id: t.integer(),
        name: t.text(),
        ...t.unique(['id', { column: 'name', order: 'DESC' }], {
          name: 'compositeIndexOnTable',
        }),
      }));

      if (action === 'createTable') {
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
      } else {
        expectSql(`
          DROP TABLE "table"
        `);
      }
    });

    it('should support composite foreign key', async () => {
      await db[action]('table', (t) => ({
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

      if (action === 'createTable') {
        const expectedConstraint = toLine(`
          CONSTRAINT "constraintName"
            FOREIGN KEY ("id", "name")
            REFERENCES "otherTable"("foreignId", "foreignName")
            MATCH FULL
            ON DELETE CASCADE
            ON UPDATE CASCADE
        `);

        expectSql(`
          CREATE TABLE "table" (
            "id" integer NOT NULL,
            "name" text NOT NULL,
            ${expectedConstraint}
          )
        `);
      } else {
        expectSql(`
          DROP TABLE "table"
        `);
      }
    });
  });
});
