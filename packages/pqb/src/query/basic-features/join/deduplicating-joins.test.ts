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
        FROM "schema"."user"
        LEFT JOIN LATERAL (
          SELECT array["profile"."active"] "one", array["profile"."bio"] "two"
          FROM "schema"."profile"
          WHERE "profile"."user_id" = "user"."id" AND "profile"."profile_key" = "user"."user_key"
        ) "one" ON true
        WHERE "one"."one"[1] >= $1
          AND "one"."two"[1] ILIKE $2 || '%'
      `,
      [true, 'bio'],
    );
  });
});
