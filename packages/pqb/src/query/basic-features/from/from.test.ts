import {
  expectQueryNotMutated,
  messageData,
  profileData,
} from '../../../test-utils/pqb.test-utils';
import {
  assertType,
  ChatData,
  db,
  expectSql,
  ProfileData,
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

  describe('with columns', () => {
    useTestDatabase();

    const score = testDb
      .fromSql(
        (t) => ({
          userId: t.integer(),
          points: t.integer(),
          at: t.timestamp().asDate(),
        }),
        sql`SELECT user_id, points, at FROM (VALUES (1, 10, '2000-01-01T00:00:00Z'::timestamptz)) v(user_id, points, at)`,
      )
      .as('score');

    const scoreSql = `(SELECT user_id, points, at FROM (VALUES (1, 10, '2000-01-01T00:00:00Z'::timestamptz)) v(user_id, points, at)) "score"("userId", "points", "at")`;

    it('should name the SQL result columns by the declared columns, filter, order, and parse them', async () => {
      const q = score.where({ points: { gt: 5 } }).order({ points: 'DESC' });

      assertType<
        Awaited<typeof q>,
        { userId: number; points: number; at: Date }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT * FROM ${scoreSql}
          WHERE "score"."points" > $1
          ORDER BY "score"."points" DESC
        `,
        [5],
      );

      expect(await q).toEqual([
        { userId: 1, points: 10, at: new Date('2000-01-01T00:00:00Z') },
      ]);

      // @ts-expect-error the column is not declared
      score.where({ user_id: 1 });
    });

    it('should ignore `name()` and quote the declared column names', async () => {
      const q = testDb
        .fromSql(
          (t) => ({ userId: t.name('user_id').integer(), 'a"b': t.integer() }),
          sql`SELECT 1, 2`,
        )
        .where({ userId: 1 })
        .select('userId', 'a"b');

      expectSql(
        q.toSQL(),
        `
          SELECT "t"."userId", "t"."a""b" FROM (SELECT 1, 2) "t"("userId", "a""b")
          WHERE "t"."userId" = $1
        `,
        [1],
      );

      expect(await q).toEqual([{ userId: 1, 'a"b': 2 }]);
    });

    it('should group by the declared columns when called on a table', async () => {
      // `UserKey` of the table is named `user_key`
      const q = db.user
        .fromSql((t) => ({ UserKey: t.text() }), sql`SELECT 'key'`)
        .select('UserKey', { count: (q) => q.count() })
        .group('UserKey');

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."UserKey", count(*) "count" FROM (SELECT 'key') "User"("UserKey")
          GROUP BY "User"."UserKey"
        `,
      );

      expect(await q).toEqual([{ UserKey: 'key', count: 1 }]);
    });

    it('should use the table name as the default alias', async () => {
      const q = db.user
        .fromSql((t) => ({ Id: t.text() }), sql`SELECT 'abc'`)
        .where({ 'User.Id': 'abc' });

      expectSql(
        q.toSQL(),
        `SELECT * FROM (SELECT 'abc') "User"("Id") WHERE "User"."Id" = $1`,
        ['abc'],
      );

      expect(await q).toEqual([{ Id: 'abc' }]);
    });

    it('should get a declared column by a qualified name when called on a table', async () => {
      // `Id` of the table is an integer, it has no `contains`
      const q = db.user
        .fromSql((t) => ({ Id: t.text() }), sql`SELECT 'abc'`)
        .as('s')
        .get('s.Id')
        .contains('b');

      expectSql(
        q.toSQL(),
        `SELECT "s"."Id" ILIKE '%' || $1 || '%' FROM (SELECT 'abc') "s"("Id") LIMIT 1`,
        ['b'],
      );

      expect(await q).toBe(true);
    });

    it('should not list columns when none are declared', async () => {
      const userId = await db.user.get('Id').insert(UserData);

      const q = db.user
        .whereExists(testDb.fromSql(() => ({}), sql`SELECT 1`))
        .pluck('Id');

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id" FROM "schema"."user" "User"
          WHERE EXISTS (SELECT 1 FROM (SELECT 1) "t")
        `,
      );

      expect(await q).toEqual([userId]);
    });

    it('should not be placed after `select`', () => {
      testDb
        .select({ one: sql`1`.type((t) => t.integer()) })
        // @ts-expect-error `select` must be placed after `fromSql`
        .fromSql((t) => ({ two: t.integer() }), sql`SELECT 2`);
    });

    it('should be joined', async () => {
      const userId = await db.user.get('Id').insert({ ...UserData, Id: 1 });

      const q = db.user
        .join(score, 'score.userId', 'Id')
        .select('Id', 'score.points', 'score.at');

      assertType<
        Awaited<typeof q>,
        { Id: number; points: number; at: Date }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id", "score"."points", "score"."at"
          FROM "schema"."user" "User"
          JOIN (SELECT * FROM ${scoreSql}) "score" ON "score"."userId" = "User"."id"
        `,
      );

      expect(await q).toEqual([
        { Id: userId, points: 10, at: new Date('2000-01-01T00:00:00Z') },
      ]);
    });

    it('should be used in `whereExists`', async () => {
      const userId = await db.user.get('Id').insert({ ...UserData, Id: 1 });

      const q = db.user
        .whereExists(score.where({ points: 10 }), 'score.userId', 'Id')
        .pluck('Id');

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id" FROM "schema"."user" "User"
          WHERE EXISTS (
            SELECT 1 FROM ${scoreSql}
            WHERE "score"."userId" = "User"."id" AND "score"."points" = $1
          )
        `,
        [10],
      );

      expect(await q).toEqual([userId]);
    });

    it('should use the declared columns instead of the table columns in `whereExists`', async () => {
      const profileId = await db.profile.get('Id').insert(ProfileData);

      // `UserKey` of the table is named `user_key`
      const keys = db.user
        .fromSql((t) => ({ UserKey: t.text() }), sql`SELECT 'key'`)
        .as('k');

      const q = db.profile
        .whereExists(keys, 'k.UserKey', 'ProfileKey')
        .whereExists(keys, (q) =>
          q.on('k.UserKey', 'Profile.ProfileKey').where({ UserKey: 'key' }),
        )
        .pluck('Id');

      expectSql(
        q.toSQL(),
        `
          SELECT "Profile"."id" "Id" FROM "schema"."profile" "Profile"
          WHERE EXISTS (
            SELECT 1 FROM (SELECT 'key') "k"("UserKey")
            WHERE "k"."UserKey" = "Profile"."profile_key"
          )
          AND EXISTS (
            SELECT 1 FROM (SELECT 'key') "k"("UserKey")
            WHERE "k"."UserKey" = "Profile"."profile_key" AND "k"."UserKey" = $1
          )
        `,
        ['key'],
      );

      expect(await q).toEqual([profileId]);
    });

    it('should be used in `whereIn`', async () => {
      const userId = await db.user.get('Id').insert({ ...UserData, Id: 1 });

      const q = db.user.whereIn('Id', score.pluck('userId')).pluck('Id');

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id" FROM "schema"."user" "User"
          WHERE "User"."id" IN (SELECT "score"."userId" FROM ${scoreSql})
        `,
      );

      expect(await q).toEqual([userId]);
    });

    it('should be selected as a sub-query', async () => {
      const userId = await db.user.get('Id').insert({ ...UserData, Id: 1 });

      const q = db.user.select('Id', {
        score: (q) => score.where({ userId: q.ref('Id') }).take(),
      });

      assertType<
        Awaited<typeof q>,
        { Id: number; score: { userId: number; points: number; at: Date } }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id", (
            SELECT row_to_json(t.*)
            FROM (
              SELECT * FROM ${scoreSql}
              WHERE "score"."userId" = "User"."id"
              LIMIT 1
            ) "t"
          ) "score"
          FROM "schema"."user" "User"
        `,
      );

      expect(await q).toEqual([
        {
          Id: userId,
          score: {
            userId: 1,
            points: 10,
            at: new Date('2000-01-01T00:00:00Z'),
          },
        },
      ]);
    });

    it('should select the declared columns as JSON when called on a table', async () => {
      const userId = await db.user.get('Id').insert(UserData);

      // the table has other columns, including a decimal that is cast for JSON
      const source = db.message
        .fromSql(
          (t) => ({ x: t.integer(), amount: t.decimal() }),
          sql`SELECT 1, 1.5`,
        )
        .as('m');

      const q = db.user.select('Id', { source: () => source.take() });

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id", (
            SELECT json_build_object('x', t."x", 'amount', t."amount"::text)
            FROM (SELECT * FROM (SELECT 1, 1.5) "m"("x", "amount") LIMIT 1) "t"
          ) "source"
          FROM "schema"."user" "User"
        `,
      );

      expect(await q).toEqual([
        { Id: userId, source: { x: 1, amount: '1.5' } },
      ]);
    });

    it('should select the columns of a later `from` as JSON', async () => {
      // beyond the precision of a JS number
      const decimal = '12345678901234567.123456789';

      const userId = await db.user.get('Id').insert(UserData);
      const messageId = await db.message.get('Id').insert({
        ...messageData,
        ChatId: await db.chat.get('IdOfChat').insert(ChatData),
        AuthorId: userId,
        Decimal: decimal,
      });

      // the table has columns that are not declared
      const declared = db.message.fromSql(
        (t) => ({ x: t.integer(), amount: t.decimal() }),
        sql`SELECT 1, 1.5`,
      );

      const one = declared.from(db.message.select('Id', 'Decimal'));
      const taken = one.take();
      assertType<
        Awaited<typeof taken>,
        { Id: number; Decimal: string | null }
      >();

      const q = db.user.select({ source: () => one.take() });

      expectSql(
        q.toSQL(),
        `
          SELECT (
            SELECT json_build_object('Id', t."Id", 'Decimal', t."Decimal"::text)
            FROM (
              SELECT * FROM (
                SELECT "Message"."id" "Id", "Message"."decimal" "Decimal"
                FROM "schema"."message" "Message"
                WHERE ("Message"."deleted_at" IS NULL)
              ) "Message"
              LIMIT 1
            ) "t"
          ) "source"
          FROM "schema"."user" "User"
        `,
      );

      expect(await q).toEqual([
        { source: { Id: messageId, Decimal: decimal } },
      ]);

      // the array form of `from` selects the columns of the table
      const several = db.user.select({
        source: () => declared.from([db.message]).take(),
      });

      expect(await several).toEqual([
        {
          source: expect.objectContaining({ Id: messageId, Decimal: decimal }),
        },
      ]);
    });
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
