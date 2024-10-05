import { Db, Query } from 'pqb';
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
  PostTag,
  postTagSelectAll,
  Post,
  postSelectAll,
} from '../test-utils/orm.test-utils';
import { orchidORM } from '../orm';
import { assertType, expectSql } from 'test-utils';
import { omit } from 'orchid-core';

describe('hasMany', () => {
  useTestORM();

  describe('querying', () => {
    it('should support `queryRelated` to query related data', async () => {
      const userId = await db.user.get('Id').create(userData);
      const ChatId = await db.chat.get('IdOfChat').create(chatData);

      await db.message.createMany([
        { ...messageData, AuthorId: userId, ChatId },
        { ...messageData, AuthorId: userId, ChatId },
      ]);

      const user = await db.user.find(userId);
      const query = db.user.queryRelated('messages', user);

      expectSql(
        query.toSQL(),
        `
        SELECT ${messageSelectAll} FROM "message" "messages"
        WHERE "messages"."author_id" = $1
          AND "messages"."message_key" = $2
      `,
        [userId, 'key'],
      );

      const messages = await query;

      expect(messages).toMatchObject([messageData, messageData]);
    });

    it('should handle chained query', () => {
      const query = db.user
        .where({ Name: 'name' })
        .chain('messages')
        .where({ Text: 'text' });

      expectSql(
        query.toSQL(),
        `
          SELECT ${messageSelectAll} FROM "message" "messages"
          WHERE
            EXISTS (
              SELECT 1 FROM "user"
              WHERE "user"."name" = $1
                AND "user"."id" = "messages"."author_id"
                AND "user"."user_key" = "messages"."message_key"
            )
            AND "messages"."text" = $2
        `,
        ['name', 'text'],
      );
    });

    it('should handle long chained query', () => {
      const q = db.user
        .where({ Name: 'name' })
        .chain('posts')
        .where({ Body: 'body' })
        .chain('postTags')
        .where({ Tag: 'tag' });

      assertType<Awaited<typeof q>, PostTag[]>();

      expectSql(
        q.toSQL(),
        `
        SELECT ${postTagSelectAll}
        FROM "postTag" "postTags"
        WHERE
          EXISTS (
            SELECT 1
            FROM "post" AS "posts"
            WHERE
              EXISTS (
                SELECT 1
                FROM "user"
                WHERE "user"."name" = $1
                  AND "user"."id" = "posts"."user_id"
                  AND "user"."user_key" = "posts"."title"
              )
              AND "posts"."body" = $2
              AND "posts"."id" = "postTags"."post_id"
          )
          AND "postTags"."tag" = $3
      `,
        ['name', 'body', 'tag'],
      );
    });

    it('should have create with defaults of provided id', () => {
      const user = { Id: 1, UserKey: 'key' };
      const query = db.user.queryRelated('messages', user).insert({
        ChatId: 2,
        Text: 'text',
      });

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "message"("author_id", "message_key", "chat_id", "text")
          VALUES ($1, $2, $3, $4)
        `,
        [1, 'key', 2, 'text'],
      );
    });

    describe('create based on a query', () => {
      it('should have create based on a query', () => {
        const query = db.chat.find(1).chain('messages').create({
          Text: 'text',
        });

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "message"("chat_id", "message_key", "text")
            SELECT "chat"."id_of_chat" "ChatId", "chat"."chat_key" "MessageKey", $1
            FROM "chat"
            WHERE "chat"."id_of_chat" = $2
            LIMIT 1
            RETURNING ${messageSelectAll}
          `,
          ['text', 1],
        );
      });

      it('should throw when the main query returns many records', async () => {
        await expect(
          async () =>
            await db.chat.chain('messages').create({
              Text: 'text',
            }),
        ).rejects.toThrow(
          'Cannot create based on a query which returns multiple records',
        );
      });

      it('should throw when main record is not found', async () => {
        const q = db.chat.find(1).chain('messages').create({
          Text: 'text',
        });

        await expect(q).rejects.toThrow('Record is not found');
      });

      it('should not throw when searching with findOptional', async () => {
        await db.chat.findOptional(1).chain('messages').takeOptional().create({
          Text: 'text',
        });
      });
    });

    it('should have chained delete', () => {
      const query = db.chat
        .where({ Title: 'title' })
        .chain('messages')
        .where({ Text: 'text' })
        .delete();

      expectSql(
        query.toSQL(),
        `
          DELETE FROM "message" AS "messages"
          WHERE EXISTS (
              SELECT 1 FROM "chat"
              WHERE "chat"."title" = $1
                AND "chat"."id_of_chat" = "messages"."chat_id"
                AND "chat"."chat_key" = "messages"."message_key"
            )
            AND "messages"."text" = $2
        `,
        ['title', 'text'],
      );
    });

    it('should have proper joinQuery', () => {
      expectSql(
        (
          db.user.relations.messages.relationConfig.joinQuery(
            db.message.as('m'),
            db.user.as('u'),
          ) as Query
        ).toSQL(),
        `
        SELECT ${messageSelectAll} FROM "message" "m"
        WHERE "m"."author_id" = "u"."id"
          AND "m"."message_key" = "u"."user_key"
      `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.user.whereExists('messages').toSQL(),
        `
        SELECT ${userSelectAll} FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "message" AS "messages"
          WHERE "messages"."author_id" = "user"."id"
            AND "messages"."message_key" = "user"."user_key"
        )
      `,
      );

      expectSql(
        db.user
          .as('u')
          .whereExists((q) => q.messages.where({ Text: 'text' }))
          .toSQL(),
        `
          SELECT ${userSelectAll} FROM "user" "u"
          WHERE EXISTS (
            SELECT 1 FROM "message" AS "messages"
            WHERE "messages"."text" = $1
              AND "messages"."author_id" = "u"."id"
              AND "messages"."message_key" = "u"."user_key"
          )
        `,
        ['text'],
      );

      expectSql(
        db.user
          .as('u')
          .whereExists('messages', (q) => q.where({ 'messages.Text': 'text' }))
          .toSQL(),
        `
          SELECT ${userSelectAll} FROM "user" "u"
          WHERE EXISTS (
            SELECT 1 FROM "message" AS "messages"
            WHERE "messages"."author_id" = "u"."id"
              AND "messages"."message_key" = "u"."user_key"
              AND "messages"."text" = $1
          )
        `,
        ['text'],
      );
    });

    it('should support nested where with exists', () => {
      // @ts-expect-error sub query must return a boolean
      db.user.where((q) => q.messages);

      const q = db.user.where((q) => q.messages.exists());

      expectSql(
        q.toSQL(),
        `
        SELECT ${userSelectAll}
        FROM "user"
        WHERE (
          SELECT true
          FROM "message" "messages"
          WHERE "messages"."author_id" = "user"."id"
            AND "messages"."message_key" = "user"."user_key"
          LIMIT 1
        )
        `,
      );
    });

    it('should be supported in join', () => {
      const query = db.user
        .as('u')
        .join('messages', (q) => q.where({ Text: 'text' }))
        .select('Name', 'messages.Text');

      assertType<Awaited<typeof query>, { Name: string; Text: string }[]>();

      expectSql(
        query.toSQL(),
        `
        SELECT "u"."name" "Name", "messages"."text" "Text"
        FROM "user" "u"
        JOIN "message" AS "messages"
          ON "messages"."author_id" = "u"."id"
         AND "messages"."message_key" = "u"."user_key"
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
        query.toSQL(),
        `
        SELECT "u"."name" "Name", "m"."text" "Text"
        FROM "user" "u"
        JOIN "message" AS "m"
          ON "m"."text" = $1
         AND "m"."chat_id" = $2
         AND "m"."author_id" = "u"."id"
         AND "m"."message_key" = "u"."user_key"
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
        q.toSQL(),
        `
          SELECT "user"."name" "Name", row_to_json("m".*) "message"
          FROM "user"
          JOIN LATERAL (
            SELECT ${messageSelectAll}
            FROM "message" "m"
            WHERE "m"."text" = $1
              AND "m"."author_id" = "user"."id"
              AND "m"."message_key" = "user"."user_key"
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
          query.toSQL(),
          `
            SELECT
              "u"."id" "Id",
              COALESCE("messages".r, '[]') "messages"
            FROM "user" "u"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
              FROM (
                SELECT ${messageSelectAll}
                FROM "message" "messages"
                WHERE "messages"."text" = $1
                  AND "messages"."author_id" = "u"."id"
                  AND "messages"."message_key" = "u"."user_key"
              ) "t"
            ) "messages" ON true
          `,
          ['text'],
        );
      });

      it('should support chained select', () => {
        const q = db.user.select({
          items: (q) => q.posts.chain('postTags'),
        });

        assertType<Awaited<typeof q>, { items: PostTag[] }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT COALESCE("items".r, '[]') "items"
            FROM "user"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
              FROM (
                SELECT ${postTagSelectAll}
                FROM "postTag" "postTags"
                WHERE EXISTS (
                  SELECT 1
                  FROM "post" AS "posts"
                  WHERE "posts"."user_id" = "user"."id"
                    AND "posts"."title" = "user"."user_key"
                    AND "posts"."id" = "postTags"."post_id"
                )
              ) "t"
            ) "items" ON true
          `,
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
        query.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            "messagesCount".r "messagesCount"
          FROM "user" "u"
          LEFT JOIN LATERAL (
            SELECT count(*) r
            FROM "message" "messages"
            WHERE "messages"."author_id" = "u"."id"
              AND "messages"."message_key" = "u"."user_key"
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
        query.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("texts".r, '[]') "texts"
          FROM "user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg("t"."Text") r
            FROM (
              SELECT "messages"."text" "Text"
              FROM "message" "messages"
              WHERE "messages"."author_id" = "u"."id"
                AND "messages"."message_key" = "u"."user_key"
            ) "t"
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
        query.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("hasMessages".r, false) "hasMessages"
          FROM "user" "u"
          LEFT JOIN LATERAL (
            SELECT true r
            FROM "message" "messages"
            WHERE "messages"."author_id" = "u"."id"
              AND "messages"."message_key" = "u"."user_key"
            LIMIT 1
          ) "hasMessages" ON true
        `,
      );
    });

    it('should support recurring select', () => {
      const q = db.user.as('sender').select({
        messages: (q) =>
          q.messages.select({
            sender: (q) =>
              q.sender.select({
                messages: (q) => q.messages,
              }),
          }),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("messages".r, '[]') "messages"
          FROM "user" "sender"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json("t".*)) r
            FROM (
              SELECT row_to_json("sender2".*) "sender"
              FROM "message" "messages"
              LEFT JOIN LATERAL (
                SELECT COALESCE("messages2".r, '[]') "messages"
                FROM "user" "sender2"
                LEFT JOIN LATERAL (
                  SELECT json_agg(row_to_json("t".*)) r
                  FROM (
                    SELECT ${messageSelectAll}
                    FROM "message" "messages2"
                    WHERE "messages2"."author_id" = "sender2"."id"
                      AND "messages2"."message_key" = "sender2"."user_key"
                  ) "t"
                ) "messages2" ON true
                WHERE "sender2"."id" = "messages"."author_id"
                  AND "sender2"."user_key" = "messages"."message_key"
              ) "sender2" ON true
              WHERE "messages"."author_id" = "sender"."id"
                AND "messages"."message_key" = "sender"."user_key"
            ) "t"
          ) "messages" ON true
        `,
      );
    });
  });

  describe('create', () => {
    const checkUser = (user: User, Name: string) => {
      expect(user).toEqual({
        ...omit(userData, ['Password']),
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
          ['Id'],
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

          const ids = await db.message;

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(ids, expect.any(Db));
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

          const ids = await db.message;

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(ids, expect.any(Db));
        });
      });
    });

    describe('nested connect', () => {
      it('should support connect', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);
        await db.message.createMany([
          {
            ChatId,
            sender: { create: { ...userData, Name: 'tmp' } },
            Text: 'message 1',
          },
          {
            ChatId,
            sender: { connect: { Name: 'tmp' } },
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
            ChatId,
            sender: { create: { ...userData, Name: 'tmp' } },
            Text: 'message 1',
          },
          {
            ChatId,
            sender: { connect: { Name: 'tmp' } },
            Text: 'message 2',
          },
          {
            ChatId,
            sender: { connect: { Name: 'tmp' } },
            Text: 'message 3',
          },
          {
            ChatId,
            sender: { connect: { Name: 'tmp' } },
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
          ['Id'],
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
          expect(afterUpdate).toBeCalledWith(
            [{ Id: ids[0] }, { Id: ids[1] }],
            expect.any(Db),
          );
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
          expect(afterUpdate).toBeCalledWith(
            [{ Id: ids[0] }, { Id: ids[1] }],
            expect.any(Db),
          );
          expect(afterUpdate).toBeCalledWith(
            [{ Id: ids[2] }, { Id: ids[3] }],
            expect.any(Db),
          );
        });
      });
    });

    describe('connectOrCreate', () => {
      it('should support connect or create', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(chatData);
        const messageId = await db.message.get('Id').create({
          ChatId,
          sender: { create: { ...userData, Name: 'tmp' } },
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
              ChatId,
              sender: { create: { ...userData, Name: 'tmp' } },
              Text: 'message 1',
            },
            {
              ChatId,
              sender: { create: { ...userData, Name: 'tmp' } },
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
        } = useRelationCallback(db.user.relations.messages, ['Id']);

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
          expect(afterUpdate).toBeCalledWith(
            [
              {
                Id: ids[0],
              },
            ],
            expect.any(Db),
          );
          expect(afterUpdate).toBeCalledWith(
            [
              {
                Id: ids[1],
              },
            ],
            expect.any(Db),
          );
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

          const messages = await db.message;

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(messages, expect.any(Db));
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
          expect(afterUpdate).toHaveBeenCalledTimes(2);
          expect(afterUpdate).toBeCalledWith([{ Id: ids[0] }], expect.any(Db));
          expect(afterUpdate).toBeCalledWith([{ Id: ids[1] }], expect.any(Db));

          const created = await db.message.whereNot({ Id: { in: ids } });
          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(created, expect.any(Db));
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
          ['Id'],
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

          const ids = await db.message.select('Id');

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toBeCalledWith(ids, expect.any(Db));
        });

        it('should invoke callbacks in a batch update', async () => {
          resetMocks();

          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const UserIds = await db.user.pluck('Id').createMany([
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

          await db.user.where({ Id: { in: UserIds } }).update({
            messages: {
              disconnect: [{ Text: 'message 1' }, { Text: 'message 3' }],
            },
          });

          const ids = await db.message
            .where({ Text: { in: ['message 1', 'message 3'] } })
            .select('Id');

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toBeCalledWith(ids, expect.any(Db));
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

      it('should nullify all related records foreign keys when giving empty array', async () => {
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

        await db.user.find(id).update({
          messages: {
            set: [],
          },
        });

        const messages = await db.message;

        expect(messages.map((m) => m.AuthorId)).toEqual([null, null]);
      });

      it('should throw in batch update', async () => {
        expect(() =>
          db.user.where({ Id: { in: [1, 2, 3] } }).update({
            messages: {
              // @ts-expect-error not allows in batch update
              set: { Text: { in: ['message 2', 'message 3'] } },
            },
          }),
        ).toThrow('`set` option is not allowed in a batch update');
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate } = useRelationCallback(
          db.user.relations.messages,
          ['Id'],
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

          const ids = await db.message.pluck('Id');

          expect(beforeUpdate).toHaveBeenCalledTimes(2);
          expect(afterUpdate).toHaveBeenCalledTimes(2);
          expect(afterUpdate).toBeCalledWith(
            [{ Id: ids[0] }, { Id: ids[2] }],
            expect.any(Db),
          );
          expect(afterUpdate).toBeCalledWith(
            [{ Id: ids[1] }, { Id: ids[2] }],
            expect.any(Db),
          );
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

        const messages = await db.user
          .queryRelated('messages', { Id, UserKey: 'key' })
          .select('Text');
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
          .queryRelated('messages', { Id: userIds[1], UserKey: 'key' })
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

        const messages = await db.user
          .queryRelated('messages', { Id, UserKey: 'key' })
          .pluck('Text');
        expect(messages).toEqual(['message 1']);
      });

      describe('relation callbacks', () => {
        const { beforeDelete, afterDelete, resetMocks } = useRelationCallback(
          db.user.relations.messages,
          ['Id'],
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

          const ids = await db.message.pluck('Id');

          await db.user.find(Id).update({
            messages: {
              delete: [{ Text: 'message 1' }, { Text: 'message 2' }],
            },
          });

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledWith(
            [{ Id: ids[0] }, { Id: ids[1] }],
            expect.any(Db),
          );
        });

        it('should invoke callbacks in a batch delete', async () => {
          resetMocks();

          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const UserIds = await db.user.pluck('Id').createMany([
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

          const ids = await db.message.pluck('Id');

          await db.user.where({ Id: { in: UserIds } }).update({
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
          expect(afterDelete).toBeCalledWith(
            [{ Id: ids[0] }, { Id: ids[1] }, { Id: ids[3] }, { Id: ids[4] }],
            expect.any(Db),
          );
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
          .queryRelated('messages', { Id, UserKey: 'key' })
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

        const messages = await db.user
          .queryRelated('messages', { Id, UserKey: 'key' })
          .pluck('Text');
        expect(messages).toEqual(['message 1']);
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
          db.user.relations.messages,
          ['Id'],
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

          const ids = await db.message.pluck('Id');

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
          expect(afterUpdate).toBeCalledWith(
            [{ Id: ids[0] }, { Id: ids[1] }],
            expect.any(Db),
          );
        });

        it('should invoke callbacks in a batch update', async () => {
          resetMocks();

          const ChatId = await db.chat.get('IdOfChat').create(chatData);
          const UserIds = await db.user.pluck('Id').createMany([
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

          const ids = await db.message.select('Id');

          await db.user.where({ Id: { in: UserIds } }).update({
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
          expect(afterUpdate).toBeCalledWith(ids, expect.any(Db));
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

        const texts = await db.user
          .queryRelated('messages', user)
          .order('Text')
          .pluck('Text');
        expect(texts).toEqual(['created 1', 'created 2']);
      });

      it('should throw in batch update', async () => {
        expect(() =>
          db.user.where({ Id: { in: [1, 2, 3] } }).update({
            messages: {
              // @ts-expect-error not allows in batch update
              create: [{ ...messageData, ChatId: 1, Text: 'created 1' }],
            },
          }),
        ).toThrow('`create` option is not allowed in a batch update');
      });

      it('should ignore empty create list', async () => {
        const Id = await db.user.get('Id').create(userData);

        await db.user.find(Id).update({
          messages: {
            create: [],
          },
        });

        const messages = await db.user.queryRelated('messages', {
          Id,
          UserKey: 'key',
        });
        expect(messages.length).toEqual(0);
      });

      describe('relation callbacks', () => {
        const { beforeCreate, afterCreate } = useRelationCallback(
          db.user.relations.messages,
          ['Id'],
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

          const ids = await db.message.select('Id');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(ids, expect.any(Db));
        });
      });
    });
  });

  it('should be supported in a `where` callback', () => {
    const q = db.user.where((q) =>
      q.messages.whereIn('Text', ['a', 'b']).count().equals(10),
    );

    expectSql(
      q.toSQL(),
      `
          SELECT ${userSelectAll} FROM "user" WHERE (
            SELECT count(*) = $1
            FROM "message" "messages"
            WHERE "messages"."text" IN ($2, $3)
              AND "messages"."author_id" = "user"."id"
              AND "messages"."message_key" = "user"."user_key"
          )
        `,
      [10, 'a', 'b'],
    );
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
          columns: ['Id'],
          references: ['postId'],
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
          columns: ['Id'],
          references: ['postId'],
        }),

        posts: this.hasMany(() => Post, {
          through: 'postTags',
          source: 'post',
        }),
      };
    }

    class PostTag extends BaseTable {
      table = 'postTag';
      columns = this.setColumns(
        (t) => ({
          postId: t.integer().foreignKey(() => Post, 'Id'),
          tagId: t.integer().foreignKey(() => Tag, 'Id'),
        }),
        (t) => t.primaryKey(['postId', 'tagId']),
      );

      relations = {
        post: this.belongsTo(() => Post, {
          references: ['Id'],
          columns: ['postId'],
        }),

        tag: this.belongsTo(() => Tag, {
          references: ['Id'],
          columns: ['tagId'],
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
          columns: ['Id'],
          references: ['postId'],
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
      columns = this.setColumns(
        (t) => ({
          postId: t.integer().foreignKey(() => Post, 'Id'),
          tagId: t.integer().foreignKey(() => Tag, 'Id'),
        }),
        (t) => t.primaryKey(['postId', 'tagId']),
      );
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
    it('should support `queryRelated` to query related data', async () => {
      const query = db.profile.queryRelated('chats', {
        UserId: 1,
        ProfileKey: 'key',
      });
      expectSql(
        query.toSQL(),
        `
        SELECT ${chatSelectAll} FROM "chat" "chats"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
              AND "chatUser"."chat_key" = "chats"."chat_key"
              AND "chatUser"."user_id" = "user"."id"
              AND "chatUser"."user_key" = "user"."user_key"
          )
          AND "user"."id" = $1
          AND "user"."user_key" = $2
        )
      `,
        [1, 'key'],
      );
    });

    it('should handle chained query', () => {
      const query = db.profile
        .where({ Bio: 'bio' })
        .chain('chats')
        .where({ Title: 'title' });

      expectSql(
        query.toSQL(),
        `
          SELECT ${chatSelectAll} FROM "chat" "chats"
          WHERE EXISTS (
            SELECT 1 FROM "profile"
            WHERE "profile"."bio" = $1
              AND EXISTS (
                SELECT 1 FROM "user"
                WHERE EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                      AND "chatUser"."chat_key" = "chats"."chat_key"
                      AND "chatUser"."user_id" = "user"."id"
                  AND "chatUser"."user_key" = "user"."user_key"
                  )
                  AND "user"."id" = "profile"."user_id"
                  AND "user"."user_key" = "profile"."profile_key"
              )
          )
          AND "chats"."title" = $2
        `,
        ['bio', 'title'],
      );
    });

    it('should handle long chained query', () => {
      const q = db.message
        .where({ Text: 'text' })
        .chain('profiles')
        .where({ Bio: 'bio' })
        .chain('posts')
        .where({ Body: 'body' });

      assertType<Awaited<typeof q>, Post[]>();

      expectSql(
        q.toSQL(),
        `
        SELECT ${postSelectAll}
        FROM "post" "posts"
        WHERE
          EXISTS (
            SELECT 1
            FROM "profile" AS "profiles"
            WHERE
              EXISTS (
                SELECT 1
                FROM "message"
                WHERE "message"."text" = $1
                  AND EXISTS (
                    SELECT 1
                    FROM "user" AS "sender"
                    WHERE "profiles"."user_id" = "sender"."id"
                      AND "profiles"."profile_key" = "sender"."user_key"
                      AND "sender"."id" = "message"."author_id"
                      AND "sender"."user_key" = "message"."message_key"
                  )
              )
              AND "profiles"."bio" = $2
              AND EXISTS (
                SELECT 1
                FROM "user"
                WHERE "posts"."user_id" = "user"."id"
                  AND "posts"."title" = "user"."user_key"
                  AND "user"."id" = "profiles"."user_id"
                  AND "user"."user_key" = "profiles"."profile_key"
              )
          )
          AND "posts"."body" = $3
      `,
        ['text', 'bio', 'body'],
      );
    });

    it('should disable create', () => {
      // @ts-expect-error hasMany with through option should not have chained create
      db.profile.chain('chats').create(chatData);
    });

    describe('chained delete', () => {
      it('should have chained delete', () => {
        const query = db.profile
          .where({ Bio: 'bio' })
          .chain('chats')
          .where({ Title: 'title' })
          .delete();

        expectSql(
          query.toSQL(),
          `
          DELETE FROM "chat" AS "chats"
          WHERE EXISTS (
              SELECT 1 FROM "profile"
              WHERE "profile"."bio" = $1
                AND EXISTS (
                  SELECT 1 FROM "user"
                  WHERE EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                        AND "chatUser"."chat_key" = "chats"."chat_key"
                        AND "chatUser"."user_id" = "user"."id"
                    AND "chatUser"."user_key" = "user"."user_key"
                    )
                    AND "user"."id" = "profile"."user_id"
                    AND "user"."user_key" = "profile"."profile_key"
                )
            )
            AND "chats"."title" = $2
        `,
          ['bio', 'title'],
        );
      });
    });

    it('should have proper joinQuery', () => {
      expectSql(
        (
          db.profile.relations.chats.relationConfig.joinQuery(
            db.chat.as('c'),
            db.profile.as('p'),
          ) as Query
        ).toSQL(),
        `
          SELECT ${chatSelectAll} FROM "chat" "c"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "c"."id_of_chat"
                      AND "chatUser"."chat_key" = "c"."chat_key"
                  AND "chatUser"."user_id" = "user"."id"
              AND "chatUser"."user_key" = "user"."user_key"
              )
              AND "user"."id" = "p"."user_id"
            AND "user"."user_key" = "p"."profile_key"
          )
        `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.profile.whereExists('chats').toSQL(),
        `
        SELECT ${profileSelectAll} FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "chat" AS "chats"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                  AND "chatUser"."chat_key" = "chats"."chat_key"
                  AND "chatUser"."user_id" = "user"."id"
              AND "chatUser"."user_key" = "user"."user_key"
              )
              AND "user"."id" = "profile"."user_id"
              AND "user"."user_key" = "profile"."profile_key"
          )
        )
      `,
      );

      expectSql(
        db.profile
          .as('p')
          .whereExists((q) => q.chats.where({ Title: 'title' }))
          .toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile" "p"
          WHERE EXISTS (
            SELECT 1 FROM "chat" AS "chats"
            WHERE "chats"."title" = $1
              AND EXISTS (
                SELECT 1 FROM "user"
                WHERE EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                    AND "chatUser"."chat_key" = "chats"."chat_key"
                    AND "chatUser"."user_id" = "user"."id"
                    AND "chatUser"."user_key" = "user"."user_key"
                )
                AND "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
              )
          )
        `,
        ['title'],
      );

      expectSql(
        db.profile
          .as('p')
          .whereExists('chats', (q) => q.where({ 'chats.Title': 'title' }))
          .toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile" "p"
          WHERE EXISTS (
            SELECT 1 FROM "chat" AS "chats"
            WHERE EXISTS (
              SELECT 1 FROM "user"
              WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                  AND "chatUser"."chat_key" = "chats"."chat_key"
                  AND "chatUser"."user_id" = "user"."id"
                  AND "chatUser"."user_key" = "user"."user_key"
              )
              AND "user"."id" = "p"."user_id"
              AND "user"."user_key" = "p"."profile_key"
            )
            AND "chats"."title" = $1
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
        query.toSQL(),
        `
          SELECT "p"."bio" "Bio", "chats"."title" "Title"
          FROM "profile" "p"
          JOIN "chat" AS "chats"
            ON EXISTS (
              SELECT 1 FROM "user"
              WHERE EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                    AND "chatUser"."chat_key" = "chats"."chat_key"
                    AND "chatUser"."user_id" = "user"."id"
                AND "chatUser"."user_key" = "user"."user_key"
                )
                AND "user"."id" = "p"."user_id"
              AND "user"."user_key" = "p"."profile_key"
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
        query.toSQL(),
        `
          SELECT "p"."bio" "Bio", "c"."title" "Title"
          FROM "profile" "p"
          JOIN "chat" AS "c"
            ON "c"."title" = $1
            AND "c"."updated_at" = $2
            AND EXISTS (
              SELECT 1 FROM "user"
              WHERE EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chat_id" = "c"."id_of_chat"
                        AND "chatUser"."chat_key" = "c"."chat_key"
                    AND "chatUser"."user_id" = "user"."id"
                AND "chatUser"."user_key" = "user"."user_key"
                )
                AND "user"."id" = "p"."user_id"
              AND "user"."user_key" = "p"."profile_key"
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
        q.toSQL(),
        `
          SELECT "profile"."bio" "Bio", row_to_json("c".*) "chat"
          FROM "profile"
          JOIN LATERAL (
            SELECT ${chatSelectAll}
            FROM "chat" "c"
            WHERE "c"."title" = $1
              AND EXISTS (
                SELECT 1
                FROM "user"
                WHERE 
                  EXISTS (
                    SELECT 1
                    FROM "chatUser"
                    WHERE "chatUser"."chat_id" = "c"."id_of_chat"
                          AND "chatUser"."chat_key" = "c"."chat_key"
                      AND "chatUser"."user_id" = "user"."id"
                    AND "chatUser"."user_key" = "user"."user_key"
                  )
                  AND "user"."id" = "profile"."user_id"
                  AND "user"."user_key" = "profile"."profile_key"
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
          query.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              COALESCE("chats".r, '[]') "chats"
            FROM "profile" "p"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
              FROM (
                SELECT ${chatSelectAll}
                FROM "chat" "chats"
                WHERE "chats"."title" = $1
                  AND EXISTS (
                    SELECT 1 FROM "user"
                    WHERE EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                        AND "chatUser"."chat_key" = "chats"."chat_key"
                        AND "chatUser"."user_id" = "user"."id"
                      AND "chatUser"."user_key" = "user"."user_key"
                    )
                  AND "user"."id" = "p"."user_id"
                  AND "user"."user_key" = "p"."profile_key"
                )
              ) "t"  
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
        query.toSQL(),
        `
          SELECT
            "p"."id" "Id",
            "chatsCount".r "chatsCount"
          FROM "profile" "p"
          LEFT JOIN LATERAL (
            SELECT count(*) r
            FROM "chat" "chats"
            WHERE EXISTS (
              SELECT 1 FROM "user"
              WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                  AND "chatUser"."chat_key" = "chats"."chat_key"
                  AND "chatUser"."user_id" = "user"."id"
                AND "chatUser"."user_key" = "user"."user_key"
              )
              AND "user"."id" = "p"."user_id"
              AND "user"."user_key" = "p"."profile_key"
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
        query.toSQL(),
        `
          SELECT
            "p"."id" "Id",
            COALESCE("titles".r, '[]') "titles"
          FROM "profile" "p"
          LEFT JOIN LATERAL (
            SELECT json_agg("t"."Title") r
            FROM (
              SELECT "chats"."title" "Title"
              FROM "chat" "chats"
              WHERE EXISTS (
                SELECT 1 FROM "user"
                WHERE EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                    AND "chatUser"."chat_key" = "chats"."chat_key"
                    AND "chatUser"."user_id" = "user"."id"
                  AND "chatUser"."user_key" = "user"."user_key"
                )
                AND "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
              )
            ) "t"
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
        query.toSQL(),
        `
          SELECT
            "p"."id" "Id",
            COALESCE("hasChats".r, false) "hasChats"
          FROM "profile" "p"
          LEFT JOIN LATERAL (
            SELECT true r
            FROM "chat" "chats"
            WHERE EXISTS (
                SELECT 1 FROM "user"
                WHERE EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                    AND "chatUser"."chat_key" = "chats"."chat_key"
                    AND "chatUser"."user_id" = "user"."id"
                  AND "chatUser"."user_key" = "user"."user_key"
              )
              AND "user"."id" = "p"."user_id"
              AND "user"."user_key" = "p"."profile_key"
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
        q.toSQL(),
        `
          SELECT COALESCE("chats".r, '[]') "chats"
          FROM "profile"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json("t".*)) r
            FROM (
              SELECT COALESCE("profiles".r, '[]') "profiles"
              FROM "chat" "chats"
              LEFT JOIN LATERAL (
                SELECT json_agg(row_to_json("t".*)) r
                FROM (
                  SELECT COALESCE("chats2".r, '[]') "chats"
                  FROM "profile" "profiles"
                  LEFT JOIN LATERAL (
                    SELECT json_agg(row_to_json("t".*)) r
                    FROM (
                      SELECT ${chatSelectAll}
                      FROM "chat" "chats2"
                      WHERE EXISTS (
                        SELECT 1
                        FROM "user"
                        WHERE
                          EXISTS (
                            SELECT 1
                            FROM "chatUser"
                            WHERE "chatUser"."chat_id" = "chats2"."id_of_chat"
                              AND "chatUser"."chat_key" = "chats2"."chat_key"
                              AND "chatUser"."user_id" = "user"."id"
                            AND "chatUser"."user_key" = "user"."user_key"
                          )
                          AND "user"."id" = "profiles"."user_id"
                          AND "user"."user_key" = "profiles"."profile_key"
                      )
                    ) "t"
                  ) "chats2" ON true
                  WHERE EXISTS (
                    SELECT 1
                    FROM "user" AS "users"
                    WHERE "profiles"."user_id" = "users"."id"
                      AND "profiles"."profile_key" = "users"."user_key"
                      AND EXISTS (
                        SELECT 1
                        FROM "chatUser"
                        WHERE "chatUser"."user_id" = "users"."id"
                          AND "chatUser"."user_key" = "users"."user_key"
                          AND "chatUser"."chat_id" = "chats"."id_of_chat"
                        AND "chatUser"."chat_key" = "chats"."chat_key"
                      )
                  )
                ) "t"
              ) "profiles" ON true
              WHERE EXISTS (
                SELECT 1
                FROM "user"
                WHERE EXISTS (
                  SELECT 1
                  FROM "chatUser"
                  WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                    AND "chatUser"."chat_key" = "chats"."chat_key"
                    AND "chatUser"."user_id" = "user"."id"
                  AND "chatUser"."user_key" = "user"."user_key"
                ) AND "user"."id" = "profile"."user_id"
                  AND "user"."user_key" = "profile"."profile_key"
              )
            ) "t"
          ) "chats" ON true
        `,
      );
    });

    it('should be supported in a `where` callback', () => {
      const q = db.profile.where((q) =>
        q.chats.whereIn('Title', ['a', 'b']).count().equals(10),
      );

      expectSql(
        q.toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile" WHERE (
            SELECT count(*) = $1
            FROM "chat" "chats"
            WHERE "chats"."title" IN ($2, $3)
              AND EXISTS (
                SELECT 1
                FROM "user"
                WHERE
                  EXISTS (
                    SELECT 1
                    FROM "chatUser"
                    WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                      AND "chatUser"."chat_key" = "chats"."chat_key"
                      AND "chatUser"."user_id" = "user"."id"
                    AND "chatUser"."user_key" = "user"."user_key"
                  )
                  AND "user"."id" = "profile"."user_id"
                  AND "user"."user_key" = "profile"."profile_key"
              )
          )
        `,
        [10, 'a', 'b'],
      );
    });
  });

  describe('through hasOne', () => {
    it('should support `queryRelated` to query related data', () => {
      const query = db.chat.queryRelated('profiles', {
        IdOfChat: 1,
        ChatKey: 'key',
      });
      expectSql(
        query.toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile" "profiles"
          WHERE EXISTS (
            SELECT 1 FROM "user" AS "users"
            WHERE "profiles"."user_id" = "users"."id"
              AND "profiles"."profile_key" = "users"."user_key"
            AND EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."user_id" = "users"."id"
                AND "chatUser"."user_key" = "users"."user_key"
                AND "chatUser"."chat_id" = $1
                AND "chatUser"."chat_key" = $2
            )
          )
        `,
        [1, 'key'],
      );
    });

    it('should handle chained query', () => {
      const query = db.chat
        .where({ Title: 'title' })
        .chain('profiles')
        .where({ Bio: 'bio' });

      expectSql(
        query.toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile" "profiles"
          WHERE EXISTS (
            SELECT 1 FROM "chat"
            WHERE "chat"."title" = $1
              AND EXISTS (
                SELECT 1 FROM "user" AS "users"
                WHERE "profiles"."user_id" = "users"."id"
                  AND "profiles"."profile_key" = "users"."user_key"
                  AND EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."user_id" = "users"."id"
                      AND "chatUser"."user_key" = "users"."user_key"
                      AND "chatUser"."chat_id" = "chat"."id_of_chat"
                    AND "chatUser"."chat_key" = "chat"."chat_key"
                  )
              )
          )
          AND "profiles"."bio" = $2
        `,
        ['title', 'bio'],
      );
    });

    it('should disable create', () => {
      // @ts-expect-error hasMany with through option should not have chained create
      db.chat.chain('profiles').create(chatData);
    });

    it('should have chained delete', () => {
      const query = db.chat
        .where({ Title: 'title' })
        .chain('profiles')
        .where({ Bio: 'bio' })
        .delete();

      expectSql(
        query.toSQL(),
        `
          DELETE FROM "profile" AS "profiles"
          WHERE EXISTS (
              SELECT 1 FROM "chat"
              WHERE "chat"."title" = $1
                AND EXISTS (
                  SELECT 1 FROM "user" AS "users"
                  WHERE "profiles"."user_id" = "users"."id"
                    AND "profiles"."profile_key" = "users"."user_key"
                    AND EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."user_id" = "users"."id"
                        AND "chatUser"."user_key" = "users"."user_key"
                        AND "chatUser"."chat_id" = "chat"."id_of_chat"
                      AND "chatUser"."chat_key" = "chat"."chat_key"
                    )
                )
            )
            AND "profiles"."bio" = $2
        `,
        ['title', 'bio'],
      );
    });

    it('should have proper joinQuery', () => {
      expectSql(
        (
          db.chat.relations.profiles.relationConfig.joinQuery(
            db.profile.as('p'),
            db.chat.as('c'),
          ) as Query
        ).toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile" "p"
          WHERE EXISTS (
            SELECT 1 FROM "user" AS "users"
            WHERE "p"."user_id" = "users"."id"
              AND "p"."profile_key" = "users"."user_key"
              AND EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."user_id" = "users"."id"
                  AND "chatUser"."user_key" = "users"."user_key"
                  AND "chatUser"."chat_id" = "c"."id_of_chat"
                    AND "chatUser"."chat_key" = "c"."chat_key"
              )
          )
        `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.chat.whereExists('profiles').toSQL(),
        `
          SELECT ${chatSelectAll} FROM "chat"
          WHERE EXISTS (
            SELECT 1 FROM "profile" AS "profiles"
            WHERE EXISTS (
              SELECT 1 FROM "user" AS "users"
              WHERE "profiles"."user_id" = "users"."id"
                AND "profiles"."profile_key" = "users"."user_key"
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."user_id" = "users"."id"
                    AND "chatUser"."user_key" = "users"."user_key"
                    AND "chatUser"."chat_id" = "chat"."id_of_chat"
                  AND "chatUser"."chat_key" = "chat"."chat_key"
                )
            )
          )
        `,
      );

      expectSql(
        db.chat
          .as('c')
          .whereExists((q) => q.profiles.where({ Bio: 'bio' }))
          .toSQL(),
        `
          SELECT ${chatSelectAll} FROM "chat" "c"
          WHERE EXISTS (
            SELECT 1 FROM "profile" AS "profiles"
            WHERE "profiles"."bio" = $1
              AND EXISTS (
                SELECT 1 FROM "user" AS "users"
                WHERE "profiles"."user_id" = "users"."id"
                  AND "profiles"."profile_key" = "users"."user_key"
                  AND EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."user_id" = "users"."id"
                      AND "chatUser"."user_key" = "users"."user_key"
                      AND "chatUser"."chat_id" = "c"."id_of_chat"
                        AND "chatUser"."chat_key" = "c"."chat_key"
                  )
              )
          )
        `,
        ['bio'],
      );

      expectSql(
        db.chat
          .as('c')
          .whereExists('profiles', (q) => q.where({ 'profiles.Bio': 'bio' }))
          .toSQL(),
        `
          SELECT ${chatSelectAll} FROM "chat" "c"
          WHERE EXISTS (
            SELECT 1 FROM "profile" AS "profiles"
            WHERE EXISTS (
              SELECT 1 FROM "user" AS "users"
              WHERE "profiles"."user_id" = "users"."id"
                AND "profiles"."profile_key" = "users"."user_key"
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."user_id" = "users"."id"
                    AND "chatUser"."user_key" = "users"."user_key"
                    AND "chatUser"."chat_id" = "c"."id_of_chat"
                      AND "chatUser"."chat_key" = "c"."chat_key"
                )
            )
            AND "profiles"."bio" = $1
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
        query.toSQL(),
        `
          SELECT "c"."title" "Title", "profiles"."bio" "Bio"
          FROM "chat" "c"
          JOIN "profile" AS "profiles"
            ON EXISTS (
              SELECT 1 FROM "user" AS "users"
              WHERE "profiles"."user_id" = "users"."id"
                AND "profiles"."profile_key" = "users"."user_key"
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."user_id" = "users"."id"
                    AND "chatUser"."user_key" = "users"."user_key"
                    AND "chatUser"."chat_id" = "c"."id_of_chat"
                      AND "chatUser"."chat_key" = "c"."chat_key"
                )
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
        query.toSQL(),
        `
          SELECT "c"."title" "Title", "p"."bio" "Bio"
          FROM "chat" "c"
          JOIN "profile" AS "p"
            ON "p"."bio" = $1
            AND "p"."user_id" = $2
            AND EXISTS (
              SELECT 1 FROM "user" AS "users"
              WHERE "p"."user_id" = "users"."id"
                AND "p"."profile_key" = "users"."user_key"
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."user_id" = "users"."id"
                    AND "chatUser"."user_key" = "users"."user_key"
                    AND "chatUser"."chat_id" = "c"."id_of_chat"
                      AND "chatUser"."chat_key" = "c"."chat_key"
                )
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
        q.toSQL(),
        `
          SELECT "chat"."title" "Title", row_to_json("p".*) "profile"
          FROM "chat"
          JOIN LATERAL (
            SELECT ${profileSelectAll}
            FROM "profile" "p"
            WHERE "p"."bio" = $1
              AND EXISTS (
                SELECT 1
                FROM "user" AS "users"
                WHERE "p"."user_id" = "users"."id"
                  AND "p"."profile_key" = "users"."user_key"
                  AND EXISTS (
                    SELECT 1
                    FROM "chatUser"
                    WHERE "chatUser"."user_id" = "users"."id"
                      AND "chatUser"."user_key" = "users"."user_key"
                      AND "chatUser"."chat_id" = "chat"."id_of_chat"
                    AND "chatUser"."chat_key" = "chat"."chat_key"
                  )
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
          query.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              COALESCE("profiles".r, '[]') "profiles"
            FROM "chat" "c"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
              FROM (
                SELECT ${profileSelectAll}
                FROM "profile" "profiles"
                WHERE "profiles"."bio" = $1
                  AND EXISTS (
                    SELECT 1 FROM "user" AS "users"
                    WHERE "profiles"."user_id" = "users"."id"
                      AND "profiles"."profile_key" = "users"."user_key"
                      AND EXISTS (
                        SELECT 1 FROM "chatUser"
                        WHERE "chatUser"."user_id" = "users"."id"
                          AND "chatUser"."user_key" = "users"."user_key"
                          AND "chatUser"."chat_id" = "c"."id_of_chat"
                          AND "chatUser"."chat_key" = "c"."chat_key"
                      )
                  )
              ) "t"
            ) "profiles" ON true
          `,
          ['bio'],
        );
      });

      it('should support chained select', () => {
        const q = db.message.select({
          items: (q) => q.profiles.chain('posts'),
        });

        assertType<Awaited<typeof q>, { items: Post[] }[]>();

        expectSql(
          q.toSQL(),
          `
          SELECT COALESCE("items".r, '[]') "items"
          FROM "message"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json("t".*)) r
            FROM (
              SELECT ${postSelectAll}
              FROM "post" "posts"
              WHERE EXISTS (
                SELECT 1 FROM "profile" AS "profiles"
                WHERE EXISTS (
                  SELECT 1 FROM "user" AS "sender"
                  WHERE "profiles"."user_id" = "sender"."id"
                    AND "profiles"."profile_key" = "sender"."user_key"
                    AND "sender"."id" = "message"."author_id"
                    AND "sender"."user_key" = "message"."message_key"
                ) AND EXISTS (
                  SELECT 1 FROM "user"
                  WHERE "posts"."user_id" = "user"."id"
                    AND "posts"."title" = "user"."user_key"
                    AND "user"."id" = "profiles"."user_id"
                    AND "user"."user_key" = "profiles"."profile_key"
                )
              )
            ) "t"
          ) "items" ON true
        `,
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
          query.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              "profilesCount".r "profilesCount"
            FROM "chat" "c"
            LEFT JOIN LATERAL (
              SELECT count(*) r
              FROM "profile" "profiles"
              WHERE EXISTS (
                SELECT 1 FROM "user" AS "users"
                WHERE "profiles"."user_id" = "users"."id"
                  AND "profiles"."profile_key" = "users"."user_key"
                  AND EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."user_id" = "users"."id"
                      AND "chatUser"."user_key" = "users"."user_key"
                      AND "chatUser"."chat_id" = "c"."id_of_chat"
                      AND "chatUser"."chat_key" = "c"."chat_key"
                  )
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
          query.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              COALESCE("bios".r, '[]') "bios"
            FROM "chat" "c"
            LEFT JOIN LATERAL (
              SELECT json_agg("t"."Bio") r
              FROM (
                SELECT "profiles"."bio" "Bio"
                FROM "profile" "profiles"
                WHERE EXISTS (
                  SELECT 1 FROM "user" AS "users"
                  WHERE "profiles"."user_id" = "users"."id"
                    AND "profiles"."profile_key" = "users"."user_key"
                  AND EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."user_id" = "users"."id"
                        AND "chatUser"."user_key" = "users"."user_key"
                        AND "chatUser"."chat_id" = "c"."id_of_chat"
                        AND "chatUser"."chat_key" = "c"."chat_key"
                    )
                )
              ) "t"
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
          query.toSQL(),
          `
            SELECT
              "c"."id_of_chat" "IdOfChat",
              COALESCE("hasProfiles".r, false) "hasProfiles"
            FROM "chat" "c"
            LEFT JOIN LATERAL (
              SELECT true r
              FROM "profile" "profiles"
              WHERE EXISTS (
                SELECT 1
                FROM "user" AS "users"
                WHERE "profiles"."user_id" = "users"."id"
                  AND "profiles"."profile_key" = "users"."user_key"
                  AND EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."user_id" = "users"."id"
                      AND "chatUser"."user_key" = "users"."user_key"
                      AND "chatUser"."chat_id" = "c"."id_of_chat"
                        AND "chatUser"."chat_key" = "c"."chat_key"
                  )
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
          q.toSQL(),
          `
            SELECT COALESCE("profiles".r, '[]') "profiles"
            FROM "chat"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
              FROM (
                SELECT COALESCE("chats".r, '[]') "chats"
                FROM "profile" "profiles"
                LEFT JOIN LATERAL (
                  SELECT json_agg(row_to_json("t".*)) r
                  FROM (
                    SELECT COALESCE("profiles2".r, '[]') "profiles"
                    FROM "chat" "chats"
                    LEFT JOIN LATERAL (
                      SELECT json_agg(row_to_json("t".*)) r
                      FROM (
                        SELECT ${profileSelectAll}
                        FROM "profile" "profiles2"
                        WHERE EXISTS (
                          SELECT 1
                          FROM "user" AS "users"
                          WHERE "profiles2"."user_id" = "users"."id"
                            AND "profiles2"."profile_key" = "users"."user_key"
                          AND EXISTS (
                            SELECT 1
                            FROM "chatUser"
                            WHERE "chatUser"."user_id" = "users"."id"
                              AND "chatUser"."user_key" = "users"."user_key"
                              AND "chatUser"."chat_id" = "chats"."id_of_chat"
                            AND "chatUser"."chat_key" = "chats"."chat_key"
                          )
                      )
                    ) "t"
                  ) "profiles2" ON true
                  WHERE EXISTS (
                    SELECT 1
                    FROM "user"
                    WHERE
                      EXISTS (
                        SELECT 1
                        FROM "chatUser"
                        WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                          AND "chatUser"."chat_key" = "chats"."chat_key"
                          AND "chatUser"."user_id" = "user"."id"
                          AND "chatUser"."user_key" = "user"."user_key"
                      )
                      AND "user"."id" = "profiles"."user_id"
                      AND "user"."user_key" = "profiles"."profile_key"
                  )
                ) "t"
              ) "chats" ON true
                WHERE EXISTS (
                  SELECT 1
                  FROM "user" AS "users"
                  WHERE "profiles"."user_id" = "users"."id"
                    AND "profiles"."profile_key" = "users"."user_key"
                    AND EXISTS (
                      SELECT 1
                      FROM "chatUser"
                      WHERE "chatUser"."user_id" = "users"."id"
                        AND "chatUser"."user_key" = "users"."user_key"
                        AND "chatUser"."chat_id" = "chat"."id_of_chat"
                        AND "chatUser"."chat_key" = "chat"."chat_key"
                    )
                )
              ) "t"
            ) "profiles" ON true
          `,
        );
      });
    });

    it('should be supported in a `where` callback', () => {
      const q = db.chat.where((q) =>
        q.profiles.whereIn('Bio', ['a', 'b']).count().equals(10),
      );

      expectSql(
        q.toSQL(),
        `
            SELECT ${chatSelectAll} FROM "chat" WHERE (
              SELECT count(*) = $1
              FROM "profile" "profiles"
              WHERE "profiles"."bio" IN ($2, $3)
                AND EXISTS (
                  SELECT 1
                  FROM "user" AS "users"
                  WHERE "profiles"."user_id" = "users"."id"
                    AND "profiles"."profile_key" = "users"."user_key"
                    AND EXISTS (
                      SELECT 1
                      FROM "chatUser"
                      WHERE "chatUser"."user_id" = "users"."id"
                        AND "chatUser"."user_key" = "users"."user_key"
                        AND "chatUser"."chat_id" = "chat"."id_of_chat"
                        AND "chatUser"."chat_key" = "chat"."chat_key"
                    )
                )
            )
          `,
        [10, 'a', 'b'],
      );
    });
  });
});
