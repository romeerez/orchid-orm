import {
  expectQueryNotMutated,
  User,
  userData,
} from '../test-utils/test-utils';
import { assertType, expectSql, testDb, useTestDatabase } from 'test-utils';
import { raw } from '../sql/rawSql';

describe('from', () => {
  it('should accept query parameter', () => {
    const q = User.all();
    expectSql(
      q.select('name').from(User.select('name')).toSQL(),
      'SELECT "user"."name" FROM (SELECT "user"."name" FROM "user") AS "user"',
    );
    expectQueryNotMutated(q);
  });

  it('should not insert sub query and alias if provided query is simple', () => {
    const q = User.all();
    expectSql(
      User.select('name').from(User).toSQL(),
      'SELECT "user"."name" FROM "user"',
    );
    expectQueryNotMutated(q);
  });

  it('should add ONLY keyword when `only` parameter is provided', () => {
    expectSql(
      User.select('id').from(User, { only: true }).toSQL(),
      'SELECT "user"."id" FROM ONLY "user"',
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
