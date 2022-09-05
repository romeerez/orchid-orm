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
        SELECT "messages".* FROM "message" AS "messages"
        WHERE "messages"."authorId" = $1
      `,
      [userId],
    );

    const messages = await query;

    expect(messages).toMatchObject([messageData, messageData]);
  });

  it('should have proper joinQuery', () => {
    expectSql(
      db.user.relations.messages.joinQuery.toSql(),
      `
        SELECT "messages".* FROM "message" AS "messages"
        WHERE "messages"."authorId" = "user"."id"
      `,
    );
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

  it('should be supported in join', () => {
    const query = db.user
      .join('messages', (q) => q.where({ 'user.name': 'name' }))
      .select('name', 'messages.text');

    const eq: AssertEqual<
      Awaited<typeof query>,
      { name: string; text: string }[]
    > = true;
    expect(eq).toBe(true);

    expectSql(
      query.toSql(),
      `
        SELECT "user"."name", "messages"."text" FROM "user"
        JOIN "message" AS "messages"
          ON "messages"."authorId" = "user"."id"
          AND "user"."name" = $1
      `,
      ['name'],
    );
  });
});

describe('hasMany through', () => {
  it('should have method to query related data', async () => {
    const chatsQuery = db.chat.all();

    const eq: AssertEqual<
      typeof db.profile.chats,
      (params: { userId: number }) => typeof chatsQuery
    > = true;

    expect(eq).toBe(true);

    const query = db.profile.chats({ userId: 1 });
    expectSql(
      query.toSql(),
      `
        SELECT "chats".* FROM "chat" AS "chats"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chatId" = "chats"."id"
              AND "chatUser"."userId" = "user"."id"
            LIMIT 1
          )
          AND "user"."id" = $1
          LIMIT 1
        )
      `,
      [1],
    );
  });

  it('should have proper joinQuery', () => {
    expectSql(
      db.profile.relations.chats.joinQuery.toSql(),
      `
        SELECT "chats".* FROM "chat" AS "chats"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chatId" = "chats"."id"
              AND "chatUser"."userId" = "user"."id"
            LIMIT 1
          )
          AND "user"."id" = "profile"."userId"
          LIMIT 1
        )
      `,
    );
  });

  it('should be supported in whereExists', () => {
    expectSql(
      db.profile.whereExists('chats').toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "chat" AS "chats"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."chatId" = "chats"."id"
                AND "chatUser"."userId" = "user"."id"
              LIMIT 1
            )
            AND "user"."id" = "profile"."userId"
            LIMIT 1
          )
          LIMIT 1
        )
      `,
    );

    expectSql(
      db.profile
        .whereExists('chats', (q) => q.where({ 'profile.bio': 'bio' }))
        .toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "chat" AS "chats"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."chatId" = "chats"."id"
                AND "chatUser"."userId" = "user"."id"
              LIMIT 1
            )
            AND "user"."id" = "profile"."userId"
            LIMIT 1
          )
          AND "profile"."bio" = $1
          LIMIT 1
        )
      `,
      ['bio'],
    );
  });

  it('should be supported in join', () => {
    const query = db.profile
      .join('chats', (q) => q.where({ 'profile.bio': 'bio' }))
      .select('bio', 'chats.title');

    const eq: AssertEqual<
      Awaited<typeof query>,
      { bio: string | null; title: string }[]
    > = true;
    expect(eq).toBe(true);

    expectSql(
      query.toSql(),
      `
        SELECT "profile"."bio", "chats"."title" FROM "profile"
        JOIN "chat" AS "chats"
          ON EXISTS (
            SELECT 1 FROM "user"
            WHERE EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."chatId" = "chats"."id"
                AND "chatUser"."userId" = "user"."id"
              LIMIT 1
            )
            AND "user"."id" = "profile"."userId"
            LIMIT 1
          )
          AND "profile"."bio" = $1
      `,
      ['bio'],
    );
  });
});
