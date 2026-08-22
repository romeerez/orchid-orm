import { Db, NotFoundError } from 'pqb';
import { omit } from 'pqb/internal';
import {
  useQueryCounter,
  useRelationCallback,
  useTestORM,
} from '../../test-utils/orm.test-utils';
import { orchidORMWithAdapter } from '../../orm-instance/orm-instance';
import {
  db,
  Profile,
  assertType,
  expectSql,
  MessageData,
  ChatData,
  ProfileData,
  UserData,
  UserSelectAll,
  ProfileSelectAll,
} from 'test-utils';
import { createTableFactory } from '../../orm-table/table';

const ormParams = { db: db.$qb };

describe('belongsTo create', () => {
  useTestORM();

  const { resetQueriesCount, getQueriesCount } = useQueryCounter();

  const testData = {
    createMessageChat: (Title = 'chat') => ({
      create: {
        ...ChatData,
        Title,
      },
    }),
    createOrConnectMessageChat: (Title = 'chat') => ({
      connectOrCreate: {
        where: { Title },
        create: { ...ChatData, Title },
      },
    }),
    createMessageSender: (Name = 'user') => ({
      create: {
        ...UserData,
        Name,
      },
    }),
    createOrConnectMessageSender: (Name = 'user') => ({
      connectOrCreate: {
        where: { Name },
        create: { ...UserData, Name },
      },
    }),
  };

  const assert = {
    async message({
      messageId,
      ChatId,
      AuthorId,
      Text,
    }: {
      messageId: number;
      ChatId: number;
      AuthorId: number | null;
      Text: string;
    }) {
      const message = await db.message.find(messageId);
      expect(message).toEqual({
        ...message,
        ...MessageData,
        ChatId,
        AuthorId,
        Text,
      });
    },

    async chat({
      ChatId,
      ...data
    }: {
      ChatId: number;
      Title: string;
      Active?: boolean;
    }) {
      const chat = await db.chat.find(ChatId);
      expect(chat).toEqual({
        ...chat,
        ...ChatData,
        ...data,
      });
    },

    activeChat(params: { ChatId: number; Title: string }) {
      return this.chat({ ...params, Active: true });
    },

    async sender({
      AuthorId,
      ...data
    }: {
      AuthorId: number;
      Name: string;
      Active?: boolean;
    }) {
      const user = await db.user.find(AuthorId);
      expect(user).toEqual({
        ...user,
        ...omit(UserData, ['Password']),
        Age: null,
        Data: null,
        Picture: null,
        Active: null,
        ...data,
      });
    },

    activeSender(params: { AuthorId: number; Name: string; Active?: boolean }) {
      return this.sender({ ...params, Active: true });
    },
  };

  describe('create', () => {
    it('should restrict the type', () => {
      db.profile.create({
        ...ProfileData,
        user: {
          // @ts-expect-error the type is restricted
          create: 123,
        },
      });

      db.profile.createMany([
        {
          ...ProfileData,
          user: {
            // @ts-expect-error the type is restricted
            create: 123,
          },
        },
      ]);
    });

    it('should support create', async () => {
      const chatData = testData.createMessageChat();
      const senderData = testData.createMessageSender();

      const q = db.message.select('Id', 'ChatId', 'AuthorId').create({
        createdAt: MessageData.createdAt,
        updatedAt: MessageData.updatedAt,
        Text: 'message',
        chat: chatData,
        sender: senderData,
      });

      const { Id: messageId, ChatId, AuthorId } = await q;

      expect(getQueriesCount()).toEqual(1);

      await assert.message({ messageId, ChatId, AuthorId, Text: 'message' });
      await assert.chat({ ChatId, Title: 'chat' });
      await assert.sender({ AuthorId, Name: 'user' });
    });

    it('should support create using `on`', async () => {
      const {
        Id: messageId,
        ChatId,
        AuthorId,
      } = await db.message.select('Id', 'ChatId', 'AuthorId').create({
        createdAt: MessageData.createdAt,
        updatedAt: MessageData.updatedAt,
        Text: 'message',
        activeChat: testData.createMessageChat(),
        activeSender: testData.createMessageSender(),
      });

      expect(getQueriesCount()).toEqual(1);

      await assert.message({ messageId, ChatId, AuthorId, Text: 'message' });
      await assert.activeChat({ ChatId, Title: 'chat' });
      await assert.activeSender({ AuthorId, Name: 'user' });
    });

    it('should support create in batch create', async () => {
      const q = db.message.select('Id', 'ChatId', 'AuthorId').createMany(
        Array.from({ length: 2 }, (_, i) => ({
          createdAt: MessageData.createdAt,
          updatedAt: MessageData.updatedAt,
          Text: `message ${i + 1}`,
          chat: testData.createMessageChat(`chat ${i + 1}`),
          sender: testData.createMessageSender(`user ${i + 1}`),
        })),
      );

      const [first, second] = await q;

      expect(getQueriesCount()).toEqual(1);

      await assert.message({
        messageId: first.Id,
        ChatId: first.ChatId,
        AuthorId: first.AuthorId,
        Text: 'message 1',
      });
      await assert.chat({ ChatId: first.ChatId, Title: 'chat 1' });
      if (!first.AuthorId) {
        throw new Error('Missing AuthorId');
      }
      await assert.sender({ AuthorId: first.AuthorId, Name: 'user 1' });

      await assert.message({
        messageId: second.Id,
        ChatId: second.ChatId,
        AuthorId: second.AuthorId,
        Text: 'message 2',
      });
      await assert.chat({ ChatId: second.ChatId, Title: 'chat 2' });
      if (!second.AuthorId) {
        throw new Error('Missing AuthorId');
      }
      await assert.sender({ AuthorId: second.AuthorId, Name: 'user 2' });
    });

    it('should support create in batch create using `on`', async () => {
      const q = db.message.select('Id', 'ChatId', 'AuthorId').createMany(
        Array.from({ length: 2 }, (_, i) => ({
          createdAt: MessageData.createdAt,
          updatedAt: MessageData.updatedAt,
          Text: `message ${i + 1}`,
          activeChat: testData.createMessageChat(`chat ${i + 1}`),
          activeSender: testData.createMessageSender(`user ${i + 1}`),
        })),
      );

      const [first, second] = await q;

      expect(getQueriesCount()).toEqual(1);

      await assert.message({
        messageId: first.Id,
        ChatId: first.ChatId,
        AuthorId: first.AuthorId,
        Text: 'message 1',
      });
      await assert.activeChat({ ChatId: first.ChatId, Title: 'chat 1' });
      if (!first.AuthorId) {
        throw new Error('Missing AuthorId');
      }
      await assert.activeSender({ AuthorId: first.AuthorId, Name: 'user 1' });

      await assert.message({
        messageId: second.Id,
        ChatId: second.ChatId,
        AuthorId: second.AuthorId,
        Text: 'message 2',
      });
      await assert.activeChat({ ChatId: second.ChatId, Title: 'chat 2' });
      if (!second.AuthorId) {
        throw new Error('Missing AuthorId');
      }
      await assert.activeSender({
        AuthorId: second.AuthorId,
        Name: 'user 2',
      });
    });

    it('should support nested create with a value from `with`', async () => {
      const q = db.$qb
        .with('user', db.user.create(UserData))
        .with('profile', (q) =>
          db.profile.create({
            ...ProfileData,
            UserId: () => q.from('user').get('Id'),
          }),
        )
        .from('profile');

      assertType<Awaited<typeof q>, (Profile & { UserId: number })[]>();

      expectSql(
        q.toSQL(),
        `
          WITH "user" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at")
            VALUES ($1, $2, $3, $4, $5)
            RETURNING ${UserSelectAll}
          ),
          "profile" AS (
            INSERT INTO "schema"."profile" AS "Profile"("bio", "profile_key", "updated_at", "created_at", "user_id")
            VALUES (
              $6, $7, $8, $9,
              (
                SELECT "user"."Id" FROM "user" LIMIT 1
              )
            )
            RETURNING ${ProfileSelectAll}
          )
          SELECT * FROM "profile"
        `,
        [...Object.values(UserData), ...Object.values(ProfileData)],
      );
    });

    describe('id has no default', () => {
      // for this issue: https://github.com/romeerez/orchid-orm/issues/34
      it('should create record with explicitly setting id and foreign key', async () => {
        const { defineTable } = createTableFactory({ snakeCase: true });
        const UserTable = defineTable('user', { schema: 'schema' }, (t) => ({
          Id: t.name('id').identity().primaryKey(),
          UserKey: t.name('user_key').text(),
          Name: t.name('name').text(),
          Password: t.name('password').text(),
          ...t.timestamps(),
        }));

        const ProfileTable = defineTable(
          'profile',
          { schema: 'schema' },
          (t) => ({
            Id: t.name('id').identity().primaryKey(),
            ProfileKey: t.name('profile_key').text(),
            UserId: t
              .name('user_id')
              .integer()
              .nullable()
              .foreignKey(() => UserTable, 'Id'),
            Bio: t.name('bio').text().nullable(),
            Active: t.name('active').boolean().nullable(),
            ...t.timestamps(),
          }),
        ).relations((profile) => ({
          user: profile('UserId', 'ProfileKey')
            .belongsTo(() => UserTable('Id', 'UserKey'))
            .required(),
        }));

        const db = orchidORMWithAdapter(ormParams, {
          user: UserTable,
          profile: ProfileTable,
        });

        const UserId = await db.user.get('Id').create(UserData);

        const q = db.profile.create({
          Id: 1,
          UserId,
          ProfileKey: 'key',
          Bio: 'bio',
        });

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "schema"."profile"("id", "user_id", "profile_key", "bio")
            VALUES ($1, $2, $3, $4)
            RETURNING ${ProfileSelectAll}
          `,
          [1, UserId, 'key', 'bio'],
        );

        resetQueriesCount();

        const result = await q;

        expect(getQueriesCount()).toBe(1);

        expect(result).toMatchObject({
          Id: 1,
          UserId,
          ProfileKey: 'key',
          Bio: 'bio',
        });
      });
    });

    describe('relation callbacks', () => {
      const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
        db.message.relations.chat,
        ['IdOfChat'],
      );

      const data = {
        Text: 'text',
        chat: {
          create: ChatData,
        },
      };

      it('should invoke callbacks', async () => {
        await db.message.create(data);

        expect(getQueriesCount()).toEqual(1);

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(
          [{ IdOfChat: expect.any(Number), ChatKey: 'key' }],
          expect.any(Db),
        );
      });

      it('should invoke callbacks in a batch create', async () => {
        resetMocks();

        await db.message.createMany([data, data]);

        expect(getQueriesCount()).toEqual(1);

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(
          [
            { IdOfChat: expect.any(Number), ChatKey: 'key' },
            { IdOfChat: expect.any(Number), ChatKey: 'key' },
          ],
          expect.any(Db),
        );
      });
    });

    it('should create the belongsTo record in upsert', async () => {
      const profile = await db.profile
        .select('UserId', 'ProfileKey')
        .find(123)
        .upsert({
          update: {
            Bio: 'updated',
          },
          create: {
            ...ProfileData,
            user: { create: { ...UserData, Name: 'upsert created user' } },
          },
        })
        .narrowType()<{ UserId: number }>();

      expect(getQueriesCount()).toBe(2);

      const users = await db.user;

      expect(users).toMatchObject([
        {
          Id: profile.UserId,
          UserKey: profile.ProfileKey,
          Name: 'upsert created user',
        },
      ]);
    });
  });

  describe('connect', () => {
    it('should restrict the type', () => {
      expect(() =>
        db.profile.create({
          ...ProfileData,
          user: {
            // @ts-expect-error the type is restricted
            connect: 123,
          },
        }),
      ).toThrow();
    });

    it('should support connect', async () => {
      await db.chat.create({ ...ChatData, Title: 'chat' });
      await db.user.create({ ...UserData, Name: 'user' });
      resetQueriesCount();

      const q = db.message.select('Id', 'ChatId', 'AuthorId').create({
        createdAt: MessageData.createdAt,
        updatedAt: MessageData.updatedAt,
        Text: 'message',
        chat: {
          connect: { Title: 'chat' },
        },
        sender: {
          connect: { Name: 'user' },
        },
      });

      const { Id: messageId, ChatId, AuthorId } = await q;

      expect(getQueriesCount()).toBe(1);

      await assert.message({ messageId, ChatId, AuthorId, Text: 'message' });
      await assert.chat({ ChatId, Title: 'chat' });
      await assert.sender({ AuthorId, Name: 'user' });
    });

    it('should not connect when `on` condition does not match', async () => {
      await db.chat.create({ ...ChatData, Title: 'chat' });
      await db.user.create({ ...UserData, Name: 'user' });
      resetQueriesCount();

      const q = db.message.select('Id', 'ChatId', 'AuthorId').create({
        createdAt: MessageData.createdAt,
        updatedAt: MessageData.updatedAt,
        Text: 'message',
        // ok
        chat: {
          connect: { Title: 'chat' },
        },
        // should fail
        activeSender: {
          connect: { Name: 'user' },
        },
      });

      const res = await q.catch((err) => err);

      expect(getQueriesCount()).toEqual(1);

      expect(res).toEqual(expect.any(NotFoundError));
    });

    it('should support connect in batch create', async () => {
      await db.chat.createMany([
        { ...ChatData, Title: 'chat 1' },
        { ...ChatData, Title: 'chat 2' },
      ]);
      await db.user.createMany([
        { ...UserData, Name: 'user 1' },
        { ...UserData, Name: 'user 2' },
      ]);
      resetQueriesCount();

      const q = db.message.select('Id', 'ChatId', 'AuthorId').createMany([
        {
          createdAt: MessageData.createdAt,
          updatedAt: MessageData.updatedAt,
          Text: 'message 1',
          chat: {
            connect: { Title: 'chat 1' },
          },
          sender: {
            connect: { Name: 'user 1' },
          },
        },
        {
          createdAt: MessageData.createdAt,
          updatedAt: MessageData.updatedAt,
          Text: 'message 2',
          chat: {
            connect: { Title: 'chat 2' },
          },
          sender: {
            connect: { Name: 'user 2' },
          },
        },
      ]);

      const [first, second] = await q;

      expect(getQueriesCount()).toEqual(1);

      await assert.message({
        messageId: first.Id,
        ChatId: first.ChatId,
        AuthorId: first.AuthorId,
        Text: 'message 1',
      });
      await assert.chat({ ChatId: first.ChatId, Title: 'chat 1' });
      if (!first.AuthorId) {
        throw new Error('Missing AuthorId');
      }
      await assert.sender({ AuthorId: first.AuthorId, Name: 'user 1' });

      await assert.message({
        messageId: second.Id,
        ChatId: second.ChatId,
        AuthorId: second.AuthorId,
        Text: 'message 2',
      });
      await assert.chat({ ChatId: second.ChatId, Title: 'chat 2' });
      if (!second.AuthorId) {
        throw new Error('Missing AuthorId');
      }
      await assert.sender({ AuthorId: second.AuthorId, Name: 'user 2' });
    });

    it('should not connect in batch create if `on` condition does not match', async () => {
      await db.chat.create(ChatData);
      await db.user.create(UserData);
      resetQueriesCount();

      const q = db.message.createMany([
        {
          ...MessageData,
          chat: {
            connect: { Title: ChatData.Title },
          },
          activeSender: {
            connect: { Name: UserData.Name },
          },
        },
      ]);

      const res = await q.catch((err) => err);

      expect(getQueriesCount()).toEqual(1);

      expect(res).toEqual(expect.any(NotFoundError));
    });

    it('should connect the belongsTo record in upsert', async () => {
      await db.user.create({
        ...UserData,
        UserKey: 'tmp',
        Name: 'upsert connected user',
      });

      resetQueriesCount();

      const profile = await db.profile
        .select('UserId', 'ProfileKey')
        .find(123)
        .upsert({
          update: {
            Bio: 'updated',
          },
          create: {
            ...ProfileData,
            user: { connect: { Name: 'upsert connected user' } },
          },
        });

      expect(getQueriesCount()).toBe(2);

      if (!profile.UserId) {
        throw new Error('Missing UserId');
      }

      const users = await db.user;

      expect(users).toMatchObject([
        {
          Id: profile.UserId,
          UserKey: profile.ProfileKey,
          Name: 'upsert connected user',
        },
      ]);
    });
  });

  describe('connectOrCreate', () => {
    it('should restrict the type', () => {
      expect(() =>
        db.profile.create({
          ...ProfileData,
          user: {
            // @ts-expect-error the type is restricted
            connectOrCreate: 123,
          },
        }),
      ).toThrow();
    });

    it('should support connect or create', async () => {
      const chat = await db.chat.select('IdOfChat').create({
        ...ChatData,
        Title: 'chat',
      });
      resetQueriesCount();

      const q = db.message.select('Id', 'ChatId', 'AuthorId').create({
        updatedAt: MessageData.updatedAt,
        createdAt: MessageData.createdAt,
        Text: 'message',
        chat: testData.createOrConnectMessageChat(),
        sender: testData.createOrConnectMessageSender(),
      });

      const { Id: messageId, ChatId, AuthorId } = await q;

      expect(getQueriesCount()).toEqual(1);

      expect(ChatId).toBe(chat.IdOfChat);

      await assert.message({ messageId, ChatId, AuthorId, Text: 'message' });
      await assert.chat({ ChatId, Title: 'chat' });
      await assert.sender({ AuthorId, Name: 'user' });
    });

    it('should connect and create using `on`', async () => {
      const activeChat = await db.chat.select('IdOfChat').create({
        ...ChatData,
        Title: 'chat',
        Active: true,
      });
      const user = await db.user.select('Id').create({
        ...UserData,
        Name: 'name',
      });
      resetQueriesCount();

      const q = await db.message.select('Id', 'ChatId', 'AuthorId').create({
        updatedAt: MessageData.updatedAt,
        createdAt: MessageData.createdAt,
        Text: 'message',
        activeChat: testData.createOrConnectMessageChat(),
        activeSender: testData.createOrConnectMessageSender(),
      });

      const { Id: messageId, ChatId, AuthorId } = await q;

      expect(getQueriesCount()).toEqual(1);

      expect(ChatId).toBe(activeChat.IdOfChat);
      expect(AuthorId).not.toBe(user.Id);

      await assert.message({ messageId, ChatId, AuthorId, Text: 'message' });
      await assert.activeChat({ ChatId, Title: 'chat' });
      await assert.activeSender({ AuthorId, Name: 'user' });
    });

    it('should support connect or create in batch create', async () => {
      const chat = await db.chat.select('IdOfChat').create({
        ...ChatData,
        Title: 'chat 1',
      });
      const user = await db.user.select('Id').create({
        ...UserData,
        Name: 'user 2',
      });
      resetQueriesCount();

      const q = await db.message.select('Id', 'ChatId', 'AuthorId').createMany([
        {
          updatedAt: MessageData.updatedAt,
          createdAt: MessageData.createdAt,
          Text: 'message 1',
          chat: testData.createOrConnectMessageChat('chat 1'),
          sender: testData.createOrConnectMessageSender('user 1'),
        },
        {
          updatedAt: MessageData.updatedAt,
          createdAt: MessageData.createdAt,
          Text: 'message 2',
          chat: testData.createOrConnectMessageChat('chat 2'),
          sender: testData.createOrConnectMessageSender('user 2'),
        },
      ]);

      const [first, second] = await q;

      expect(getQueriesCount()).toEqual(1);

      expect(first.ChatId).toBe(chat.IdOfChat);
      expect(second.AuthorId).toBe(user.Id);

      await assert.message({
        messageId: first.Id,
        ChatId: first.ChatId,
        AuthorId: first.AuthorId,
        Text: 'message 1',
      });
      await assert.chat({ ChatId: first.ChatId, Title: 'chat 1' });
      if (!first.AuthorId) {
        throw new Error('Missing AuthorId');
      }
      await assert.sender({ AuthorId: first.AuthorId, Name: 'user 1' });

      await assert.message({
        messageId: second.Id,
        ChatId: second.ChatId,
        AuthorId: second.AuthorId,
        Text: 'message 2',
      });
      await assert.chat({ ChatId: second.ChatId, Title: 'chat 2' });
      if (!second.AuthorId) {
        throw new Error('Missing AuthorId');
      }
      await assert.sender({ AuthorId: second.AuthorId, Name: 'user 2' });
    });

    it('should connect and create in batch using `on`', async () => {
      const activeChat = await db.chat.select('IdOfChat').create({
        ...ChatData,
        Title: 'chat',
        Active: true,
      });
      const user = await db.user.select('Id').create({
        ...UserData,
        Name: 'user',
      });
      resetQueriesCount();

      const q = await db.message.select('Id', 'ChatId', 'AuthorId').createMany([
        {
          updatedAt: MessageData.updatedAt,
          createdAt: MessageData.createdAt,
          Text: 'message',
          activeChat: testData.createOrConnectMessageChat(),
          activeSender: testData.createOrConnectMessageSender(),
        },
      ]);

      const [{ Id: messageId, ChatId, AuthorId }] = await q;

      expect(getQueriesCount()).toEqual(1);

      expect(ChatId).toBe(activeChat.IdOfChat);
      expect(AuthorId).not.toBe(user.Id);

      await assert.message({ messageId, ChatId, AuthorId, Text: 'message' });
      await assert.chat({ ChatId, Title: 'chat' });
      if (!AuthorId) {
        throw new Error('Missing AuthorId');
      }
      await assert.activeSender({ AuthorId, Name: 'user' });
    });

    describe('relation callbacks', () => {
      const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
        db.message.relations.chat,
        ['IdOfChat'],
      );

      const data = {
        Text: 'text',
        chat: {
          connectOrCreate: {
            where: { Title: 'title' },
            create: ChatData,
          },
        },
      };

      it('should invoke callbacks', async () => {
        await db.message.create(data);

        expect(getQueriesCount()).toEqual(1);
        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(
          [{ IdOfChat: expect.any(Number), ChatKey: 'key' }],
          expect.any(Db),
        );
      });

      it('should invoke callbacks in a batch create', async () => {
        resetMocks();

        await db.message.createMany([data, data]);

        expect(getQueriesCount()).toEqual(1);
        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(
          [
            { IdOfChat: expect.any(Number), ChatKey: 'key' },
            { IdOfChat: expect.any(Number), ChatKey: 'key' },
          ],
          expect.any(Db),
        );
      });
    });

    it('should connect or create the belongsTo record in upsert', async () => {
      await db.user.create({
        ...UserData,
        UserKey: 'tmp',
        Name: 'upsert connected or created user',
      });

      resetQueriesCount();

      const profile = await db.profile
        .select('UserId', 'ProfileKey')
        .find(123)
        .upsert({
          update: {
            Bio: 'updated',
          },
          create: {
            ...ProfileData,
            user: {
              connectOrCreate: {
                where: { Name: 'upsert connected or created user' },
                create: {
                  ...UserData,
                  Name: 'upsert connected or created user',
                },
              },
            },
          },
        });

      expect(getQueriesCount()).toBe(2);

      if (!profile.UserId) {
        throw new Error('Missing UserId');
      }

      const users = await db.user;

      expect(users).toMatchObject([
        {
          Id: profile.UserId,
          UserKey: profile.ProfileKey,
          Name: 'upsert connected or created user',
        },
      ]);
    });
  });
});
