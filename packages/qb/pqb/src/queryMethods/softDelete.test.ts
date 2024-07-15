import { expectSql, testAdapter, testColumnTypes } from 'test-utils';
import { UserSoftDelete } from '../test-utils/test-utils';
import { createDb } from '../query/db';

describe('softDelete', () => {
  it('should have nonDeleted scope enabled by default', () => {
    expectSql(
      UserSoftDelete.toSQL(),
      `
          SELECT * FROM "user"
          WHERE ("user"."deletedAt" IS NULL)
        `,
    );
  });

  it('should have `includeDeleted` method to query all records', () => {
    expectSql(
      UserSoftDelete.includeDeleted().toSQL(),
      `
          SELECT * FROM "user"
        `,
    );
  });

  it('should set deletedAt to current time instead of deleting', () => {
    const q = UserSoftDelete.all().delete();
    expectSql(
      q.toSQL(),
      `
        UPDATE "user"
           SET "deletedAt" = now()
         WHERE ("user"."deletedAt" IS NULL)
      `,
    );
  });

  it('should respect `nowSql` option', () => {
    const db = createDb({
      adapter: testAdapter,
      columnTypes: testColumnTypes,
      nowSQL: 'CURRENT_TIMESTAMP',
    });

    const UserSoftDelete = db(
      'user',
      (t) => ({
        id: t.identity().primaryKey(),
        name: t.string(),
        active: t.boolean().nullable(),
        deletedAt: t.timestamp().nullable(),
      }),
      undefined,
      {
        softDelete: true,
      },
    );

    const q = UserSoftDelete.all().delete();
    expectSql(
      q.toSQL(),
      `
        UPDATE "user"
           SET "deletedAt" = CURRENT_TIMESTAMP
         WHERE ("user"."deletedAt" IS NULL)
      `,
    );
  });

  it('should delete records for real with `hardDelete`', () => {
    const q = UserSoftDelete.all().hardDelete();
    expectSql(
      q.toSQL(),
      `
        DELETE FROM "user"
      `,
    );
  });
});
