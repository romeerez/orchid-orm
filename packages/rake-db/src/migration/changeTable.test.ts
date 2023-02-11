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

    expect(db.options.appCodeUpdater).toHaveBeenCalled();
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
    it(`should ${action} columns ${
      action === 'add' ? 'to' : 'from'
    } table`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          id: t[action](t.serial().primaryKey()),
          dropCascade: t[action](t.text(), { dropMode: 'CASCADE' }),
          nullable: t[action](t.text().nullable()),
          nonNullable: t[action](t.text()),
          withDefault: t[action](t.boolean().default(false)),
          withDefaultRaw: t[action](t.date().default(t.raw(`now()`))),
          varcharWithLength: t[action](t.varchar(20)),
          decimalWithPrecisionAndScale: t[action](t.decimal(10, 5)),
          columnWithCompression: t[action](t.text().compression('compression')),
          columnWithCollate: t[action](t.text().collate('utf-8')),
          columnWithForeignKey: t[action](
            t.integer().foreignKey('table', 'column', {
              name: 'fkeyConstraint',
              match: 'FULL',
              onUpdate: 'CASCADE',
              onDelete: 'CASCADE',
            }),
          ),
          ...t[action](t.timestamps()),
        }));
      };

      const expectAddColumns = () => {
        expectSql([
          `
            ALTER TABLE "table"
              ADD COLUMN "id" serial PRIMARY KEY,
              ADD COLUMN "dropCascade" text NOT NULL,
              ADD COLUMN "nullable" text,
              ADD COLUMN "nonNullable" text NOT NULL,
              ADD COLUMN "withDefault" boolean NOT NULL DEFAULT false,
              ADD COLUMN "withDefaultRaw" date NOT NULL DEFAULT now(),
              ADD COLUMN "varcharWithLength" varchar(20) NOT NULL,
              ADD COLUMN "decimalWithPrecisionAndScale" decimal(10, 5) NOT NULL,
              ADD COLUMN "columnWithCompression" text COMPRESSION compression NOT NULL,
              ADD COLUMN "columnWithCollate" text COLLATE 'utf-8' NOT NULL,
              ADD COLUMN "columnWithForeignKey" integer NOT NULL CONSTRAINT "fkeyConstraint" REFERENCES "table"("column") MATCH FULL ON DELETE CASCADE ON UPDATE CASCADE,
              ADD COLUMN "createdAt" timestamp NOT NULL DEFAULT now(),
              ADD COLUMN "updatedAt" timestamp NOT NULL DEFAULT now()
          `,
        ]);
      };

      const expectRemoveColumns = () => {
        expectSql([
          `
            ALTER TABLE "table"
              DROP COLUMN "id",
              DROP COLUMN "dropCascade" CASCADE,
              DROP COLUMN "nullable",
              DROP COLUMN "nonNullable",
              DROP COLUMN "withDefault",
              DROP COLUMN "withDefaultRaw",
              DROP COLUMN "varcharWithLength",
              DROP COLUMN "decimalWithPrecisionAndScale",
              DROP COLUMN "columnWithCompression",
              DROP COLUMN "columnWithCollate",
              DROP COLUMN "columnWithForeignKey",
              DROP COLUMN "createdAt",
              DROP COLUMN "updatedAt"
          `,
        ]);
      };

      asMock(queryMock).mockResolvedValue({ rows: [['one'], ['two']] });

      await fn();
      (action === 'add' ? expectAddColumns : expectRemoveColumns)();

      queryMock.mockClear();
      db.up = false;

      await fn();

      (action === 'add' ? expectRemoveColumns : expectAddColumns)();
    });

    it(`should ${action} index`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
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
        }));
      };

      const expectAdd = () => {
        expectSql([
          `ALTER TABLE "table"
              ADD COLUMN "withIndex" text NOT NULL`,
          toLine(`
              CREATE UNIQUE INDEX "indexName"
                  ON "table"
                      USING gin
                      ("withIndex" COLLATE 'utf-8' opclass ASC)
                  INCLUDE ("id")
                  WITH (fillfactor = 70)
                  TABLESPACE tablespace
                  WHERE column = 123
          `),
        ]);
      };

      const expectRemove = () => {
        expectSql([
          `ALTER TABLE "table"
              DROP COLUMN "withIndex"`,
          toLine(`DROP INDEX "indexName"`),
        ]);
      };

      asMock(queryMock).mockResolvedValue({ rows: [['one'], ['two']] });

      await fn();
      (action === 'add' ? expectAdd : expectRemove)();

      queryMock.mockClear();
      db.up = false;

      await fn();

      (action === 'add' ? expectRemove : expectAdd)();
    });

    it(`should ${action} unique index`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          uniqueColumn: t[action](t.text().unique({ dropMode: 'CASCADE' })),
        }));
      };

      const expectAdd = () => {
        expectSql([
          `ALTER TABLE "table"
              ADD COLUMN "uniqueColumn" text NOT NULL`,
          toLine(`
            CREATE UNIQUE INDEX "table_uniqueColumn_idx"
              ON "table"
              ("uniqueColumn")
          `),
        ]);
      };

      const expectRemove = () => {
        expectSql([
          `ALTER TABLE "table"
              DROP COLUMN "uniqueColumn"`,
          toLine(`DROP INDEX "table_uniqueColumn_idx" CASCADE`),
        ]);
      };

      asMock(queryMock).mockResolvedValue({ rows: [['one'], ['two']] });

      await fn();
      (action === 'add' ? expectAdd : expectRemove)();

      queryMock.mockClear();
      db.up = false;

      await fn();

      (action === 'add' ? expectRemove : expectAdd)();
    });

    it(`should ${action} column comment`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          columnWithComment: t[action](
            t.text().comment('this is a column comment'),
          ),
        }));
      };

      const expectAdd = () => {
        expectSql([
          `ALTER TABLE "table"
            ADD COLUMN "columnWithComment" text NOT NULL`,
          `COMMENT ON COLUMN "table"."columnWithComment" IS 'this is a column comment'`,
        ]);
      };

      const expectRemove = () => {
        expectSql(
          `ALTER TABLE "table"
            DROP COLUMN "columnWithComment"`,
        );
      };

      asMock(queryMock).mockResolvedValue({ rows: [['one'], ['two']] });

      await fn();
      (action === 'add' ? expectAdd : expectRemove)();

      queryMock.mockClear();
      db.up = false;

      await fn();

      (action === 'add' ? expectRemove : expectAdd)();
    });

    it(`should ${action} enum`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          enum: t[action](t.enum('mood')),
        }));
      };

      const expectAdd = () => {
        expectSql([
          'SELECT unnest(enum_range(NULL::"mood"))::text',
          `
            ALTER TABLE "table"
              ADD COLUMN "enum" "mood" NOT NULL
          `,
        ]);
      };

      const expectRemove = () => {
        expectSql([
          'SELECT unnest(enum_range(NULL::"mood"))::text',
          `
            ALTER TABLE "table"
              DROP COLUMN "enum"
          `,
        ]);
      };

      asMock(queryMock).mockResolvedValue({ rows: [['one'], ['two']] });

      await fn();

      (action === 'add' ? expectAdd : expectRemove)();

      const [{ ast: ast1 }] = asMock(db.options.appCodeUpdater).mock.calls[0];
      expect(ast1.shape.enum.item.options).toEqual(['one', 'two']);

      queryMock.mockClear();
      asMock(db.options.appCodeUpdater).mockClear();
      db.up = false;

      await fn();

      (action === 'add' ? expectRemove : expectAdd)();

      const [{ ast: ast2 }] = asMock(db.options.appCodeUpdater).mock.calls[0];
      expect(ast2.shape.enum.item.options).toEqual(['one', 'two']);
    });

    it(`should ${action} columns with a primary key`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          id: t[action](t.integer().primaryKey()),
          text: t[action](t.text().primaryKey()),
          active: t[action](t.boolean().primaryKey()),
        }));
      };

      const expectAddColumns = () => {
        expectSql([
          `
            ALTER TABLE "table"
            ADD COLUMN "id" integer NOT NULL,
            ADD COLUMN "text" text NOT NULL,
            ADD COLUMN "active" boolean NOT NULL,
            ADD PRIMARY KEY ("id", "text", "active")
          `,
        ]);
      };

      const expectRemoveColumns = () => {
        expectSql(`
          ALTER TABLE "table"
          DROP CONSTRAINT "table_pkey",
          DROP COLUMN "id",
          DROP COLUMN "text",
          DROP COLUMN "active"
        `);
      };

      await fn();
      (action === 'add' ? expectAddColumns : expectRemoveColumns)();

      queryMock.mockClear();
      db.up = false;
      await fn();
      (action === 'add' ? expectRemoveColumns : expectAddColumns)();
    });

    it(`should ${action} composite primary key`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          ...t[action](t.primaryKey(['id', 'name'])),
        }));
      };

      const expectAddPrimaryKey = () => {
        expectSql(`
          ALTER TABLE "table"
          ADD PRIMARY KEY ("id", "name")
      `);
      };

      const expectDropPrimaryKey = () => {
        expectSql(`
          ALTER TABLE "table"
          DROP CONSTRAINT "table_pkey"
      `);
      };

      await fn();
      (action === 'add' ? expectAddPrimaryKey : expectDropPrimaryKey)();

      db.up = false;
      queryMock.mockClear();
      await fn();
      (action === 'add' ? expectDropPrimaryKey : expectAddPrimaryKey)();
    });

    it(`should ${action} composite primary key with constraint name`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          ...t[action](
            t.primaryKey(['id', 'name'], { name: 'primaryKeyName' }),
          ),
        }));
      };

      const expectAddPrimaryKey = () => {
        expectSql(`
          ALTER TABLE "table"
          ADD CONSTRAINT "primaryKeyName" PRIMARY KEY ("id", "name")
      `);
      };

      const expectDropPrimaryKey = () => {
        expectSql(`
          ALTER TABLE "table"
          DROP CONSTRAINT "primaryKeyName"
      `);
      };

      await fn();
      (action === 'add' ? expectAddPrimaryKey : expectDropPrimaryKey)();

      db.up = false;
      queryMock.mockClear();
      await fn();
      (action === 'add' ? expectDropPrimaryKey : expectAddPrimaryKey)();
    });

    it(`should ${action} composite index`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          ...t[action](
            t.index(['id', { column: 'name', order: 'DESC' }], {
              name: 'compositeIndexOnTable',
              dropMode: 'CASCADE',
            }),
          ),
        }));
      };

      const expectCreateIndex = () => {
        expectSql(`
          CREATE INDEX "compositeIndexOnTable" ON "table" ("id", "name" DESC)
        `);
      };

      const expectDropIndex = () => {
        expectSql(`
          DROP INDEX "compositeIndexOnTable" CASCADE
        `);
      };

      await fn();
      (action === 'add' ? expectCreateIndex : expectDropIndex)();

      db.up = false;
      queryMock.mockClear();
      await fn();
      (action === 'add' ? expectDropIndex : expectCreateIndex)();
    });

    it(`should ${action} composite unique index`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
          ...t[action](
            t.unique(['id', { column: 'name', order: 'DESC' }], {
              name: 'compositeIndexOnTable',
              dropMode: 'CASCADE',
            }),
          ),
        }));
      };

      const expectCreateIndex = () => {
        expectSql(`
          CREATE UNIQUE INDEX "compositeIndexOnTable" ON "table" ("id", "name" DESC)
        `);
      };

      const expectDropIndex = () => {
        expectSql(`
          DROP INDEX "compositeIndexOnTable" CASCADE
        `);
      };

      await fn();
      (action === 'add' ? expectCreateIndex : expectDropIndex)();

      db.up = false;
      queryMock.mockClear();
      await fn();
      (action === 'add' ? expectDropIndex : expectCreateIndex)();
    });

    it(`should ${action} composite foreign key`, async () => {
      const fn = () => {
        return db.changeTable('table', (t) => ({
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
        }));
      };

      const expectedConstraint = toLine(`
        ADD CONSTRAINT "constraintName"
          FOREIGN KEY ("id", "name")
          REFERENCES "otherTable"("foreignId", "foreignName")
          MATCH FULL
          ON DELETE CASCADE
          ON UPDATE CASCADE
      `);

      const expectAddConstraint = () => {
        expectSql(`
          ALTER TABLE "table"
          ${expectedConstraint}
        `);
      };

      const expectDropConstraint = () => {
        expectSql(`
          ALTER TABLE "table"
          DROP CONSTRAINT "constraintName" CASCADE
        `);
      };

      await fn();
      (action === 'add' ? expectAddConstraint : expectDropConstraint)();

      db.up = false;
      queryMock.mockClear();
      await fn();
      (action === 'add' ? expectDropConstraint : expectAddConstraint)();
    });
  });

  describe('column change', () => {
    const fn = () => {
      return db.changeTable('table', (t) => ({
        changeType: t.change(t.integer(), t.text()),
        changeEnum: t.change(t.enum('one'), t.enum('two')),
        changeTypeUsing: t.change(t.integer(), t.text(), {
          usingUp: t.raw('b::text'),
          usingDown: t.raw('b::int'),
        }),
        changeCollate: t.change(
          t.text().collate('de_DE'),
          t.text().collate('fr_FR'),
        ),
        changeDefault: t.change(t.default('from'), t.default(t.raw("'to'"))),
        changeNull: t.change(t.nonNullable(), t.nullable()),
        changeComment: t.change(t.comment('comment 1'), t.comment('comment 2')),
        changeCompression: t.change(t.text(), t.text().compression('value')),
      }));
    };

    const enumOne = ['one', 'two'];
    const enumTwo = ['three', 'four'];

    it('should change column up', async () => {
      asMock(queryMock).mockResolvedValueOnce({
        rows: enumOne.map((value) => [value]),
      });
      asMock(queryMock).mockResolvedValueOnce({
        rows: enumTwo.map((value) => [value]),
      });

      await fn();

      expectSql([
        'SELECT unnest(enum_range(NULL::"one"))::text',
        'SELECT unnest(enum_range(NULL::"two"))::text',
        `
        ALTER TABLE "table"
        ALTER COLUMN "changeType" TYPE text,
        ALTER COLUMN "changeEnum" TYPE "two",
        ALTER COLUMN "changeTypeUsing" TYPE text USING b::text,
        ALTER COLUMN "changeCollate" TYPE text COLLATE 'fr_FR',
        ALTER COLUMN "changeDefault" SET DEFAULT 'to',
        ALTER COLUMN "changeNull" DROP NOT NULL,
        ALTER COLUMN "changeCompression" SET COMPRESSION value
      `,
        `COMMENT ON COLUMN "table"."changeComment" IS 'comment 2'`,
      ]);

      const [{ ast }] = asMock(db.options.appCodeUpdater).mock.calls[0];
      expect(ast.shape.changeEnum.from.column.options).toEqual(enumOne);
      expect(ast.shape.changeEnum.to.column.options).toEqual(enumTwo);
    });

    it('should change column down', async () => {
      asMock(queryMock).mockResolvedValueOnce({
        rows: enumTwo.map((value) => [value]),
      });
      asMock(queryMock).mockResolvedValueOnce({
        rows: enumOne.map((value) => [value]),
      });

      db.up = false;

      await fn();

      expectSql([
        'SELECT unnest(enum_range(NULL::"two"))::text',
        'SELECT unnest(enum_range(NULL::"one"))::text',
        `
        ALTER TABLE "table"
        ALTER COLUMN "changeType" TYPE integer,
        ALTER COLUMN "changeEnum" TYPE "one",
        ALTER COLUMN "changeTypeUsing" TYPE integer USING b::int,
        ALTER COLUMN "changeCollate" TYPE text COLLATE 'de_DE',
        ALTER COLUMN "changeDefault" SET DEFAULT 'from',
        ALTER COLUMN "changeNull" SET NOT NULL,
        ALTER COLUMN "changeCompression" SET COMPRESSION DEFAULT
      `,
        `COMMENT ON COLUMN "table"."changeComment" IS 'comment 1'`,
      ]);

      const [{ ast }] = asMock(db.options.appCodeUpdater).mock.calls[0];
      expect(ast.shape.changeEnum.from.column.options).toEqual(enumTwo);
      expect(ast.shape.changeEnum.to.column.options).toEqual(enumOne);
    });
  });

  it('should add composite primary key via change', async () => {
    const fn = () => {
      return db.changeTable('table', (t) => ({
        id: t.change(t.integer(), t.integer().primaryKey()),
        text: t.change(t.integer(), t.integer().primaryKey()),
      }));
    };

    await fn();
    expectSql(`
      ALTER TABLE "table"
      ADD PRIMARY KEY ("id", "text")
    `);

    queryMock.mockClear();
    db.up = false;
    await fn();
    expectSql(`
      ALTER TABLE "table"
      DROP CONSTRAINT "table_pkey"
    `);
  });

  it('should drop composite primary key via change', async () => {
    const fn = () => {
      return db.changeTable('table', (t) => ({
        id: t.change(t.integer().primaryKey(), t.integer()),
        text: t.change(t.integer().primaryKey(), t.integer()),
      }));
    };

    await fn();
    expectSql(`
      ALTER TABLE "table"
      DROP CONSTRAINT "table_pkey"
    `);

    queryMock.mockClear();
    db.up = false;
    await fn();
    expectSql(`
      ALTER TABLE "table"
      ADD PRIMARY KEY ("id", "text")
    `);
  });

  it('should change composite primary key', async () => {
    const fn = () => {
      return db.changeTable('table', (t) => ({
        id: t.change(t.integer().primaryKey(), t.integer()),
        text: t.change(t.integer().primaryKey(), t.integer().primaryKey()),
        active: t.change(t.integer(), t.integer().primaryKey()),
      }));
    };

    await fn();
    expectSql(`
      ALTER TABLE "table"
      DROP CONSTRAINT "table_pkey",
      ADD PRIMARY KEY ("text", "active")
    `);

    queryMock.mockClear();
    db.up = false;
    await fn();
    expectSql(`
      ALTER TABLE "table"
      DROP CONSTRAINT "table_pkey",
      ADD PRIMARY KEY ("id", "text")
    `);
  });

  it('should change column foreign key', async () => {
    const fn = () => {
      return db.changeTable('table', (t) => ({
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
      }));
    };

    await fn();
    expectSql(`
      ALTER TABLE "table"
      DROP CONSTRAINT "table_removeFkey_fkey",
      DROP CONSTRAINT "foreignKeyName",
      DROP CONSTRAINT "fromFkeyName",
      ADD CONSTRAINT "table_addFkey_fkey" FOREIGN KEY ("addFkey") REFERENCES "otherTable"("foreignId"),
      ADD CONSTRAINT "foreignKeyName" FOREIGN KEY ("addFkeyWithOptions") REFERENCES "otherTable"("foreignId") MATCH FULL ON DELETE CASCADE ON UPDATE SET NULL,
      ADD CONSTRAINT "toFkeyName" FOREIGN KEY ("changeForeignKey") REFERENCES "b"("bId") MATCH FULL ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    queryMock.mockClear();
    db.up = false;
    await fn();
    expectSql(`
      ALTER TABLE "table"
      DROP CONSTRAINT "table_addFkey_fkey",
      DROP CONSTRAINT "foreignKeyName",
      DROP CONSTRAINT "toFkeyName",
      ADD CONSTRAINT "table_removeFkey_fkey" FOREIGN KEY ("removeFkey") REFERENCES "otherTable"("foreignId"),
      ADD CONSTRAINT "foreignKeyName" FOREIGN KEY ("removeFkeyWithOptions") REFERENCES "otherTable"("foreignId") MATCH FULL ON DELETE CASCADE ON UPDATE SET NULL,
      ADD CONSTRAINT "fromFkeyName" FOREIGN KEY ("changeForeignKey") REFERENCES "a"("aId") MATCH PARTIAL ON DELETE SET DEFAULT ON UPDATE RESTRICT
    `);
  });

  it('should change index', async () => {
    const fn = () => {
      return db.changeTable('table', (t) => ({
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
      }));
    };

    await fn();
    expectSql([
      `DROP INDEX "table_removeIndex_idx"`,
      `DROP INDEX "table_removeIndexWithOptions_idx" CASCADE`,
      `DROP INDEX "from" CASCADE`,
      `CREATE INDEX "table_addIndex_idx" ON "table" ("addIndex")`,
      `CREATE UNIQUE INDEX "table_addIndexWithOptions_idx" ON "table" USING using ("addIndexWithOptions" COLLATE 'collate' opclass order) INCLUDE ("a", "b") WITH (with) TABLESPACE tablespace WHERE where`,
      `CREATE UNIQUE INDEX "to" ON "table" USING to ("changeIndex" COLLATE 'to' to to) INCLUDE ("c", "d") WITH (to) TABLESPACE to WHERE to`,
    ]);

    queryMock.mockClear();
    db.up = false;
    await fn();
    expectSql([
      `DROP INDEX "table_addIndex_idx"`,
      `DROP INDEX "table_addIndexWithOptions_idx" CASCADE`,
      `DROP INDEX "to" RESTRICT`,
      `CREATE INDEX "table_removeIndex_idx" ON "table" ("removeIndex")`,
      `CREATE UNIQUE INDEX "table_removeIndexWithOptions_idx" ON "table" USING using ("removeIndexWithOptions" COLLATE 'collate' opclass order) INCLUDE ("a", "b") WITH (with) TABLESPACE tablespace WHERE where`,
      `CREATE INDEX "from" ON "table" USING from ("changeIndex" COLLATE 'from' from from) INCLUDE ("a", "b") WITH (from) TABLESPACE from WHERE from`,
    ]);
  });

  it('should rename a column', async () => {
    const fn = () => {
      return db.changeTable('table', (t) => ({
        a: t.rename('b'),
      }));
    };

    await fn();
    expectSql(
      `
          ALTER TABLE "table"
          RENAME COLUMN "a" TO "b"
        `,
    );

    queryMock.mockClear();
    db.up = false;
    await fn();
    expectSql(
      `
          ALTER TABLE "table"
          RENAME COLUMN "b" TO "a"
        `,
    );
  });
});
