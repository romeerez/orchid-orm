import { RelationQuery } from 'pqb';
import {
  Chat,
  Message,
  BaseTable,
  Profile,
  User,
  db,
  useRelationCallback,
  messageData,
  chatData,
  userData,
  chatSelectAll,
  messageSelectAll,
  profileSelectAll,
  userSelectAll,
  useTestORM,
} from '../test-utils/test-utils';
import { orchidORM } from '../orm';
import { assertType, expectSql } from 'test-utils';

describe('hasMany', () => {
  useTestORM();

  describe('querying', () => {
    it('should have method to query related data', async () => {
      const messagesQuery = db.message.all();

      assertType<
        typeof db.user.messages,
        RelationQuery<
          'messages',
          { Id: number },
          'AuthorId',
          typeof messagesQuery,
          false,
          true,
          true
        >
      >();

      const userId = await db.user.get('Id').create(userData);
      const ChatId = await db.chat.get('IdOfChat').create(chatData);

      await db.message.createMany([
        { ...messageData, AuthorId: userId, ChatId },
        { ...messageData, AuthorId: userId, ChatId },
      ]);

      const user = await db.user.find(userId);
      const query = db.user.messages(user);

      expectSql(
        query.toSql(),
        `
        SELECT ${messageSelectAll} FROM "message" AS "messages"
        WHERE "messages"."authorId" = $1
      `,
        [userId],
      );

      const messages = await query;

      expect(messages).toMatchObject([messageData, messageData]);
    });

    it('should handle chained query', () => {
      const query = db.user
        .where({ Name: 'name' })
        .messages.where({ Text: 'text' });

      expectSql(
        query.toSql(),
        `
          SELECT ${messageSelectAll} FROM "message" AS "messages"
          WHERE EXISTS (
              SELECT 1 FROM "user"
              WHERE "user"."name" = $1
                AND "user"."id" = "messages"."authorId"
              LIMIT 1
            )
            AND "messages"."text" = $2
        `,
        ['name', 'text'],
      );
    });

    it('should have create with defaults of provided id', () => {
      const user = { Id: 1 };
      const query = db.user.messages(user).count().create({
        ChatId: 2,
        Text: 'text',
      });

      expectSql(
        query.toSql(),
        `
          INSERT INTO "message"("authorId", "chatId", "text")
          VALUES ($1, $2, $3)
        `,
        [1, 2, 'text'],
      );
    });

    describe('create based on a query', () => {
      it('should have create based on a query', () => {
        const query = db.chat.find(1).messages.create({
          Text: 'text',
        });

        expectSql(
          query.toSql(),
          `
            INSERT INTO "message"("chatId", "text")
            SELECT "chat"."idOfChat" AS "ChatId", $1
            FROM "chat"
            WHERE "chat"."idOfChat" = $2
            LIMIT 1
            RETURNING ${messageSelectAll}
          `,
          ['text', 1],
        );
      });

      it('should throw when the main query returns many records', async () => {
        await expect(
          async () =>
            await db.chat.messages.create({
              Text: 'text',
            }),
        ).rejects.toThrow(
          'Cannot create based on a query which returns multiple records',
        );
      });

      it('should throw when main record is not found', async () => {
        await expect(
          async () =>
            await db.chat.find(1).messages.create({
              Text: 'text',
            }),
        ).rejects.toThrow('Record is not found');
      });

      it('should not throw when searching with findOptional', async () => {
        await db.chat.findOptional(1).messages.takeOptional().create({
          Text: 'text',
        });
      });
    });

    it('should have chained delete', () => {
      const query = db.chat
        .where({ Title: 'title' })
        .messages.where({ Text: 'text' })
        .delete();

      expectSql(
        query.toSql(),
        `
          DELETE FROM "message" AS "messages"
          WHERE EXISTS (
              SELECT 1 FROM "chat"
              WHERE "chat"."title" = $1
                AND "chat"."idOfChat" = "messages"."chatId"
              LIMIT 1
            )
            AND "messages"."text" = $2
        `,
        ['title', 'text'],
      );
    });

    it('should have proper joinQuery', () => {
      expectSql(
        db.user.relations.messages
          .joinQuery(db.user.as('u'), db.message.as('m'))
          .toSql(),
        `
        SELECT ${messageSelectAll} FROM "message" AS "m"
        WHERE "m"."authorId" = "u"."id"
      `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.user.whereExists('messages').toSql(),
        `
        SELECT ${userSelectAll} FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "message" AS "messages"
          WHERE "messages"."authorId" = "user"."id"
          LIMIT 1
        )
      `,
      );

      expectSql(
        db.user
          .as('u')
          .whereExists('messages', (q) => q.where({ Text: 'text' }))
          .toSql(),
        `
        SELECT ${userSelectAll} FROM "user" AS "u"
        WHERE EXISTS (
          SELECT 1 FROM "message" AS "messages"
          WHERE "messages"."authorId" = "u"."id"
            AND "messages"."text" = $1
          LIMIT 1
        )
      `,
        ['text'],
      );
    });

    it('should be supported in join', () => {
      const query = db.user
        .as('u')
        .join('messages', (q) => q.where({ Text: 'text' }))
        .select('Name', 'messages.Text');

      assertType<Awaited<typeof query>, { Name: string; Text: string }[]>();

      expectSql(
        query.toSql(),
        `
        SELECT "u"."name" AS "Name", "messages"."text" AS "Text"
        FROM "user" AS "u"
        JOIN "message" AS "messages"
          ON "messages"."authorId" = "u"."id"
          AND "messages"."text" = $1
      `,
        ['text'],
      );
    });

    it('should be supported in join with a callback', () => {
      const query = db.user
        .as('u')
        .join(
          (q) => q.messages.as('m').where({ ChatId: 123 }),
          (q) => q.where({ Text: 'text' }),
        )
        .select('Name', 'm.Text');

      assertType<Awaited<typeof query>, { Name: string; Text: string }[]>();

      expectSql(
        query.toSql(),
        `
        SELECT "u"."name" AS "Name", "m"."text" AS "Text"
        FROM "user" AS "u"
        JOIN "message" AS "m"
          ON "m"."text" = $1
         AND "m"."chatId" = $2
         AND "m"."authorId" = "u"."id"
      `,
        ['text', 123],
      );
    });

    it('should be supported in joinLateral', () => {
      const q = db.user
        .joinLateral('messages', (q) => q.as('m').where({ Text: 'one' }))
        .where({ 'm.Text': 'two' })
        .select('Name', { message: 'm.*' });

      assertType<Awaited<typeof q>, { Name: string; message: Message }[]>();

      expectSql(
        q.toSql(),
        `
          SELECT "user"."name" AS "Name", row_to_json("m".*) AS "message"
          FROM "user"
          JOIN LATERAL (
            SELECT ${messageSelectAll}
            FROM "message" AS "m"
            WHERE "m"."text" = $1 AND "m"."authorId" = "user"."id"
          ) "m" ON true
          WHERE "m"."Text" = $2
        `,
        ['one', 'two'],
      );
    });

    describe('select', () => {
      it('should be selectable', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);
        const AuthorId = await db.user.get('Id').create(userData);
        const messageId = await db.message.get('Id').create({
          ChatId,
          AuthorId,
          ...messageData,
        });

        const query = db.user.as('u').select('Id', {
          messages: (q) => q.messages.where({ Text: 'text' }),
        });

        const result = await query;
        expect(result).toEqual([
          {
            Id: AuthorId,
            messages: [
              {
                Id: messageId,
                AuthorId,
                ChatId,
                ...messageData,
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
              },
            ],
          },
        ]);

        assertType<
          Awaited<typeof query>,
          { Id: number; messages: Message[] }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "u"."id" AS "Id",
              COALESCE("messages".r, '[]') "messages"
            FROM "user" AS "u"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
              FROM (
                SELECT ${messageSelectAll}
                FROM "message" AS "messages"
                WHERE "messages"."text" = $1
                  AND "messages"."authorId" = "u"."id"
              ) AS "t"
            ) "messages" ON true
          `,
          ['text'],
        );
      });
    });

    it('should allow to select count', () => {
      const query = db.user.as('u').select('Id', {
        messagesCount: (q) => q.messages.count(),
      });

      assertType<
        Awaited<typeof query>,
        { Id: number; messagesCount: number }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT
            "u"."id" AS "Id",
            "messagesCount".r "messagesCount"
          FROM "user" AS "u"
          LEFT JOIN LATERAL (
            SELECT count(*) r
            FROM "message" AS "messages"
            WHERE "messages"."authorId" = "u"."id"
          ) "messagesCount" ON true
        `,
      );
    });

    it('should allow to pluck values', () => {
      const query = db.user.as('u').select('Id', {
        texts: (q) => q.messages.pluck('Text'),
      });

      assertType<Awaited<typeof query>, { Id: number; texts: string[] }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            "u"."id" AS "Id",
            COALESCE("texts".r, '[]') "texts"
          FROM "user" AS "u"
          LEFT JOIN LATERAL (
            SELECT json_agg("t"."Text") r
            FROM (
              SELECT "messages"."text" AS "Text"
              FROM "message" AS "messages"
              WHERE "messages"."authorId" = "u"."id"
            ) AS "t"
          ) "texts" ON true
        `,
      );
    });

    it('should handle exists sub query', () => {
      const query = db.user.as('u').select('Id', {
        hasMessages: (q) => q.messages.exists(),
      });

      assertType<
        Awaited<typeof query>,
        { Id: number; hasMessages: boolean }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT
            "u"."id" AS "Id",
            COALESCE("hasMessages".r, false) "hasMessages"
          FROM "user" AS "u"
          LEFT JOIN LATERAL (
            SELECT true r
            FROM "message" AS "messages"
            WHERE "messages"."authorId" = "u"."id"
            LIMIT 1
          ) "hasMessages" ON true
        `,
      );
    });

    it('should support recurring select', () => {
      const q = db.user.select({
        messages: (q) =>
          q.messages.select({
            user: (q) =>
              q.user.select({
                messages: (q) => q.messages,
              }),
          }),
      });

      expectSql(
        q.toSql(),
        `
          SELECT COALESCE("messages".r, '[]') "messages"
          FROM "user"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json("t".*)) r
            FROM (
              SELECT row_to_json("user2".*) "user"
              FROM "message" AS "messages"
              LEFT JOIN LATERAL (
                SELECT COALESCE("messages2".r, '[]') "messages"
                FROM "user"
                LEFT JOIN LATERAL (
                  SELECT json_agg(row_to_json("t".*)) r
                  FROM (
                    SELECT ${messageSelectAll}
                    FROM "message" AS "messages"
                    WHERE "messages"."authorId" = "user"."id"
                  ) AS "t"
                ) "messages2" ON true
                WHERE "user"."id" = "messages"."authorId"
              ) "user2" ON true
              WHERE "messages"."authorId" = "user"."id"
            ) AS "t"
          ) "messages" ON true
        `,
      );
    });
  });

  describe('create', () => {
    const checkUser = (user: User, Name: string) => {
      expect(user).toEqual({
        ...userData,
        Id: user.Id,
        Name,
        Active: null,
        Age: null,
        Data: null,
        Picture: null,
      });
    };

    const checkMessages = ({
      messages,
      UserId,
      ChatId,
      text1,
      text2,
    }: {
      messages: Message[];
      UserId: number;
      ChatId: number;
      text1: string;
      text2: string;
    }) => {
      expect(messages).toMatchObject([
        {
          Id: messages[0].Id,
          AuthorId: UserId,
          Text: text1,
          ChatId,
        },
        {
          Id: messages[1].Id,
          AuthorId: UserId,
          Text: text2,
          ChatId,
        },
      ]);
    };

    describe('nested create', () => {
      it('should support create', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);

        const user = await db.user.create({
          ...userData,
          Name: 'user 1',
          messages: {
            create: [
              {
                ...messageData,
                Text: 'message 1',
                ChatId,
              },
              {
                ...messageData,
                Text: 'message 2',
                ChatId,
              },
            ],
          },
        });

        checkUser(user, 'user 1');

        const messages = await db.message.order('Text');
        checkMessages({
          messages,
          UserId: user.Id,
          ChatId,
          text1: 'message 1',
          text2: 'message 2',
        });
      });

      it('should support create in batch create', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);

        const user = await db.user.createMany([
          {
            ...userData,
            Name: 'user 1',
            messages: {
              create: [
                {
                  ...messageData,
                  Text: 'message 1',
                  ChatId,
                },
                {
                  ...messageData,
                  Text: 'message 2',
                  ChatId,
                },
              ],
            },
          },
          {
            ...userData,
            Name: 'user 2',
            messages: {
              create: [
                {
                  ...messageData,
                  Text: 'message 3',
                  ChatId,
                },
                {
                  ...messageData,
                  Text: 'message 4',
                  ChatId,
                },
              ],
            },
          },
        ]);

        checkUser(user[0], 'user 1');
        checkUser(user[1], 'user 2');

        const messages = await db.message.order('Text');
        checkMessages({
          messages: messages.slice(0, 2),
          UserId: user[0].Id,
          ChatId,
          text1: 'message 1',
          text2: 'message 2',
        });

        checkMessages({
          messages: messages.slice(2, 4),
          UserId: user[1].Id,
          ChatId,
          text1: 'message 3',
          text2: 'message 4',
        });
      });

      it('should ignore empty create list', async () => {
        const user = await db.user.create({
          ...userData,
          Name: 'user 1',
          messages: {
            create: [],
          },
        });

        checkUser(user, 'user 1');
      });

      describe('relation callbacks', () => {
        const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
          db.user.relations.messages,
        );

        it('should invoke callbacks', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(chatData);

          await db.user.create({
            ...userData,
            messages: {
              create: [
                { ...messageData, ChatId },
                { ...messageData, ChatId },
              ],
            },
          });

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          const ChatId = await db.chat.get('IdOfChat').create(chatData);

          await db.user.createMany([
            {
              ...userData,
              messages: {
                create: [
                  { ...messageData, ChatId },
                  { ...messageData, ChatId },
                ],
              },
            },
            {
              ...userData,
              messages: {
                create: [
                  { ...messageData, ChatId },
                  { ...messageData, ChatId },
                ],
              },
            },
          ]);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('nested connect', () => {
      it('should support connect', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);
        await db.message.createMany([
          {
            ...messageData,
            ChatId,
            user: { create: { ...userData, Name: 'tmp' } },
            Text: 'message 1',
          },
          {
            ...messageData,
            ChatId,
            user: { connect: { Name: 'tmp' } },
            Text: 'message 2',
          },
        ]);

        const user = await db.user.create({
          ...userData,
          Name: 'user 1',
          messages: {
            connect: [
              {
                Text: 'message 1',
              },
              {
                Text: 'message 2',
              },
            ],
          },
        });

        checkUser(user, 'user 1');

        const messages = await db.message.order('Text');
        checkMessages({
          messages,
          UserId: user.Id,
          ChatId,
          text1: 'message 1',
          text2: 'message 2',
        });
      });

      it('should support connect in batch create', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);
        await db.message.createMany([
          {
            ...messageData,
            ChatId,
            user: { create: { ...userData, Name: 'tmp' } },
            Text: 'message 1',
          },
          {
            ...messageData,
            ChatId,
            user: { connect: { Name: 'tmp' } },
            Text: 'message 2',
          },
          {
            ...messageData,
            ChatId,
            user: { connect: { Name: 'tmp' } },
            Text: 'message 3',
          },
          {
            ...messageData,
            ChatId,
            user: { connect: { Name: 'tmp' } },
            Text: 'message 4',
          },
        ]);

        const user = await db.user.createMany([
          {
            ...userData,
            Name: 'user 1',
            messages: {
              connect: [
                {
                  Text: 'message 1',
                },
                {
                  Text: 'message 2',
                },
              ],
            },
          },
          {
            ...userData,
            Name: 'user 2',
            messages: {
              connect: [
                {
                  Text: 'message 3',
                },
                {
                  Text: 'message 4',
                },
              ],
            },
          },
        ]);

        checkUser(user[0], 'user 1');
        checkUser(user[1], 'user 2');

        const messages = await db.message.order('Text');
        checkMessages({
          messages: messages.slice(0, 2),
          UserId: user[0].Id,
          ChatId,
          text1: 'message 1',
          text2: 'message 2',
        });

        checkMessages({
          messages: messages.slice(2, 4),
          UserId: user[1].Id,
          ChatId,
          text1: 'message 3',
          text2: 'message 4',
        });
      });

      it('should ignore empty connect list', async () => {
        const user = await db.user.create({
          ...userData,
          Name: 'user 1',
          messages: {
            connect: [],
          },
        });

        checkUser(user, 'user 1');
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
          db.user.relations.messages,
        );

        it('should invoke callbacks', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const ids = await db.message.pluck('Id').createMany([
            { ...messageData, ChatId },
            { ...messageData, ChatId },
          ]);

          await db.user.create({
            ...userData,
            messages: {
              connect: [{ Id: ids[0] }, { Id: ids[1] }],
            },
          });

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch create', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(chatData);

          const ids = await db.message.pluck('Id').createMany([
            { ...messageData, ChatId },
            { ...messageData, ChatId },
            { ...messageData, ChatId },
            { ...messageData, ChatId },
          ]);

          resetMocks();

          await db.user.createMany([
            {
              ...userData,
              messages: {
                connect: [{ Id: ids[0] }, { Id: ids[1] }],
              },
            },
            {
              ...userData,
              messages: {
                connect: [{ Id: ids[2] }, { Id: ids[3] }],
              },
            },
          ]);

          expect(beforeUpdate).toHaveBeenCalledTimes(2);
          expect(afterUpdate).toHaveBeenCalledTimes(2);
        });
      });
    });

    describe('connectOrCreate', () => {
      it('should support connect or create', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);
        const messageId = await db.message.get('Id').create({
          ...messageData,
          ChatId,
          user: { create: { ...userData, Name: 'tmp' } },
          Text: 'message 1',
        });

        const user = await db.user.create({
          ...userData,
          Name: 'user 1',
          messages: {
            connectOrCreate: [
              {
                where: { Text: 'message 1' },
                create: { ...messageData, ChatId, Text: 'message 1' },
              },
              {
                where: { Text: 'message 2' },
                create: { ...messageData, ChatId, Text: 'message 2' },
              },
            ],
          },
        });

        checkUser(user, 'user 1');

        const messages = await db.message.order('Text');
        expect(messages[0].Id).toBe(messageId);

        checkMessages({
          messages,
          UserId: user.Id,
          ChatId,
          text1: 'message 1',
          text2: 'message 2',
        });
      });

      it('should support connect or create in batch create', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);
        const [{ Id: message1Id }, { Id: message4Id }] = await db.message
          .select('Id')
          .createMany([
            {
              ...messageData,
              ChatId,
              user: { create: { ...userData, Name: 'tmp' } },
              Text: 'message 1',
            },
            {
              ...messageData,
              ChatId,
              user: { create: { ...userData, Name: 'tmp' } },
              Text: 'message 4',
            },
          ]);

        const users = await db.user.createMany([
          {
            ...userData,
            Name: 'user 1',
            messages: {
              connectOrCreate: [
                {
                  where: { Text: 'message 1' },
                  create: { ...messageData, ChatId, Text: 'message 1' },
                },
                {
                  where: { Text: 'message 2' },
                  create: { ...messageData, ChatId, Text: 'message 2' },
                },
              ],
            },
          },
          {
            ...userData,
            Name: 'user 2',
            messages: {
              connectOrCreate: [
                {
                  where: { Text: 'message 3' },
                  create: { ...messageData, ChatId, Text: 'message 3' },
                },
                {
                  where: { Text: 'message 4' },
                  create: { ...messageData, ChatId, Text: 'message 4' },
                },
              ],
            },
          },
        ]);

        checkUser(users[0], 'user 1');
        checkUser(users[1], 'user 2');

        const messages = await db.message.order('Text');
        expect(messages[0].Id).toBe(message1Id);
        expect(messages[3].Id).toBe(message4Id);

        checkMessages({
          messages: messages.slice(0, 2),
          UserId: users[0].Id,
          ChatId,
          text1: 'message 1',
          text2: 'message 2',
        });

        checkMessages({
          messages: messages.slice(2, 4),
          UserId: users[1].Id,
          ChatId,
          text1: 'message 3',
          text2: 'message 4',
        });
      });

      it('should ignore empty connectOrCreate list', async () => {
        const user = await db.user.create({
          ...userData,
          Name: 'user 1',
          messages: {
            connectOrCreate: [],
          },
        });

        checkUser(user, 'user 1');
      });

      describe('relation callbacks', () => {
        const {
          beforeCreate,
          afterCreate,
          beforeUpdate,
          afterUpdate,
          resetMocks,
        } = useRelationCallback(db.user.relations.messages);

        it('should invoke callbacks when connecting', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const ids = await db.message.pluck('Id').createMany([
            { ...messageData, ChatId },
            { ...messageData, ChatId },
          ]);

          await db.user.create({
            ...userData,
            messages: {
              connectOrCreate: [
                {
                  where: { Id: ids[0] },
                  create: messageData,
                },
                {
                  where: { Id: ids[1] },
                  create: messageData,
                },
              ],
            },
          });

          expect(beforeUpdate).toHaveBeenCalledTimes(2);
          expect(afterUpdate).toHaveBeenCalledTimes(2);
        });

        it('should invoke callbacks when creating', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(chatData);

          resetMocks();

          await db.user.create({
            ...userData,
            messages: {
              connectOrCreate: [
                {
                  where: { Id: 0 },
                  create: { ...messageData, ChatId },
                },
                {
                  where: { Id: 0 },
                  create: { ...messageData, ChatId },
                },
              ],
            },
          });

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch create', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const ids = await db.message.pluck('Id').createMany([
            { ...messageData, ChatId },
            { ...messageData, ChatId },
          ]);

          resetMocks();

          await db.user.createMany([
            {
              ...userData,
              messages: {
                connectOrCreate: [
                  {
                    where: { Id: ids[0] },
                    create: { ...messageData, ChatId },
                  },
                  {
                    where: { Id: 0 },
                    create: { ...messageData, ChatId },
                  },
                ],
              },
            },
            {
              ...userData,
              messages: {
                connectOrCreate: [
                  {
                    where: { Id: ids[1] },
                    create: { ...messageData, ChatId },
                  },
                  {
                    where: { Id: 0 },
                    create: { ...messageData, ChatId },
                  },
                ],
              },
            },
          ]);

          expect(beforeUpdate).toHaveBeenCalledTimes(4);
          expect(afterUpdate).toHaveBeenCalledTimes(4);
          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('update', () => {
    describe('disconnect', () => {
      it('should nullify foreignKey', async () => {
        const ChatId = await db.chat
          .get('IdOfChat')
          .create({ ...chatData, Title: 'chat 1' });

        const UserId = await db.user.get('Id').create({
          ...userData,
          messages: {
            create: [
              { ...messageData, ChatId: ChatId, Text: 'message 1' },
              { ...messageData, ChatId: ChatId, Text: 'message 2' },
              { ...messageData, ChatId: ChatId, Text: 'message 3' },
            ],
          },
        });

        await db.user.find(UserId).update({
          messages: {
            disconnect: [{ Text: 'message 1' }, { Text: 'message 2' }],
          },
        });

        const messages = await db.message.order('Text');
        expect(messages[0].AuthorId).toBe(null);
        expect(messages[1].AuthorId).toBe(null);
        expect(messages[2].AuthorId).toBe(UserId);
      });

      it('should nullify foreignKey in batch update', async () => {
        const ChatId = await db.chat
          .get('IdOfChat')
          .create({ ...chatData, Title: 'chat 1' });

        const userIds = await db.user.pluck('Id').createMany([
          {
            ...userData,
            messages: {
              create: [{ ...messageData, ChatId: ChatId, Text: 'message 1' }],
            },
          },
          {
            ...userData,
            messages: {
              create: [
                { ...messageData, ChatId: ChatId, Text: 'message 2' },
                { ...messageData, ChatId: ChatId, Text: 'message 3' },
              ],
            },
          },
        ]);

        await db.user.where({ Id: { in: userIds } }).update({
          messages: {
            disconnect: [{ Text: 'message 1' }, { Text: 'message 2' }],
          },
        });

        const messages = await db.message.order('Text');
        expect(messages[0].AuthorId).toBe(null);
        expect(messages[1].AuthorId).toBe(null);
        expect(messages[2].AuthorId).toBe(userIds[1]);
      });

      it('should ignore empty disconnect list', async () => {
        const id = await db.user.get('Id').create(userData);

        await db.user.find(id).update({
          messages: {
            disconnect: [],
          },
        });
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
          db.user.relations.messages,
        );

        it('should invoke callbacks', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const UserId = await db.user.get('Id').create({
            ...userData,
            messages: {
              create: [
                {
                  ...messageData,
                  ChatId,
                  Text: 'message 1',
                },
                {
                  ...messageData,
                  ChatId,
                  Text: 'message 2',
                },
              ],
            },
          });

          await db.user.find(UserId).update({
            messages: {
              disconnect: [{ Text: 'message 1' }, { Text: 'message 2' }],
            },
          });

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch update', async () => {
          resetMocks();

          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const ids = await db.user.pluck('Id').createMany([
            {
              ...userData,
              messages: {
                create: [
                  {
                    ...messageData,
                    ChatId,
                    Text: 'message 1',
                  },
                  {
                    ...messageData,
                    ChatId,
                    Text: 'message 1',
                  },
                ],
              },
            },
            {
              ...userData,
              messages: {
                create: [
                  {
                    ...messageData,
                    ChatId,
                    Text: 'message 3',
                  },
                  {
                    ...messageData,
                    ChatId,
                    Text: 'message 4',
                  },
                ],
              },
            },
          ]);

          await db.user.where({ Id: { in: ids } }).update({
            messages: {
              disconnect: [{ Text: 'message 1' }, { Text: 'message 3' }],
            },
          });

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('set', () => {
      it('should nullify foreignKey of previous related record and set foreignKey to new related record', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);
        const id = await db.user.get('Id').create({
          ...userData,
          messages: {
            create: [
              { ...messageData, ChatId, Text: 'message 1' },
              { ...messageData, ChatId, Text: 'message 2' },
            ],
          },
        });

        await db.message.create({ ...messageData, ChatId, Text: 'message 3' });

        await db.user.find(id).update({
          messages: {
            set: { Text: { in: ['message 2', 'message 3'] } },
          },
        });

        const [message1, message2, message3] = await db.message.order({
          Text: 'ASC',
        });

        expect(message1.AuthorId).toBe(null);
        expect(message2.AuthorId).toBe(id);
        expect(message3.AuthorId).toBe(id);
      });

      it('should throw in batch update', async () => {
        const query = db.user.where({ Id: { in: [1, 2, 3] } }).update({
          messages: {
            // @ts-expect-error not allows in batch update
            set: { Text: { in: ['message 2', 'message 3'] } },
          },
        });

        await expect(query).rejects.toThrow();
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate } = useRelationCallback(
          db.user.relations.messages,
        );

        it('should invoke callbacks', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const id = await db.user.get('Id').create({
            ...userData,
            messages: {
              create: [
                { ...messageData, ChatId, Text: 'message 1' },
                { ...messageData, ChatId, Text: 'message 2' },
              ],
            },
          });

          await db.message.create({
            ...messageData,
            ChatId,
            Text: 'message 3',
          });

          await db.user.find(id).update({
            messages: {
              set: { Text: { in: ['message 2', 'message 3'] } },
            },
          });

          expect(beforeUpdate).toHaveBeenCalledTimes(2);
          expect(afterUpdate).toHaveBeenCalledTimes(2);
        });
      });
    });

    describe('delete', () => {
      it('should delete related records', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);

        const Id = await db.user.get('Id').create({
          ...userData,
          messages: {
            create: [
              { ...messageData, ChatId, Text: 'message 1' },
              { ...messageData, ChatId, Text: 'message 2' },
              { ...messageData, ChatId, Text: 'message 3' },
            ],
          },
        });

        await db.user.find(Id).update({
          messages: {
            delete: {
              Text: { in: ['message 1', 'message 2'] },
            },
          },
        });

        expect(await db.message.count()).toBe(1);

        const messages = await db.user.messages({ Id }).select('Text');
        expect(messages).toEqual([{ Text: 'message 3' }]);
      });

      it('should delete related records in batch update', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);

        const userIds = await db.user.pluck('Id').createMany([
          {
            ...userData,
            messages: {
              create: [{ ...messageData, ChatId, Text: 'message 1' }],
            },
          },
          {
            ...userData,
            messages: {
              create: [
                { ...messageData, ChatId, Text: 'message 2' },
                { ...messageData, ChatId, Text: 'message 3' },
              ],
            },
          },
        ]);

        await db.user.where({ Id: { in: userIds } }).update({
          messages: {
            delete: [{ Text: 'message 1' }, { Text: 'message 2' }],
          },
        });

        expect(await db.message.count()).toBe(1);

        const messages = await db.user
          .messages({ Id: userIds[1] })
          .select('Text');
        expect(messages).toEqual([{ Text: 'message 3' }]);
      });

      it('should ignore empty delete list', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);

        const Id = await db.user.get('Id').create({
          ...userData,
          messages: {
            create: [{ ...messageData, ChatId, Text: 'message 1' }],
          },
        });

        await db.user.find(Id).update({
          messages: {
            delete: [],
          },
        });

        const messages = await db.user.messages({ Id }).pluck('Text');
        expect(messages).toEqual(['message 1']);
      });

      describe('relation callbacks', () => {
        const { beforeDelete, afterDelete, resetMocks } = useRelationCallback(
          db.user.relations.messages,
        );

        it('should invoke callbacks', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const Id = await db.user.get('Id').create({
            ...userData,
            messages: {
              create: [
                { ...messageData, ChatId, Text: 'message 1' },
                { ...messageData, ChatId, Text: 'message 2' },
                { ...messageData, ChatId, Text: 'message 3' },
              ],
            },
          });

          await db.user.find(Id).update({
            messages: {
              delete: [{ Text: 'message 1' }, { Text: 'message 2' }],
            },
          });

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch delete', async () => {
          resetMocks();

          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const ids = await db.user.pluck('Id').createMany([
            {
              ...userData,
              messages: {
                create: [
                  { ...messageData, ChatId, Text: 'message 1' },
                  { ...messageData, ChatId, Text: 'message 2' },
                  { ...messageData, ChatId, Text: 'message 3' },
                ],
              },
            },
            {
              ...userData,
              messages: {
                create: [
                  { ...messageData, ChatId, Text: 'message 4' },
                  { ...messageData, ChatId, Text: 'message 5' },
                  { ...messageData, ChatId, Text: 'message 6' },
                ],
              },
            },
          ]);

          await db.user.where({ Id: { in: ids } }).update({
            messages: {
              delete: [
                { Text: 'message 1' },
                { Text: 'message 2' },
                { Text: 'message 4' },
                { Text: 'message 5' },
              ],
            },
          });

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('nested update', () => {
      it('should update related records', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);

        const Id = await db.user.get('Id').create({
          ...userData,
          messages: {
            create: [
              { ...messageData, ChatId, Text: 'message 1' },
              { ...messageData, ChatId, Text: 'message 2' },
              { ...messageData, ChatId, Text: 'message 3' },
            ],
          },
        });

        await db.user.find(Id).update({
          messages: {
            update: {
              where: {
                Text: { in: ['message 1', 'message 3'] },
              },
              data: {
                Text: 'updated',
              },
            },
          },
        });

        const messages = await db.user
          .messages({ Id })
          .order('Id')
          .pluck('Text');
        expect(messages).toEqual(['updated', 'message 2', 'updated']);
      });

      it('should update related records in batch update', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);

        const userIds = await db.user.pluck('Id').createMany([
          {
            ...userData,
            messages: {
              create: [{ ...messageData, ChatId, Text: 'message 1' }],
            },
          },
          {
            ...userData,
            messages: {
              create: [
                { ...messageData, ChatId, Text: 'message 2' },
                { ...messageData, ChatId, Text: 'message 3' },
              ],
            },
          },
        ]);

        await db.user.where({ Id: { in: userIds } }).update({
          messages: {
            update: {
              where: {
                Text: { in: ['message 1', 'message 3'] },
              },
              data: {
                Text: 'updated',
              },
            },
          },
        });

        const messages = await db.message.order('Id').pluck('Text');
        expect(messages).toEqual(['updated', 'message 2', 'updated']);
      });

      it('should ignore empty update where list', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);

        const Id = await db.user.get('Id').create({
          ...userData,
          messages: {
            create: [{ ...messageData, ChatId, Text: 'message 1' }],
          },
        });

        await db.user.find(Id).update({
          messages: {
            update: {
              where: [],
              data: {
                Text: 'updated',
              },
            },
          },
        });

        const messages = await db.user.messages({ Id }).pluck('Text');
        expect(messages).toEqual(['message 1']);
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
          db.user.relations.messages,
        );

        it('should invoke callbacks', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const Id = await db.user.get('Id').create({
            ...userData,
            messages: {
              create: [
                { ...messageData, ChatId, Text: 'message 1' },
                { ...messageData, ChatId, Text: 'message 2' },
                { ...messageData, ChatId, Text: 'message 3' },
              ],
            },
          });

          await db.user.find(Id).update({
            messages: {
              update: {
                where: [{ Text: 'message 1' }, { Text: 'message 2' }],
                data: {
                  Text: 'updated',
                },
              },
            },
          });

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch update', async () => {
          resetMocks();

          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const ids = await db.user.pluck('Id').createMany([
            {
              ...userData,
              messages: {
                create: [
                  { ...messageData, ChatId, Text: 'message 1' },
                  { ...messageData, ChatId, Text: 'message 2' },
                  { ...messageData, ChatId, Text: 'message 3' },
                ],
              },
            },
            {
              ...userData,
              messages: {
                create: [
                  { ...messageData, ChatId, Text: 'message 1' },
                  { ...messageData, ChatId, Text: 'message 2' },
                  { ...messageData, ChatId, Text: 'message 3' },
                ],
              },
            },
          ]);

          await db.user.where({ Id: { in: ids } }).update({
            messages: {
              update: {
                where: [
                  { Text: 'message 1' },
                  { Text: 'message 2' },
                  { Text: 'message 3' },
                  { Text: 'message 4' },
                ],
                data: {
                  Text: 'updated',
                },
              },
            },
          });

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('nested create', () => {
      it('should create new related records', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);
        const user = await db.user.create({ ...userData, Age: 1 });

        const updated = await db.user
          .select('Age')
          .find(user.Id)
          .increment('Age')
          .update({
            messages: {
              create: [
                { ...messageData, ChatId, Text: 'created 1' },
                { ...messageData, ChatId, Text: 'created 2' },
              ],
            },
          });

        expect(updated.Age).toBe(2);

        const texts = await db.user.messages(user).order('Text').pluck('Text');
        expect(texts).toEqual(['created 1', 'created 2']);
      });

      it('should throw in batch update', async () => {
        const query = db.user.where({ Id: { in: [1, 2, 3] } }).update({
          messages: {
            // @ts-expect-error not allows in batch update
            create: [{ ...messageData, ChatId: 1, Text: 'created 1' }],
          },
        });

        await expect(query).rejects.toThrow();
      });

      it('should ignore empty create list', async () => {
        const Id = await db.user.get('Id').create(userData);

        await db.user.find(Id).update({
          messages: {
            create: [],
          },
        });

        const messages = await db.user.messages({ Id });
        expect(messages.length).toEqual(0);
      });

      describe('relation callbacks', () => {
        const { beforeCreate, afterCreate } = useRelationCallback(
          db.user.relations.messages,
        );

        it('should invoke callbacks', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const Id = await db.user.get('Id').create({ ...userData, Age: 1 });

          await db.user.find(Id).update({
            messages: {
              create: [
                { ...messageData, ChatId, Text: 'created 1' },
                { ...messageData, ChatId, Text: 'created 2' },
              ],
            },
          });

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });
      });
    });
  });
});

