import {
  expectQueryNotMutated,
  Profile,
  User,
  userColumnsSql,
  userData,
} from '../test-utils/test-utils';
import {
  assertType,
  expectSql,
  sql,
  testDb,
  useTestDatabase,
} from 'test-utils';
import { raw } from '../sql/rawSql';

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
          SELECT "profile"."userId"
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

    expectSql(q.toSQL(), 'SELECT "profile"."bio" FROM "profile"');
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
          "user"."createdAt",
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
  it('should support multiple sources', () => {
    const q = testDb
      .with('with1', (qb) =>
        qb.select({ one: sql`1`.type((t) => t.integer()) }),
      )
      .with('with2', (qb) =>
        qb.select({ two: sql`1`.type((t) => t.integer()) }),
      )
      .from(['with1', 'with2', User, Profile])
      .select('with1.one', 'with2.two', 'user.active', 'profile.bio');

    assertType<
      Awaited<typeof q>,
      {
        one: number;
        two: number;
        active: boolean | null;
        bio: string | null;
      }[]
    >();

    expectSql(
      q.toSQL(),
      `
        WITH
          "with1" AS (SELECT 1 "one"),
          "with2" AS (SELECT 1 "two")
        SELECT "with1"."one", "with2"."two", "user"."active", "profile"."bio"
        FROM "with1", "with2", (SELECT ${userColumnsSql} FROM "user"), "profile"
      `,
    );
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
