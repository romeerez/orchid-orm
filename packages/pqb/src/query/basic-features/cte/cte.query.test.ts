import {
  expectSql,
  assertType,
  sql,
  useTestDatabase,
  db,
  Profile,
  ProfileSelectAll,
  UserData,
  UserDefaultSelect,
  UserSelectAll,
} from 'test-utils';
import { CteOptions } from './cte.sql';

const makeOptions = (
  select: string,
  columns?: string[],
): { options: CteOptions; sql: string }[] => {
  const sqlColumns = columns
    ? `(${columns.map((column) => `"${column}"`).join(', ')})`
    : '';
  return [
    {
      options: { columns: ['id', 'name'] },
      sql: `WITH "w"${
        sqlColumns ? sqlColumns : `("id", "name")`
      } AS (SELECT ${select} FROM "schema"."user" "User") SELECT * FROM "w"`,
    },
    {
      options: { recursive: true },
      sql: `WITH RECURSIVE "w"${sqlColumns} AS (SELECT ${select} FROM "schema"."user" "User") SELECT * FROM "w"`,
    },
    {
      options: { materialized: true },
      sql: `WITH "w"${sqlColumns} AS MATERIALIZED (SELECT ${select} FROM "schema"."user" "User") SELECT * FROM "w"`,
    },
    {
      options: { notMaterialized: true },
      sql: `WITH "w"${sqlColumns} AS NOT MATERIALIZED (SELECT ${select} FROM "schema"."user" "User") SELECT * FROM "w"`,
    },
  ];
};

const selectedOptions = makeOptions(UserSelectAll);