describe('hasMany through', () => {
  it('should resolve recursive situation when both tables depends on each other', () => {
    class Post extends BaseTable {
      table = 'post';
      columns = this.setColumns((t) => ({
        Id: t.identity().primaryKey(),
      }));

      relations = {
        postTags: this.hasMany(() => PostTag, {
          primaryKey: 'Id',
          foreignKey: 'postId',
        }),

        tags: this.hasMany(() => Tag, {
          through: 'postTags',
          source: 'tag',
        }),
      };
    }

    class Tag extends BaseTable {
      table = 'tag';
      columns = this.setColumns((t) => ({
        Id: t.identity().primaryKey(),
      }));

      relations = {
        postTags: this.hasMany(() => PostTag, {
          primaryKey: 'Id',
          foreignKey: 'postId',
        }),

        posts: this.hasMany(() => Post, {
          through: 'postTags',
          source: 'post',
        }),
      };
    }

    class PostTag extends BaseTable {
      table = 'postTag';
      columns = this.setColumns((t) => ({
        postId: t.integer().foreignKey(() => Post, 'Id'),
        tagId: t.integer().foreignKey(() => Tag, 'Id'),
        ...t.primaryKey(['postId', 'tagId']),
      }));

      relations = {
        post: this.belongsTo(() => Post, {
          primaryKey: 'Id',
          foreignKey: 'postId',
        }),

        tag: this.belongsTo(() => Tag, {
          primaryKey: 'Id',
          foreignKey: 'tagId',
        }),
      };
    }

    const local = orchidORM(
      {
        db: db.$queryBuilder,
        log: false,
      },
      {
        post: Post,
        tag: Tag,
        postTag: PostTag,
      },
    );

    expect(Object.keys(local.post.relations)).toEqual(['postTags', 'tags']);
    expect(Object.keys(local.tag.relations)).toEqual(['postTags', 'posts']);
  });

  it('should throw if through relation is not defined', () => {
    class Post extends BaseTable {
      table = 'post';
      columns = this.setColumns((t) => ({
        Id: t.identity().primaryKey(),
      }));

      relations = {
        tags: this.hasMany(() => Tag, {
          through: 'postTags',
          source: 'tag',
        }),
      };
    }

    class Tag extends BaseTable {
      table = 'tag';
      columns = this.setColumns((t) => ({
        Id: t.identity().primaryKey(),
      }));
    }

    expect(() => {
      orchidORM(
        {
          db: db.$queryBuilder,
          log: false,
        },
        {
          post: Post,
          tag: Tag,
        },
      );
    }).toThrow(
      'Cannot define a `tags` relation on `post`: cannot find `postTags` relation required by the `through` option',
    );
  });

  it('should throw if source relation is not defined', () => {
    class Post extends BaseTable {
      table = 'post';
      columns = this.setColumns((t) => ({
        Id: t.identity().primaryKey(),
      }));

      relations = {
        postTags: this.hasMany(() => PostTag, {
          primaryKey: 'Id',
          foreignKey: 'postId',
        }),

        tags: this.hasMany(() => Tag, {
          through: 'postTags',
          source: 'tag',
        }),
      };
    }

    class Tag extends BaseTable {
      table = 'tag';
      columns = this.setColumns((t) => ({
        Id: t.identity().primaryKey(),
      }));
    }

    class PostTag extends BaseTable {
      table = 'postTag';
      columns = this.setColumns((t) => ({
        postId: t.integer().foreignKey(() => Post, 'Id'),
        tagId: t.integer().foreignKey(() => Tag, 'Id'),
        ...t.primaryKey(['postId', 'tagId']),
      }));
    }

    expect(() => {
      orchidORM(
        {
          db: db.$queryBuilder,
          log: false,
        },
        {
          post: Post,
          tag: Tag,
          postTag: PostTag,
        },
      );
    }).toThrow(
      'Cannot define a `tags` relation on `post`: cannot find `tag` relation in `postTag` required by the `source` option',
    );
  });

  describe('through hasMany', () => {
    it('should have method to query related data', async () => {
      const chatsQuery = db.chat.all();

      assertType<
        typeof db.profile.chats,
        RelationQuery<
          'chats',
          { UserId: number | null },
          never,
          typeof chatsQuery,
          false,
          false,
          true
        >
      >();

      const query = db.profile.chats({ UserId: 1 });
      expectSql(
        query.toSql(),
        `
        SELECT ${chatSelectAll} FROM "chat" AS "chats"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chatId" = "chats"."idOfChat"
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

    it('should handle chained query', () => {
      const query = db.profile
        .where({ Bio: 'bio' })
        .chats.where({ Title: 'title' });

      expectSql(
        query.toSql(),
        `
          SELECT ${chatSelectAll} FROM "chat" AS "chats"
          WHERE EXISTS (
            SELECT 1 FROM "profile"
            WHERE "profile"."bio" = $1
              AND EXISTS (
                SELECT 1 FROM "user"
                WHERE EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."chatId" = "chats"."idOfChat"
                      AND "chatUser"."userId" = "user"."id"
                    LIMIT 1
                  )
                  AND "user"."id" = "profile"."userId"
                LIMIT 1
              )
            LIMIT 1
          )
          AND "chats"."title" = $2
        `,
        ['bio', 'title'],
      );
    });

    it('should have disabled create method', () => {
      // @ts-expect-error hasMany with through option should not have chained create
      db.profile.chats.create(chatData);
    });

    describe('chained delete', () => {
      it('should have chained delete', () => {
        const query = db.profile
          .where({ Bio: 'bio' })
          .chats.where({ Title: 'title' })
          .delete();

        expectSql(
          query.toSql(),
          `
          DELETE FROM "chat" AS "chats"
          WHERE EXISTS (
              SELECT 1 FROM "profile"
              WHERE "profile"."bio" = $1
                AND EXISTS (
                  SELECT 1 FROM "user"
                  WHERE EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."chatId" = "chats"."idOfChat"
                        AND "chatUser"."userId" = "user"."id"
                      LIMIT 1
                    )
                    AND "user"."id" = "profile"."userId"
                  LIMIT 1
                )
              LIMIT 1
            )
            AND "chats"."title" = $2
        `,
          ['bio', 'title'],
        );
      });
    });

    it('should have proper joinQuery', () => {
      expectSql(
        db.profile.relations.chats
          .joinQuery(db.profile.as('p'), db.chat.as('c'))
          .toSql(),
        `
          SELECT ${chatSelectAll} FROM "chat" AS "c"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chatId" = "c"."idOfChat"
                  AND "chatUser"."userId" = "user"."id"
                LIMIT 1
              )
              AND "user"."id" = "p"."userId"
            LIMIT 1
          )
        `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.profile.whereExists('chats').toSql(),
        `
        SELECT ${profileSelectAll} FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "chat" AS "chats"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chatId" = "chats"."idOfChat"
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
          .as('p')
          .whereExists('chats', (q) => q.where({ Title: 'title' }))
          .toSql(),
        `
        SELECT ${profileSelectAll} FROM "profile" AS "p"
        WHERE EXISTS (
          SELECT 1 FROM "chat" AS "chats"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chatId" = "chats"."idOfChat"
                  AND "chatUser"."userId" = "user"."id"
                LIMIT 1
              )
              AND "user"."id" = "p"."userId"
            LIMIT 1
          )
          AND "chats"."title" = $1
          LIMIT 1
        )
      `,
        ['title'],
      );
    });

    it('should be supported in join', () => {
      const query = db.profile
        .as('p')
        .join('chats', (q) => q.where({ Title: 'title' }))
        .select('Bio', 'chats.Title');

      assertType<
        Awaited<typeof query>,
        { Bio: string | null; Title: string }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT "p"."bio" AS "Bio", "chats"."title" AS "Title"
          FROM "profile" AS "p"
          JOIN "chat" AS "chats"
            ON EXISTS (
              SELECT 1 FROM "user"
              WHERE EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chatId" = "chats"."idOfChat"
                    AND "chatUser"."userId" = "user"."id"
                  LIMIT 1
                )
                AND "user"."id" = "p"."userId"
              LIMIT 1
            )
            AND "chats"."title" = $1
        `,
        ['title'],
      );
    });

    it('should be supported in join with a callback', () => {
      const now = new Date();

      const query = db.profile
        .as('p')
        .join(
          (q) => q.chats.as('c').where({ updatedAt: now }),
          (q) => q.where({ Title: 'title' }),
        )
        .select('Bio', 'c.Title');

      assertType<
        Awaited<typeof query>,
        { Bio: string | null; Title: string }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT "p"."bio" AS "Bio", "c"."title" AS "Title"
          FROM "profile" AS "p"
          JOIN "chat" AS "c"
            ON "c"."title" = $1
            AND "c"."updatedAt" = $2
            AND EXISTS (
              SELECT 1 FROM "user"
              WHERE EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chatId" = "c"."idOfChat"
                    AND "chatUser"."userId" = "user"."id"
                  LIMIT 1
                )
                AND "user"."id" = "p"."userId"
              LIMIT 1
            )
        `,
        ['title', now],
      );
    });

    it('should be supported in joinLateral', () => {
      const q = db.profile
        .joinLateral('chats', (q) => q.as('c').where({ Title: 'one' }))
        .where({ 'c.Title': 'two' })
        .select('Bio', { chat: 'c.*' });

      assertType<Awaited<typeof q>, { Bio: string | null; chat: Chat }[]>();

      expectSql(
        q.toSql(),
        `
          SELECT "profile"."bio" AS "Bio", row_to_json("c".*) AS "chat"
          FROM "profile"
          JOIN LATERAL (
            SELECT ${chatSelectAll}
            FROM "chat" AS "c"
            WHERE "c"."title" = $1
              AND EXISTS (
                SELECT 1
                FROM "user"
                WHERE 
                  EXISTS (
                    SELECT 1
                    FROM "chatUser"
                    WHERE "chatUser"."chatId" = "c"."idOfChat"
                      AND "chatUser"."userId" = "user"."id"
                    LIMIT 1
                  )
                  AND "user"."id" = "profile"."userId"
                LIMIT 1
              )
          ) "c" ON true
          WHERE "c"."Title" = $2
        `,
        ['one', 'two'],
      );
    });

    describe('select', () => {
      it('should be selectable', () => {
        const query = db.profile.as('p').select('Id', {
          chats: (q) => q.chats.where({ Title: 'title' }),
        });

        assertType<Awaited<typeof query>, { Id: number; chats: Chat[] }[]>();

        expectSql(
          query.toSql(),
          `
            SELECT
              "p"."id" AS "Id",
              COALESCE("chats".r, '[]') "chats"
            FROM "profile" AS "p"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
              FROM (
                SELECT ${chatSelectAll}
                FROM "chat" AS "chats"
                WHERE "chats"."title" = $1
                  AND EXISTS (
                    SELECT 1 FROM "user"
                    WHERE EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."chatId" = "chats"."idOfChat"
                        AND "chatUser"."userId" = "user"."id"
                      LIMIT 1
                    )
                  AND "user"."id" = "p"."userId"
                  LIMIT 1
                )
              ) AS "t"  
            ) "chats" ON true
          `,
          ['title'],
        );
      });
    });

    it('should allow to select count', () => {
      const query = db.profile.as('p').select('Id', {
        chatsCount: (q) => q.chats.count(),
      });

      assertType<Awaited<typeof query>, { Id: number; chatsCount: number }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            "p"."id" AS "Id",
            "chatsCount".r "chatsCount"
          FROM "profile" AS "p"
          LEFT JOIN LATERAL (
            SELECT count(*) r
            FROM "chat" AS "chats"
            WHERE EXISTS (
              SELECT 1 FROM "user"
              WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chatId" = "chats"."idOfChat"
                  AND "chatUser"."userId" = "user"."id"
                LIMIT 1
              )
              AND "user"."id" = "p"."userId"
              LIMIT 1
            )
          ) "chatsCount" ON true
        `,
      );
    });

    it('should allow to pluck values', () => {
      const query = db.profile.as('p').select('Id', {
        titles: (q) => q.chats.pluck('Title'),
      });

      assertType<Awaited<typeof query>, { Id: number; titles: string[] }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            "p"."id" AS "Id",
            COALESCE("titles".r, '[]') "titles"
          FROM "profile" AS "p"
          LEFT JOIN LATERAL (
            SELECT json_agg("t"."Title") r
            FROM (
              SELECT "chats"."title" AS "Title"
              FROM "chat" AS "chats"
              WHERE EXISTS (
                SELECT 1 FROM "user"
                WHERE EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chatId" = "chats"."idOfChat"
                    AND "chatUser"."userId" = "user"."id"
                  LIMIT 1
                )
                AND "user"."id" = "p"."userId"
                LIMIT 1
              )
            ) AS "t"
          ) "titles" ON true
        `,
      );
    });

    it('should handle exists sub query', () => {
      const query = db.profile.as('p').select('Id', {
        hasChats: (q) => q.chats.exists(),
      });

      assertType<Awaited<typeof query>, { Id: number; hasChats: boolean }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            "p"."id" AS "Id",
            COALESCE("hasChats".r, false) "hasChats"
          FROM "profile" AS "p"
          LEFT JOIN LATERAL (
            SELECT true r
            FROM "chat" AS "chats"
            WHERE EXISTS (
                SELECT 1 FROM "user"
                WHERE EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chatId" = "chats"."idOfChat"
                    AND "chatUser"."userId" = "user"."id"
                  LIMIT 1
              )
              AND "user"."id" = "p"."userId"
              LIMIT 1
            )
            LIMIT 1
          ) "hasChats" ON true
        `,
      );
    });

    it('should support recurring select', () => {
      const q = db.profile.select({
        chats: (q) =>
          q.chats.select({
            profiles: (q) =>
              q.profiles.select({
                chats: (q) => q.chats,
              }),
          }),
      });

      expectSql(
        q.toSql(),
        `
          SELECT COALESCE("chats".r, '[]') "chats"
          FROM "profile"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json("t".*)) r
            FROM (
              SELECT COALESCE("profiles".r, '[]') "profiles"
              FROM "chat" AS "chats"
              LEFT JOIN LATERAL (
                SELECT json_agg(row_to_json("t".*)) r
                FROM (
                  SELECT COALESCE("chats2".r, '[]') "chats"
                  FROM "profile" AS "profiles"
                  LEFT JOIN LATERAL (
                    SELECT json_agg(row_to_json("t".*)) r
                    FROM (
                      SELECT ${chatSelectAll}
                      FROM "chat" AS "chats"
                      WHERE EXISTS (
                        SELECT 1
                        FROM "user"
                        WHERE EXISTS (
                            SELECT 1
                            FROM "chatUser"
                            WHERE "chatUser"."chatId" = "chats"."idOfChat"
                              AND "chatUser"."userId" = "user"."id"
                            LIMIT 1
                          )
                          AND "user"."id" = "profiles"."userId"
                        LIMIT 1
                      )
                    ) AS "t"
                  ) "chats2" ON true
                  WHERE EXISTS (
                    SELECT 1
                    FROM "user" AS "users"
                    WHERE "profiles"."userId" = "users"."id"
                      AND EXISTS (
                        SELECT 1
                        FROM "chatUser"
                        WHERE "chatUser"."userId" = "users"."id"
                          AND "chatUser"."chatId" = "chats"."idOfChat"
                        LIMIT 1
                      )
                    LIMIT 1
                  )
                ) AS "t"
              ) "profiles" ON true
              WHERE EXISTS (
                SELECT 1
                FROM "user"
                WHERE EXISTS (
                  SELECT 1
                  FROM "chatUser"
                  WHERE "chatUser"."chatId" = "chats"."idOfChat"
                    AND "chatUser"."userId" = "user"."id"
                  LIMIT 1
                ) AND "user"."id" = "profile"."userId"
                LIMIT 1
              )
            ) AS "t"
          ) "chats" ON true
        `,
      );
    });
  });

  describe('through hasOne', () => {
    it('should have method to query related data', () => {
      const profilesQuery = db.profile.all();

      assertType<
        typeof db.chat.profiles,
        RelationQuery<
          'profiles',
          { IdOfChat: number },
          never,
          typeof profilesQuery,
          false,
          false,
          true
        >
      >();

      const query = db.chat.profiles({ IdOfChat: 1 });
      expectSql(
        query.toSql(),
        `
          SELECT ${profileSelectAll} FROM "profile" AS "profiles"
          WHERE EXISTS (
            SELECT 1 FROM "user" AS "users"
            WHERE "profiles"."userId" = "users"."id"
            AND EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."userId" = "users"."id"
                AND "chatUser"."chatId" = $1
              LIMIT 1
            )
            LIMIT 1
          )
        `,
        [1],
      );
    });

    it('should handle chained query', () => {
      const query = db.chat
        .where({ Title: 'title' })
        .profiles.where({ Bio: 'bio' });

      expectSql(
        query.toSql(),
        `
          SELECT ${profileSelectAll} FROM "profile" AS "profiles"
          WHERE EXISTS (
            SELECT 1 FROM "chat"
            WHERE "chat"."title" = $1
              AND EXISTS (
                SELECT 1 FROM "user" AS "users"
                WHERE "profiles"."userId" = "users"."id"
                  AND EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."userId" = "users"."id"
                      AND "chatUser"."chatId" = "chat"."idOfChat"
                    LIMIT 1
                  )
                LIMIT 1
              )
            LIMIT 1
          )
          AND "profiles"."bio" = $2
        `,
        ['title', 'bio'],
      );
    });

    it('should have disabled create method', () => {
      // @ts-expect-error hasMany with through option should not have chained create
      db.chat.profiles.create(chatData);
    });

    it('should have chained delete', () => {
      const query = db.chat
        .where({ Title: 'title' })
        .profiles.where({ Bio: 'bio' })
        .delete();

      expectSql(
        query.toSql(),
        `
          DELETE FROM "profile" AS "profiles"
          WHERE EXISTS (
              SELECT 1 FROM "chat"
              WHERE "chat"."title" = $1
                AND EXISTS (
                  SELECT 1 FROM "user" AS "users"
                  WHERE "profiles"."userId" = "users"."id"
                    AND EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."userId" = "users"."id"
                        AND "chatUser"."chatId" = "chat"."idOfChat"
                      LIMIT 1
                    )
                  LIMIT 1
                )
              LIMIT 1
            )
            AND "profiles"."bio" = $2
        `,
        ['title', 'bio'],
      );
    });

    it('should have proper joinQuery', () => {
      expectSql(
        db.chat.relations.profiles
          .joinQuery(db.chat.as('c'), db.profile.as('p'))
          .toSql(),
        `
          SELECT ${profileSelectAll} FROM "profile" AS "p"
          WHERE EXISTS (
            SELECT 1 FROM "user" AS "users"
            WHERE "p"."userId" = "users"."id"
              AND EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."userId" = "users"."id"
                  AND "chatUser"."chatId" = "c"."idOfChat"
                LIMIT 1
              )
            LIMIT 1
          )
        `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.chat.whereExists('profiles').toSql(),
        `
          SELECT ${chatSelectAll} FROM "chat"
          WHERE EXISTS (
            SELECT 1 FROM "profile" AS "profiles"
            WHERE EXISTS (
              SELECT 1 FROM "user" AS "users"
              WHERE "profiles"."userId" = "users"."id"
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."userId" = "users"."id"
                    AND "chatUser"."chatId" = "chat"."idOfChat"
                  LIMIT 1
                )
              LIMIT 1
            )
            LIMIT 1
          )
        `,
      );

      expectSql(
        db.chat
          .as('c')
          .whereExists('profiles', (q) => q.where({ Bio: 'bio' }))
          .toSql(),
        `
          SELECT ${chatSelectAll} FROM "chat" AS "c"
          WHERE EXISTS (
            SELECT 1 FROM "profile" AS "profiles"
            WHERE EXISTS (
              SELECT 1 FROM "user" AS "users"
              WHERE "profiles"."userId" = "users"."id"
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."userId" = "users"."id"
                    AND "chatUser"."chatId" = "c"."idOfChat"
                  LIMIT 1
                )
              LIMIT 1
            )
            AND "profiles"."bio" = $1
            LIMIT 1
          )
        `,
        ['bio'],
      );
    });

    it('should be supported in join', () => {
      const query = db.chat
        .as('c')
        .join('profiles', (q) => q.where({ Bio: 'bio' }))
        .select('Title', 'profiles.Bio');

      assertType<
        Awaited<typeof query>,
        { Title: string; Bio: string | null }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT "c"."title" AS "Title", "profiles"."bio" AS "Bio"
          FROM "chat" AS "c"
          JOIN "profile" AS "profiles"
            ON EXISTS (
              SELECT 1 FROM "user" AS "users"
              WHERE "profiles"."userId" = "users"."id"
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."userId" = "users"."id"
                    AND "chatUser"."chatId" = "c"."idOfChat"
                  LIMIT 1
                )
              LIMIT 1
            )
            AND "profiles"."bio" = $1
        `,
        ['bio'],
      );
    });

    it('should be supported in join with a callback', () => {
      const query = db.chat
        .as('c')
        .join(
          (q) => q.profiles.as('p').where({ UserId: 123 }),
          (q) => q.where({ Bio: 'bio' }),
        )
        .select('Title', 'p.Bio');

      assertType<
        Awaited<typeof query>,
        { Title: string; Bio: string | null }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT "c"."title" AS "Title", "p"."bio" AS "Bio"
          FROM "chat" AS "c"
          JOIN "profile" AS "p"
            ON "p"."bio" = $1
            AND "p"."userId" = $2
            AND EXISTS (
              SELECT 1 FROM "user" AS "users"
              WHERE "p"."userId" = "users"."id"
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."userId" = "users"."id"
                    AND "chatUser"."chatId" = "c"."idOfChat"
                  LIMIT 1
                )
              LIMIT 1
            )
        `,
        ['bio', 123],
      );
    });

    it('should be supported in joinLateral', () => {
      const q = db.chat
        .joinLateral('profiles', (q) => q.as('p').where({ Bio: 'one' }))
        .where({ 'p.Bio': 'two' })
        .select('Title', { profile: 'p.*' });

      assertType<Awaited<typeof q>, { Title: string; profile: Profile }[]>();

      expectSql(
        q.toSql(),
        `
          SELECT "chat"."title" AS "Title", row_to_json("p".*) AS "profile"
          FROM "chat"
          JOIN LATERAL (
            SELECT ${profileSelectAll}
            FROM "profile" AS "p"
            WHERE "p"."bio" = $1
              AND EXISTS (
                SELECT 1
                FROM "user" AS "users"
                WHERE "p"."userId" = "users"."id"
                  AND EXISTS (
                    SELECT 1
                    FROM "chatUser"
                    WHERE "chatUser"."userId" = "users"."id"
                      AND "chatUser"."chatId" = "chat"."idOfChat"
                    LIMIT 1
                  )
                LIMIT 1
              )
          ) "p" ON true
          WHERE "p"."Bio" = $2
        `,
        ['one', 'two'],
      );
    });

    describe('select', () => {
      it('should be selectable', () => {
        const query = db.chat.as('c').select('IdOfChat', {
          profiles: (q) => q.profiles.where({ Bio: 'bio' }),
        });

        assertType<
          Awaited<typeof query>,
          { IdOfChat: number; profiles: Profile[] }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "c"."idOfChat" AS "IdOfChat",
              COALESCE("profiles".r, '[]') "profiles"
            FROM "chat" AS "c"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
              FROM (
                SELECT ${profileSelectAll}
                FROM "profile" AS "profiles"
                WHERE "profiles"."bio" = $1
                  AND EXISTS (
                        SELECT 1 FROM "user" AS "users"
                        WHERE "profiles"."userId" = "users"."id"
                          AND EXISTS (
                                SELECT 1 FROM "chatUser"
                                WHERE "chatUser"."userId" = "users"."id"
                                  AND "chatUser"."chatId" = "c"."idOfChat"
                                LIMIT 1
                            )
                        LIMIT 1
                    )
              ) AS "t"
            ) "profiles" ON true
          `,
          ['bio'],
        );
      });

      it('should allow to select count', () => {
        const query = db.chat.as('c').select('IdOfChat', {
          profilesCount: (q) => q.profiles.count(),
        });

        assertType<
          Awaited<typeof query>,
          { IdOfChat: number; profilesCount: number }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "c"."idOfChat" AS "IdOfChat",
              "profilesCount".r "profilesCount"
            FROM "chat" AS "c"
            LEFT JOIN LATERAL (
              SELECT count(*) r
              FROM "profile" AS "profiles"
              WHERE EXISTS (
                SELECT 1 FROM "user" AS "users"
                WHERE "profiles"."userId" = "users"."id"
                  AND EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."userId" = "users"."id"
                      AND "chatUser"."chatId" = "c"."idOfChat"
                    LIMIT 1
                  )
                LIMIT 1
              )
            ) "profilesCount" ON true
          `,
          [],
        );
      });

      it('should allow to pluck values', () => {
        const query = db.chat.as('c').select('IdOfChat', {
          bios: (q) => q.profiles.pluck('Bio'),
        });

        assertType<
          Awaited<typeof query>,
          { IdOfChat: number; bios: (string | null)[] }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "c"."idOfChat" AS "IdOfChat",
              COALESCE("bios".r, '[]') "bios"
            FROM "chat" AS "c"
            LEFT JOIN LATERAL (
              SELECT json_agg("t"."Bio") r
              FROM (
                SELECT "profiles"."bio" AS "Bio"
                FROM "profile" AS "profiles"
                WHERE EXISTS (
                  SELECT 1 FROM "user" AS "users"
                  WHERE "profiles"."userId" = "users"."id"
                  AND EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."userId" = "users"."id"
                        AND "chatUser"."chatId" = "c"."idOfChat"
                      LIMIT 1
                    )
                  LIMIT 1
                )
              ) AS "t"
            ) "bios" ON true
          `,
        );
      });

      it('should handle exists sub query', () => {
        const query = db.chat.as('c').select('IdOfChat', {
          hasProfiles: (q) => q.profiles.exists(),
        });

        assertType<
          Awaited<typeof query>,
          { IdOfChat: number; hasProfiles: boolean }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "c"."idOfChat" AS "IdOfChat",
              COALESCE("hasProfiles".r, false) "hasProfiles"
            FROM "chat" AS "c"
            LEFT JOIN LATERAL (
              SELECT true r
              FROM "profile" AS "profiles"
              WHERE EXISTS (
                SELECT 1
                FROM "user" AS "users"
                WHERE "profiles"."userId" = "users"."id"
                  AND EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."userId" = "users"."id"
                      AND "chatUser"."chatId" = "c"."idOfChat"
                    LIMIT 1
                  )
                LIMIT 1
              )
              LIMIT 1
            ) "hasProfiles" ON true
          `,
        );
      });

      it('should support recurring select', () => {
        const q = db.chat.select({
          profiles: (q) =>
            q.profiles.select({
              chats: (q) =>
                q.chats.select({
                  profiles: (q) => q.profiles,
                }),
            }),
        });

        expectSql(
          q.toSql(),
          `
            SELECT COALESCE("profiles".r, '[]') "profiles"
            FROM "chat"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
              FROM (
                SELECT COALESCE("chats".r, '[]') "chats"
                FROM "profile" AS "profiles"
                LEFT JOIN LATERAL (
                  SELECT json_agg(row_to_json("t".*)) r
                  FROM (
                    SELECT COALESCE("profiles2".r, '[]') "profiles"
                    FROM "chat" AS "chats"
                    LEFT JOIN LATERAL (
                      SELECT json_agg(row_to_json("t".*)) r
                      FROM (
                        SELECT ${profileSelectAll}
                        FROM "profile" AS "profiles"
                        WHERE EXISTS (
                          SELECT 1
                          FROM "user" AS "users"
                          WHERE "profiles"."userId" = "users"."id"
                          AND EXISTS (
                            SELECT 1
                            FROM "chatUser"
                            WHERE "chatUser"."userId" = "users"."id"
                              AND "chatUser"."chatId" = "chats"."idOfChat"
                            LIMIT 1
                          )
                        LIMIT 1
                      )
                    ) AS "t"
                  ) "profiles2" ON true
                  WHERE EXISTS (
                    SELECT 1
                    FROM "user"
                    WHERE EXISTS (
                      SELECT 1
                      FROM "chatUser"
                      WHERE "chatUser"."chatId" = "chats"."idOfChat"
                        AND "chatUser"."userId" = "user"."id"
                      LIMIT 1
                    ) AND "user"."id" = "profiles"."userId"
                    LIMIT 1
                  )
                ) AS "t"
              ) "chats" ON true
                WHERE EXISTS (
                  SELECT 1
                  FROM "user" AS "users"
                  WHERE "profiles"."userId" = "users"."id"
                    AND EXISTS (
                      SELECT 1
                      FROM "chatUser"
                      WHERE "chatUser"."userId" = "users"."id"
                        AND "chatUser"."chatId" = "chat"."idOfChat"
                      LIMIT 1
                    )
                  LIMIT 1
                )
              ) AS "t"
            ) "profiles" ON true
          `,
        );
      });
    });
  });
});
