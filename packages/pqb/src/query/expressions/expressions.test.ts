import {
  Post,
  Profile,
  User,
  userColumnsSql,
} from '../../test-utils/pqb.test-utils';
import {
  assertType,
  db,
  expectSql,
  sql,
  testDb,
  UserData,
  useTestDatabase,
} from 'test-utils';
import { Expression } from './expression';

describe('expressions', () => {
  useTestDatabase();

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
        `SELECT "User"."name" || ' ' || "User"."password" FROM "schema"."user" "User" LIMIT 1`,
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
          SELECT ("User"."id" = $1) OR ("User"."name" = $2) "alias" FROM "schema"."user" "User"
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
      const q = User.join(Post, 'Post.title', 'User.id').select({
        alias: (q) =>
          User.as('u')
            .where({
              id: q.ref('User.id'),
              name: q.ref('Post.title'),
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
              WHERE "u"."id" = "User"."id"
                AND "u"."name" = "Post"."title"
              LIMIT 1
            ) "t"
          ) "alias"
          FROM "schema"."user" "User"
          JOIN "schema"."post" "Post" ON "Post"."title" = "User"."id"
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
          SELECT ("User"."id" = $1) OR ("User"."name" = $2) "alias" FROM "schema"."user" "User"
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
                SELECT "User"."id" FROM "schema"."user" "User" WHERE "User"."name" = "Profile"."bio"
              ) "t"
            ) "sub"
          FROM (SELECT "Profile"."bio" FROM "schema"."profile" "Profile") "Profile"
        `,
      );
    });
  });

  describe('val', () => {
    it('should parameterized values', async () => {
      await db.user.insert(UserData);

      const q = db.user.select({
        value: (q) => {
          return q
            .fn('concat', [
              sql`${q.val('one')}::text`,
              'Name',
              sql`${q.val('two')}::text`,
              'User.Password',
            ])
            .type((t) => t.string())
            .contains('lala');
        },
      });

      assertType<Awaited<typeof q>, { value: boolean }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT concat($1::text, "User"."name", $2::text, "User"."password") ILIKE '%' || $3 || '%' "value"
          FROM "schema"."user" "User"
        `,
        ['one', 'two', 'lala'],
      );

      const res = await q;
      expect(res).toEqual([{ value: false }]);
    });
  });

  describe('fn', () => {
    it('should accept raw SQL', async () => {
      await db.user.insert(UserData);

      const q = db.user
        .select({
          count: (q) =>
            q
              .fn('count', [sql`coalesce(age, id)`])
              .type((t) => t.integer())
              .gt(sql`2 + 2`),
        })
        .take();

      assertType<Awaited<typeof q>, { count: boolean }>();

      expectSql(
        q.toSQL(),
        `
          SELECT count(coalesce(age, id)) > 2 + 2 "count" FROM "schema"."user" "User" LIMIT 1
        `,
      );

      const res = await q;
      expect(res).toEqual({ count: false });
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
          SELECT ${userColumnsSql} FROM "schema"."user" "User"
          WHERE ((
            (SELECT "User"."active" FROM "schema"."user" "User" WHERE "User"."id" = $1 LIMIT 1)
            OR
            "User"."age" > $2
          ) = $3)
        `,
        [1, 123, false],
      );
    });
  });
});
