import {
  asMock,
  expectSql,
  getDb,
  queryMock,
  resetDb,
  setDbDown,
  toLine,
} from '../test-utils';

const db = getDb();

describe('changeTable', () => {
  beforeEach(resetDb);

  it('should call appCodeUpdater', async () => {
    await db.changeTable('name', () => ({}));

    expect(db.migratedAsts.length).toBe(1);
  });

  it('should work for table with schema', async () => {
    const fn = () => {
      return db.changeTable('schema.table', (t) => ({
        column: t.add(t.text()),
      }));
    };

    await fn();
    expectSql(
      `ALTER TABLE "schema"."table"\nADD COLUMN "column" text NOT NULL`,
    );

    setDbDown();
    await fn();
    expectSql(`ALTER TABLE "schema"."table"\nDROP COLUMN "column"`);
  });

  it('should set comment', async () => {
    const fn = () => {
      return db.changeTable('table', { comment: 'comment' });
    };

    await fn();
    expectSql(`COMMENT ON TABLE "table" IS 'comment'`);

    setDbDown();
    await fn();
    expectSql(`COMMENT ON TABLE "table" IS NULL`);
  });

  it('should change comment', async () => {
    const fn = () => {
      return db.changeTable('table', { comment: ['old', 'new'] });
    };

    await fn();
    expectSql(`COMMENT ON TABLE "table" IS 'new'`);

    setDbDown();
    await fn();
    expectSql(`COMMENT ON TABLE "table" IS 'old'`);
  });

  (['add', 'drop'] as const).forEach((action) => {
    const testUpAndDown = async (
      fn: () => Promise<void>,
      expectUp: () => void,
      expectDown: () => void,
    ) => {
      await fn();
      (action === 'add' ? expectUp : expectDown)();

      db.up = false;
      db.migratedAsts.length = 0;
      queryMock.mockClear();
      await fn();
      (action === 'add' ? expectDown : expectUp)();
    };

    it(`should ${action} primary key column`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            id: t[action](t.serial().primaryKey()),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "id" serial PRIMARY KEY
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "id"
          `),
      );
    });

    it(`should ${action} column with custom name`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            columnKey: t.name('name')[action](t.text()),
          })),
        () =>
          expectSql(`
              ALTER TABLE "table"
                  ADD COLUMN "name" text NOT NULL
          `),
        () =>
          expectSql(`
              ALTER TABLE "table"
                  DROP COLUMN "name"
          `),
      );
    });

    it(`should ${action} column with custom name on column itself`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            columnKey: t[action](t.name('name').text()),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "name" text NOT NULL
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "name"
          `),
      );
    });

    it(`should ${action} column with drop cascade`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            dropCascade: t[action](t.text(), { dropMode: 'CASCADE' }),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "dropCascade" text NOT NULL
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "dropCascade" CASCADE
          `),
      );
    });

    it(`should ${action} nullable column`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            nullable: t[action](t.text().nullable()),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "nullable" text
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "nullable"
          `),
      );
    });

    it(`should ${action} non nullable column`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            nonNullable: t[action](t.text()),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "nonNullable" text NOT NULL
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "nonNullable"
          `),
      );
    });

    it(`should ${action} column with default`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            withDefault: t[action](t.boolean().default(false)),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "withDefault" boolean NOT NULL DEFAULT false
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "withDefault"
          `),
      );
    });

    it(`should ${action} column with raw default`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            withDefaultRaw: t[action](t.date().default(t.raw(`now()`))),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "withDefaultRaw" date NOT NULL DEFAULT now()
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "withDefaultRaw"
          `),
      );
    });

    it(`should ${action} varchar with length`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            varcharWithLength: t[action](t.varchar(20)),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "varcharWithLength" varchar(20) NOT NULL
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "varcharWithLength"
          `),
      );
    });

    it(`should ${action} decimal with precision and scale`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            decimalWithPrecisionAndScale: t[action](t.decimal(10, 5)),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "decimalWithPrecisionAndScale" decimal(10, 5) NOT NULL
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "decimalWithPrecisionAndScale"
          `),
      );
    });

    it(`should ${action} column with compression`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            columnWithCompression: t[action](
              t.text().compression('compression'),
            ),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "columnWithCompression" text COMPRESSION compression NOT NULL
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "columnWithCompression"
          `),
      );
    });

    it(`should ${action} column with collate`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            columnWithCollate: t[action](t.text().collate('utf-8')),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "columnWithCollate" text COLLATE 'utf-8' NOT NULL
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "columnWithCollate"
          `),
      );
    });

    it(`should ${action} column with foreign key`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            columnWithForeignKey: t[action](
              t.integer().foreignKey('table', 'column', {
                name: 'fkeyConstraint',
                match: 'FULL',
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
              }),
            ),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "columnWithForeignKey" integer NOT NULL CONSTRAINT "fkeyConstraint" REFERENCES "table"("column") MATCH FULL ON DELETE CASCADE ON UPDATE CASCADE
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "columnWithForeignKey"
          `),
      );
    });

    it(`should ${action} timestamps`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            ...t[action](t.timestamps()),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "createdAt" timestamp NOT NULL DEFAULT now(),
              ADD COLUMN "updatedAt" timestamp NOT NULL DEFAULT now()
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "createdAt",
              DROP COLUMN "updatedAt"
          `),
      );
    });

    it(`should ${action} snake case timestamps if config has snakeCase: true`, async () => {
      await testUpAndDown(
        async () => {
          db.options.snakeCase = true;

          await db.changeTable('table', (t) => ({
            ...t[action](t.timestamps()),
          }));

          db.options.snakeCase = false;
        },
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "created_at" timestamp NOT NULL DEFAULT now(),
              ADD COLUMN "updated_at" timestamp NOT NULL DEFAULT now()
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "created_at",
              DROP COLUMN "updated_at"
          `),
      );
    });

    it(`should ${action} index`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            withIndex: t[action](
              t.text().index({
                name: 'indexName',
                unique: true,
                using: 'gin',
                collate: 'utf-8',
                opclass: 'opclass',
                order: 'ASC',
                include: 'id',
                with: 'fillfactor = 70',
                tablespace: 'tablespace',
                where: 'column = 123',
              }),
            ),
          })),
        () =>
          expectSql([
            `ALTER TABLE "table"
              ADD COLUMN "withIndex" text NOT NULL`,
            toLine(`
              CREATE UNIQUE INDEX "indexName"
                ON "table"
                USING gin ("withIndex" COLLATE 'utf-8' opclass ASC)
                INCLUDE ("id")
                WITH (fillfactor = 70)
                TABLESPACE tablespace
                WHERE column = 123
            `),
          ]),
        () =>
          expectSql([
            `ALTER TABLE "table"
              DROP COLUMN "withIndex"`,
            toLine(`DROP INDEX "indexName"`),
          ]),
      );
    });

    it(`should ${action} unique index`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            uniqueColumn: t[action](t.text().unique({ dropMode: 'CASCADE' })),
          })),
        () =>
          expectSql([
            `ALTER TABLE "table"
              ADD COLUMN "uniqueColumn" text NOT NULL`,
            toLine(`
            CREATE UNIQUE INDEX "table_uniqueColumn_idx"
              ON "table"
              ("uniqueColumn")
          `),
          ]),
        () =>
          expectSql([
            `ALTER TABLE "table"
              DROP COLUMN "uniqueColumn"`,
            toLine(`DROP INDEX "table_uniqueColumn_idx" CASCADE`),
          ]),
      );
    });

    it(`should ${action} column comment`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            columnWithComment: t[action](
              t.text().comment('this is a column comment'),
            ),
          })),
        () =>
          expectSql([
            `ALTER TABLE "table"
            ADD COLUMN "columnWithComment" text NOT NULL`,
            `COMMENT ON COLUMN "table"."columnWithComment" IS 'this is a column comment'`,
          ]),
        () =>
          expectSql(
            `ALTER TABLE "table"
            DROP COLUMN "columnWithComment"`,
          ),
      );
    });

    it(`should ${action} enum`, async () => {
      asMock(queryMock).mockResolvedValue({ rows: [['one'], ['two']] });

      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            enum: t[action](t.enum('mood')),
          })),
        () => {
          expectSql([
            'SELECT unnest(enum_range(NULL::"mood"))::text',
            `
            ALTER TABLE "table"
              ADD COLUMN "enum" "mood" NOT NULL
          `,
          ]);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [ast1] = db.migratedAsts as any[];
          expect(ast1.shape.enum.item.options).toEqual(['one', 'two']);
        },
        () => {
          expectSql([
            'SELECT unnest(enum_range(NULL::"mood"))::text',
            `
            ALTER TABLE "table"
              DROP COLUMN "enum"
          `,
          ]);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const [ast2] = db.migratedAsts as any[];
          expect(ast2.shape.enum.item.options).toEqual(['one', 'two']);
        },
      );
    });

    it(`should ${action} column with check`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            column: t[action](t.text().check(t.raw(`length(column) > 10`))),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "column" text NOT NULL CHECK (length(column) > 10)
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "column"
          `),
      );
    });

    it(`should ${action} column check`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            column: t[action](t.check(t.raw(`length(column) > 10`))),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD CONSTRAINT "table_column_check"
              CHECK (length(column) > 10)
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP CONSTRAINT "table_column_check"
          `),
      );
    });

    it(`should ${action} domain column`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            column: t[action](t.domain('domainName')),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
              ADD COLUMN "column" "domainName" NOT NULL
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
              DROP COLUMN "column"
          `),
      );
    });

    it(`should ${action} columns with a primary key`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            id: t[action](t.integer().primaryKey()),
            text: t[action](t.text().primaryKey()),
            active: t[action](t.boolean().primaryKey()),
          })),
        () =>
          expectSql(`
            ALTER TABLE "table"
            ADD COLUMN "id" integer NOT NULL,
            ADD COLUMN "text" text NOT NULL,
            ADD COLUMN "active" boolean NOT NULL,
            ADD PRIMARY KEY ("id", "text", "active")
          `),
        () =>
          expectSql(`
            ALTER TABLE "table"
            DROP CONSTRAINT "table_pkey",
            DROP COLUMN "id",
            DROP COLUMN "text",
            DROP COLUMN "active"
          `),
      );
    });

    it(`should ${action} composite primary key`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            ...t[action](t.primaryKey(['id', 'name'])),
          })),
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

    it(`should ${action} composite primary key with constraint name`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            ...t[action](
              t.primaryKey(['id', 'name'], { name: 'primaryKeyName' }),
            ),
          })),
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

    it(`should ${action} composite index`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            ...t[action](
              t.index(['id', { column: 'name', order: 'DESC' }], {
                name: 'compositeIndexOnTable',
                dropMode: 'CASCADE',
              }),
            ),
          })),
        () =>
          expectSql(`
            CREATE INDEX "compositeIndexOnTable" ON "table" ("id", "name" DESC)
          `),
        () =>
          expectSql(`
            DROP INDEX "compositeIndexOnTable" CASCADE
          `),
      );
    });

    it(`should ${action} composite unique index`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            ...t[action](
              t.unique(['id', { column: 'name', order: 'DESC' }], {
                name: 'compositeIndexOnTable',
                dropMode: 'CASCADE',
              }),
            ),
          })),
        () =>
          expectSql(`
            CREATE UNIQUE INDEX "compositeIndexOnTable" ON "table" ("id", "name" DESC)
          `),
        () =>
          expectSql(`
            DROP INDEX "compositeIndexOnTable" CASCADE
          `),
      );
    });

    it(`should ${action} composite foreign key`, async () => {
      await testUpAndDown(
        () =>
          db.changeTable('table', (t) => ({
            ...t[action](
              t.foreignKey(
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
            ),
          })),
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
  });

  const testUpAndDown = async (
    fn: () => Promise<void>,
    expectUp: () => void,
    expectDown: () => void,
  ) => {
    await fn();
    expectUp();

    db.up = false;
    db.migratedAsts.length = 0;
    queryMock.mockClear();
    await fn();
    expectDown();
  };

  it('should change column type', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeType: t.change(t.integer(), t.text()),
          changeDomainType: t.change(t.domain('one'), t.domain('two')),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "changeType" TYPE text,
            ALTER COLUMN "changeDomainType" TYPE "two"
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "changeType" TYPE integer,
            ALTER COLUMN "changeDomainType" TYPE "one"
        `),
    );
  });

  it('should change column type with custom name', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeType: t.name('name').change(t.integer(), t.text()),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "name" TYPE text
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "name" TYPE integer
        `),
    );
  });

  it('should change enum column', async () => {
    const enumOne = ['one', 'two'];
    const enumTwo = ['three', 'four'];

    asMock(queryMock).mockResolvedValueOnce({
      rows: enumOne.map((value) => [value]),
    });
    asMock(queryMock).mockResolvedValueOnce({
      rows: enumTwo.map((value) => [value]),
    });

    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeEnum: t.change(t.enum('one'), t.enum('two')),
        })),
      () => {
        expectSql([
          'SELECT unnest(enum_range(NULL::"one"))::text',
          'SELECT unnest(enum_range(NULL::"two"))::text',
          `
            ALTER TABLE "table"
              ALTER COLUMN "changeEnum" TYPE "two"
          `,
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [ast] = db.migratedAsts as any[];
        expect(ast.shape.changeEnum.from.column.options).toEqual(enumOne);
        expect(ast.shape.changeEnum.to.column.options).toEqual(enumTwo);

        asMock(queryMock).mockResolvedValueOnce({
          rows: enumTwo.map((value) => [value]),
        });
        asMock(queryMock).mockResolvedValueOnce({
          rows: enumOne.map((value) => [value]),
        });
      },
      () => {
        expectSql([
          'SELECT unnest(enum_range(NULL::"two"))::text',
          'SELECT unnest(enum_range(NULL::"one"))::text',
          `
            ALTER TABLE "table"
              ALTER COLUMN "changeEnum" TYPE "one"
          `,
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [ast] = db.migratedAsts as any[];
        expect(ast.shape.changeEnum.from.column.options).toEqual(enumTwo);
        expect(ast.shape.changeEnum.to.column.options).toEqual(enumOne);
      },
    );
  });

  it('should change column check', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          column: t.change(
            t.check(t.raw('length(column) < 20')),
            t.check(t.raw('length(column) > 10')),
          ),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            DROP CONSTRAINT "table_column_check",
            ADD CONSTRAINT "table_column_check"
            CHECK (length(column) > 10)
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            DROP CONSTRAINT "table_column_check",
            ADD CONSTRAINT "table_column_check"
            CHECK (length(column) < 20)
        `),
    );
  });

  it('should change column type using', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeTypeUsing: t.change(t.integer(), t.text(), {
            usingUp: t.raw('b::text'),
            usingDown: t.raw('b::int'),
          }),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "changeTypeUsing" TYPE text USING b::text
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "changeTypeUsing" TYPE integer USING b::int
        `),
    );
  });

  it('should change column collate', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeCollate: t.change(
            t.text().collate('de_DE'),
            t.text().collate('fr_FR'),
          ),
        })),
      () =>
        expectSql(`
            ALTER TABLE "table"
              ALTER COLUMN "changeCollate" TYPE text COLLATE 'fr_FR'
        `),
      () =>
        expectSql(`
            ALTER TABLE "table"
              ALTER COLUMN "changeCollate" TYPE text COLLATE 'de_DE'
        `),
    );
  });

  it('should change column default', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeDefault: t.change(t.default('from'), t.default(t.raw("'to'"))),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "changeDefault" SET DEFAULT 'to'
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "changeDefault" SET DEFAULT 'from'
        `),
    );
  });

  it('should change column default with custom name', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeDefault: t
            .name('name')
            .change(t.default('from'), t.default(t.raw("'to'"))),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "name" SET DEFAULT 'to'
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "name" SET DEFAULT 'from'
        `),
    );
  });

  it('should change column null', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeNull: t.change(t.nonNullable(), t.nullable()),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "changeNull" DROP NOT NULL
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "changeNull" SET NOT NULL
        `),
    );
  });

  it('should change column null with custom column name', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeNull: t.name('name').change(t.nonNullable(), t.nullable()),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "name" DROP NOT NULL
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "name" SET NOT NULL
        `),
    );
  });

  it('should change column comment', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeComment: t.change(
            t.comment('comment 1'),
            t.comment('comment 2'),
          ),
        })),
      () =>
        expectSql(`
          COMMENT ON COLUMN "table"."changeComment" IS 'comment 2'
        `),
      () =>
        expectSql(`
          COMMENT ON COLUMN "table"."changeComment" IS 'comment 1'
        `),
    );
  });

  it('should change column compression', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeCompression: t.change(t.text(), t.text().compression('value')),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "changeCompression" SET COMPRESSION value
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "changeCompression" SET COMPRESSION DEFAULT
        `),
    );
  });

  it('should change column compression with custom name', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeCompression: t
            .name('name')
            .change(t.text(), t.text().compression('value')),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "name" SET COMPRESSION value
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ALTER COLUMN "name" SET COMPRESSION DEFAULT
        `),
    );
  });

  it('should add composite primary key via change', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          id: t.change(t.integer(), t.integer().primaryKey()),
          text: t.change(t.integer(), t.integer().primaryKey()),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
          ADD PRIMARY KEY ("id", "text")
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
          DROP CONSTRAINT "table_pkey"
        `),
    );
  });

  it('should drop composite primary key via change', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          id: t.change(t.integer().primaryKey(), t.integer()),
          text: t.change(t.integer().primaryKey(), t.integer()),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
          DROP CONSTRAINT "table_pkey"
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
          ADD PRIMARY KEY ("id", "text")
        `),
    );
  });

  it('should change composite primary key', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          id: t.change(t.integer().primaryKey(), t.integer()),
          text: t.change(t.integer().primaryKey(), t.integer().primaryKey()),
          active: t.change(t.integer(), t.integer().primaryKey()),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
          DROP CONSTRAINT "table_pkey",
          ADD PRIMARY KEY ("text", "active")
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
          DROP CONSTRAINT "table_pkey",
          ADD PRIMARY KEY ("id", "text")
        `),
    );
  });

  it('should add foreign key', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          addFkey: t.change(
            t.integer(),
            t.integer().foreignKey('otherTable', 'foreignId'),
          ),
          addFkeyWithOptions: t.change(
            t.integer(),
            t.integer().foreignKey('otherTable', 'foreignId', {
              name: 'foreignKeyName',
              match: 'FULL',
              onUpdate: 'SET NULL',
              onDelete: 'CASCADE',
            }),
          ),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ADD CONSTRAINT "table_addFkey_fkey" FOREIGN KEY ("addFkey") REFERENCES "otherTable"("foreignId"),
            ADD CONSTRAINT "foreignKeyName" FOREIGN KEY ("addFkeyWithOptions") REFERENCES "otherTable"("foreignId") MATCH FULL ON DELETE CASCADE ON UPDATE SET NULL
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            DROP CONSTRAINT "table_addFkey_fkey",
            DROP CONSTRAINT "foreignKeyName"
        `),
    );
  });

  it('should remove foreign key', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          removeFkey: t.change(
            t.integer().foreignKey('otherTable', 'foreignId'),
            t.integer(),
          ),
          removeFkeyWithOptions: t.change(
            t.integer().foreignKey('otherTable', 'foreignId', {
              name: 'foreignKeyName',
              match: 'FULL',
              onUpdate: 'SET NULL',
              onDelete: 'CASCADE',
            }),
            t.integer(),
          ),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            DROP CONSTRAINT "table_removeFkey_fkey",
            DROP CONSTRAINT "foreignKeyName"
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            ADD CONSTRAINT "table_removeFkey_fkey" FOREIGN KEY ("removeFkey") REFERENCES "otherTable"("foreignId"),
            ADD CONSTRAINT "foreignKeyName" FOREIGN KEY ("removeFkeyWithOptions") REFERENCES "otherTable"("foreignId") MATCH FULL ON DELETE CASCADE ON UPDATE SET NULL
        `),
    );
  });

  it('should change foreign key', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeForeignKey: t.change(
            t.integer().foreignKey('a', 'aId', {
              name: 'fromFkeyName',
              match: 'PARTIAL',
              onUpdate: 'RESTRICT',
              onDelete: 'SET DEFAULT',
            }),
            t.integer().foreignKey('b', 'bId', {
              name: 'toFkeyName',
              match: 'FULL',
              onUpdate: 'NO ACTION',
              onDelete: 'CASCADE',
            }),
          ),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
            DROP CONSTRAINT "fromFkeyName",
            ADD CONSTRAINT "toFkeyName" FOREIGN KEY ("changeForeignKey") REFERENCES "b"("bId") MATCH FULL ON DELETE CASCADE ON UPDATE NO ACTION
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
            DROP CONSTRAINT "toFkeyName",
            ADD CONSTRAINT "fromFkeyName" FOREIGN KEY ("changeForeignKey") REFERENCES "a"("aId") MATCH PARTIAL ON DELETE SET DEFAULT ON UPDATE RESTRICT
        `),
    );
  });

  it('should add index', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          addIndex: t.change(t.integer(), t.integer().index()),
          addIndexWithOptions: t.change(
            t.integer(),
            t.integer().index({
              collate: 'collate',
              opclass: 'opclass',
              order: 'order',
              unique: true,
              using: 'using',
              include: ['a', 'b'],
              with: 'with',
              tablespace: 'tablespace',
              where: 'where',
              dropMode: 'CASCADE',
            }),
          ),
        })),
      () =>
        expectSql([
          `CREATE INDEX "table_addIndex_idx" ON "table" ("addIndex")`,
          `CREATE UNIQUE INDEX "table_addIndexWithOptions_idx" ON "table" USING using ("addIndexWithOptions" COLLATE 'collate' opclass order) INCLUDE ("a", "b") WITH (with) TABLESPACE tablespace WHERE where`,
        ]),
      () =>
        expectSql([
          `DROP INDEX "table_addIndex_idx"`,
          `DROP INDEX "table_addIndexWithOptions_idx" CASCADE`,
        ]),
    );
  });

  it('should remove index', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          removeIndex: t.change(t.integer().index(), t.integer()),
          removeIndexWithOptions: t.change(
            t.integer().index({
              collate: 'collate',
              opclass: 'opclass',
              order: 'order',
              unique: true,
              using: 'using',
              include: ['a', 'b'],
              with: 'with',
              tablespace: 'tablespace',
              where: 'where',
              dropMode: 'CASCADE',
            }),
            t.integer(),
          ),
        })),
      () =>
        expectSql([
          `DROP INDEX "table_removeIndex_idx"`,
          `DROP INDEX "table_removeIndexWithOptions_idx" CASCADE`,
        ]),
      () =>
        expectSql([
          `CREATE INDEX "table_removeIndex_idx" ON "table" ("removeIndex")`,
          `CREATE UNIQUE INDEX "table_removeIndexWithOptions_idx" ON "table" USING using ("removeIndexWithOptions" COLLATE 'collate' opclass order) INCLUDE ("a", "b") WITH (with) TABLESPACE tablespace WHERE where`,
        ]),
    );
  });

  it('should change index', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          changeIndex: t.change(
            t.integer().index({
              name: 'from',
              collate: 'from',
              opclass: 'from',
              order: 'from',
              unique: false,
              using: 'from',
              include: ['a', 'b'],
              with: 'from',
              tablespace: 'from',
              where: 'from',
              dropMode: 'CASCADE',
            }),
            t.integer().index({
              name: 'to',
              collate: 'to',
              opclass: 'to',
              order: 'to',
              unique: true,
              using: 'to',
              include: ['c', 'd'],
              with: 'to',
              tablespace: 'to',
              where: 'to',
              dropMode: 'RESTRICT',
            }),
          ),
        })),
      () =>
        expectSql([
          `DROP INDEX "from" CASCADE`,
          `CREATE UNIQUE INDEX "to" ON "table" USING to ("changeIndex" COLLATE 'to' to to) INCLUDE ("c", "d") WITH (to) TABLESPACE to WHERE to`,
        ]),
      () =>
        expectSql([
          `DROP INDEX "to" RESTRICT`,
          `CREATE INDEX "from" ON "table" USING from ("changeIndex" COLLATE 'from' from from) INCLUDE ("a", "b") WITH (from) TABLESPACE from WHERE from`,
        ]),
    );
  });

  it('should rename a column', async () => {
    await testUpAndDown(
      () =>
        db.changeTable('table', (t) => ({
          a: t.rename('b'),
        })),
      () =>
        expectSql(`
          ALTER TABLE "table"
          RENAME COLUMN "a" TO "b"
        `),
      () =>
        expectSql(`
          ALTER TABLE "table"
          RENAME COLUMN "b" TO "a"
        `),
    );
  });
});
