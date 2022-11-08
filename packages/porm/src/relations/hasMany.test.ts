import { db, pgConfig } from '../test-utils/test-db';
import {
  assertType,
  chatData,
  expectSql,
  messageData,
  userData,
  useTestDatabase,
} from '../test-utils/test-utils';
import { RelationQuery } from 'pqb';
import { Chat, Message, Model, Profile, User } from '../test-utils/test-models';
import { porm } from '../orm';

describe('hasMany', () => {
  useTestDatabase();

  describe('querying', () => {
    it('should have method to query related data', async () => {
      const messagesQuery = db.message.all();

      assertType<
        typeof db.user.messages,
        RelationQuery<
          'messages',
          { id: number },
          'authorId',
          typeof messagesQuery,
          false,
          true
        >
      >();

      const userId = await db.user.get('id').create(userData);
      const chatId = await db.chat.get('id').create(chatData);

      await db.message.createMany([
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

    it('should have create with defaults of provided id', () => {
      const user = { id: 1 };
      const query = db.user.messages(user).count().create({
        chatId: 2,
        text: 'text',
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
          text: 'text',
        });

        expectSql(
          query.toSql(),
          `
          INSERT INTO "message"("chatId", "text")
          SELECT "chat"."id" AS "chatId", $1
          FROM "chat"
          WHERE "chat"."id" = $2
          LIMIT $3
          RETURNING *
        `,
          ['text', 1, 1],
        );
      });

      it('should throw when the main query returns many records', async () => {
        await expect(
          async () =>
            await db.chat.messages.create({
              text: 'text',
            }),
        ).rejects.toThrow(
          'Cannot create based on a query which returns multiple records',
        );
      });
    });

    it('should have proper joinQuery', () => {
      expectSql(
        db.user.relations.messages
          .joinQuery(db.user.as('u'), db.message.as('m'))
          .toSql(),
        `
        SELECT * FROM "message" AS "m"
        WHERE "m"."authorId" = "u"."id"
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
          .as('u')
          .whereExists('messages', (q) => q.where({ text: 'text' }))
          .toSql(),
        `
        SELECT * FROM "user" AS "u"
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
        .join('messages', (q) => q.where({ text: 'text' }))
        .select('name', 'messages.text');

      assertType<Awaited<typeof query>, { name: string; text: string }[]>();

      expectSql(
        query.toSql(),
        `
        SELECT "u"."name", "messages"."text" FROM "user" AS "u"
        JOIN "message" AS "messages"
          ON "messages"."authorId" = "u"."id"
          AND "messages"."text" = $1
      `,
        ['text'],
      );
    });

    describe('select', () => {
      it('should be selectable', () => {
        const query = db.user.as('u').select('id', {
          messages: (q) => q.messages.where({ text: 'text' }),
        });

        assertType<
          Awaited<typeof query>,
          { id: number; messages: Message[] }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "u"."id",
              (
                SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
                FROM (
                  SELECT * FROM "message" AS "messages"
                  WHERE "messages"."authorId" = "u"."id"
                    AND "messages"."text" = $1
                ) AS "t"
              ) AS "messages"
            FROM "user" AS "u"
          `,
          ['text'],
        );
      });

      it('should be selectable by relation name', () => {
        const query = db.user.select('id', 'messages');

        assertType<
          Awaited<typeof query>,
          { id: number; messages: Message[] }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "user"."id",
              (
                SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
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
      const query = db.user.as('u').select('id', {
        messagesCount: (q) => q.messages.count(),
      });

      assertType<
        Awaited<typeof query>,
        { id: number; messagesCount: number }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT
            "u"."id",
            (
              SELECT count(*) FROM "message" AS "messages"
              WHERE "messages"."authorId" = "u"."id"
            ) AS "messagesCount"
          FROM "user" AS "u"
        `,
      );
    });

    it('should allow to pluck values', () => {
      const query = db.user.as('u').select('id', {
        texts: (q) => q.messages.pluck('text'),
      });

      assertType<Awaited<typeof query>, { id: number; texts: string[] }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            "u"."id",
            (
              SELECT COALESCE(json_agg("c"), '[]')
              FROM (
                SELECT "messages"."text" AS "c"
                FROM "message" AS "messages"
                WHERE "messages"."authorId" = "u"."id"
              ) AS "t"
            ) AS "texts"
          FROM "user" AS "u"
        `,
      );
    });

    it('should handle exists sub query', () => {
      const query = db.user.as('u').select('id', {
        hasMessages: (q) => q.messages.exists(),
      });

      assertType<
        Awaited<typeof query>,
        { id: number; hasMessages: boolean }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT
            "u"."id",
            COALESCE((
              SELECT true
              FROM "message" AS "messages"
              WHERE "messages"."authorId" = "u"."id"
            ), false) AS "hasMessages"
          FROM "user" AS "u"
        `,
      );
    });
  });

  describe('create', () => {
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
      expect(messages).toMatchObject([
        {
          id: messages[0].id,
          authorId: userId,
          text: text1,
          chatId,
          meta: null,
        },
        {
          id: messages[1].id,
          authorId: userId,
          text: text2,
          chatId,
          meta: null,
        },
      ]);
    };

    describe('nested create', () => {
      it('should support create', async () => {
        const chatId = await db.chat.get('id').create(chatData);

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

      it('should support create in batch create', async () => {
        const chatId = await db.chat.get('id').create(chatData);

        const user = await db.user.createMany([
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
    });

    describe('nested connect', () => {
      it('should support connect', async () => {
        const chatId = await db.chat.get('id').create(chatData);
        await db.message.createMany([
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

      it('should support connect in batch create', async () => {
        const chatId = await db.chat.get('id').create(chatData);
        await db.message.createMany([
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

        const user = await db.user.createMany([
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
    });

    describe('connectOrCreate', () => {
      it('should support connect or create', async () => {
        const chatId = await db.chat.get('id').create(chatData);
        const messageId = await db.message.get('id').create({
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

      it('should support connect or create in batch create', async () => {
        const chatId = await db.chat.get('id').create(chatData);
        const [{ id: message1Id }, { id: message4Id }] = await db.message
          .select('id')
          .createMany([
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

        const users = await db.user.createMany([
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
  });

  describe('update', () => {
    describe('disconnect', () => {
      it('should nullify foreignKey', async () => {
        const chatId = await db.chat
          .get('id')
          .create({ ...chatData, title: 'chat 1' });

        const userId = await db.user.get('id').create({
          ...userData,
          messages: {
            create: [
              { ...messageData, chatId: chatId, text: 'message 1' },
              { ...messageData, chatId: chatId, text: 'message 2' },
              { ...messageData, chatId: chatId, text: 'message 3' },
            ],
          },
        });

        await db.user.find(userId).update({
          messages: {
            disconnect: [{ text: 'message 1' }, { text: 'message 2' }],
          },
        });

        const messages = await db.message.order('text');
        expect(messages[0].authorId).toBe(null);
        expect(messages[1].authorId).toBe(null);
        expect(messages[2].authorId).toBe(userId);
      });

      it('should nullify foreignKey in batch update', async () => {
        const chatId = await db.chat
          .get('id')
          .create({ ...chatData, title: 'chat 1' });

        const userIds = await db.user.pluck('id').createMany([
          {
            ...userData,
            messages: {
              create: [{ ...messageData, chatId: chatId, text: 'message 1' }],
            },
          },
          {
            ...userData,
            messages: {
              create: [
                { ...messageData, chatId: chatId, text: 'message 2' },
                { ...messageData, chatId: chatId, text: 'message 3' },
              ],
            },
          },
        ]);

        await db.user.where({ id: { in: userIds } }).update({
          messages: {
            disconnect: [{ text: 'message 1' }, { text: 'message 2' }],
          },
        });

        const messages = await db.message.order('text');
        expect(messages[0].authorId).toBe(null);
        expect(messages[1].authorId).toBe(null);
        expect(messages[2].authorId).toBe(userIds[1]);
      });
    });

    describe('set', () => {
      it('should nullify foreignKey of previous related record and set foreignKey to new related record', async () => {
        const chatId = await db.chat.get('id').create(chatData);
        const id = await db.user.get('id').create({
          ...userData,
          messages: {
            create: [
              { ...messageData, chatId, text: 'message 1' },
              { ...messageData, chatId, text: 'message 2' },
            ],
          },
        });

        await db.message.create({ ...messageData, chatId, text: 'message 3' });

        await db.user.find(id).update({
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

      it('should throw in batch update', async () => {
        const query = db.user.where({ id: { in: [1, 2, 3] } }).update({
          messages: {
            // @ts-expect-error not allows in batch update
            set: { text: { in: ['message 2', 'message 3'] } },
          },
        });

        await expect(query).rejects.toThrow();
      });
    });

    describe('delete', () => {
      it('should delete related records', async () => {
        const chatId = await db.chat.get('id').create(chatData);

        const id = await db.user.get('id').create({
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
          messages: {
            delete: {
              text: { in: ['message 1', 'message 2'] },
            },
          },
        });

        expect(await db.message.count()).toBe(1);

        const messages = await db.user.messages({ id }).select('text');
        expect(messages).toEqual([{ text: 'message 3' }]);
      });

      it('should delete related records in batch update', async () => {
        const chatId = await db.chat.get('id').create(chatData);

        const userIds = await db.user.pluck('id').createMany([
          {
            ...userData,
            messages: {
              create: [{ ...messageData, chatId, text: 'message 1' }],
            },
          },
          {
            ...userData,
            messages: {
              create: [
                { ...messageData, chatId, text: 'message 2' },
                { ...messageData, chatId, text: 'message 3' },
              ],
            },
          },
        ]);

        await db.user.where({ id: { in: userIds } }).update({
          messages: {
            delete: [{ text: 'message 1' }, { text: 'message 2' }],
          },
        });

        expect(await db.message.count()).toBe(1);

        const messages = await db.user
          .messages({ id: userIds[1] })
          .select('text');
        expect(messages).toEqual([{ text: 'message 3' }]);
      });
    });

    describe('nested update', () => {
      it('should update related records', async () => {
        const chatId = await db.chat.get('id').create(chatData);

        const id = await db.user.get('id').create({
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
          messages: {
            update: {
              where: {
                text: { in: ['message 1', 'message 3'] },
              },
              data: {
                text: 'updated',
              },
            },
          },
        });

        const messages = await db.user
          .messages({ id })
          .order('id')
          .pluck('text');
        expect(messages).toEqual(['updated', 'message 2', 'updated']);
      });

      it('should update related records in batch update', async () => {
        const chatId = await db.chat.get('id').create(chatData);

        const userIds = await db.user.pluck('id').createMany([
          {
            ...userData,
            messages: {
              create: [{ ...messageData, chatId, text: 'message 1' }],
            },
          },
          {
            ...userData,
            messages: {
              create: [
                { ...messageData, chatId, text: 'message 2' },
                { ...messageData, chatId, text: 'message 3' },
              ],
            },
          },
        ]);

        await db.user.where({ id: { in: userIds } }).update({
          messages: {
            update: {
              where: {
                text: { in: ['message 1', 'message 3'] },
              },
              data: {
                text: 'updated',
              },
            },
          },
        });

        const messages = await db.message.order('id').pluck('text');
        expect(messages).toEqual(['updated', 'message 2', 'updated']);
      });
    });

    describe('nested create', () => {
      it('should create new related records', async () => {
        const chatId = await db.chat.get('id').create(chatData);
        const user = await db.user.create({ ...userData, age: 1 });

        const updated = await db.user
          .select('age')
          .find(user.id)
          .increment('age')
          .update({
            messages: {
              create: [
                { ...messageData, chatId, text: 'created 1' },
                { ...messageData, chatId, text: 'created 2' },
              ],
            },
          });

        expect(updated.age).toBe(2);

        const texts = await db.user.messages(user).order('text').pluck('text');
        expect(texts).toEqual(['created 1', 'created 2']);
      });

      it('should throw in batch update', async () => {
        const query = db.user.where({ id: { in: [1, 2, 3] } }).update({
          messages: {
            // @ts-expect-error not allows in batch update
            create: [{ ...messageData, chatId: 1, text: 'created 1' }],
          },
        });

        await expect(query).rejects.toThrow();
      });
    });
  });
});

describe('hasMany through', () => {
  it('should resolve recursive situation when both models depends on each other', () => {
    class Post extends Model {
      table = 'post';
      columns = this.setColumns((t) => ({
        id: t.serial().primaryKey(),
      }));

      relations = {
        postTags: this.hasMany(() => PostTag, {
          primaryKey: 'id',
          foreignKey: 'postId',
        }),

        tags: this.hasMany(() => Tag, {
          through: 'postTags',
          source: 'tag',
        }),
      };
    }

    class Tag extends Model {
      table = 'tag';
      columns = this.setColumns((t) => ({
        id: t.serial().primaryKey(),
      }));

      relations = {
        postTags: this.hasMany(() => PostTag, {
          primaryKey: 'id',
          foreignKey: 'postId',
        }),

        posts: this.hasMany(() => Post, {
          through: 'postTags',
          source: 'post',
        }),
      };
    }

    class PostTag extends Model {
      table = 'postTag';
      columns = this.setColumns((t) => ({
        postId: t.integer().foreignKey(() => Post, 'id'),
        tagId: t.integer().foreignKey(() => Tag, 'id'),
      }));

      relations = {
        post: this.belongsTo(() => Post, {
          primaryKey: 'id',
          foreignKey: 'postId',
        }),

        tag: this.belongsTo(() => Tag, {
          primaryKey: 'id',
          foreignKey: 'tagId',
        }),
      };
    }

    const db = porm(
      {
        ...pgConfig,
        log: false,
      },
      {
        post: Post,
        tag: Tag,
        postTag: PostTag,
      },
    );

    expect(Object.keys(db.post.relations)).toEqual(['postTags', 'tags']);
    expect(Object.keys(db.tag.relations)).toEqual(['postTags', 'posts']);
  });

  describe('through hasMany', () => {
    it('should have method to query related data', async () => {
      const chatsQuery = db.chat.all();

      assertType<
        typeof db.profile.chats,
        RelationQuery<
          'chats',
          { userId: number | null },
          never,
          typeof chatsQuery,
          false
        >
      >();

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

    it('should have disabled create method', () => {
      // @ts-expect-error hasMany with through option should not have chained create
      db.profile.chats.create(chatData);
    });

    it('should have proper joinQuery', () => {
      expectSql(
        db.profile.relations.chats
          .joinQuery(db.profile.as('p'), db.chat.as('c'))
          .toSql(),
        `
          SELECT * FROM "chat" AS "c"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."chatId" = "c"."id"
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
          .as('p')
          .whereExists('chats', (q) => q.where({ title: 'title' }))
          .toSql(),
        `
        SELECT * FROM "profile" AS "p"
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
        .join('chats', (q) => q.where({ title: 'title' }))
        .select('bio', 'chats.title');

      assertType<
        Awaited<typeof query>,
        { bio: string | null; title: string }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT "p"."bio", "chats"."title" FROM "profile" AS "p"
          JOIN "chat" AS "chats"
            ON EXISTS (
              SELECT 1 FROM "user"
              WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chatId" = "chats"."id"
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

    describe('select', () => {
      it('should be selectable', () => {
        const query = db.profile.as('p').select('id', {
          chats: (q) => q.chats.where({ title: 'title' }),
        });

        assertType<Awaited<typeof query>, { id: number; chats: Chat[] }[]>();

        expectSql(
          query.toSql(),
          `
            SELECT
              "p"."id",
              (
                SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
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
                      AND "user"."id" = "p"."userId"
                      LIMIT 1
                    )
                    AND "chats"."title" = $1
                ) AS "t"
              ) AS "chats"
            FROM "profile" AS "p"
          `,
          ['title'],
        );
      });

      it('should be selectable by relation name', () => {
        const query = db.profile.select('id', 'chats');

        assertType<Awaited<typeof query>, { id: number; chats: Chat[] }[]>();

        expectSql(
          query.toSql(),
          `
            SELECT
              "profile"."id",
              (
                SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
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
      const query = db.profile.as('p').select('id', {
        chatsCount: (q) => q.chats.count(),
      });

      assertType<Awaited<typeof query>, { id: number; chatsCount: number }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            "p"."id",
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
                  AND "user"."id" = "p"."userId"
                  LIMIT 1
                )
            ) AS "chatsCount"
          FROM "profile" AS "p"
        `,
      );
    });

    it('should allow to pluck values', () => {
      const query = db.profile.as('p').select('id', {
        titles: (q) => q.chats.pluck('title'),
      });

      assertType<Awaited<typeof query>, { id: number; titles: string[] }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            "p"."id",
            (
              SELECT COALESCE(json_agg("c"), '[]')
              FROM (
                SELECT "chats"."title" AS "c"
                FROM "chat" AS "chats"
                WHERE EXISTS (
                  SELECT 1 FROM "user"
                  WHERE EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."chatId" = "chats"."id"
                      AND "chatUser"."userId" = "user"."id"
                    LIMIT 1
                  )
                  AND "user"."id" = "p"."userId"
                  LIMIT 1
                )
              ) AS "t"
            ) AS "titles"
          FROM "profile" AS "p"
        `,
      );
    });

    it('should handle exists sub query', () => {
      const query = db.profile.as('p').select('id', {
        hasChats: (q) => q.chats.exists(),
      });

      assertType<Awaited<typeof query>, { id: number; hasChats: boolean }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            "p"."id",
            COALESCE((
              SELECT true
              FROM "chat" AS "chats"
              WHERE EXISTS (
                SELECT 1 FROM "user"
                WHERE EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chatId" = "chats"."id"
                    AND "chatUser"."userId" = "user"."id"
                  LIMIT 1
                )
                AND "user"."id" = "p"."userId"
                LIMIT 1
              )
            ), false) AS "hasChats"
          FROM "profile" AS "p"
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
          { id: number },
          never,
          typeof profilesQuery,
          false
        >
      >();

      const query = db.chat.profiles({ id: 1 });
      expectSql(
        query.toSql(),
        `
          SELECT * FROM "profile" AS "profiles"
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

    it('should have disabled create method', () => {
      // @ts-expect-error hasMany with through option should not have chained create
      db.profile.chats.create(chatData);
    });

    it('should have proper joinQuery', () => {
      expectSql(
        db.chat.relations.profiles
          .joinQuery(db.chat.as('c'), db.profile.as('p'))
          .toSql(),
        `
          SELECT * FROM "profile" AS "p"
          WHERE EXISTS (
            SELECT 1 FROM "user" AS "users"
            WHERE "p"."userId" = "users"."id"
              AND EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."userId" = "users"."id"
                  AND "chatUser"."chatId" = "c"."id"
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
          SELECT * FROM "chat"
          WHERE EXISTS (
            SELECT 1 FROM "profile" AS "profiles"
            WHERE EXISTS (
              SELECT 1 FROM "user" AS "users"
              WHERE "profiles"."userId" = "users"."id"
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."userId" = "users"."id"
                    AND "chatUser"."chatId" = "chat"."id"
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
          .whereExists('profiles', (q) => q.where({ bio: 'bio' }))
          .toSql(),
        `
          SELECT * FROM "chat" AS "c"
          WHERE EXISTS (
            SELECT 1 FROM "profile" AS "profiles"
            WHERE EXISTS (
              SELECT 1 FROM "user" AS "users"
              WHERE "profiles"."userId" = "users"."id"
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."userId" = "users"."id"
                    AND "chatUser"."chatId" = "c"."id"
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
        .join('profiles', (q) => q.where({ bio: 'bio' }))
        .select('title', 'profiles.bio');

      assertType<
        Awaited<typeof query>,
        { title: string; bio: string | null }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT "c"."title", "profiles"."bio" FROM "chat" AS "c"
          JOIN "profile" AS "profiles"
            ON EXISTS (
              SELECT 1 FROM "user" AS "users"
              WHERE "profiles"."userId" = "users"."id"
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."userId" = "users"."id"
                    AND "chatUser"."chatId" = "c"."id"
                  LIMIT 1
                )
              LIMIT 1
            )
            AND "profiles"."bio" = $1
        `,
        ['bio'],
      );
    });

    describe('select', () => {
      it('should be selectable', () => {
        const query = db.chat.as('c').select('id', {
          profiles: (q) => q.profiles.where({ bio: 'bio' }),
        });

        assertType<
          Awaited<typeof query>,
          { id: number; profiles: Profile[] }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "c"."id",
              (
                SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
                FROM (
                  SELECT *
                  FROM "profile" AS "profiles"
                  WHERE EXISTS (
                    SELECT 1 FROM "user" AS "users"
                    WHERE "profiles"."userId" = "users"."id"
                      AND EXISTS (
                        SELECT 1 FROM "chatUser"
                        WHERE "chatUser"."userId" = "users"."id"
                          AND "chatUser"."chatId" = "c"."id"
                        LIMIT 1
                      )
                    LIMIT 1
                  )
                  AND "profiles"."bio" = $1
                ) AS "t"
              ) AS "profiles"
            FROM "chat" AS "c"
          `,
          ['bio'],
        );
      });

      it('should be selectable by relation name', () => {
        const query = db.chat.select('id', 'profiles');

        assertType<
          Awaited<typeof query>,
          { id: number; profiles: Profile[] }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "chat"."id",
              (
                SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
                FROM (
                  SELECT *
                  FROM "profile" AS "profiles"
                  WHERE EXISTS (
                    SELECT 1 FROM "user" AS "users"
                    WHERE "profiles"."userId" = "users"."id"
                      AND EXISTS (
                        SELECT 1 FROM "chatUser"
                        WHERE "chatUser"."userId" = "users"."id"
                          AND "chatUser"."chatId" = "chat"."id"
                        LIMIT 1
                      )
                    LIMIT 1
                  )
                ) AS "t"
              ) AS "profiles"
            FROM "chat"
          `,
          [],
        );
      });

      it('should allow to select count', () => {
        const query = db.chat.as('c').select('id', {
          profilesCount: (q) => q.profiles.count(),
        });

        assertType<
          Awaited<typeof query>,
          { id: number; profilesCount: number }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "c"."id",
              (
                SELECT count(*)
                FROM "profile" AS "profiles"
                WHERE EXISTS (
                  SELECT 1 FROM "user" AS "users"
                  WHERE "profiles"."userId" = "users"."id"
                    AND EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."userId" = "users"."id"
                        AND "chatUser"."chatId" = "c"."id"
                      LIMIT 1
                    )
                  LIMIT 1
                )
              ) AS "profilesCount"
            FROM "chat" AS "c"
          `,
          [],
        );
      });

      it('should allow to pluck values', () => {
        const query = db.chat.as('c').select('id', {
          bios: (q) => q.profiles.pluck('bio'),
        });

        assertType<
          Awaited<typeof query>,
          { id: number; bios: (string | null)[] }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "c"."id",
              (
                SELECT COALESCE(json_agg("c"), '[]')
                FROM (
                  SELECT "profiles"."bio" AS "c"
                  FROM "profile" AS "profiles"
                  WHERE EXISTS (
                    SELECT 1 FROM "user" AS "users"
                    WHERE "profiles"."userId" = "users"."id"
                      AND EXISTS (
                        SELECT 1 FROM "chatUser"
                        WHERE "chatUser"."userId" = "users"."id"
                          AND "chatUser"."chatId" = "c"."id"
                        LIMIT 1
                      )
                    LIMIT 1
                  )
                ) AS "t"
              ) AS "bios"
            FROM "chat" AS "c"
          `,
        );
      });

      it('should handle exists sub query', () => {
        const query = db.chat.as('c').select('id', {
          hasProfiles: (q) => q.profiles.exists(),
        });

        assertType<
          Awaited<typeof query>,
          { id: number; hasProfiles: boolean }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "c"."id",
              COALESCE((
                SELECT true
                FROM "profile" AS "profiles"
                WHERE EXISTS (
                  SELECT 1 FROM "user" AS "users"
                  WHERE "profiles"."userId" = "users"."id"
                    AND EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."userId" = "users"."id"
                        AND "chatUser"."chatId" = "c"."id"
                      LIMIT 1
                    )
                  LIMIT 1
                )
              ), false) AS "hasProfiles"
            FROM "chat" AS "c"
          `,
        );
      });
    });
  });
});
