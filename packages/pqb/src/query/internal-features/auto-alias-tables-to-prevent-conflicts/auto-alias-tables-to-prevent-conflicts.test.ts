import { db, expectSql } from 'test-utils';

describe('auto alias tables to prevent conflicts', () => {
  it('should alias tables in a recurrent select', () => {
    const q = db.profile
      .select({
        user: (q) =>
          q.user.select({
            profile: (q) => q.profile.get('Active'),
            bio: (q) => q.profile.get('Bio'),
          }),
      })
      .where({
        'user.profile': true,
        'user.bio': 'bio',
      });

    expectSql(
      q.toSQL(),
      `
          SELECT row_to_json("user".*) "user"
          FROM "schema"."profile"
          LEFT JOIN LATERAL (
            SELECT "profile2"."profile" "profile", "profile2"."bio" "bio"
            FROM "schema"."user"
            LEFT JOIN LATERAL (
              SELECT "profile2"."active" "profile", "profile2"."bio" "bio"
              FROM "schema"."profile" "profile2"
              WHERE "profile2"."user_id" = "user"."id"
                AND "profile2"."profile_key" = "user"."user_key"
            ) "profile2" ON true
            WHERE "user"."id" = "profile"."user_id"
              AND "user"."user_key" = "profile"."profile_key"
          ) "user" ON true
          WHERE "user"."profile" = $1 AND "user"."bio" = $2
        `,
      [true, 'bio'],
    );
  });
});
