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
    const ChatId = await db.chat.get('Id').create(chatData);
    const AuthorId = await db.user.get('Id').create(userData);
    await db.message.count().create({ ...messageData, ChatId, AuthorId });

    const q = db
      .$from(
        db.user.select('createdAt', {
          alias: 'Name',
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
