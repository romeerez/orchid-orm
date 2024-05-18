import { Post, User } from '../test-utils/test-utils';
import { assertType, expectSql } from 'test-utils';

describe('expressions', () => {
  describe('column', () => {
    it('should make SQL where given column is prefixed with a table name', () => {
      const q = User.get(
        User.sql`${User.column('name')} || ' ' || ${User.column('password')}`,
      );

      expectSql(
        q.toSQL(),
        `SELECT "user"."name" || ' ' || "user"."password" FROM "user" LIMIT 1`,
      );
    });

    it('should support column operators', () => {
      const q = User.select({
        alias: (q) =>
          q.column('id').equals(1).or(q.column('name').equals('name')),
      });

      assertType<Awaited<typeof q>, { alias: boolean }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ("user"."id" = $1) OR ("user"."name" = $2) "alias" FROM "user"
        `,
        [1, 'name'],
      );
    });
  });

  describe('ref', () => {
    it('should reference selectable columns', () => {
      const q = User.join(Post, 'post.title', 'user.id').select({
        alias: (q) =>
          User.as('u')
            .where({
              id: q.ref('user.id'),
              name: q.ref('post.title'),
            })
            .take(),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT (
            SELECT row_to_json("t".*)
            FROM (
              SELECT *
              FROM "user" AS "u"
              WHERE "u"."id" = "user"."id"
                AND "u"."name" = "post"."title"
              LIMIT 1
            ) AS "t"
          ) "alias"
          FROM "user"
          JOIN "post" ON "post"."title" = "user"."id"
        `,
      );
    });

    it('should support column operators', () => {
      const q = User.select({
        alias: (q) => q.ref('id').equals(1).or(q.ref('name').equals('name')),
      });

      assertType<Awaited<typeof q>, { alias: boolean }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ("user"."id" = $1) OR ("user"."name" = $2) "alias" FROM "user"
        `,
        [1, 'name'],
      );
    });
  });

  describe('val', () => {
    it('should parameterized values', async () => {
      const q = User.select({
        value: (q) => {
          return q
            .fn('concat', [q.val('one'), 'name', q.val('two'), 'user.password'])
            .type((t) => t.string())
            .contains('lala');
        },
      });

      assertType<Awaited<typeof q>, { value: boolean }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT concat($1, "user"."name", $2, "user"."password") ILIKE '%' || $3 || '%' "value"
          FROM "user"
        `,
        ['one', 'two', 'lala'],
      );
    });
  });

  describe('fn', () => {
    it('should accept raw SQL', () => {
      const q = User.select({
        count: (q) =>
          q
            .fn('count', [q.sql`coalesce(one, two)`])
            .type((t) => t.integer())
            .gt(q.sql`2 + 2`),
      }).take();

      assertType<Awaited<typeof q>, { count: boolean }>();

      expectSql(
        q.toSQL(),
        `
          SELECT count(coalesce(one, two)) > 2 + 2 "count" FROM "user" LIMIT 1
        `,
      );
    });
  });
});
