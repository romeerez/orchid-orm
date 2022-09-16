import { db } from '../test-utils/test-db';
import {
  AssertEqual,
  chatData,
  expectSql,
  messageData,
  userData,
  useTestDatabase,
} from '../test-utils/test-utils';
import { RelationQuery } from 'pqb';
import { Chat, Message, User } from '../test-utils/test-models';

describe('hasMany', () => {
  useTestDatabase();

  describe('querying', () => {
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

      const { id: userId } = await db.user.select('id').insert(userData);
      const { id: chatId } = await db.chat.select('id').insert(chatData);

      await db.message.insert([
        { ...messageData, authorId: userId, chatId },
        { ...messageData, authorId: userId, chatId },
      ]);

      const user = await db.user.find(userId);
      const query = db.user.messages(user);

      expectSql(
        query.toSql(),
        `
        SELECT * FROM "message" AS "messages"
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
        SELECT * FROM "message" AS "messages"
        WHERE "messages"."authorId" = "user"."id"
      `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.user.whereExists('messages').toSql(),
        `
        SELECT * FROM "user"
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
        SELECT * FROM "user"
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

    describe('select', () => {
      it('should be selectable', () => {
        const query = db.user.select(
          'id',
          db.user.messages.where({ text: 'text' }),
        );

        const eq: AssertEqual<
          Awaited<typeof query>,
          { id: number; messages: Message[] }[]
        > = true;
        expect(eq).toBe(true);

        expectSql(
          query.toSql(),
          `
            SELECT
              "user"."id",
              (
                SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
                FROM (
                  SELECT * FROM "message" AS "messages"
                  WHERE "messages"."authorId" = "user"."id"
                    AND "messages"."text" = $1
                ) AS "t"
              ) AS "messages"
            FROM "user"
          `,
          ['text'],
        );
      });

      it('should be selectable by relation name', () => {
        const query = db.user.select('id', 'messages');

        const eq: AssertEqual<
          Awaited<typeof query>,
          { id: number; messages: Message[] }[]
        > = true;
        expect(eq).toBe(true);

        expectSql(
          query.toSql(),
          `
            SELECT
              "user"."id",
              (
                SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
                FROM (
                  SELECT * FROM "message" AS "messages"
                  WHERE "messages"."authorId" = "user"."id"
                ) AS "t"
              ) AS "messages"
            FROM "user"
          `,
        );
      });
    });

    it('should allow to select count', () => {
      const query = db.user.select('id', db.user.messages.count());

      const eq: AssertEqual<
        Awaited<typeof query>,
        { id: number; messages: number }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
          SELECT
            "user"."id",
            (
              SELECT count(*) FROM "message" AS "messages"
              WHERE "messages"."authorId" = "user"."id"
            ) AS "messages"
          FROM "user"
        `,
      );
    });

    it('should allow to select count with alias', () => {
      const query = db.user.select(
        'id',
        db.user.messages.count().as('messagesCount'),
      );

      const eq: AssertEqual<
        Awaited<typeof query>,
        { id: number; messagesCount: number }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
          SELECT
            "user"."id",
            (
              SELECT count(*) FROM "message" AS "messages"
              WHERE "messages"."authorId" = "user"."id"
            ) AS "messagesCount"
          FROM "user"
        `,
      );
    });
  });

  describe('insert', () => {
    const checkUser = (user: User, name: string) => {
      expect(user).toEqual({
        ...userData,
        id: user.id,
        name: name,
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
          ...messageData,
          id: messages[0].id,
          authorId: userId,
          text: text1,
          chatId,
          meta: null,
        },
        {
          ...messageData,
          id: messages[1].id,
          authorId: userId,
          text: text2,
          chatId,
          meta: null,
        },
      ]);
    };

    it('should support create', async () => {
      const { id: chatId } = await db.chat.select('id').insert(chatData);

      const user = await db.user.create({
        ...userData,
        name: 'user 1',
        messages: {
          create: [
            {
              ...messageData,
              text: 'message 1',
              chatId,
            },
            {
              ...messageData,
              text: 'message 2',
              chatId,
            },
          ],
        },
      });

      checkUser(user, 'user 1');

      const messages = await db.message.order('text');
      checkMessages({
        messages,
        userId: user.id,
        chatId,
        text1: 'message 1',
        text2: 'message 2',
      });
    });

    it('should support create many', async () => {
      const { id: chatId } = await db.chat.select('id').insert(chatData);

      const user = await db.user.create([
        {
          ...userData,
          name: 'user 1',
          messages: {
            create: [
              {
                ...messageData,
                text: 'message 1',
                chatId,
              },
              {
                ...messageData,
                text: 'message 2',
                chatId,
              },
            ],
          },
        },
        {
          ...userData,
          name: 'user 2',
          messages: {
            create: [
              {
                ...messageData,
                text: 'message 3',
                chatId,
              },
              {
                ...messageData,
                text: 'message 4',
                chatId,
              },
            ],
          },
        },
      ]);

      checkUser(user[0], 'user 1');
      checkUser(user[1], 'user 2');

      const messages = await db.message.order('text');
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

    it('should support connect', async () => {
      const { id: chatId } = await db.chat.select('id').insert(chatData);
      await db.message.insert([
        {
          ...messageData,
          chatId,
          user: { create: { ...userData, name: 'tmp' } },
          text: 'message 1',
        },
        {
          ...messageData,
          chatId,
          user: { connect: { name: 'tmp' } },
          text: 'message 2',
        },
      ]);

      const user = await db.user.create({
        ...userData,
        name: 'user 1',
        messages: {
          connect: [
            {
              text: 'message 1',
            },
            {
              text: 'message 2',
            },
          ],
        },
      });

      checkUser(user, 'user 1');

      const messages = await db.message.order('text');
      checkMessages({
        messages,
        userId: user.id,
        chatId,
        text1: 'message 1',
        text2: 'message 2',
      });
    });

    it('should support connect many', async () => {
      const { id: chatId } = await db.chat.select('id').insert(chatData);
      await db.message.insert([
        {
          ...messageData,
          chatId,
          user: { create: { ...userData, name: 'tmp' } },
          text: 'message 1',
        },
        {
          ...messageData,
          chatId,
          user: { connect: { name: 'tmp' } },
          text: 'message 2',
        },
        {
          ...messageData,
          chatId,
          user: { connect: { name: 'tmp' } },
          text: 'message 3',
        },
        {
          ...messageData,
          chatId,
          user: { connect: { name: 'tmp' } },
          text: 'message 4',
        },
      ]);

      const user = await db.user.create([
        {
          ...userData,
          name: 'user 1',
          messages: {
            connect: [
              {
                text: 'message 1',
              },
              {
                text: 'message 2',
              },
            ],
          },
        },
        {
          ...userData,
          name: 'user 2',
          messages: {
            connect: [
              {
                text: 'message 3',
              },
              {
                text: 'message 4',
              },
            ],
          },
        },
      ]);

      checkUser(user[0], 'user 1');
      checkUser(user[1], 'user 2');

      const messages = await db.message.order('text');
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

    it('should support connect or create', async () => {
      const { id: chatId } = await db.chat.select('id').insert(chatData);
      const { id: messageId } = await db.message.select('id').insert({
        ...messageData,
        chatId,
        user: { create: { ...userData, name: 'tmp' } },
        text: 'message 1',
      });

      const user = await db.user.create({
        ...userData,
        name: 'user 1',
        messages: {
          connectOrCreate: [
            {
              where: { text: 'message 1' },
              create: { ...messageData, chatId, text: 'message 1' },
            },
            {
              where: { text: 'message 2' },
              create: { ...messageData, chatId, text: 'message 2' },
            },
          ],
        },
      });

      checkUser(user, 'user 1');

      const messages = await db.message.order('text');
      expect(messages[0].id).toBe(messageId);

      checkMessages({
        messages,
        userId: user.id,
        chatId,
        text1: 'message 1',
        text2: 'message 2',
      });
    });

    it('should support connect or create many', async () => {
      const { id: chatId } = await db.chat.select('id').insert(chatData);
      const [{ id: message1Id }, { id: message4Id }] = await db.message
        .selectAll()
        .insert([
          {
            ...messageData,
            chatId,
            user: { create: { ...userData, name: 'tmp' } },
            text: 'message 1',
          },
          {
            ...messageData,
            chatId,
            user: { create: { ...userData, name: 'tmp' } },
            text: 'message 4',
          },
        ]);

      const users = await db.user.create([
        {
          ...userData,
          name: 'user 1',
          messages: {
            connectOrCreate: [
              {
                where: { text: 'message 1' },
                create: { ...messageData, chatId, text: 'message 1' },
              },
              {
                where: { text: 'message 2' },
                create: { ...messageData, chatId, text: 'message 2' },
              },
            ],
          },
        },
        {
          ...userData,
          name: 'user 2',
          messages: {
            connectOrCreate: [
              {
                where: { text: 'message 3' },
                create: { ...messageData, chatId, text: 'message 3' },
              },
              {
                where: { text: 'message 4' },
                create: { ...messageData, chatId, text: 'message 4' },
              },
            ],
          },
        },
      ]);

      checkUser(users[0], 'user 1');
      checkUser(users[1], 'user 2');

      const messages = await db.message.order('text');
      expect(messages[0].id).toBe(message1Id);
      expect(messages[3].id).toBe(message4Id);

      checkMessages({
        messages: messages.slice(0, 2),
        userId: users[0].id,
        chatId,
        text1: 'message 1',
        text2: 'message 2',
      });

      checkMessages({
        messages: messages.slice(2, 4),
        userId: users[1].id,
        chatId,
        text1: 'message 3',
        text2: 'message 4',
      });
    });
  });

  describe('update', () => {
    describe('disconnect', () => {
      it('should nullify foreignKey', async () => {
        const { id: chatId } = await db.chat
          .select('id')
          .insert({ ...chatData, title: 'chat 1' });
        const { id: userId } = await db.user.select('id').insert({
          ...userData,
          messages: {
            create: [
              { ...messageData, chatId: chatId, text: 'message 1' },
              { ...messageData, chatId: chatId, text: 'message 2' },
              { ...messageData, chatId: chatId, text: 'message 3' },
            ],
          },
        });

        await db.user.where({ id: userId }).update({
          messages: {
            disconnect: [{ text: 'message 1' }, { text: 'message 2' }],
          },
        });

        const messages = await db.message.order('text');
        expect(messages[0].authorId).toBe(null);
        expect(messages[1].authorId).toBe(null);
        expect(messages[2].authorId).toBe(userId);
      });
    });

    describe('set', () => {
      it('should nullify foreignKey of previous related record and set foreignKey to new related record', async () => {
        const { id: chatId } = await db.chat.select('id').insert(chatData);
        const { id } = await db.user.select('id').insert({
          ...userData,
          messages: {
            create: [
              { ...messageData, chatId, text: 'message 1' },
              { ...messageData, chatId, text: 'message 2' },
            ],
          },
        });

        await db.message.insert({ ...messageData, chatId, text: 'message 3' });

        await db.user.findBy({ id }).update({
          messages: {
            set: { text: { in: ['message 2', 'message 3'] } },
          },
        });

        const [message1, message2, message3] = await db.message.order({
          text: 'ASC',
        });

        expect(message1.authorId).toBe(null);
        expect(message2.authorId).toBe(id);
        expect(message3.authorId).toBe(id);
      });
    });

    describe('delete', () => {
      it('should delete related records', async () => {
        const { id: chatId } = await db.chat.select('id').insert(chatData);

        const { id } = await db.user.select('id').insert({
          ...userData,
          messages: {
            create: [
              { ...messageData, chatId, text: 'message 1' },
              { ...messageData, chatId, text: 'message 2' },
              { ...messageData, chatId, text: 'message 3' },
            ],
          },
        });

        await db.user.find(id).update({
          messages: { delete: [{ text: 'message 1' }, { text: 'message 2' }] },
        });

        expect(await db.message.count()).toBe(1);

        const messages = await db.user.messages({ id }).select('text');
        expect(messages).toEqual([{ text: 'message 3' }]);
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
        { userId: number | null },
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
        SELECT * FROM "chat" AS "chats"
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
        SELECT * FROM "chat" AS "chats"
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
        SELECT * FROM "profile"
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
        SELECT * FROM "profile"
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

  describe('select', () => {
    it('should be selectable', () => {
      const query = db.profile.select(
        'id',
        db.profile.chats.where({ title: 'title' }),
      );

      const eq: AssertEqual<
        Awaited<typeof query>,
        { id: number; chats: Chat[] }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
          SELECT
            "profile"."id",
            (
              SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
              FROM (
                SELECT *
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

    it('should be selectable by relation name', () => {
      const query = db.profile.select('id', 'chats');

      const eq: AssertEqual<
        Awaited<typeof query>,
        { id: number; chats: Chat[] }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
          SELECT
            "profile"."id",
            (
              SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
              FROM (
                SELECT *
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
              ) AS "t"
            ) AS "chats"
          FROM "profile"
        `,
        [],
      );
    });
  });

  it('should allow to select count', () => {
    const query = db.profile.select('id', db.profile.chats.count());

    const eq: AssertEqual<
      Awaited<typeof query>,
      { id: number; chats: number }[]
    > = true;
    expect(eq).toBe(true);

    expectSql(
      query.toSql(),
      `
        SELECT
          "profile"."id",
          (
            SELECT count(*)
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
          ) AS "chats"
        FROM "profile"
      `,
    );
  });

  it('should allow to select count with alias', () => {
    const query = db.profile.select(
      'id',
      db.profile.chats.count().as('chatsCount'),
    );

    const eq: AssertEqual<
      Awaited<typeof query>,
      { id: number; chatsCount: number }[]
    > = true;
    expect(eq).toBe(true);

    expectSql(
      query.toSql(),
      `
        SELECT
          "profile"."id",
          (
            SELECT count(*)
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
          ) AS "chatsCount"
        FROM "profile"
      `,
    );
  });
});
