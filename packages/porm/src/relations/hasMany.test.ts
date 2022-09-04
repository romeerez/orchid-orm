import { db } from '../test-utils/test-db';
import {
  AssertEqual,
  expectSql,
  insertChat,
  insertMessage,
  insertUser,
  useTestDatabase,
} from '../test-utils/test-utils';

describe('hasMany', () => {
  useTestDatabase();

  it('should have method to query related data', async () => {
    const messagesQuery = db.message.all();

    const eq: AssertEqual<
      typeof db.user.messages,
      (params: { id: number }) => typeof messagesQuery
    > = true;

    expect(eq).toBe(true);

    const userId = await insertUser();
    const chatId = await insertChat();

    const messageData = {
      authorId: userId,
      chatId,
      text: 'text',
    };
    await insertMessage({ ...messageData, count: 2 });

    const user = await db.user.find(userId).takeOrThrow();
    const query = db.user.messages(user);

    expectSql(
      query.toSql(),
      `
        SELECT "message".* FROM "message"
        WHERE "message"."authorId" = $1
      `,
      [userId],
    );

    const messages = await query;

    expect(messages).toMatchObject([messageData, messageData]);
  });

  it('should be supported in whereExists', () => {
    expectSql(
      db.user.whereExists('messages').toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "message" AS "messages"
          WHERE "messages"."authorId" = "user"."id"
          LIMIT 1
        )
      `,
    );

    expectSql(
      db.user
        .whereExists('messages', (q) => q.where({ 'user.name': 'name' }))
        .toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "message" AS "messages"
          WHERE "messages"."authorId" = "user"."id"
            AND "user"."name" = $1
          LIMIT 1
        )
      `,
      ['name'],
    );
  });
});
