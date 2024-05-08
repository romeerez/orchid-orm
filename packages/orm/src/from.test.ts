import { assertType, expectSql } from 'test-utils';
import {
  chatData,
  db,
  messageData,
  userData,
  useTestORM,
} from './test-utils/orm.test-utils';

describe('orm', () => {
  useTestORM();

  it('should have method `$from` with proper handling of type, where operators, parsers', async () => {
    const ChatId = await db.chat.get('IdOfChat').create(chatData);
    const AuthorId = await db.user.get('Id').create(userData);
    await db.message.insert({ ...messageData, ChatId, AuthorId });

    const inner = db.user.select('createdAt', {
      alias: 'Name',
      messagesCount: (q) => q.messages.count(),
    });

    const q = db.$from(inner).where({
      messagesCount: { gte: 1 },
    });

    assertType<
      Awaited<typeof q>,
      { createdAt: Date; alias: string; messagesCount: number }[]
    >();

    expectSql(
      q.toSQL(),
      `SELECT * FROM (
        SELECT
          "user"."createdAt",
          "user"."name" "alias",
          "messagesCount".r "messagesCount"
        FROM "user"
        LEFT JOIN LATERAL (
          SELECT count(*) r
          FROM "message" AS "messages"
          WHERE "messages"."authorId" = "user"."id"
            AND "messages"."messageKey" = "user"."userKey"
        ) "messagesCount" ON true
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