describe('cte', () => {
  useTestDatabase();

  it('should use a query, handle selection, parse values', async () => {
    const userId = await db.user.get('Id').insert(UserData);

    const q = db.user
      .with('w', db.user.select({ i: 'Id', u: 'updatedAt' }))
      .from('w');

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS (SELECT "User"."id" "i", "User"."updated_at" "u" FROM "schema"."user" "User") SELECT * FROM "w"
      `,
    );

    const res = await q;

    assertType<typeof res, { i: number; u: Date }[]>();

    expect(res).toEqual([{ i: userId, u: expect.any(Date) }]);
  });

  it('should use query builder callback', async () => {
    await db.user.insert(UserData);

    const q = db.user
      .with('w', (q) =>
        q.select({ one: () => sql`'1'`.type((t) => t.text().parse(parseInt)) }),
      )
      .from('w');

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS (SELECT '1' "one") SELECT * FROM "w"
      `,
    );

    const res = await q;

    assertType<Awaited<typeof q>, { one: number }[]>();

    expect(res).toEqual([{ one: 1 }]);
  });

  it('should work with join', () => {
    const q = db.user
      .with('w', db.user)
      .join('w', 'w.Id', 'User.Id')
      .select('w.Id');

    assertType<Awaited<typeof q>, { Id: number }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS (SELECT ${UserSelectAll} FROM "schema"."user" "User")
        SELECT "w"."Id" FROM "schema"."user" "User"
        JOIN "w" ON "w"."Id" = "User"."id"
      `,
    );
  });

  it('should work with join lateral', () => {
    const q = db.user
      .with('w', db.profile)
      .joinLateral('w', (q) => q.on('UserId', 'User.Id').where({ Bio: 'bio' }))
      .select('Name', 'w.*');

    assertType<Awaited<typeof q>, { Name: string; w: Profile }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "w" AS (SELECT ${ProfileSelectAll} FROM "schema"."profile" "Profile")
        SELECT "User"."name" "Name", row_to_json("w".*) "w"
        FROM "schema"."user" "User"
        JOIN LATERAL (
          SELECT *
          FROM "w"
          WHERE "w"."UserId" = "User"."id"
            AND "w"."Bio" = $1
        ) "w" ON true
      `,
      ['bio'],
    );
  });

  describe('options', () => {
    it('should support columns: true to list all columns', () => {
      const q = db.user.with('w', { columns: true }, db.user).from('w');

      assertType<Awaited<typeof q>, UserDefaultSelect[]>();

      expectSql(
        q.toSQL(),
        `
          WITH "w"(${Object.keys(db.user.shape)
            .map((c) => `"${c}"`)
            .join(
              ', ',
            )}) AS (SELECT ${UserSelectAll} FROM "schema"."user" "User") SELECT * FROM "w"
        `,
      );
    });

    it('should support all with options', () => {
      for (const { options: opts, sql } of selectedOptions) {
        const q = db.user.with('w', opts, db.user).from('w');

        assertType<Awaited<typeof q>, UserDefaultSelect[]>();

        expectSql(q.toSQL(), sql);
      }
    });
  });

  it('should allow using one CTE in another', () => {
    const q = db.user
      .with('a', () => db.user.where({ Id: 1 }))
      .with('b', (q) => q.from('a').where({ Name: 'name' }))
      .from('b')
      .where({ Active: true });

    assertType<Awaited<typeof q>, UserDefaultSelect[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "a" AS (
          SELECT ${UserSelectAll} FROM "schema"."user" "User"
          WHERE "User"."id" = $1
        ), "b" AS (
          SELECT * FROM "a"
          WHERE "a"."Name" = $2
        )
        SELECT * FROM "b"
        WHERE "b"."Active" = $3
      `,
      [1, 'name', true],
    );
  });

  it('should read a renamed union column through a second CTE', () => {
    const q = db.user
      .with('u', () =>
        db.user.select({ i: 'Id' }).unionAll(db.user.select({ i: 'Id' })),
      )
      .with('c', (q) => q.from('u').select({ renamed: 'u.i' }))
      .from('c');

    assertType<Awaited<typeof q>, { renamed: number }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "u" AS (
          (SELECT "User"."id" "i" FROM "schema"."user" "User")
          UNION ALL
          (SELECT "User"."id" "i" FROM "schema"."user" "User")
        ), "c" AS (
          SELECT "u"."i" "renamed" FROM "u"
        )
        SELECT * FROM "c"
      `,
    );
  });

  it('should parse columns of a union CTE by their selected keys', async () => {
    await db.user.insert(UserData);

    const res = await db.user
      .with('u', () =>
        db.user
          .select({ at: 'updatedAt' })
          .unionAll(db.user.select({ at: 'updatedAt' })),
      )
      .from('u');

    assertType<typeof res, { at: Date }[]>();

    expect(res).toEqual([{ at: expect.any(Date) }, { at: expect.any(Date) }]);
  });

  it('should expose RETURNING columns of a mutation chained after a union', () => {
    const q = db.user
      .with('d', () =>
        db.user
          .unionAll(db.user)
          .where({ Id: 1 })
          .delete()
          .select({ deletedAt: 'updatedAt' }),
      )
      .with('c', (q) => q.from('d').select({ renamed: 'd.deletedAt' }))
      .from('c');

    assertType<Awaited<typeof q>, { renamed: Date }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "d" AS (
          DELETE FROM "schema"."user" "User"
          WHERE "User"."id" = $1
          RETURNING "User"."updated_at" "deletedAt"
        ), "c" AS (
          SELECT "d"."deletedAt" "renamed" FROM "d"
        )
        SELECT * FROM "c"
      `,
      [1],
    );
  });
});

describe('withRecursive', () => {
  it('should work with custom sql statements', () => {
    const q = db.user
      .withRecursive(
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
    const q = db.profile
      .withRecursive('rec', db.profile.select('Id', 'UserId').find(1), (q) =>
        q
          .from(db.profile)
          .select('Id', 'UserId')
          .join('rec', 'rec.Id', 'Profile.UserId'),
      )
      .from('rec');

    expectSql(
      q.toSQL(),
      `
        WITH RECURSIVE "rec" AS (
          (
            SELECT "Profile"."id" "Id", "Profile"."user_id" "UserId"
            FROM "schema"."profile" "Profile"
            WHERE "Profile"."id" = $1
            LIMIT 1
          )  
          UNION ALL
          (
            SELECT "Profile"."Id", "Profile"."UserId"
            FROM (SELECT ${ProfileSelectAll} FROM "schema"."profile" "Profile") "Profile"
            JOIN "rec" ON "rec"."Id" = "Profile"."UserId"
          )
        )
        SELECT * FROM "rec"
      `,
      [1],
    );
  });
});

describe('withSql', () => {
  useTestDatabase();

  it('should use raw sql', async () => {
    const q = db.user
      .withSql(
        'w',
        (t) => ({
          one: t.text().parse(parseInt),
          two: t.text(),
        }),
        () => sql`(VALUES ('1', 'two'))`,
      )
      .from('w');

    expectSql(
      q.toSQL(),
      `
        WITH "w"("one", "two") AS ((VALUES ('1', 'two'))) SELECT * FROM "w"
      `,
    );

    const res = await q;

    assertType<typeof res, { one: number; two: string }[]>();

    expect(res).toEqual([{ one: 1, two: 'two' }]);
  });

  describe('named column', () => {
    const withNamed = () =>
      db.user.withSql(
        'w',
        (t) => ({
          authorId: t.name('author_id').text().parse(parseInt),
          points: t.integer(),
        }),
        () => sql`SELECT '1', 10`,
      );

    it('should reference a named column by its key', async () => {
      const q = withNamed()
        .from('w')
        .select('authorId', 'points')
        .where({ authorId: '1' });

      expectSql(
        q.toSQL(),
        `
          WITH "w"("authorId", "points") AS (SELECT '1', 10)
          SELECT "w"."authorId", "w"."points"
          FROM "w"
          WHERE "w"."authorId" = $1
        `,
        ['1'],
      );

      expect(await q).toEqual([{ authorId: 1, points: 10 }]);
    });

    it('should return and parse a named column by its key when selecting all', async () => {
      const res = await withNamed().from('w');

      expect(res).toEqual([{ authorId: 1, points: 10 }]);
    });

    it('should expose a named column by its key to another CTE', async () => {
      const res = await withNamed()
        .with('v', (q) => q.from('w'))
        .from('v')
        .select('authorId');

      expect(res).toEqual([{ authorId: 1 }]);
    });

    it('should not change the shape returned from the shape callback', () => {
      db.user.withSql(
        'w',
        () => db.user.shape,
        () => sql`SELECT * FROM "schema"."user"`,
      );

      expectSql(
        db.user.select('UserKey').toSQL(),
        `SELECT "User"."user_key" "UserKey" FROM "schema"."user" "User"`,
      );
    });
  });

  it('should support all with options', () => {
    for (const { options: opts, sql: s } of makeOptions('*', ['id', 'name'])) {
      const q = db.user
        .withSql(
          'w',
          opts,
          (t) => ({
            id: t.integer(),
            name: t.text(),
          }),
          () => sql`SELECT * FROM "schema"."user" "User"`,
        )
        .from('w');

      expectSql(q.toSQL(), s);
    }
  });

  it('should work in join', () => {
    const q = db.user
      .withSql(
        'test',
        (t) => ({ id: t.integer() }),
        () => sql`select 1 as id`,
      )
      .join('test')
      .select('test.id');

    expectSql(
      q.toSQL(),
      `
        WITH "test"("id") AS (select 1 as id)
        SELECT "test"."id"
        FROM "schema"."user" "User"
        JOIN "test" ON true
      `,
    );
  });
});
