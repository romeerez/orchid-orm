import { getPrimaryKeysOfTable } from './migrationUtils';
import { expectSql, getDb, queryMock, resetDb } from '../test-utils';

const db = getDb();

jest.mock('./migrationUtils', () => ({
  ...jest.requireActual('./migrationUtils'),
  getPrimaryKeysOfTable: jest.fn(),
}));

describe('join table', () => {
  beforeEach(resetDb);

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
        db.up = action !== 'dropJoinTable';

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
});
