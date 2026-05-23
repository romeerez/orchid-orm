import { expectSql, testAdapter, testColumnTypes } from 'test-utils';
import {
  UserSoftDelete,
  userSoftDeleteColumnsSql,
} from '../../../test-utils/pqb.test-utils';
import { createDbWithAdapter } from '../../db';

describe('softDelete', () => {
  it('should throw on empty effective where filter for delete and hardDelete', () => {
    expect(() => UserSoftDelete.where({}).delete().toSQL()).toThrow(
      'Dangerous update without conditions',
    );
    expect(() => UserSoftDelete.where({}).hardDelete().toSQL()).toThrow(
      'Dangerous delete without conditions',
    );
  });

  it('should have nonDeleted scope enabled by default', () => {
    expectSql(
      UserSoftDelete.toSQL(),
      `
          SELECT ${userSoftDeleteColumnsSql} FROM "schema"."user"
          WHERE ("user"."deleted_at" IS NULL)
        `,
    );
  });

  it('should have `includeDeleted` method to query all records', () => {
    expectSql(
      UserSoftDelete.includeDeleted().toSQL(),
      `
          SELECT ${userSoftDeleteColumnsSql} FROM "schema"."user"
        `,
    );
  });

  it('should set deletedAt to current time instead of deleting', () => {
    const q = UserSoftDelete.all().delete();
    expectSql(
      q.toSQL(),
      `
        UPDATE "schema"."user"
           SET "deleted_at" = now()
         WHERE ("user"."deleted_at" IS NULL)
      `,
    );
  });

  it('should respect `nowSql` option', () => {
    const db = createDbWithAdapter({
      snakeCase: true,
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
        schema: () => 'schema',
        softDelete: true,
      },
    );

    const q = UserSoftDelete.all().delete();
    expectSql(
      q.toSQL(),
      `
        UPDATE "schema"."user"
           SET "deleted_at" = CURRENT_TIMESTAMP
         WHERE ("user"."deleted_at" IS NULL)
      `,
    );
  });

  it('should delete records for real with `hardDelete`', () => {
    const q = UserSoftDelete.all().hardDelete();
    expectSql(
      q.toSQL(),
      `
        DELETE FROM "schema"."user"
      `,
    );
  });

  it('should allow all with an empty effective where filter', () => {
    expectSql(
      UserSoftDelete.all().where({ id: undefined }).delete().toSQL(),
      `
        UPDATE "schema"."user" SET "deleted_at" = now()
        WHERE ("user"."deleted_at" IS NULL)
      `,
    );

    expectSql(
      UserSoftDelete.all().where({ id: undefined }).hardDelete().toSQL(),
      `
        DELETE FROM "schema"."user"
      `,
    );
  });
});
