import { db } from '../test-utils/test-db';
import {
  AssertEqual,
  expectSql,
  insertChat,
  insertMessage,
  insertUser,
  useTestDatabase,
} from '../test-utils/test-utils';
import { RelationQuery } from 'pqb';
import { Message, User } from '../test-utils/test-models';

describe('hasMany', () => {
  useTestDatabase();

  it('should have method to query related data', async () => {
    const messagesQuery = db.message.all();

    const eq: AssertEqual<
      typeof db.user.messages,
      RelationQuery<
        'messages',
        { id: number },
        'authorId',
        typeof messagesQuery,
        false
      >
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

  it('should have insert with defaults of provided id', () => {
    const user = { id: 1 };
    const now = new Date();
    const query = db.user.messages(user).insert({
      chatId: 2,
      text: 'text',
      updatedAt: now,
      createdAt: now,
    });

    expectSql(
      query.toSql(),
      `
        INSERT INTO "message"("authorId", "chatId", "text", "updatedAt", "createdAt")
        VALUES ($1, $2, $3, $4, $5)
      `,
      [1, 2, 'text', now, now],
    );
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

  it('should be selectable', () => {
    const query = db.user.select(
      'id',
      db.user.messages.where({ text: 'text' }),
    );
    expectSql(
      query.toSql(),
      `
        SELECT
          "user"."id",
          (
            SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
            FROM (
              SELECT "messages".* FROM "message" AS "messages"
              WHERE "messages"."authorId" = "user"."id"
                AND "messages"."text" = $1
            ) AS "t"
          ) AS "messages"
        FROM "user"
      `,
      ['text'],
    );
  });

  describe('insert', () => {
    const now = new Date();
    const userData = {
      password: 'password',
      updatedAt: now,
      createdAt: now,
    };

    const messageData = {
      meta: null,
      updatedAt: now,
      createdAt: now,
    };

    const chatData = {
      title: 'title',
      updatedAt: now,
      createdAt: now,
    };

    const checkUser = (user: User, name: string) => {
      expect(user).toEqual({
        id: user.id,
        name: name,
        ...userData,
        active: null,
        age: null,
        data: null,
        picture: null,
      });
    };

    const checkMessages = ({
      messages,
      userId,
      chatId,
      text1,
      text2,
    }: {
      messages: Message[];
      userId: number;
      chatId: number;
      text1: string;
      text2: string;
    }) => {
      expect(messages).toEqual([
        {
          id: messages[0].id,
          authorId: userId,
          ...messageData,
          text: text1,
          chatId,
        },
        {
          id: messages[1].id,
          authorId: userId,
          ...messageData,
          text: text2,
          chatId,
        },
      ]);
    };

    it('should support create', async () => {
      const { id: chatId } = await db.chat.insert(chatData, ['id']);

      const user = await db.user.insert(
        {
          name: 'user 1',
          ...userData,
          messages: {
            create: [
              {
                text: 'message 1',
                ...messageData,
                chatId,
              },
              {
                text: 'message 2',
                ...messageData,
                chatId,
              },
            ],
          },
        },
        '*',
      );

      checkUser(user, 'user 1');

      const messages = await db.message.order({ text: 'ASC' });
      checkMessages({
        messages,
        userId: user.id,
        chatId,
        text1: 'message 1',
        text2: 'message 2',
      });
    });

    it('should support create many', async () => {
      const { id: chatId } = await db.chat.insert(chatData, ['id']);

      const user = await db.user.insert(
        [
          {
            name: 'user 1',
            ...userData,
            messages: {
              create: [
                {
                  text: 'message 1',
                  ...messageData,
                  chatId,
                },
                {
                  text: 'message 2',
                  ...messageData,
                  chatId,
                },
              ],
            },
          },
          {
            name: 'user 2',
            ...userData,
            messages: {
              create: [
                {
                  text: 'message 3',
                  ...messageData,
                  chatId,
                },
                {
                  text: 'message 4',
                  ...messageData,
                  chatId,
                },
              ],
            },
          },
        ],
        '*',
      );

      checkUser(user[0], 'user 1');
      checkUser(user[1], 'user 2');

      const messages = await db.message.order({ text: 'ASC' });
      checkMessages({
        messages: messages.slice(0, 2),
        userId: user[0].id,
        chatId,
        text1: 'message 1',
        text2: 'message 2',
      });

      checkMessages({
        messages: messages.slice(2, 4),
        userId: user[1].id,
        chatId,
        text1: 'message 3',
        text2: 'message 4',
      });
    });
  });
});

describe('hasMany through', () => {
  it('should have method to query related data', async () => {
    const chatsQuery = db.chat.all();

    const eq: AssertEqual<
      typeof db.profile.chats,
      RelationQuery<
        'chats',
        { userId: number },
        never,
        typeof chatsQuery,
        false
      >
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

  it('should be selectable', () => {
    const query = db.profile.select(
      'id',
      db.profile.chats.where({ title: 'title' }),
    );
    expectSql(
      query.toSql(),
      `
        SELECT
          "profile"."id",
          (
            SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
            FROM (
              SELECT "chats".*
              FROM "chat" AS "chats"
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
                AND "chats"."title" = $1
            ) AS "t"
          ) AS "chats"
        FROM "profile"
      `,
      ['title'],
    );
  });
});
