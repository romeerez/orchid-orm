import { db } from '../test-utils/test-db';
import {
  AssertEqual,
  expectSql,
  insert,
  insertChat,
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

    await insert('chatUser', {
      id: 1,
      userId,
      chatId: chat1Id,
    });
    await insert('chatUser', {
      id: 2,
      userId,
      chatId: chat2Id,
    });

    const user = await db.user.find(userId).takeOrThrow();
    const query = db.user.chats(user);

    expectSql(
      query.toSql(),
      `
        SELECT "chats".* FROM "chat" AS "chats"
        WHERE EXISTS (
          SELECT 1 FROM "chatUser"
          WHERE "chatUser"."chatId" = "chats"."id"
            AND "chatUser"."userId" = $1
          LIMIT 1
        )
      `,
      [userId],
    );

    const messages = await query;

    expect(messages).toMatchObject([chatData, chatData]);
  });

  it('should have proper joinQuery', () => {
    expectSql(
      db.user.relations.chats.joinQuery.toSql(),
      `
        SELECT "chats".* FROM "chat" AS "chats"
        WHERE EXISTS (
          SELECT 1 FROM "chatUser"
          WHERE "chatUser"."chatId" = "chats"."id"
            AND "chatUser"."userId" = "user"."id"
          LIMIT 1
        )
      `,
    );
  });

  it('should be supported in whereExists', () => {
    expectSql(
      db.user.whereExists('chats').toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "chat" AS "chats"
          WHERE EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chatId" = "chats"."id"
              AND "chatUser"."userId" = "user"."id"
            LIMIT 1
          )
          LIMIT 1
        )
      `,
    );

    expectSql(
      db.user
        .whereExists('chats', (q) => q.where({ 'user.name': 'name' }))
        .toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "chat" AS "chats"
          WHERE EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chatId" = "chats"."id"
              AND "chatUser"."userId" = "user"."id"
            LIMIT 1
          )
            AND "user"."name" = $1
          LIMIT 1
        )
      `,
      ['name'],
    );
  });
});
