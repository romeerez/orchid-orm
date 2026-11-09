import {
  db,
  expectSql,
  ProfileData,
  UserData,
  useTestDatabase,
} from 'test-utils';

describe('deduplicating joins', () => {
  useTestDatabase();

  it('should dedupe relation joins when selecting different gets from the same relation', async () => {
    await db.user.insert({
      ...UserData,
      profile: { create: { ...ProfileData, Active: true } },
    });

    const q = db.user
      .select({
        one: (q) => q.profile.getOptional('profile.Active'),
        two: (q) => q.profile.getOptional('profile.Bio'),
      })
      .where({
        one: { gte: true },
        two: { startsWith: 'bio' },
      });

    const res = await q;
    expect(res).toEqual([{ one: true, two: 'bio' }]);

    expectSql(
      q.toSQL(),
      `
        SELECT "one"."one" "one", "one"."two" "two"
        FROM "schema"."user" "User"
        LEFT JOIN LATERAL (
          SELECT array["profile"."active"] "one", array["profile"."bio"] "two"
          FROM "schema"."profile"
          WHERE "profile"."user_id" = "User"."id" AND "profile"."profile_key" = "User"."user_key"
        ) "one" ON true
        WHERE "one"."one"[1] >= $1
          AND "one"."two"[1] ILIKE $2 || '%'
      `,
      [true, 'bio'],
    );
  });

  it('should share relation aggregates only when their filter values match', async () => {
    await db.user.insert({
      ...UserData,
      posts: {
        create: [
          { Body: 'one', Active: true },
          { Body: 'two', Active: false },
          { Body: 'three', Active: true },
        ],
      },
    });

    const q = db.user.select({
      active: (q) => q.posts.where({ Active: true }).count(),
      inactive: (q) => q.posts.where({ Active: false }).count(),
      activeIds: (q) => q.posts.where({ Active: true }).count('Id'),
    });

    expectSql(
      q.toSQL(),
      `
        SELECT "active"."active" "active", "inactive"."inactive" "inactive",
          "active"."activeIds" "activeIds"
        FROM "schema"."user" "User"
        LEFT JOIN LATERAL (
          SELECT count(*) "active", count("posts"."id") "activeIds"
          FROM "schema"."post" "posts"
          WHERE "posts"."active" = $1
            AND "posts"."user_id" = "User"."id"
            AND "posts"."title" = "User"."user_key"
        ) "active" ON true
        LEFT JOIN LATERAL (
          SELECT count(*) "inactive"
          FROM "schema"."post" "posts"
          WHERE "posts"."active" = $2
            AND "posts"."user_id" = "User"."id"
            AND "posts"."title" = "User"."user_key"
        ) "inactive" ON true
      `,
      [true, false],
    );

    expect(await q).toEqual([{ active: 2, inactive: 1, activeIds: 2 }]);
  });

  it('should not share a join between selections whose nested whereExists filters differ', async () => {
    await db.user.insert({
      ...UserData,
      profile: { create: ProfileData },
    });

    const q = db.user.select({
      matching: (q) =>
        q.profile
          .whereExists((q) => q.user.as('owner').where({ Name: UserData.Name }))
          .getOptional('Bio'),
      missing: (q) =>
        q.profile
          .whereExists((q) => q.user.as('owner').where({ Name: 'other' }))
          .getOptional('Bio'),
    });

    expectSql(
      q.toSQL(),
      `
        SELECT "matching"."matching" "matching", "missing"."missing" "missing"
        FROM "schema"."user" "User"
        LEFT JOIN LATERAL (
          SELECT array["profile"."bio"] "matching"
          FROM "schema"."profile"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."user" "owner"
            WHERE "owner"."name" = $1
              AND "owner"."id" = "profile"."user_id"
              AND "owner"."user_key" = "profile"."profile_key"
          ) AND "profile"."user_id" = "User"."id"
            AND "profile"."profile_key" = "User"."user_key"
        ) "matching" ON true
        LEFT JOIN LATERAL (
          SELECT array["profile"."bio"] "missing"
          FROM "schema"."profile"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."user" "owner"
            WHERE "owner"."name" = $2
              AND "owner"."id" = "profile"."user_id"
              AND "owner"."user_key" = "profile"."profile_key"
          ) AND "profile"."user_id" = "User"."id"
            AND "profile"."profile_key" = "User"."user_key"
        ) "missing" ON true
      `,
      [UserData.Name, 'other'],
    );

    expect(await q).toEqual([
      { matching: ProfileData.Bio, missing: undefined },
    ]);
  });

  it.each([
    ['string', 'approved', 'rejected', 'approved'],
    ['number', 1, 2, 1],
    ['bigint', 1n, 2n, 1n],
    ['date', new Date(0), new Date(1), new Date(0)],
    ['buffer', Buffer.from('a'), Buffer.from('b'), Buffer.from('a')],
    ['array', [1, 2], [2, 1], [1, 2]],
    [
      'object',
      { nested: { a: 1 } },
      { nested: { a: 2 } },
      { nested: { a: 1 } },
    ],
    ['different types', new Date(0), new Date(0).toISOString(), new Date(0)],
  ])('should compare %s parameters by value', (_, first, second, third) => {
    const q = db.user.select({
      one: (q) => q.profile.whereSql`${first} IS NOT NULL`.count(),
      two: (q) => q.profile.whereSql`${second} IS NOT NULL`.count(),
      three: (q) => q.profile.whereSql`${third} IS NOT NULL`.count(),
    });

    expectSql(
      q.toSQL(),
      `
        SELECT "one"."one" "one", "two"."two" "two", "one"."three" "three"
        FROM "schema"."user" "User"
        LEFT JOIN LATERAL (
          SELECT count(*) "one", count(*) "three"
          FROM "schema"."profile"
          WHERE ($1 IS NOT NULL)
            AND "profile"."user_id" = "User"."id"
            AND "profile"."profile_key" = "User"."user_key"
        ) "one" ON true
        LEFT JOIN LATERAL (
          SELECT count(*) "two"
          FROM "schema"."profile"
          WHERE ($2 IS NOT NULL)
            AND "profile"."user_id" = "User"."id"
            AND "profile"."profile_key" = "User"."user_key"
        ) "two" ON true
      `,
      [first, second],
    );
  });
});
