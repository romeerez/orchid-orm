import {
  expectQueryNotMutated,
  Profile,
  profileColumnsSql,
  profileData,
  User,
  userColumnsSql,
  userData,
} from '../../../test-utils/pqb.test-utils';
import {
  assertType,
  expectSql,
  sql,
  testDb,
  useTestDatabase,
} from 'test-utils';
import { raw } from '../../expressions/raw-sql';

describe('from', () => {
  it('should accept a query', () => {
    const q = User.from(User.select('name')).select('name');

    assertType<Awaited<typeof q>, { name: string }[]>();

    expectSql(
      q.toSQL(),
      'SELECT "user"."name" FROM (SELECT "user"."name" FROM "user") "user"',
    );
  });

  it('should play nicely with `with` and `join`', () => {
    const q = User.with('w', Profile.select('userId'))
      .from(User)
      .join('w', 'w.userId', 'user.id')
      .select('w.userId', 'user.id');

    assertType<Awaited<typeof q>, { userId: number; id: number }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS (
          SELECT "profile"."user_id" "userId"
          FROM "profile"
        )
        SELECT "w"."userId", "user"."id"
        FROM (SELECT ${userColumnsSql} FROM "user") "user"
        JOIN "w" ON "w"."userId" = "user"."id"
      `,
    );
  });

  it('should not insert sub query and alias if provided query is simple', () => {
    const q = testDb.from(Profile).select('bio');

    assertType<Awaited<typeof q>, { bio: string | null }[]>();

    expectSql(
      q.toSQL(),
      `SELECT "profile"."bio" FROM (SELECT ${profileColumnsSql} FROM "profile") "profile"`,
    );
  });

  describe('inner query', () => {
    useTestDatabase();
    beforeEach(() => User.insert(userData));

    it('should apply column types from inner query', async () => {
      const inner = User.select('createdAt', {
        alias: 'name',
        count: () => User.count(),
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
          "user"."created_at" "createdAt",
          "user"."name" "alias",
          (SELECT count(*) FROM "user") "count"
        FROM "user"
      ) "user" WHERE "user"."alias" ILIKE '%' || $1 || '%'`,
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
    const userId = await User.get('id').insert(userData);
    await Profile.insert({ ...profileData, userId });

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
        User.select('updatedAt'),
        Profile.select('createdAt'),
      ])
      .select('with1.one', 'with2.two', 'user.updatedAt', 'profile.createdAt');

    expectSql(
      q.toSQL(),
      `
        WITH
          "with1" AS (SELECT '1' "one"),
          "with2" AS (SELECT '2' "two")
        SELECT "with1"."one", "with2"."two", "user"."updatedAt", "profile"."createdAt"
        FROM
          "with1",
          "with2",
          (SELECT "user"."updated_at" "updatedAt" FROM "user") "user",
          (SELECT "profile"."created_at" "createdAt" FROM "profile") "profile"
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
    const q = User.all();

    expectSql(
      q.fromSql`(SELECT * FROM profile)`.as('t').toSQL(),
      `SELECT * FROM (SELECT * FROM profile) "t"`,
    );

    expectQueryNotMutated(q);
  });

  it('should accept raw', () => {
    const q = User.all();

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
    const q = User.only();

    expectSql(q.toSQL(), `SELECT ${userColumnsSql} FROM ONLY "user"`);
  });
});
