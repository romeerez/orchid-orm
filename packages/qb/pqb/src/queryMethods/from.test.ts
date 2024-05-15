import {
  expectQueryNotMutated,
  Profile,
  User,
  userData,
} from '../test-utils/test-utils';
import { assertType, expectSql, testDb, useTestDatabase } from 'test-utils';
import { raw } from '../sql/rawSql';

describe('from', () => {
  it('should accept a query', () => {
    const q = User.from(User.select('name')).select('name');

    expectSql(
      q.toSQL(),
      'SELECT "user"."name" FROM (SELECT "user"."name" FROM "user") AS "user"',
    );
  });

  it('should not insert sub query and alias if provided query is simple', () => {
    const q = User.from(User).select('name');

    expectSql(q.toSQL(), 'SELECT "user"."name" FROM "user"');
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
      ) AS "user" WHERE "user"."alias" ILIKE '%' || $1 || '%'`,
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
    const q = User.queryBuilder
      .with('with1', (qb) =>
        qb.select({ one: User.sql`1`.type((t) => t.integer()) }),
      )
      .with('with2', (qb) =>
        qb.select({ two: User.sql`1`.type((t) => t.integer()) }),
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
        FROM "with1", "with2", "user", "profile"
      `,
    );
  });
});

describe('fromSql', () => {
  it('should accept sql', () => {
    const q = User.all();

    expectSql(
      q.fromSql`(SELECT * FROM profile)`.as('t').toSQL(),
      `SELECT * FROM (SELECT * FROM profile) AS "t"`,
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
      `SELECT * FROM (SELECT * FROM profile) AS "t"`,
    );

    expectQueryNotMutated(q);
  });
});

describe('only', () => {
  it('should add `ONLY` keyword to `FROM`', () => {
    const q = User.only();

    expectSql(q.toSQL(), `SELECT * FROM ONLY "user"`);
  });
});
