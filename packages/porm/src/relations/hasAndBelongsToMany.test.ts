import { db } from '../test-utils/test-db';
import {
  AssertEqual,
  expectSql,
  insertChat,
  insertMessage,
  insertUser,
  useTestDatabase,
} from '../test-utils/test-utils';

describe('hasAndBelongsToMany', () => {
  useTestDatabase();

  it('should have method to query related data', async () => {
    const chatsQuery = db.chat.all();

    const eq: AssertEqual<
      typeof db.user.chats,
      (params: { id: number }) => typeof chatsQuery
    > = true;

    expect(eq).toBe(true);

    const userId = await insertUser();

    const chatData = {
      title: 'title',
    };
    const chat1Id = await insertChat(chatData);
    const chat2Id = await insertChat(chatData);

    await insertMessage({
      authorId: userId,
      chatId: chat1Id,
      text: 'text',
      count: 2,
    });
    await insertMessage({
      authorId: userId,
      chatId: chat2Id,
      text: 'text',
    });

    const user = await db.user.find(userId).takeOrThrow();
    const query = db.user.chats(user);

    expectSql(
      query.toSql(),
      `
        SELECT "chat".* FROM "chat"
        WHERE EXISTS (
          SELECT 1 FROM "message"
          WHERE "message"."chatId" = "chat"."id"
            AND "message"."authorId" = $1
          LIMIT $2
        )
      `,
      [userId, 1],
    );

    const messages = await query;

    expect(messages).toMatchObject([chatData, chatData]);
  });
});
