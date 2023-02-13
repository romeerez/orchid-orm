import {
  assertType,
  db,
  expectQueryNotMutated,
  expectSql,
  User,
  userData,
  useTestDatabase,
} from '../test-utils/test-utils';

describe('from', () => {
  it('should accept raw parameter', () => {
    const q = User.all();
    expectSql(
      q.from(db.raw('profile')).as('t').toSql(),
      `SELECT * FROM profile AS "t"`,
    );
    expectQueryNotMutated(q);
  });

  it('should accept query parameter', () => {
    const q = User.all();
    expectSql(
      q.select('name').from(User.select('name')).toSql(),
      'SELECT "user"."name" FROM (SELECT "user"."name" FROM "user") AS "user"',
    );
    expectQueryNotMutated(q);
  });

  it('should not insert sub query and alias if provided query is simple', () => {
    const q = User.all();
    expectSql(
      User.select('name').from(User).toSql(),
      'SELECT "user"."name" FROM "user"',
    );
    expectQueryNotMutated(q);
  });

  it('should add ONLY keyword when `only` parameter is provided', () => {
    expectSql(
      User.select('id').from(User, { only: true }).toSql(),
      'SELECT "user"."id" FROM ONLY "user"',
    );
  });

  describe('inner query', () => {
    useTestDatabase();
    beforeEach(() => User.count().create(userData));

    it('should apply column types from inner query', async () => {
      const q = db
        .from(
          User.select('createdAt', {
            alias: 'name',
            count: () => User.count(),
          }),
        )
        .where({
          alias: { contains: 'name' },
        });

      assertType<
        Awaited<typeof q>,
        { createdAt: Date; alias: string; count: number }[]
      >();

      expectSql(
        q.toSql(),
        `SELECT * FROM (
        SELECT
          "user"."createdAt",
          "user"."name" AS "alias",
          (SELECT count(*) FROM "user") AS "count"
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
