import { expectSql, getDb, resetDb, toLine } from '../rake-db.test-utils';
import { Db } from 'pqb';
import { asMock } from 'test-utils';

const db = getDb();

const testUpAndDown = async (
  fn: (action: 'createTable' | 'dropTable') => Promise<unknown> | void,
  expectUp?: () => void,
  expectDown: () => void = () => expectSql(`DROP TABLE "table"`),
) => {
  resetDb(true);
  await fn('createTable');
  expectUp?.();

  resetDb(false);
  await fn('createTable');
  expectUp && expectDown();

  resetDb(true);
  await fn('dropTable');
  expectUp && expectDown();

  resetDb(false);
  await fn('dropTable');
  expectUp?.();
};

describe('create and drop table', () => {
  beforeEach(() => {
    db.options.snakeCase = false;
  });

  it('should push ast to migratedAsts', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('name', (t) => ({
          id: t.identity().primaryKey(),
        })),
      () => expect(db.migratedAsts.length).toBe(1),
      () => expect(db.migratedAsts.length).toBe(1),
    );
  });

  it('should handle table with schema', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('schema.name', (t) => ({ id: t.uuid().primaryKey() })),
      () =>
        expectSql(`
            CREATE TABLE "schema"."name" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid()
            )
          `),
      () =>
        expectSql(`
            DROP TABLE "schema"."name"
          `),
    );
  });

  it('should handle table with comment', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', { comment: 'this is a table comment' }, (t) => ({
          id: t.identity().primaryKey(),
        })),
      () =>
        expectSql([
          `
              CREATE TABLE "table" (
                "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
              )
            `,
          `COMMENT ON TABLE "table" IS 'this is a table comment'`,
        ]),
    );
  });

  it('should support drop table cascade', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', { dropMode: 'CASCADE' }, (t) => ({
          id: t.identity().primaryKey(),
        })),
      () =>
        expectSql(`
          CREATE TABLE "table" (
            "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
          )
        `),
      () =>
        expectSql(`
          DROP TABLE "table" CASCADE
        `),
    );
  });

  it('should return a table db interface', async () => {
    await testUpAndDown(async (action) => {
      const { table } = await db[action]('table', (t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }));

      expect(table).toBeInstanceOf(Db);
    });
  });

  describe('columns', () => {
    it('should handle table columns', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            nullable: t.text().nullable(),
            nonNullable: t.text(),
            citext: t.citext(),
            varcharWithLength: t.varchar(20),
            decimalWithPrecisionAndScale: t.decimal(10, 5),
            columnWithCompression: t.text().compression('compression'),
            columnWithCollate: t.text().collate('utf-8'),
          })),
        () => {
          expectSql(
            `
            CREATE TABLE "table" (
              "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              "nullable" text,
              "nonNullable" text NOT NULL,
              "citext" citext NOT NULL,
              "varcharWithLength" varchar(20) NOT NULL,
              "decimalWithPrecisionAndScale" decimal(10, 5) NOT NULL,
              "columnWithCompression" text COMPRESSION compression NOT NULL,
              "columnWithCollate" text COLLATE 'utf-8' NOT NULL
            )
          `,
          );
        },
        () => {
          expectSql(
            `
            DROP TABLE "table"
          `,
          );
        },
      );
    });

    it('should handle columns in snakeCase mode', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', { snakeCase: true }, (t) => ({
            id: t.identity().primaryKey(),
            columnName: t.text(),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              "column_name" text NOT NULL
            )
          `),
      );
    });
  });

  describe('identity', () => {
    it('should add identity column', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', { snakeCase: true }, (t) => ({
            id: t.identity().primaryKey(),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
            )
          `),
      );
    });

    it('should add small identity column', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', { snakeCase: true }, (t) => ({
            id: t.smallint().identity().primaryKey(),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" smallint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
            )
          `),
      );
    });

    it('should add always generated identity column', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', { snakeCase: true }, (t) => ({
            id: t.identity({ always: true }).primaryKey(),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY
            )
          `),
      );
    });

    it('should add identity column with sequence options', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', { snakeCase: true }, (t) => ({
            id: t
              .identity({
                incrementBy: 5,
                startWith: 10,
                min: 15,
                max: 20,
                cache: 3,
                cycle: true,
              })
              .primaryKey(),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" integer GENERATED BY DEFAULT AS IDENTITY (${toLine(`
                INCREMENT BY 5
                MINVALUE 15
                MAXVALUE 20
                START WITH 10
                CACHE 3
                CYCLE
              `)}) PRIMARY KEY
            )
          `),
      );
    });
  });

  it('should handle enum column', async () => {
    const enumRows = [['one'], ['two']];

    await testUpAndDown(
      (action) => {
        asMock(db.adapter.arrays).mockResolvedValueOnce({ rows: enumRows });

        return db[action]('table', (t) => ({
          id: t.identity().primaryKey(),
          enum: t.enum('mood'),
        }));
      },
      () => {
        expectSql([
          'SELECT unnest(enum_range(NULL::"mood"))::text',
          `
            CREATE TABLE "table" (
              "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              "enum" "mood" NOT NULL
            )
          `,
        ]);
      },
      () => {
        expectSql([
          'SELECT unnest(enum_range(NULL::"mood"))::text',
          `
            DROP TABLE "table"
          `,
        ]);
      },
    );
  });

  it('should handle columns with defaults', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', (t) => ({
          id: t.identity().primaryKey(),
          withDefault: t.boolean().default(false),
          withDefaultRaw: t.date().default(t.sql(`now()`)),
        })),
      () =>
        expectSql(
          `
            CREATE TABLE "table" (
              "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              "withDefault" boolean NOT NULL DEFAULT false,
              "withDefaultRaw" date NOT NULL DEFAULT now()
            )
          `,
        ),
    );
  });

  describe('indexes', () => {
    it('should handle indexes', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            withIndex: t.text().index({
              name: 'indexName',
              unique: true,
              nullsNotDistinct: true,
              using: 'gin',
              collate: 'utf-8',
              opclass: 'opclass',
              order: 'ASC',
              include: 'id',
              with: 'fillfactor = 70',
              tablespace: 'tablespace',
              where: 'column = 123',
            }),
            uniqueColumn: t.text().unique({ nullsNotDistinct: true }),
          })),
        () =>
          expectSql([
            `
              CREATE TABLE "table" (
                "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                "withIndex" text NOT NULL,
                "uniqueColumn" text NOT NULL
              )
            `,
            toLine(`
              CREATE UNIQUE INDEX "indexName"
                ON "table"
                USING gin
                ("withIndex" COLLATE 'utf-8' opclass ASC)
                INCLUDE ("id")
                NULLS NOT DISTINCT
                WITH (fillfactor = 70)
                TABLESPACE tablespace
                WHERE column = 123
            `),
            toLine(`
              CREATE UNIQUE INDEX "table_uniqueColumn_idx"
                ON "table" ("uniqueColumn") NULLS NOT DISTINCT
            `),
          ]),
      );
    });

    it('should handle indexes in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            withIndex: t.text().index(),
            uniqueColumn: t.text().unique(),
          })),
        () =>
          expectSql([
            `
              CREATE TABLE "table" (
                "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                "with_index" text NOT NULL,
                "unique_column" text NOT NULL
              )
            `,
            toLine(`
              CREATE INDEX "table_with_index_idx" ON "table" ("with_index")
            `),
            toLine(`
              CREATE UNIQUE INDEX "table_unique_column_idx" ON "table" ("unique_column")
            `),
          ]),
      );
    });
  });

  describe('timestamps', () => {
    it('should handle timestamps', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            ...t.timestamps(),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
              "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
            )
          `),
      );
    });

    it('should handle timestamps in snake case mode', async () => {
      await testUpAndDown(
        async (action) => {
          db.options.snakeCase = true;

          await db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            ...t.timestamps(),
          }));

          db.options.snakeCase = false;
        },
        () =>
          expectSql(`
          CREATE TABLE "table" (
            "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "created_at" timestamp with time zone NOT NULL DEFAULT now(),
            "updated_at" timestamp with time zone NOT NULL DEFAULT now()
          )
        `),
      );
    });

    it('should allow to override timestamp default with `nowSQL` option', async () => {
      await testUpAndDown(
        async (action) => {
          db.options.baseTable = {
            nowSQL: `now() AT TIME ZONE 'UTC'`,
          } as unknown as typeof db.options.baseTable;

          await db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            ...t.timestamps(),
          }));

          db.options.baseTable = undefined;
        },
        () =>
          expectSql(`
          CREATE TABLE "table" (
            "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "createdAt" timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
            "updatedAt" timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
          )
        `),
      );
    });
  });

  it('should handle column with explicit name', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', (t) => ({
          columnKey: t.name('its_a_columnName').identity().primaryKey(),
        })),
      () =>
        expectSql(`
          CREATE TABLE "table" (
            "its_a_columnName" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
          )
        `),
    );
  });

  describe('column comment', () => {
    it('should handle column comment', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey().comment('this is a column comment'),
          })),
        () =>
          expectSql([
            `
            CREATE TABLE "table" (
              "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
            )
          `,
            `COMMENT ON COLUMN "table"."id" IS 'this is a column comment'`,
          ]),
      );
    });

    it('should handle column comment in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            columnName: t
              .identity()
              .primaryKey()
              .comment('this is a column comment'),
          })),
        () =>
          expectSql([
            `
            CREATE TABLE "table" (
              "column_name" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
            )
          `,
            `COMMENT ON COLUMN "table"."column_name" IS 'this is a column comment'`,
          ]),
      );
    });
  });

  describe('composite primary key', () => {
    it('should support composite primary key defined on multiple columns', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.integer().primaryKey(),
            name: t.text().primaryKey(),
            active: t.boolean().primaryKey(),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" integer NOT NULL,
              "name" text NOT NULL,
              "active" boolean NOT NULL,
              PRIMARY KEY ("id", "name", "active")
            )
          `),
      );
    });

    it('should support composite primary key defined on table', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.integer(),
            name: t.text(),
            active: t.boolean(),
            ...t.primaryKey(['id', 'name', 'active']),
          })),
        () =>
          expectSql(`
          CREATE TABLE "table" (
            "id" integer NOT NULL,
            "name" text NOT NULL,
            "active" boolean NOT NULL,
            PRIMARY KEY ("id", "name", "active")
          )
        `),
      );
    });

    it('should support composite primary key with constraint name', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.integer(),
            name: t.text(),
            active: t.boolean(),
            ...t.primaryKey(['id', 'name', 'active'], {
              name: 'primaryKeyName',
            }),
          })),
        () =>
          expectSql(`
          CREATE TABLE "table" (
            "id" integer NOT NULL,
            "name" text NOT NULL,
            "active" boolean NOT NULL,
            CONSTRAINT "primaryKeyName" PRIMARY KEY ("id", "name", "active")
          )
        `),
      );
    });

    it('should support composite primary key defined on table and multiple columns', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.integer().primaryKey(),
            name: t.text().primaryKey(),
            active: t.boolean().primaryKey(),
            another: t.date(),
            one: t.decimal(),
            ...t.primaryKey(['another', 'one']),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" integer NOT NULL,
              "name" text NOT NULL,
              "active" boolean NOT NULL,
              "another" date NOT NULL,
              "one" decimal NOT NULL,
              PRIMARY KEY ("id", "name", "active", "another", "one")
            )
          `),
      );
    });

    it('should support composite primary key defined on multiple columns', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            idColumn: t.integer().primaryKey(),
            nameColumn: t.text().primaryKey(),
            activeColumn: t.boolean().primaryKey(),
            anotherColumn: t.date(),
            oneColumn: t.decimal(),
            ...t.primaryKey(['anotherColumn', 'oneColumn']),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id_column" integer NOT NULL,
              "name_column" text NOT NULL,
              "active_column" boolean NOT NULL,
              "another_column" date NOT NULL,
              "one_column" decimal NOT NULL,
              PRIMARY KEY ("id_column", "name_column", "active_column", "another_column", "one_column")
            )
          `),
      );
    });
  });

  describe('composite index', () => {
    it('should support composite index', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            name: t.text(),
            ...t.index(['id', { column: 'name', order: 'DESC' }], {
              name: 'compositeIndexOnTable',
              nullsNotDistinct: true,
            }),
          })),
        () =>
          expectSql([
            `
              CREATE TABLE "table" (
                "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                "name" text NOT NULL
              )
            `,
            `
              CREATE INDEX "compositeIndexOnTable" ON "table" ("id", "name" DESC) NULLS NOT DISTINCT
            `,
          ]),
      );
    });

    it('should support composite unique index', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            name: t.text(),
            ...t.unique(['id', { column: 'name', order: 'DESC' }], {
              name: 'compositeIndexOnTable',
              nullsNotDistinct: true,
            }),
          })),
        () =>
          expectSql([
            `
              CREATE TABLE "table" (
                "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                "name" text NOT NULL
              )
            `,
            `
              CREATE UNIQUE INDEX "compositeIndexOnTable" ON "table" ("id", "name" DESC) NULLS NOT DISTINCT
            `,
          ]),
      );
    });

    it('should support composite index and composite unique index in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            idColumn: t.identity().primaryKey(),
            nameColumn: t.text(),
            ...t.index(['idColumn', { column: 'nameColumn', order: 'DESC' }]),
            ...t.unique(['idColumn', { column: 'nameColumn', order: 'DESC' }]),
          })),
        () =>
          expectSql([
            `
              CREATE TABLE "table" (
                "id_column" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                "name_column" text NOT NULL
              )
            `,
            `
              CREATE INDEX "table_id_column_name_column_idx" ON "table" ("id_column", "name_column" DESC)
            `,
            `
              CREATE UNIQUE INDEX "table_id_column_name_column_idx" ON "table" ("id_column", "name_column" DESC)
            `,
          ]),
      );
    });
  });

  describe('foreign key', () => {
    it('should handle columns with foreign key', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            columnWithForeignKey: t.integer().foreignKey('table', 'column', {
              name: 'fkeyConstraint',
              match: 'FULL',
              onUpdate: 'CASCADE',
              onDelete: 'CASCADE',
            }),
          })),
        () =>
          expectSql(
            `
              CREATE TABLE "table" (
                "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                "columnWithForeignKey" integer NOT NULL CONSTRAINT "fkeyConstraint" REFERENCES "table"("column") MATCH FULL ON DELETE CASCADE ON UPDATE CASCADE
              )
            `,
          ),
      );
    });

    it('should handle column with foreign key in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            columnWithForeignKey: t
              .integer()
              .foreignKey('table', 'otherColumn'),
          })),
        () =>
          expectSql(`
              CREATE TABLE "table" (
                "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                "column_with_foreign_key" integer NOT NULL REFERENCES "table"("other_column")
              )
          `),
      );
    });

    it('should support composite foreign key', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
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
          })),
        () => {
          expectSql(`
            CREATE TABLE "table" (
              "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              "name" text NOT NULL,
              ${toLine(`
                CONSTRAINT "constraintName"
                  FOREIGN KEY ("id", "name")
                  REFERENCES "otherTable"("foreignId", "foreignName")
                  MATCH FULL
                  ON DELETE CASCADE
                  ON UPDATE CASCADE
              `)}
            )
          `);
        },
      );
    });

    it('should support composite foreign key in snakeCase mode', async () => {
      db.options.snakeCase = true;

      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            idColumn: t.identity().primaryKey(),
            nameColumn: t.text(),
            ...t.foreignKey(['idColumn', 'nameColumn'], 'otherTable', [
              'foreignId',
              'foreignName',
            ]),
          })),
        () => {
          expectSql(`
            CREATE TABLE "table" (
              "id_column" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              "name_column" text NOT NULL,
              ${toLine(`
                CONSTRAINT "table_id_column_name_column_fkey"
                  FOREIGN KEY ("id_column", "name_column")
                  REFERENCES "otherTable"("foreign_id", "foreign_name")
              `)}
            )
          `);
        },
      );
    });
  });

  describe('check', () => {
    it('should support database check on the column', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            columnWithCheck: t
              .text()
              .check(t.sql('length("columnWithCheck") > 10')),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              "columnWithCheck" text NOT NULL CHECK (length("columnWithCheck") > 10)
            )
          `),
      );
    });

    it('should support database check on the table', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            ...t.check(t.sql('sql')),
          })),
        () =>
          expectSql(`
            CREATE TABLE "table" (
              "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              CONSTRAINT "table_check" CHECK (sql)
            )
          `),
      );
    });
  });

  describe('constraint', () => {
    it('should support constraint', async () => {
      await testUpAndDown(
        (action) =>
          db[action]('table', (t) => ({
            id: t.identity().primaryKey(),
            ...t.constraint({
              name: 'constraintName',
              check: t.sql('sql'),
              references: [
                ['id'],
                'otherTable',
                ['otherId'],
                {
                  match: 'FULL',
                  onUpdate: 'CASCADE',
                  onDelete: 'CASCADE',
                },
              ],
            }),
          })),
        () =>
          expectSql(
            `
            CREATE TABLE "table" (
              "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
              CONSTRAINT "constraintName" ` +
              `FOREIGN KEY ("id") REFERENCES "otherTable"("otherId") MATCH FULL ON DELETE CASCADE ON UPDATE CASCADE ` +
              `CHECK (sql)
            )
          `,
          ),
      );
    });
  });

  it('should support column of custom type', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', (t) => ({
          id: t.identity().primaryKey(),
          column: t.type('customType'),
        })),
      () =>
        expectSql(`
          CREATE TABLE "table" (
            "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "column" "customType" NOT NULL
          )
        `),
    );
  });

  it('should support domain column', async () => {
    await testUpAndDown(
      (action) =>
        db[action]('table', (t) => ({
          id: t.identity().primaryKey(),
          domainColumn: t.domain('domainName'),
        })),
      () =>
        expectSql(`
          CREATE TABLE "table" (
            "id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "domainColumn" "domainName" NOT NULL
          )
        `),
    );
  });

  describe('noPrimaryKey', () => {
    const { warn } = console;
    afterAll(() => {
      db.options.noPrimaryKey = undefined;
      console.warn = warn;
    });

    it('should throw by default when no primary key', async () => {
      await testUpAndDown((action) =>
        expect(() => db[action]('table', () => ({}))).rejects.toThrow(
          'Table table has no primary key.\nYou can suppress this error by setting { noPrimaryKey: true } after a table name.',
        ),
      );
    });

    it('should throw when no primary key and noPrimaryKey is set to `error`', async () => {
      await testUpAndDown((action) => {
        db.options.noPrimaryKey = 'error';

        return expect(() => db[action]('table', () => ({}))).rejects.toThrow(
          'Table table has no primary key.\nYou can suppress this error by setting { noPrimaryKey: true } after a table name.',
        );
      });
    });

    it('should warn when no primary key and noPrimaryKey is set to `warning`', async () => {
      await testUpAndDown((action) => {
        console.warn = jest.fn();
        db.options.noPrimaryKey = 'warning';

        db[action]('table', () => ({}));

        expect(console.warn).toBeCalledWith(
          'Table table has no primary key.\nYou can suppress this error by setting { noPrimaryKey: true } after a table name.',
        );
      });
    });

    it('should not throw when no primary key and noPrimaryKey is set to `ignore`', async () => {
      await testUpAndDown((action) => {
        db.options.noPrimaryKey = 'ignore';

        expect(() => db[action]('table', () => ({}))).not.toThrow();
      });
    });

    it(`should not throw if option is set to \`true\` as a option`, async () => {
      await testUpAndDown((action) => {
        db.options.noPrimaryKey = 'error';

        expect(() =>
          db[action]('table', { noPrimaryKey: true }, () => ({})),
        ).not.toThrow();
      });
    });
  });
});
