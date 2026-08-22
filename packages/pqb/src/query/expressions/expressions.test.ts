import {
  assertType,
  db,
  expectSql,
  ProfileData,
  sql,
  testDb,
  UserData,
  UserSelectAll,
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
      const q = db.user.get(
        sql`${db.user.column('Name')} || ' ' || ${db.user.column('Password')}`,
      );

      expectSql(
        q.toSQL(),
        `SELECT "User"."name" || ' ' || "User"."password" FROM "schema"."user" "User" LIMIT 1`,
      );
    });

    it('should support column operators', () => {
      const q = db.user.select({
        alias: (q) =>
          q.column('Id').equals(1).or(q.column('Name').equals('name')),
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

    it('should transform a value loaded from the main query table', async () => {
      const Age = 20;
      await db.user.insert({ ...UserData, Age });

      const q = db.user.select({
        Age: (q) => q.column('Age').transform((value) => String(value ?? 0)),
      });

      assertType<Awaited<typeof q>, { Age: string }[]>();

      expectSql(
        q.toSQL(),
        `SELECT "User"."age" "Age" FROM "schema"."user" "User"`,
      );

      const res = await q;
      expect(res).toEqual([{ Age: `${Age}` }]);
    });

    it('should transform a value after applying an operator', async () => {
      const Age = 21;
      await db.user.insert({ ...UserData, Age });

      const q = db.user.select({
        isNotGreater: (q) =>
          q
            .column('Age')
            .gt(20)
            .transform((value) => !value),
      });

      assertType<Awaited<typeof q>, { isNotGreater: boolean }[]>();

      expectSql(
        q.toSQL(),
        `SELECT "User"."age" > $1 "isNotGreater" FROM "schema"."user" "User"`,
        [20],
      );

      const res = await q;
      expect(res).toEqual([{ isNotGreater: false }]);
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
      const q = db.user.join(db.post, 'Post.Title', 'User.Id').select({
        alias: (q) =>
          db.user
            .as('u')
            .where({
              Id: q.ref('User.Id'),
              Name: q.ref('Post.Title'),
            })
            .select('Id')
            .take(),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT (
            SELECT row_to_json(t.*)
            FROM (
              SELECT "u"."id" "Id"
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
      const q = db.user.select({
        alias: (q) => q.ref('Id').equals(1).or(q.ref('Name').equals('name')),
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
      const q = testDb.from(db.profile.select('Bio')).select({
        sub: (q) =>
          db.user.select('Id').where({
            Name: q.ref('Bio'),
          }),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT
            (
              SELECT COALESCE(json_agg(row_to_json(t.*)), '[]')
              FROM (
                SELECT "User"."id" "Id" FROM "schema"."user" "User" WHERE "User"."name" = "Profile"."Bio"
              ) "t"
            ) "sub"
            FROM (SELECT "Profile"."bio" "Bio" FROM "schema"."profile" "Profile") "Profile"
        `,
      );
    });

    it('should transform a value loaded from the main query table', async () => {
      const Age = 20;
      await db.user.insert({ ...UserData, Age });

      const q = db.user.select({
        Age: (q) => q.ref('Age').transform((value) => String(value ?? 0)),
      });

      assertType<Awaited<typeof q>, { Age: string }[]>();

      expectSql(
        q.toSQL(),
        `SELECT "User"."age" "Age" FROM "schema"."user" "User"`,
      );

      const res = await q;
      expect(res).toEqual([{ Age: `${Age}` }]);
    });

    it('should not apply selected relation parsers to a ref', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      const withRelation = db.user.take().select({
        profile: (q) => q.profile.select('Bio'),
      });

      const result = await withRelation.select({
        Id: withRelation.ref('Id'),
      });

      assertType<
        typeof result,
        { profile: { Bio: string | null }; Id: number }
      >();

      expect(result).toEqual({
        profile: { Bio: ProfileData.Bio },
        Id: user.Id,
      });
    });

    it('should not apply the source query map to a ref', async () => {
      const user = await db.user.create(UserData);

      const withMap = db.user
        .take()
        .select('Name')
        .map((user) => ({ ...user, mapped: true }));

      const result = await withMap.select({
        Id: withMap.ref('Id'),
      });

      assertType<
        typeof result,
        { Name: string; mapped: boolean; Id: number }
      >();

      expect(result).toEqual({
        Name: UserData.Name,
        mapped: true,
        Id: user.Id,
      });
    });
  });

  describe('val', () => {
    it('should parameterized values', async () => {
      await db.user.insert(UserData);

      const q = db.user.select({
        value: (q) => {
          return q
            .fn('concat', [
              sql`${sql.val('one')}::text`,
              'Name',
              sql`${sql.val('two')}::text`,
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
      const q = db.user.where((q) =>
        q.or(db.user.find(1).get('Active'), q.ref('Age').gt(123)).equals(false),
      );

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user" "User"
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
