import {
  db,
  expectSql,
  ProfileData,
  UserData,
  useTestDatabase,
} from 'test-utils';

describe('auto alias tables to prevent conflicts', () => {
  useTestDatabase();

  it('should alias tables in a recurrent select', async () => {
    await db.user.insert({
      ...UserData,
      profile: { create: ProfileData },
    });

    const q = db.profile
      .select({
        user: (q) =>
          q.user.select({
            profile: (q) => q.profile.get('Active'),
            bio: (q) => q.profile.get('Bio'),
          }),
      })
      .where({
        'user.profile': null,
        'user.bio': 'bio',
      });

    const res = await q;
    expect(res).toEqual([{ user: { profile: null, bio: 'bio' } }]);

    expectSql(
      q.toSQL(),
      `
          SELECT row_to_json("user".*) "user"
          FROM "schema"."profile"
          LEFT JOIN LATERAL (
            SELECT "profile2"."profile" "profile", "profile2"."bio" "bio"
            FROM "schema"."user"
            LEFT JOIN LATERAL (
              SELECT array["profile2"."active"] "profile", array["profile2"."bio"] "bio"
              FROM "schema"."profile" "profile2"
              WHERE "profile2"."user_id" = "user"."id"
                AND "profile2"."profile_key" = "user"."user_key"
            ) "profile2" ON true
            WHERE "user"."id" = "profile"."user_id"
              AND "user"."user_key" = "profile"."profile_key"
          ) "user" ON true
          WHERE "user"."profile"[1] IS NULL AND "user"."bio"[1] = $1
        `,
      ['bio'],
    );
  });
});
