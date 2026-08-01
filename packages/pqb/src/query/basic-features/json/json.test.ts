import { expectQueryNotMutated } from '../../../test-utils/pqb.test-utils';
import { assertType, db, expectSql, useTestDatabase } from 'test-utils';

const messageColumnsSql = db.message.q.selectAllColumns!.join(', ');

describe('json methods', () => {
  useTestDatabase();

  describe('json', () => {
    it('wraps a query with json functions', () => {
      const query = db.user.all();
      const q = query.where({ Id: 1 }).select('Id').json();

      assertType<Awaited<typeof q>, string | undefined>();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE(json_agg(row_to_json(t.*)), '[]')
          FROM (
            SELECT "User"."id" "Id" FROM "schema"."user" "User"
            WHERE "User"."id" = $1
          ) "t"
        `,
        [1],
      );

      expectQueryNotMutated(query);
    });

    it('supports `take`', () => {
      const query = db.user.all();
      const q = query.where({ Id: 1 }).select('Id').take().json();

      assertType<Awaited<typeof q>, string | undefined>();

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json(t.*)
          FROM (
            SELECT "User"."id" "Id" FROM "schema"."user" "User"
            WHERE "User"."id" = $1
            LIMIT 1
          ) "t"
        `,
        [1],
      );

      expectQueryNotMutated(query);
    });

    it('should not duplicate the default scope inside the inner `FROM` and after `AS t`', () => {
      const q = db.message.json();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE(json_agg(json_build_object(
            'Id', t."Id",
            'MessageKey', t."MessageKey",
            'ChatId', t."ChatId",
            'AuthorId', t."AuthorId",
            'Text', t."Text",
            'Decimal', t."Decimal"::text,
            'Active', t."Active",
            'DeletedAt', t."DeletedAt",
            'createdAt', t."createdAt",
            'updatedAt', t."updatedAt"
          )), '[]')
          FROM (
            SELECT ${messageColumnsSql}
            FROM "schema"."message" "Message"
            WHERE ("Message"."deleted_at" IS NULL)
          ) "t"
        `,
      );
    });
  });
});
