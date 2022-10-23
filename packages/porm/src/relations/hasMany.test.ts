import { db, pgConfig } from '../test-utils/test-db';
import {
  AssertEqual,
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

      const userId = await db.user.get('id').insert(userData);
      const chatId = await db.chat.get('id').insert(chatData);

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
                SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
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

    it('should allow to pluck values', () => {
      const query = db.user.select('id', db.user.messages.pluck('text'));

      const eq: AssertEqual<
        Awaited<typeof query>,
        { id: number; messages: string[] }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
          SELECT
            "user"."id",
            (
              SELECT COALESCE(json_agg("c"), '[]')
              FROM (
                SELECT "messages"."text" AS "c"
                FROM "message" AS "messages"
                WHERE "messages"."authorId" = "user"."id"
              ) AS "t"
            ) AS "messages"
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

    describe('nested create', () => {
      it('should support create', async () => {
        const chatId = await db.chat.get('id').insert(chatData);

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

      it('should support create in batch insert', async () => {
        const chatId = await db.chat.get('id').insert(chatData);

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
    });

    describe('nested connect', () => {
      it('should support connect', async () => {
        const chatId = await db.chat.get('id').insert(chatData);
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

      it('should support connect in batch insert', async () => {
        const chatId = await db.chat.get('id').insert(chatData);
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
    });

    describe('connectOrCreate', () => {
      it('should support connect or create', async () => {
        const chatId = await db.chat.get('id').insert(chatData);
        const messageId = await db.message.get('id').insert({
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

      it('should support connect or create in batch insert', async () => {
        const chatId = await db.chat.get('id').insert(chatData);
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
  });

  describe('update', () => {
    describe('disconnect', () => {
      it('should nullify foreignKey', async () => {
        const chatId = await db.chat
          .get('id')
          .insert({ ...chatData, title: 'chat 1' });

        const userId = await db.user.get('id').insert({
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
          .insert({ ...chatData, title: 'chat 1' });

        const userIds = await db.user.pluck('id').insert([
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
        const chatId = await db.chat.get('id').insert(chatData);
        const id = await db.user.get('id').insert({
          ...userData,
          messages: {
            create: [
              { ...messageData, chatId, text: 'message 1' },
              { ...messageData, chatId, text: 'message 2' },
            ],
          },
        });

        await db.message.insert({ ...messageData, chatId, text: 'message 3' });

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
        const chatId = await db.chat.get('id').insert(chatData);

        const id = await db.user.get('id').insert({
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
            delete: [{ text: 'message 1' }, { text: 'message 2' }],
          },
        });

        expect(await db.message.count()).toBe(1);

        const messages = await db.user.messages({ id }).select('text');
        expect(messages).toEqual([{ text: 'message 3' }]);
      });

      it('should delete related records in batch update', async () => {
        const chatId = await db.chat.get('id').insert(chatData);

        const userIds = await db.user.pluck('id').insert([
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
        const chatId = await db.chat.get('id').insert(chatData);

        const id = await db.user.get('id').insert({
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
        const chatId = await db.chat.get('id').insert(chatData);

        const userIds = await db.user.pluck('id').insert([
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
        const chatId = await db.chat.get('id').insert(chatData);
        const user = await db.user.create(userData);

        await db.user.find(user.id).update({
          messages: {
            create: [
              { ...messageData, chatId, text: 'created 1' },
              { ...messageData, chatId, text: 'created 2' },
            ],
          },
        });

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

    it('should allow to pluck values', () => {
      const query = db.profile.select('id', db.profile.chats.pluck('title'));

      const eq: AssertEqual<
        Awaited<typeof query>,
        { id: number; chats: string[] }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
          SELECT
            "profile"."id",
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
                  AND "user"."id" = "profile"."userId"
                  LIMIT 1
                )
              ) AS "t"
            ) AS "chats"
          FROM "profile"
        `,
      );
    });
  });

  describe('through hasOne', () => {
    it('should have method to query related data', () => {
      const profilesQuery = db.profile.all();

      const eq: AssertEqual<
        typeof db.chat.profiles,
        RelationQuery<
          'profiles',
          { id: number },
          never,
          typeof profilesQuery,
          false
        >
      > = true;

      expect(eq).toBe(true);

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
          .whereExists('profiles', (q) => q.where({ 'chat.title': 'title' }))
          .toSql(),
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
            AND "chat"."title" = $1
            LIMIT 1
          )
        `,
        ['title'],
      );
    });

    it('should be supported in join', () => {
      const query = db.chat
        .join('profiles', (q) => q.where({ 'chat.title': 'title' }))
        .select('title', 'profiles.bio');

      const eq: AssertEqual<
        Awaited<typeof query>,
        { title: string; bio: string | null }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
          SELECT "chat"."title", "profiles"."bio" FROM "chat"
          JOIN "profile" AS "profiles"
            ON EXISTS (
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
            AND "chat"."title" = $1
        `,
        ['title'],
      );
    });

    describe('select', () => {
      it('should be selectable', () => {
        const query = db.chat.select(
          'id',
          db.chat.profiles.where({ bio: 'bio' }),
        );

        const eq: AssertEqual<
          Awaited<typeof query>,
          { id: number; profiles: Profile[] }[]
        > = true;
        expect(eq).toBe(true);

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
                  AND "profiles"."bio" = $1
                ) AS "t"
              ) AS "profiles"
            FROM "chat"
          `,
          ['bio'],
        );
      });

      it('should be selectable by relation name', () => {
        const query = db.chat.select('id', 'profiles');

        const eq: AssertEqual<
          Awaited<typeof query>,
          { id: number; profiles: Profile[] }[]
        > = true;
        expect(eq).toBe(true);

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
        const query = db.chat.select('id', db.chat.profiles.count());

        const eq: AssertEqual<
          Awaited<typeof query>,
          { id: number; profiles: number }[]
        > = true;
        expect(eq).toBe(true);

        expectSql(
          query.toSql(),
          `
            SELECT
              "chat"."id",
              (
                SELECT count(*)
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
              ) AS "profiles"
            FROM "chat"
          `,
          [],
        );
      });

      it('should allow to select count with alias', () => {
        const query = db.chat.select(
          'id',
          db.chat.profiles.count().as('profilesCount'),
        );

        const eq: AssertEqual<
          Awaited<typeof query>,
          { id: number; profilesCount: number }[]
        > = true;
        expect(eq).toBe(true);

        expectSql(
          query.toSql(),
          `
            SELECT
              "chat"."id",
              (
                SELECT count(*)
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
              ) AS "profilesCount"
            FROM "chat"
          `,
          [],
        );
      });

      it('should allow to pluck values', () => {
        const query = db.chat.select('id', db.chat.profiles.pluck('bio'));

        const eq: AssertEqual<
          Awaited<typeof query>,
          { id: number; profiles: (string | null)[] }[]
        > = true;
        expect(eq).toBe(true);

        expectSql(
          query.toSql(),
          `
            SELECT
              "chat"."id",
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
    });
  });
});
