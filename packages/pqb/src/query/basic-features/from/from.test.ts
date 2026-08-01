import {
  expectQueryNotMutated,
  profileData,
} from '../../../test-utils/pqb.test-utils';
import {
  assertType,
  db,
  expectSql,
  ProfileSelectAll,
  sql,
  testDb,
  UserData,
  UserSelectAll,
  useTestDatabase,
} from 'test-utils';
import { raw } from '../../expressions/raw-sql';

describe('from', () => {
  it('should accept a query', () => {
    const q = db.user.from(db.user.select('Name')).select('Name');

    assertType<Awaited<typeof q>, { Name: string }[]>();

    expectSql(
      q.toSQL(),
      'SELECT "User"."Name" FROM (SELECT "User"."name" "Name" FROM "schema"."user" "User") "User"',
    );
  });

  it('should play nicely with `with` and `join`', () => {
    const q = db.user
      .with('w', db.profile.select('UserId'))
      .from(db.user)
      .join('w', 'w.UserId', 'User.Id')
      .select('w.UserId', 'User.Id');

    assertType<Awaited<typeof q>, { Id: number; UserId: number | null }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS (
          SELECT "Profile"."user_id" "UserId"
          FROM "schema"."profile" "Profile"
        )
        SELECT "w"."UserId", "User"."Id"
        FROM (SELECT ${UserSelectAll} FROM "schema"."user" "User") "User"
        JOIN "w" ON "w"."UserId" = "User"."Id"
      `,
    );
  });

  it('should not insert sub query and alias if provided query is simple', () => {
    const q = testDb.from(db.profile).select('Bio');

    assertType<Awaited<typeof q>, { Bio: string | null }[]>();

    expectSql(
      q.toSQL(),
      `SELECT "Profile"."Bio" FROM (SELECT ${ProfileSelectAll} FROM "schema"."profile" "Profile") "Profile"`,
    );
  });

  describe('inner query', () => {
    useTestDatabase();
    beforeEach(() => db.user.insert(UserData));

    it('should apply column types from inner query', async () => {
      const inner = db.user.select('createdAt', {
        alias: 'Name',
        count: () => db.user.count(),
      });

      const q = testDb.from(inner).where({
        alias: { contains: 'name' },
      });

      assertType<
        Awaited<typeof q>,
        { createdAt: Date; alias: string; count: number }[]
      >();

      expectSql(
        q.toSQL(),
        `SELECT * FROM (
        SELECT
          "User"."created_at" "createdAt",
          "User"."name" "alias",
          (SELECT count(*) FROM "schema"."user" "User") "count"
        FROM "schema"."user" "User"
      ) "User" WHERE "User"."alias" ILIKE '%' || $1 || '%'`,
        ['name'],
      );

      const result = await q;
      expect(result).toEqual([
        {
          createdAt: expect.any(Date),
          alias: 'name',
          count: 1,
        },
      ]);
    });
  });
});

describe('from multiple', () => {
  useTestDatabase();

  it('should support multiple sources, should properly parse', async () => {
    const userId = await db.user.get('Id').insert(UserData);
    await db.profile.insert({
      Bio: profileData.bio,
      ProfileKey: 'key',
      UserId: userId,
    });

    const q = testDb
      .with('with1', (qb) =>
        qb.select({ one: sql`'1'`.type((t) => t.text().parse(parseInt)) }),
      )
      .with('with2', (qb) =>
        qb.select({ two: sql`'2'`.type((t) => t.text().parse(parseInt)) }),
      )
      .from([
        'with1',
        'with2',
        db.user.select('updatedAt'),
        db.profile.select('createdAt'),
      ])
      .select('with1.one', 'with2.two', 'User.updatedAt', 'Profile.createdAt');

    expectSql(
      q.toSQL(),
      `
        WITH
          "with1" AS (SELECT '1' "one"),
          "with2" AS (SELECT '2' "two")
        SELECT "with1"."one", "with2"."two", "User"."updatedAt", "Profile"."createdAt"
        FROM
          "with1",
          "with2",
          (SELECT "User"."updated_at" "updatedAt" FROM "schema"."user" "User") "User",
          (SELECT "Profile"."created_at" "createdAt" FROM "schema"."profile" "Profile") "Profile"
      `,
    );

    const res = await q;

    assertType<
      typeof res,
      {
        one: number;
        two: number;
        updatedAt: Date;
        createdAt: Date;
      }[]
    >();

    expect(res).toEqual([
      {
        one: 1,
        two: 2,
        updatedAt: expect.any(Date),
        createdAt: expect.any(Date),
      },
    ]);
  });
});

describe('fromSql', () => {
  it('should accept sql', () => {
    const q = db.user.all();

    expectSql(
      q.fromSql`(SELECT * FROM profile)`.as('t').toSQL(),
      `SELECT * FROM (SELECT * FROM profile) "t"`,
    );

    expectQueryNotMutated(q);
  });

  it('should accept raw', () => {
    const q = db.user.all();

    expectSql(
      q
        .fromSql(raw({ raw: `(SELECT * FROM profile)` }))
        .as('t')
        .toSQL(),
      `SELECT * FROM (SELECT * FROM profile) "t"`,
    );

    expectQueryNotMutated(q);
  });
});

describe('only', () => {
  it('should add `ONLY` keyword to `FROM`', () => {
    const q = db.user.only();

    expectSql(
      q.toSQL(),
      `SELECT ${UserSelectAll} FROM ONLY "schema"."user" "User"`,
    );
  });
});
