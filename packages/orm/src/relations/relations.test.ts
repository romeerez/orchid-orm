import { db } from '../test-utils/test-db';
import {
  chatData,
  expectSql,
  messageData,
  userData,
  useTestDatabase,
} from '../test-utils/test-utils';

describe('relations', () => {
  useTestDatabase();

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

  it('should handle sub query pluck', async () => {
    const chatId = await db.chat.get('id').create(chatData);
    const authorId = await db.user.get('id').create(userData);
    const data = {
      chatId,
      authorId,
      ...messageData,
    };
    const ids = await db.message.pluck('id').createMany([data, data]);

    const query = db.user
      .select({
        ids: (q) => q.messages.pluck('id'),
        dates: (q) => q.messages.pluck('createdAt'),
      })
      .take();

    const result = await query;
    expect(result).toEqual({
      ids,
      dates: [expect.any(Date), expect.any(Date)],
    });
  });

  it('should handle sub query pluck with empty results', async () => {
    await db.user.count().create(userData);

    const query = db.user
      .select({
        ids: (q) => q.messages.pluck('id'),
      })
      .take();

    const result = await query;
    expect(result).toEqual({ ids: [] });
  });
});
