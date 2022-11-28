import { expectSql, getDb, queryMock, resetDb, toLine } from '../test-utils';
import { getPrimaryKeysOfTable } from './migrationUtils';

const db = getDb();

jest.mock('./migrationUtils', () => ({
  ...jest.requireActual('./migrationUtils'),
  getPrimaryKeysOfTable: jest.fn(),
}));

describe('migration', () => {
  beforeEach(resetDb);

  describe('renameTable', () => {
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

  (['createJoinTable', 'dropJoinTable'] as const).forEach((action) => {
    describe(action, () => {
      it(`should ${
        action === 'createJoinTable' ? 'create' : 'drop'
      } a join table`, async () => {
        const fn = () => {
          return db[action](['posts', 'comments'], (t) => ({
            ...t.timestamps(),
          }));
        };

        const expectCreateTable = async () => {
          (getPrimaryKeysOfTable as jest.Mock)
            .mockResolvedValueOnce([
              {
                name: 'uuid',
                type: 'uuid',
              },
            ])
            .mockResolvedValueOnce([
              {
                name: 'id',
                type: 'integer',
              },
              {
                name: 'authorName',
                type: 'text',
              },
            ]);

          await fn();

          expectSql(`
            CREATE TABLE "postsComments" (
              "postUuid" uuid NOT NULL REFERENCES "posts"("uuid"),
              "commentId" integer NOT NULL,
              "commentAuthorName" text NOT NULL,
              "createdAt" timestamp NOT NULL DEFAULT now(),
              "updatedAt" timestamp NOT NULL DEFAULT now(),
              PRIMARY KEY ("postUuid", "commentId", "commentAuthorName"),
              CONSTRAINT "postsComments_commentId_commentAuthorName_fkey" FOREIGN KEY ("commentId", "commentAuthorName") REFERENCES "comments"("id", "authorName")
            )
          `);
        };

        const expectDropTable = async () => {
          await fn();

          expectSql(`
            DROP TABLE "postsComments"
          `);
        };

        await (action === 'createJoinTable'
          ? expectCreateTable
          : expectDropTable)();

        db.up = false;
        queryMock.mockClear();
        await (action === 'createJoinTable'
          ? expectDropTable
          : expectCreateTable)();
      });

      it('should throw error if table has no primary key', async () => {
        if (action === 'dropJoinTable') {
          db.up = false;
        }

        (getPrimaryKeysOfTable as jest.Mock)
          .mockResolvedValueOnce([
            {
              name: 'id',
              type: 'integer',
            },
          ])
          .mockResolvedValueOnce([]);

        await expect(db[action](['posts', 'comments'])).rejects.toThrow(
          'Primary key for table "comments" is not defined',
        );
      });
    });
  });

  (['createSchema', 'dropSchema'] as const).forEach((action) => {
    describe(action, () => {
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
      it(`should ${
        action === 'createExtension' ? 'add' : 'drop'
      } an extension`, async () => {
        const fn = () => {
          return db[action]('extensionName', {
            ifExists: true,
            ifNotExists: true,
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
