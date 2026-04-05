import { db, expectSql } from 'test-utils';

describe('deduplicating joins', () => {
  it('should dedupe relation joins when selecting different gets from the same relation', async () => {
    const q = db.user
      .select({
        one: (q) => q.profile.get('profile.Active'),
        two: (q) => q.profile.get('profile.Bio'),
      })
      .where({
        one: { gt: true },
        two: { startsWith: 'two' },
      });

    expectSql(
      q.toSQL(),
      `
        SELECT "one"."one" "one", "one"."two" "two"
        FROM "schema"."user"
        LEFT JOIN LATERAL (
          SELECT "profile"."active" "one", "profile"."bio" "two"
          FROM "schema"."profile"
          WHERE "profile"."user_id" = "user"."id" AND "profile"."profile_key" = "user"."user_key"
        ) "one" ON true
        WHERE "one"."one" > $1
          AND "two"."two" ILIKE $2 || '%'
      `,
      [true, 'two'],
    );
  });
});
