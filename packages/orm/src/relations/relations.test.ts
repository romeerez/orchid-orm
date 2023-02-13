import { db } from '../test-utils/test-db';
import {
  assertType,
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

  it('should support sub queries inside `from` with proper handling of type, where operators, parsers', async () => {
    const chatId = await db.chat.get('id').create(chatData);
    const authorId = await db.user.get('id').create(userData);
    await db.message.count().create({ ...messageData, chatId, authorId });

    const q = db.user
      .from(
        db.user.select('createdAt', {
          alias: 'name',
          messagesCount: (q) => q.messages.count(),
        }),
      )
      .where({
        messagesCount: { gte: 1 },
      });

    assertType<
      Awaited<typeof q>,
      { createdAt: Date; alias: string; messagesCount: number }[]
    >();

    expectSql(
      q.toSql(),
      `SELECT * FROM (
        SELECT
          "user"."createdAt",
          "user"."name" AS "alias",
          (
            SELECT count(*)
            FROM "message" AS "messages"
            WHERE "messages"."authorId" = "user"."id"
          ) AS "messagesCount"
        FROM "user"
      ) AS "user"
      WHERE "user"."messagesCount" >= $1`,
      [1],
    );

    const result = await q;
    expect(result).toEqual([
      {
        createdAt: expect.any(Date),
        alias: 'name',
        messagesCount: 1,
      },
    ]);
  });
});
