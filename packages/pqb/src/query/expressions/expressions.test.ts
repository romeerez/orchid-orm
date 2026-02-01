import {
  Post,
  Profile,
  User,
  userColumnsSql,
} from '../../test-utils/pqb.test-utils';
import { assertType, expectSql, sql, testDb } from 'test-utils';
import { Expression } from './expression';

describe('expressions', () => {
  describe('column', () => {
    it('should be available on the base query builder', () => {
      const column = (testDb.column('column') as Expression).toSQL({
        values: [],
      });
      expect(column).toBe(`"column"`);
    });

    it('should make SQL where given column is prefixed with a table name', () => {
      const q = User.get(
        sql`${User.column('name')} || ' ' || ${User.column('password')}`,
      );

      expectSql(
        q.toSQL(),
        `SELECT "user"."name" || ' ' || "user"."password" FROM "schema"."user" LIMIT 1`,
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
          SELECT ("user"."id" = $1) OR ("user"."name" = $2) "alias" FROM "schema"."user"
        `,
        [1, 'name'],
      );
    });
  });

  describe('ref', () => {
    it('should be available on the base query builder', () => {
      const tableColumn = (testDb.ref('table.column') as Expression).toSQL({
        values: [],
      });
      expect(tableColumn).toBe(`"table"."column"`);

      const column = (testDb.ref('column') as Expression).toSQL({ values: [] });
      expect(column).toBe(`"column"`);
    });

    it('should reference selectable columns', () => {
      const q = User.join(Post, 'post.title', 'user.id').select({
        alias: (q) =>
          User.as('u')
            .where({
              id: q.ref('user.id'),
              name: q.ref('post.title'),
            })
            .select('id')
            .take(),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT (
            SELECT row_to_json(t.*)
            FROM (
              SELECT "u"."id"
              FROM "schema"."user" "u"
              WHERE "u"."id" = "user"."id"
                AND "u"."name" = "post"."title"
              LIMIT 1
            ) "t"
          ) "alias"
          FROM "schema"."user"
          JOIN "schema"."post" ON "post"."title" = "user"."id"
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
          SELECT ("user"."id" = $1) OR ("user"."name" = $2) "alias" FROM "schema"."user"
        `,
        [1, 'name'],
      );
    });

    it('should reference columns of a `from` subquery in where', () => {
      const q = testDb.from(Profile.select('bio')).select({
        sub: (q) =>
          User.select('id').where({
            name: q.ref('bio'),
          }),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT
            (
              SELECT COALESCE(json_agg(row_to_json(t.*)), '[]')
              FROM (
                SELECT "user"."id" FROM "schema"."user" WHERE "user"."name" = "profile"."bio"
              ) "t"
            ) "sub"
          FROM (SELECT "profile"."bio" FROM "schema"."profile") "profile"
        `,
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
          FROM "schema"."user"
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
            .fn('count', [sql`coalesce(one, two)`])
            .type((t) => t.integer())
            .gt(sql`2 + 2`),
      }).take();

      assertType<Awaited<typeof q>, { count: boolean }>();

      expectSql(
        q.toSQL(),
        `
          SELECT count(coalesce(one, two)) > 2 + 2 "count" FROM "schema"."user" LIMIT 1
        `,
      );
    });
  });

  describe('or', () => {
    it('should support query and expression', () => {
      const q = User.where((q) =>
        q.or(User.find(1).get('active'), q.ref('age').gt(123)).equals(false),
      );

      expectSql(
        q.toSQL(),
        `
          SELECT ${userColumnsSql} FROM "schema"."user"
          WHERE ((
            (SELECT "user"."active" FROM "schema"."user" WHERE "user"."id" = $1 LIMIT 1)
            OR
            "user"."age" > $2
          ) = $3)
        `,
        [1, 123, false],
      );
    });
  });
});
