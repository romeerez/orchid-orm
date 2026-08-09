import { Db } from 'pqb';
import { omit, TransactionAdapterClass } from 'pqb/internal';
import {
  useRelationCallback,
  useTestORM,
} from '../../test-utils/orm.test-utils';
import {
  Chat,
  UserData,
  UserDefaultSelect,
  ChatData,
  db,
  expectSql,
  now,
} from 'test-utils';

const activeChatData = { ...ChatData, Active: true };

describe('hasAndBelongsToMany', () => {
  useTestORM();

  describe('create', () => {
    const assert = {
      user({
        user,
        Name,
        Active = null,
      }: {
        user: UserDefaultSelect;
        Name: string;
        Active?: boolean | null;
      }) {
        expect(user).toEqual({
          ...omit(UserData, ['Password']),
          Active,
          Age: null,
          Data: null,
          Picture: null,
          Balance: null,
          Id: user.Id,
          Name,
        });
      },

      chats({
        chats,
        title1,
        title2,
        Active = null,
      }: {
        chats: Chat[];
        title1: string;
        title2: string;
        Active?: boolean | null;
      }) {
        expect(chats[0]).toEqual({
          ...ChatData,
          IdOfChat: chats[0].IdOfChat,
          Title: title1,
          Active,
        });

        expect(chats[1]).toEqual({
          ...ChatData,
          IdOfChat: chats[1].IdOfChat,
          Title: title2,
          Active,
        });
      },

      activeChats(params: { chats: Chat[]; title1: string; title2: string }) {
        return this.chats({ ...params, Active: true });
      },
    };

    describe('nested create', () => {
      it('should support create', async () => {
        const q = db.user.select('Id', 'UserKey').create({
          ...UserData,
          Name: 'user 1',
          chats: {
            create: [
              {
                ...ChatData,
                Title: 'chat 1',
              },
              {
                ...ChatData,
                Title: 'chat 2',
              },
            ],
          },
        });

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');
        const arraysSpy = jest.spyOn(
          TransactionAdapterClass.prototype,
          'arrays',
        );

        const user = await q;
        const chatIds = await db.user
          .queryRelated('chats', user)
          .order('IdOfChat')
          .pluck('IdOfChat');

        const [
          createUserSqlCall,
          createChatsSqlCall,
          maybeCreateChatUserSqlCall,
        ] = querySpy.mock.calls;
        const createUserSql = {
          text: createUserSqlCall[0],
          values: createUserSqlCall[1],
        };
        const createChatsSql = {
          text: createChatsSqlCall[0],
          values: createChatsSqlCall[1],
        };
        const createChatUserSqlCall =
          arraysSpy.mock.calls[0] || maybeCreateChatUserSqlCall;
        const createChatUserSql = {
          text: createChatUserSqlCall[0],
          values: createChatUserSqlCall[1],
        };

        expectSql(
          createUserSql,
          `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5)
          RETURNING "User"."id" "Id", "User"."user_key" "UserKey"
        `,
          ['user 1', 'key', 'password', now, now],
        );

        expectSql(
          createChatsSql,
          `
          INSERT INTO "schema"."chat" AS "chats"("title", "chat_key", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
          RETURNING "chats"."id_of_chat" "IdOfChat", "chats"."chat_key" "ChatKey"
        `,
          ['chat 1', 'key', now, now, 'chat 2', 'key', now, now],
        );

        expectSql(
          createChatUserSql,
          `
          INSERT INTO "schema"."chat_user"("user_id", "user_key", "chat_id", "chat_key")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
        `,
          [
            user.Id,
            'key',
            chatIds[0],
            'key',
            user.Id,
            'key',
            chatIds[1],
            'key',
          ],
        );
      });

      it('should support create using `on`', async () => {
        const q = db.user.select('Id', 'UserKey').create({
          ...UserData,
          Name: 'user 1',
          activeChats: {
            create: [
              {
                ...ChatData,
                Title: 'chat 1',
              },
              {
                ...ChatData,
                Title: 'chat 2',
              },
            ],
          },
        });

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');

        const user = await q;
        await db.user
          .queryRelated('chats', user)
          .order('IdOfChat')
          .pluck('IdOfChat');

        const [, createChatsSqlCall] = querySpy.mock.calls;
        const createChatsSql = {
          text: createChatsSqlCall[0],
          values: createChatsSqlCall[1],
        };

        expectSql(
          createChatsSql,
          `
            INSERT INTO "schema"."chat" AS "activeChats"("active", "title", "chat_key", "updated_at", "created_at")
            VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)
            RETURNING "activeChats"."id_of_chat" "IdOfChat", "activeChats"."chat_key" "ChatKey"
          `,
          [true, 'chat 1', 'key', now, now, true, 'chat 2', 'key', now, now],
        );
      });

      it('should support create many', async () => {
        const q = db.user.select('Id').createMany([
          {
            ...UserData,
            Name: 'user 1',
            chats: {
              create: [
                {
                  ...ChatData,
                  Title: 'chat 1',
                },
                {
                  ...ChatData,
                  Title: 'chat 2',
                },
              ],
            },
          },
          {
            ...UserData,
            Name: 'user 2',
            chats: {
              create: [
                {
                  ...ChatData,
                  Title: 'chat 3',
                },
                {
                  ...ChatData,
                  Title: 'chat 4',
                },
              ],
            },
          },
        ]);

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');
        const arraysSpy = jest.spyOn(
          TransactionAdapterClass.prototype,
          'arrays',
        );

        const users = await q;
        const chatIds = await db.user.join('chats').pluck('chats.IdOfChat');

        const [createUserSqlCall, createChatsSqlCall] = querySpy.mock.calls;
        const createUserSql = {
          text: createUserSqlCall[0],
          values: createUserSqlCall[1],
        };
        const createChatsSql = {
          text: createChatsSqlCall[0],
          values: createChatsSqlCall[1],
        };
        const createChatUserSqlCall =
          arraysSpy.mock.calls[0] || querySpy.mock.calls[2];
        const createChatUserSql = {
          text: createChatUserSqlCall[0],
          values: createChatUserSqlCall[1],
        };

        expectSql(
          createUserSql,
          `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)
          RETURNING "User"."id" "Id", "User"."user_key" "UserKey"
        `,
          [
            'user 1',
            'key',
            'password',
            now,
            now,
            'user 2',
            'key',
            'password',
            now,
            now,
          ],
        );

        expectSql(
          createChatsSql,
          `
          INSERT INTO "schema"."chat" AS "chats"("title", "chat_key", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12), ($13, $14, $15, $16)
          RETURNING "chats"."id_of_chat" "IdOfChat", "chats"."chat_key" "ChatKey"
        `,
          [
            'chat 1',
            'key',
            now,
            now,
            'chat 2',
            'key',
            now,
            now,
            'chat 3',
            'key',
            now,
            now,
            'chat 4',
            'key',
            now,
            now,
          ],
        );

        expectSql(
          createChatUserSql,
          `
          INSERT INTO "schema"."chat_user"("user_id", "user_key", "chat_id", "chat_key")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12), ($13, $14, $15, $16)
        `,
          [
            users[0].Id,
            'key',
            chatIds[0],
            'key',
            users[0].Id,
            'key',
            chatIds[1],
            'key',
            users[1].Id,
            'key',
            chatIds[2],
            'key',
            users[1].Id,
            'key',
            chatIds[3],
            'key',
          ],
        );
      });

      it('should support create many using `on`', async () => {
        const q = db.user.select('Id').createMany([
          {
            ...UserData,
            Name: 'user 1',
            activeChats: {
              create: [
                {
                  ...ChatData,
                  Title: 'chat 1',
                },
                {
                  ...ChatData,
                  Title: 'chat 2',
                },
              ],
            },
          },
          {
            ...UserData,
            Name: 'user 2',
            activeChats: {
              create: [
                {
                  ...ChatData,
                  Title: 'chat 3',
                },
                {
                  ...ChatData,
                  Title: 'chat 4',
                },
              ],
            },
          },
        ]);

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');

        await q;

        const [, createChatsSqlCall] = querySpy.mock.calls;

        expectSql(
          { text: createChatsSqlCall[0], values: createChatsSqlCall[1] },
          `
          INSERT INTO "schema"."chat" AS "activeChats"("active", "title", "chat_key", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15), ($16, $17, $18, $19, $20)
          RETURNING "activeChats"."id_of_chat" "IdOfChat", "activeChats"."chat_key" "ChatKey"
        `,
          [
            true,
            'chat 1',
            'key',
            now,
            now,
            true,
            'chat 2',
            'key',
            now,
            now,
            true,
            'chat 3',
            'key',
            now,
            now,
            true,
            'chat 4',
            'key',
            now,
            now,
          ],
        );
      });

      it('should ignore empty create list', async () => {
        await db.user.create({
          ...UserData,
          chats: {
            create: [],
          },
        });
      });

      describe('relation callbacks', () => {
        const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
          db.user.relations.chats,
          ['IdOfChat'],
        );

        const data = {
          ...UserData,
          chats: {
            create: [ChatData, ChatData],
          },
        };

        it('should invoke callbacks', async () => {
          await db.user.create(data);

          const ids = await db.chat.select('IdOfChat', 'ChatKey');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          await db.user.createMany([data, data]);

          const ids = await db.chat.select('IdOfChat', 'ChatKey');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
        });
      });
    });

    describe('nested connect', () => {
      it('should support connect', async () => {
        await db.chat.createMany([
          { ...ChatData, Title: 'chat 1' },
          { ...ChatData, Title: 'chat 2' },
        ]);

        const q = db.user.select('Id', 'UserKey').create({
          ...UserData,
          Name: 'user 1',
          chats: {
            connect: [
              {
                Title: 'chat 1',
              },
              {
                Title: 'chat 2',
              },
            ],
          },
        });

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');
        const arraysSpy = jest.spyOn(
          TransactionAdapterClass.prototype,
          'arrays',
        );

        const user = await q;
        const chatIds = await db.user
          .queryRelated('chats', user)
          .order('IdOfChat')
          .pluck('IdOfChat');

        const [createUserSqlCall, ...findChatsSqlCalls] = querySpy.mock.calls;
        const createUserSql = {
          text: createUserSqlCall[0],
          values: createUserSqlCall[1],
        };
        let createChatUserSqlCall = arraysSpy.mock.calls[0];
        if (!createChatUserSqlCall) {
          findChatsSqlCalls.pop();
          createChatUserSqlCall = findChatsSqlCalls.pop() as never;
        }
        const createChatUserSql = {
          text: createChatUserSqlCall[0],
          values: createChatUserSqlCall[1],
        };

        expectSql(
          createUserSql,
          `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5)
          RETURNING "User"."id" "Id", "User"."user_key" "UserKey"
        `,
          ['user 1', 'key', 'password', now, now],
        );

        expect(findChatsSqlCalls.length).toBe(2);
        findChatsSqlCalls.forEach((call, i) => {
          expectSql(
            { text: call[0], values: call[1] },
            `
            SELECT "chats"."id_of_chat" "IdOfChat", "chats"."chat_key" "ChatKey"
            FROM "schema"."chat" "chats"
            WHERE "chats"."title" = $1
            LIMIT 1
          `,
            [`chat ${i + 1}`],
          );
        });

        expectSql(
          createChatUserSql,
          `
          INSERT INTO "schema"."chat_user"("user_id", "user_key", "chat_id", "chat_key")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
        `,
          [
            user.Id,
            'key',
            chatIds[0],
            'key',
            user.Id,
            'key',
            chatIds[1],
            'key',
          ],
        );
      });

      it('should fail to connect when `on` condition does not match', async () => {
        await db.chat.createMany([
          { ...ChatData, Title: 'chat 1' },
          { ...activeChatData, Title: 'chat 2' },
        ]);

        const q = db.user.select('Id', 'UserKey').create({
          ...UserData,
          Name: 'user 1',
          activeChats: {
            connect: [
              {
                Title: 'chat 1',
              },
              {
                Title: 'chat 2',
              },
            ],
          },
        });

        await expect(q).rejects.toThrow('Record is not found');
      });

      it('should connect using `on`', async () => {
        const chats = await db.chat.createMany([
          { ...activeChatData, Title: 'chat 1' },
          { ...activeChatData, Title: 'chat 2' },
        ]);

        const q = db.user.select('Id', 'UserKey').create({
          ...UserData,
          Name: 'user 1',
          activeChats: {
            connect: [
              {
                Title: 'chat 1',
              },
              {
                Title: 'chat 2',
              },
            ],
          },
        });

        const user = await q;
        const userChats = await db.user.queryRelated('activeChats', user);

        expect(userChats.map((x) => x.IdOfChat)).toEqual(
          chats.map((x) => x.IdOfChat),
        );
      });

      it('should support connect many', async () => {
        await db.chat.createMany([
          { ...ChatData, Title: 'chat 1' },
          { ...ChatData, Title: 'chat 2' },
          { ...ChatData, Title: 'chat 3' },
          { ...ChatData, Title: 'chat 4' },
        ]);

        const q = db.user.select('Id').createMany([
          {
            ...UserData,
            Name: 'user 1',
            chats: {
              connect: [
                {
                  Title: 'chat 1',
                },
                {
                  Title: 'chat 2',
                },
              ],
            },
          },
          {
            ...UserData,
            Name: 'user 2',
            chats: {
              connect: [
                {
                  Title: 'chat 3',
                },
                {
                  Title: 'chat 4',
                },
              ],
            },
          },
        ]);

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');
        const arraysSpy = jest.spyOn(
          TransactionAdapterClass.prototype,
          'arrays',
        );

        const users = await q;
        const chatIds = await db.user.join('chats').pluck('chats.IdOfChat');

        const createUserSqlCall = querySpy.mock.calls[0];
        const findChatsSqlCalls = querySpy.mock.calls.slice(1);
        const createUserSql = {
          text: createUserSqlCall[0],
          values: createUserSqlCall[1],
        };

        let createChatUserSqlCall = arraysSpy.mock.calls[0];
        if (!createChatUserSqlCall) {
          findChatsSqlCalls.pop();
          createChatUserSqlCall = findChatsSqlCalls.pop() as never;
        }
        const createChatUserSql = {
          text: createChatUserSqlCall[0],
          values: createChatUserSqlCall[1],
        };

        expectSql(
          createUserSql,
          `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)
          RETURNING "User"."id" "Id", "User"."user_key" "UserKey"
        `,
          [
            'user 1',
            'key',
            'password',
            now,
            now,
            'user 2',
            'key',
            'password',
            now,
            now,
          ],
        );

        expect(findChatsSqlCalls.length).toBe(4);
        findChatsSqlCalls.forEach((call, i) => {
          expectSql(
            { text: call[0], values: call[1] },
            `
            SELECT "chats"."id_of_chat" "IdOfChat", "chats"."chat_key" "ChatKey"
            FROM "schema"."chat" "chats"
            WHERE "chats"."title" = $1
            LIMIT 1
          `,
            [`chat ${i + 1}`],
          );
        });

        expectSql(
          createChatUserSql,
          `
          INSERT INTO "schema"."chat_user"("user_id", "user_key", "chat_id", "chat_key")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12), ($13, $14, $15, $16)
        `,
          [
            users[0].Id,
            'key',
            chatIds[0],
            'key',
            users[0].Id,
            'key',
            chatIds[1],
            'key',
            users[1].Id,
            'key',
            chatIds[2],
            'key',
            users[1].Id,
            'key',
            chatIds[3],
            'key',
          ],
        );
      });

      it('should fail to connect when `on` condition does not match', async () => {
        await db.chat.createMany([
          { ...ChatData, Title: 'chat 1' },
          { ...activeChatData, Title: 'chat 2' },
        ]);

        const q = db.user.select('Id').createMany([
          {
            ...UserData,
            Name: 'user 1',
            activeChats: {
              connect: [
                {
                  Title: 'chat 1',
                },
              ],
            },
          },
          {
            ...UserData,
            Name: 'user 2',
            activeChats: {
              connect: [
                {
                  Title: 'chat 2',
                },
              ],
            },
          },
        ]);

        await expect(q).rejects.toThrow('Record is not found');
      });

      it('should support connect many using `on`', async () => {
        const chats = await db.chat.createMany([
          { ...activeChatData, Title: 'chat 1' },
          { ...activeChatData, Title: 'chat 2' },
          { ...activeChatData, Title: 'chat 3' },
          { ...activeChatData, Title: 'chat 4' },
        ]);

        const [user1, user2] = await db.user.createMany([
          {
            ...UserData,
            Name: 'user 1',
            activeChats: {
              connect: [
                {
                  Title: 'chat 1',
                },
                {
                  Title: 'chat 2',
                },
              ],
            },
          },
          {
            ...UserData,
            Name: 'user 2',
            activeChats: {
              connect: [
                {
                  Title: 'chat 3',
                },
                {
                  Title: 'chat 4',
                },
              ],
            },
          },
        ]);

        const user1Chats = await db.user.queryRelated('activeChats', user1);
        const user2Chats = await db.user.queryRelated('activeChats', user2);

        expect(user1Chats).toEqual([chats[0], chats[1]]);
        expect(user2Chats).toEqual([chats[2], chats[3]]);
      });

      it('should ignore empty connect list', async () => {
        await db.user.create({
          ...UserData,
          chats: {
            connect: [],
          },
        });
      });
    });

    describe('connectOrCreate', () => {
      it('should support connect or create', async () => {
        const chatId = await db.chat.get('IdOfChat').create({
          ...ChatData,
          Title: 'chat 1',
        });

        const q = db.user.create({
          ...UserData,
          Name: 'user 1',
          chats: {
            connectOrCreate: [
              {
                where: { Title: 'chat 1' },
                create: { ...ChatData, Title: 'chat 1' },
              },
              {
                where: { Title: 'chat 2' },
                create: { ...ChatData, Title: 'chat 2' },
              },
            ],
          },
        });

        const user = await q;
        const chats = await db.user.queryRelated('chats', user).order('Title');

        expect(chats[0].IdOfChat).toBe(chatId);

        assert.user({ user, Name: 'user 1' });
        assert.chats({ chats, title1: 'chat 1', title2: 'chat 2' });
      });

      it('should connect using `on`', async () => {
        const chatId = await db.chat.get('IdOfChat').create({
          ...activeChatData,
          Title: 'chat 1',
        });

        const user = await db.user.create({
          ...UserData,
          Name: 'user 1',
          activeChats: {
            connectOrCreate: [
              {
                where: { Title: 'chat 1' },
                create: { ...ChatData, Title: 'chat 1' },
              },
            ],
          },
        });

        const chats = await db.user.queryRelated('chats', user);
        expect(chats[0].IdOfChat).toBe(chatId);
      });

      it('should create using `on`', async () => {
        const chatId = await db.chat.get('IdOfChat').create({
          ...ChatData,
          Title: 'chat 1',
        });

        const user = await db.user.create({
          ...UserData,
          Name: 'user 1',
          activeChats: {
            connectOrCreate: [
              {
                where: { Title: 'chat 1' },
                create: { ...ChatData, Title: 'chat 1' },
              },
            ],
          },
        });

        const chats = await db.user.queryRelated('chats', user);
        expect(chats[0].IdOfChat).not.toBe(chatId);
      });

      it('should support connect or create many', async () => {
        const [{ IdOfChat: chat1Id }, { IdOfChat: chat4Id }] = await db.chat
          .select('IdOfChat')
          .createMany([
            {
              ...ChatData,
              Title: 'chat 1',
            },
            {
              ...ChatData,
              Title: 'chat 4',
            },
          ]);

        const q = db.user.createMany([
          {
            ...UserData,
            Name: 'user 1',
            chats: {
              connectOrCreate: [
                {
                  where: { Title: 'chat 1' },
                  create: { ...ChatData, Title: 'chat 1' },
                },
                {
                  where: { Title: 'chat 2' },
                  create: { ...ChatData, Title: 'chat 2' },
                },
              ],
            },
          },
          {
            ...UserData,
            Name: 'user 2',
            chats: {
              connectOrCreate: [
                {
                  where: { Title: 'chat 3' },
                  create: { ...ChatData, Title: 'chat 3' },
                },
                {
                  where: { Title: 'chat 4' },
                  create: { ...ChatData, Title: 'chat 4' },
                },
              ],
            },
          },
        ]);

        const users = await q;
        const chats = await db.chat.order('Title');

        expect(chats[0].IdOfChat).toBe(chat1Id);
        expect(chats[3].IdOfChat).toBe(chat4Id);

        assert.user({ user: users[0], Name: 'user 1' });
        assert.chats({
          chats: chats.slice(0, 2),
          title1: 'chat 1',
          title2: 'chat 2',
        });

        assert.user({ user: users[1], Name: 'user 2' });
        assert.chats({
          chats: chats.slice(2, 4),
          title1: 'chat 3',
          title2: 'chat 4',
        });
      });

      it('should support connect or create many using `on`', async () => {
        const [{ IdOfChat: chat1Id }, , , { IdOfChat: chat4Id }] = await db.chat
          .select('IdOfChat')
          .createMany([
            {
              ...activeChatData,
              Title: 'chat 1',
            },
            {
              ...ChatData,
              Title: 'chat 2',
            },
            {
              ...ChatData,
              Title: 'chat 3',
            },
            {
              ...activeChatData,
              Title: 'chat 4',
            },
          ]);

        const q = db.user.createMany([
          {
            ...UserData,
            Name: 'user 1',
            activeChats: {
              connectOrCreate: [
                {
                  where: { Title: 'chat 1' },
                  create: { ...ChatData, Title: 'chat 1' },
                },
                {
                  where: { Title: 'chat 2' },
                  create: { ...ChatData, Title: 'chat 2' },
                },
              ],
            },
          },
          {
            ...UserData,
            Name: 'user 2',
            activeChats: {
              connectOrCreate: [
                {
                  where: { Title: 'chat 3' },
                  create: { ...ChatData, Title: 'chat 3' },
                },
                {
                  where: { Title: 'chat 4' },
                  create: { ...ChatData, Title: 'chat 4' },
                },
              ],
            },
          },
        ]);

        const users = await q;
        const chats = await db.chat.where({ Active: true }).order('Title');

        expect(chats[0].IdOfChat).toBe(chat1Id);
        expect(chats[3].IdOfChat).toBe(chat4Id);

        assert.user({ user: users[0], Name: 'user 1' });
        assert.activeChats({
          chats: chats.slice(0, 2),
          title1: 'chat 1',
          title2: 'chat 2',
        });

        assert.user({ user: users[1], Name: 'user 2' });
        assert.activeChats({
          chats: chats.slice(2, 4),
          title1: 'chat 3',
          title2: 'chat 4',
        });
      });

      it('should ignore empty connectOrCreate list', async () => {
        await db.user.create({
          ...UserData,
          chats: {
            connectOrCreate: [],
          },
        });
      });

      describe('relation callbacks', () => {
        const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
          db.user.relations.chats,
          ['IdOfChat'],
        );

        const data = {
          ...UserData,
          chats: {
            connectOrCreate: [
              {
                where: { Title: 'one' },
                create: ChatData,
              },
              {
                where: { Title: 'two' },
                create: ChatData,
              },
            ],
          },
        };

        it('should invoke callbacks', async () => {
          await db.user.create(data);

          const ids = await db.chat.select('IdOfChat', 'ChatKey');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          await db.user.createMany([data, data]);

          const ids = await db.chat.select('IdOfChat', 'ChatKey');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
        });
      });
    });
  });

  describe('upsert', () => {
    it('should create hasAndBelongsToMany records when creating the record', async () => {
      await db.user
        .select('Id', 'UserKey')
        .find(123)
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            chats: { create: [ChatData] },
          },
        });

      const chats = await db.chat.select('Title');

      expect(chats).toEqual([
        {
          Title: ChatData.Title,
        },
      ]);
    });

    it('should connect hasAndBelongsToMany records when creating the record', async () => {
      await db.chat.create({
        ...ChatData,
        Title: 'chat 1',
      });

      await db.user
        .select('Id', 'UserKey')
        .find(123)
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            chats: { connect: [{ Title: 'chat 1' }] },
          },
        });

      const chats = await db.chat.select('Title');

      expect(chats).toEqual([
        {
          Title: 'chat 1',
        },
      ]);
    });

    it('should connect or create hasAndBelongsToMany records when creating the record', async () => {
      await db.chat.create({
        ...ChatData,
        Title: 'chat 1',
      });

      await db.user
        .select('Id', 'UserKey')
        .find(123)
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            chats: {
              connectOrCreate: [
                {
                  where: { Title: 'chat 1' },
                  create: ChatData,
                },
              ],
            },
          },
        });

      const chats = await db.chat.select('Title');

      expect(chats).toEqual([
        {
          Title: 'chat 1',
        },
      ]);
    });
  });
});
