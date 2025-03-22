import {
  Profile,
  profileColumnsSql,
  ProfileRecord,
  Snake,
  User,
  userColumnsSql,
  UserRecord,
} from '../test-utils/test-utils';
import { expectSql, assertType, sql } from 'test-utils';
import { WithOptions } from '../sql';

const makeOptions = (
  select: string,
): { options: WithOptions; sql: string }[] => {
  return [
    {
      options: { columns: ['id', 'name'] },
      sql: `WITH "w"("id", "name") AS (SELECT ${select} FROM "user") SELECT * FROM "w"`,
    },
    {
      options: { recursive: true },
      sql: `WITH RECURSIVE "w" AS (SELECT ${select} FROM "user") SELECT * FROM "w"`,
    },
    {
      options: { materialized: true },
      sql: `WITH "w" AS MATERIALIZED (SELECT ${select} FROM "user") SELECT * FROM "w"`,
    },
    {
      options: { notMaterialized: true },
      sql: `WITH "w" AS NOT MATERIALIZED (SELECT ${select} FROM "user") SELECT * FROM "w"`,
    },
  ];
};

const selectedOptions = makeOptions(userColumnsSql);
const selectAllOptions = makeOptions('*');

describe('with', () => {
  it('should use a query, handle selection', () => {
    const q = User.with('w', User.select({ i: 'id', n: 'name' })).from('w');

    assertType<Awaited<typeof q>, { i: number; n: string }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS (SELECT "user"."id" "i", "user"."name" "n" FROM "user") SELECT * FROM "w"
      `,
    );
  });

  it('should use query builder callback', () => {
    const q = User.with('w', (q) =>
      q.select({ one: () => sql`1`.type((t) => t.integer()) }),
    ).from('w');

    assertType<Awaited<typeof q>, { one: number }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS (SELECT 1 "one") SELECT * FROM "w"
      `,
    );
  });

  it('should work with join', () => {
    const q = User.with('w', User).join('w', 'id', 'user.id').select('w.id');

    assertType<Awaited<typeof q>, { id: number }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS (SELECT ${userColumnsSql} FROM "user")
        SELECT "w"."id" FROM "user"
        JOIN "w" ON "w"."id" = "user"."id"
      `,
    );
  });

  it('should work with join lateral', () => {
    const q = User.with('w', Profile)
      .joinLateral('w', (q) => q.on('userId', 'user.id').where({ bio: 'bio' }))
      .select('name', 'w.*');

    assertType<Awaited<typeof q>, { name: string; w: ProfileRecord }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS (SELECT ${profileColumnsSql} FROM "profile")
        SELECT "user"."name", row_to_json("w".*) "w"
        FROM "user"
        JOIN LATERAL (
          SELECT *
          FROM "w"
          WHERE "w"."userId" = "user"."id"
            AND "w"."bio" = $1
        ) "w" ON true
      `,
      ['bio'],
    );
  });

  it('should support selecting named columns', () => {
    const q = User.with('w', Snake.select('snakeName', 'tailLength'))
      .from('w')
      .select('snakeName', 'w.tailLength');

    assertType<
      Awaited<typeof q>,
      { snakeName: string; tailLength: number }[]
    >();

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS (
          SELECT "snake"."snake_name" "snakeName", "snake"."tail_length" "tailLength"
          FROM "snake"
        )
        SELECT "w"."snakeName", "w"."tailLength"
        FROM "w"
      `,
    );
  });

  describe('options', () => {
    it('should support columns: true to list all columns', () => {
      const q = User.with('w', { columns: true }, User).from('w');

      assertType<Awaited<typeof q>, UserRecord[]>();

      expectSql(
        q.toSQL(),
        `
          WITH "w"(${Object.keys(User.q.shape)
            .map((c) => `"${c}"`)
            .join(
              ', ',
            )}) AS (SELECT ${userColumnsSql} FROM "user") SELECT * FROM "w"
        `,
      );
    });

    it('should support all with options', () => {
      for (const { options: opts, sql } of selectedOptions) {
        const q = User.with('w', opts, User).from('w');

        assertType<Awaited<typeof q>, UserRecord[]>();

        expectSql(q.toSQL(), sql);
      }
    });
  });

  it('should allow using one CTE in another', () => {
    const q = User.with('a', () => User.where({ id: 1 }))
      .with('b', (q) => q.from('a').where({ name: 'name' }))
      .from('b')
      .where({ active: true });

    assertType<Awaited<typeof q>, UserRecord[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "a" AS (
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" = $1
        ), "b" AS (
          SELECT * FROM "a"
          WHERE "a"."name" = $2
        )
        SELECT * FROM "b"
        WHERE "b"."active" = $3
      `,
      [1, 'name', true],
    );
  });
});

describe('withRecursive', () => {
  it('should work with custom sql statements', () => {
    const q = User.withRecursive(
      't',
      { union: 'UNION' },
      (q) => q.select({ n: () => sql`1`.type((t) => t.integer()) }),
      (q) =>
        q
          .from('t')
          .select({ n: () => sql<number>`n + 1` })
          .where({ n: { lt: 100 } }),
    )
      .from('t')
      .where({ n: { gt: 10 } });

    assertType<Awaited<typeof q>, { n: number }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH RECURSIVE "t" AS (
          (
            SELECT 1 "n"
          )  
          UNION
          (
            SELECT n + 1 "n"
            FROM "t"
            WHERE "t"."n" < $1
          )
        )
        SELECT * FROM "t"
        WHERE "t"."n" > $2
      `,
      [100, 10],
    );
  });

  it('should work with queries', () => {
    const q = Profile.withRecursive(
      'rec',
      Profile.select('id', 'userId').find(1),
      (q) =>
        q
          .from(Profile)
          .select('id', 'userId')
          .join('rec', 'rec.id', 'profile.userId'),
    ).from('rec');

    expectSql(
      q.toSQL(),
      `
        WITH RECURSIVE "rec" AS (
          (
            SELECT "profile"."id", "profile"."user_id" "userId"
            FROM "profile"
            WHERE "profile"."id" = $1
            LIMIT 1
          )  
          UNION ALL
          (
            SELECT "profile"."id", "profile"."userId"
            FROM (SELECT ${profileColumnsSql} FROM "profile") "profile"
            JOIN "rec" ON "rec"."id" = "profile"."userId"
          )
        )
        SELECT * FROM "rec"
      `,
      [1],
    );
  });
});

describe('withSql', () => {
  it('should use raw sql', () => {
    const q = User.withSql(
      'w',
      (t) => ({
        one: t.integer(),
        two: t.text(),
      }),
      () => sql`(VALUES (1, 'two')) t(one, two)`,
    ).from('w');

    assertType<Awaited<typeof q>, { one: number; two: string }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS ((VALUES (1, 'two')) t(one, two)) SELECT * FROM "w"
      `,
    );
  });

  it('should support all with options', () => {
    for (const { options: opts, sql: s } of selectAllOptions) {
      const q = User.withSql(
        'w',
        opts,
        () => ({}),
        () => sql`SELECT * FROM "user"`,
      ).from('w');

      expectSql(q.toSQL(), s);
    }
  });

  it('should work in join', () => {
    const q = User.withSql(
      'test',
      (t) => ({ id: t.integer() }),
      () => sql`select 1 as id`,
    )
      .join('test')
      .select('test.id');

    expectSql(
      q.toSQL(),
      `
        WITH "test" AS (select 1 as id)
        SELECT "test"."id"
        FROM "user"
        JOIN "test" ON true
      `,
    );
  });
});
