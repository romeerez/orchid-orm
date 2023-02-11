import { expectSql, getDb, queryMock, resetDb, toLine } from '../test-utils';

const db = getDb();

jest.mock('./migrationUtils', () => ({
  ...jest.requireActual('./migrationUtils'),
  getPrimaryKeysOfTable: jest.fn(),
}));

describe('migration', () => {
  beforeEach(resetDb);

  describe('renameTable', () => {
    it('should call appCodeUpdater', async () => {
      await db.renameTable('from', 'to');

      expect(db.options.appCodeUpdater).toHaveBeenCalled();
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

  (['addColumn', 'dropColumn'] as const).forEach((action) => {
    describe(action, () => {
      it(`should use changeTable to ${
        action === 'addColumn' ? 'add' : 'drop'
      } a column`, async () => {
        const fn = () => {
          return db[action]('table', 'column', (t) => t.text());
        };

        const expectAddColumn = () => {
          expectSql(`
            ALTER TABLE "table"
            ADD COLUMN "column" text NOT NULL
          `);
        };

        const expectDropColumn = () => {
          expectSql(`
            ALTER TABLE "table"
            DROP COLUMN "column"
          `);
        };

        await fn();
        (action === 'addColumn' ? expectAddColumn : expectDropColumn)();

        db.up = false;
        queryMock.mockClear();
        await fn();
        (action === 'addColumn' ? expectDropColumn : expectAddColumn)();
      });
    });
  });

  (['addIndex', 'dropIndex'] as const).forEach((action) => {
    describe(action, () => {
      it(`should use changeTable to ${
        action === 'addIndex' ? 'add' : 'drop'
      } an index`, async () => {
        const fn = () => {
          return db[action](
            'table',
            ['id', { column: 'name', order: 'DESC' }],
            {
              name: 'indexName',
            },
          );
        };

        const expectAddIndex = () => {
          expectSql(`
            CREATE INDEX "indexName" ON "table" ("id", "name" DESC)
          `);
        };

        const expectDropIndex = () => {
          expectSql(`
            DROP INDEX "indexName"
          `);
        };

        await fn();
        (action === 'addIndex' ? expectAddIndex : expectDropIndex)();

        db.up = false;
        queryMock.mockClear();
        await fn();
        (action === 'addIndex' ? expectDropIndex : expectAddIndex)();
      });
    });
  });

  (['addForeignKey', 'dropForeignKey'] as const).forEach((action) => {
    describe(action, () => {
      it(`should use changeTable to ${
        action === 'addForeignKey' ? 'add' : 'drop'
      } a foreignKey`, async () => {
        const fn = () => {
          return db[action](
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
          );
        };

        const expectAddForeignKey = () => {
          const expectedConstraint = toLine(`
            ADD CONSTRAINT "constraintName"
              FOREIGN KEY ("id", "name")
              REFERENCES "otherTable"("foreignId", "foreignName")
              MATCH FULL
              ON DELETE CASCADE
              ON UPDATE CASCADE
          `);
          expectSql(`
            ALTER TABLE "table"
            ${expectedConstraint}
          `);
        };

        const expectDropForeignKey = () => {
          expectSql(`
            ALTER TABLE "table"
            DROP CONSTRAINT "constraintName" CASCADE
          `);
        };

        await fn();
        (action === 'addForeignKey'
          ? expectAddForeignKey
          : expectDropForeignKey)();

        db.up = false;
        queryMock.mockClear();
        await fn();
        (action === 'addForeignKey'
          ? expectDropForeignKey
          : expectAddForeignKey)();
      });
    });
  });

  (['addPrimaryKey', 'dropPrimaryKey'] as const).forEach((action) => {
    describe(action, () => {
      it(`should use changeTable to ${
        action === 'addPrimaryKey' ? 'add' : 'drop'
      } primary key`, async () => {
        const fn = () => {
          return db[action]('table', ['id', 'name']);
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
        (action === 'addPrimaryKey'
          ? expectAddPrimaryKey
          : expectDropPrimaryKey)();

        db.up = false;
        queryMock.mockClear();
        await fn();
        (action === 'addPrimaryKey'
          ? expectDropPrimaryKey
          : expectAddPrimaryKey)();
      });

      it('should use changeTable to add primary key with constraint name', async () => {
        const fn = () => {
          return db.addPrimaryKey('table', ['id', 'name'], {
            name: 'primaryKeyName',
          });
        };

        await fn();
        expectSql(`
          ALTER TABLE "table"
          ADD CONSTRAINT "primaryKeyName" PRIMARY KEY ("id", "name")
        `);

        db.up = false;
        queryMock.mockClear();
        await fn();
        expectSql(`
          ALTER TABLE "table"
          DROP CONSTRAINT "primaryKeyName"
        `);
      });
    });
  });

  describe('renameColumn', () => {
    it('should use changeTable to rename a column', async () => {
      const fn = () => {
        return db.renameColumn('table', 'from', 'to');
      };

      await fn();
      expectSql(`
        ALTER TABLE "table"
        RENAME COLUMN "from" TO "to"
      `);

      db.up = false;
      queryMock.mockClear();
      await fn();
      expectSql(`
        ALTER TABLE "table"
        RENAME COLUMN "to" TO "from"
      `);
    });
  });

  (['createSchema', 'dropSchema'] as const).forEach((action) => {
    describe(action, () => {
      it('should call appCodeUpdater', async () => {
        await db[action]('schemaName');

        expect(db.options.appCodeUpdater).toHaveBeenCalled();
      });

      it(`should ${
        action === 'createSchema' ? 'add' : 'drop'
      } a schema`, async () => {
        const fn = () => {
          return db[action]('schemaName');
        };

        const expectCreateSchema = () => {
          expectSql(`
            CREATE SCHEMA "schemaName"
          `);
        };

        const expectDropSchema = () => {
          expectSql(`
            DROP SCHEMA "schemaName"
          `);
        };

        await fn();
        (action === 'createSchema' ? expectCreateSchema : expectDropSchema)();

        db.up = false;
        queryMock.mockClear();
        await fn();
        (action === 'createSchema' ? expectDropSchema : expectCreateSchema)();
      });
    });
  });

  (['createExtension', 'dropExtension'] as const).forEach((action) => {
    describe(action, () => {
      it('should call appCodeUpdater', async () => {
        await db[action]('extensionName');

        expect(db.options.appCodeUpdater).toHaveBeenCalled();
      });

      it(`should ${
        action === 'createExtension' ? 'add' : 'drop'
      } an extension`, async () => {
        const fn = () => {
          return db[action]('extensionName', {
            dropIfExists: true,
            createIfNotExists: true,
            schema: 'schemaName',
            version: '123',
            cascade: true,
          });
        };

        const expectCreateExtension = () => {
          expectSql(`
            CREATE EXTENSION IF NOT EXISTS "extensionName" SCHEMA "schemaName" VERSION '123' CASCADE
          `);
        };

        const expectDropExtension = () => {
          expectSql(`
            DROP EXTENSION IF EXISTS "extensionName" CASCADE
          `);
        };

        await fn();
        (action === 'createExtension'
          ? expectCreateExtension
          : expectDropExtension)();

        db.up = false;
        queryMock.mockClear();
        await fn();
        (action === 'createExtension'
          ? expectDropExtension
          : expectCreateExtension)();
      });
    });
  });

  (['createEnum', 'dropEnum'] as const).forEach((action) => {
    describe(action, () => {
      it('should call appCodeUpdater', async () => {
        await db[action]('enumName', ['one']);

        expect(db.options.appCodeUpdater).toHaveBeenCalled();
      });

      it(`should ${
        action === 'createEnum' ? 'add' : 'drop'
      } an enum`, async () => {
        const fn = () => {
          return db[action]('enumName', ['one', 'two'], {
            dropIfExists: true,
            schema: 'schemaName',
            cascade: true,
          });
        };

        const expectCreateExtension = () => {
          expectSql(`
            CREATE TYPE "schemaName"."enumName" AS ENUM ('one', 'two')
          `);
        };

        const expectDropExtension = () => {
          expectSql(`
            DROP TYPE IF EXISTS "schemaName"."enumName" CASCADE
          `);
        };

        await fn();
        (action === 'createEnum'
          ? expectCreateExtension
          : expectDropExtension)();

        db.up = false;
        queryMock.mockClear();
        await fn();
        (action === 'createEnum'
          ? expectDropExtension
          : expectCreateExtension)();
      });
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
