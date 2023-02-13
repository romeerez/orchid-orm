import {
  assertType,
  chatData,
  expectSql,
  messageData,
  userData,
  useTestDatabase,
} from './test-utils/test-utils';
import { db } from './test-utils/test-db';

describe('orm', () => {
  useTestDatabase();

  it('should have method `$from` with proper handling of type, where operators, parsers', async () => {
    const chatId = await db.chat.get('id').create(chatData);
    const authorId = await db.user.get('id').create(userData);
    await db.message.count().create({ ...messageData, chatId, authorId });

    const q = db
      .$from(
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
