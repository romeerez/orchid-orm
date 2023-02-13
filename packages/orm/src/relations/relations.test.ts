import { db } from '../test-utils/test-db';
import { expectSql } from '../test-utils/test-utils';

describe('relations', () => {
  it('should select multiple relations', () => {
    const query = db.user.select({
      profile: (q) => q.profile.where({ bio: 'bio' }),
      messages: (q) => q.messages.where({ text: 'text' }),
    });

    expectSql(
      query.toSql(),
      `
        SELECT
          (
            SELECT row_to_json("t".*)
            FROM (
              SELECT * FROM "profile"
              WHERE "profile"."bio" = $1
                AND "profile"."userId" = "user"."id"
              LIMIT $2
            ) AS "t"
          ) AS "profile",
          (
            SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
            FROM (
              SELECT * FROM "message" AS "messages"
              WHERE "messages"."text" = $3
                AND "messages"."authorId" = "user"."id"
            ) AS "t"
          ) AS "messages"
        FROM "user"
      `,
      ['bio', 1, 'text'],
    );
  });
});
