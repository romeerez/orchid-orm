import { Db, NotFoundError } from 'pqb';
import { omit } from 'pqb/internal';
import {
  useRelationCallback,
  useTestORM,
  useQueryCounter,
} from '../../test-utils/orm.test-utils';
import {
  ChatData,
  MessageData,
  UserData,
  PostData,
  UserDefaultSelect,
  Message,
  db,
} from 'test-utils';

const { resetQueriesCount, getQueriesCount } = useQueryCounter();

const useMultiQueryNestedCreate = () => {
  beforeAll(() => {
    db.$qb.internal.nestedCreateBatchMax = 1;
  });

  afterAll(() => {
    db.$qb.internal.nestedCreateBatchMax = 100;
  });
};

describe('hasMany create', () => {
  useTestORM();

  const assert = {
    user(user: UserDefaultSelect, Name: string, Active: boolean | null = null) {
      expect(user).toEqual({
        ...omit(UserData, ['Password']),
        Id: user.Id,
        Name,
        Active,
        Age: null,
        Data: null,
        Picture: null,
        Balance: null,
      });
    },

    messages({
      messages,
      UserId,
      ChatId,
      text1,
      text2,
      Active = null,
    }: {
      messages: Message[];
      UserId: number;
      ChatId: number;
      text1: string;
      text2: string;
      Active?: boolean | null;
    }) {
      expect(messages).toMatchObject([
        {
          Id: messages[0].Id,
          AuthorId: UserId,
          Text: text1,
          ChatId,
          Active,
        },
        {
          Id: messages[1].Id,
          AuthorId: UserId,
          Text: text2,
          ChatId,
          Active,
        },
      ]);
    },

    activeMessages(params: {
      messages: Message[];
      UserId: number;
      ChatId: number;
      text1: string;
      text2: string;
    }) {
      return this.messages({ ...params, Active: true });
    },
  };

  describe('create', () => {
    it('should restrict the type', () => {
      db.user.create({
        ...UserData,
        messages: {
          // @ts-expect-error the type is restricted
          create: 123,
        },
      });
    });

    it('should work in upsert', async () => {
      const user = await db.user
        .select('Id', 'UserKey')
        .find(123)
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            posts: { create: [PostData] },
          },
        });

      expect(getQueriesCount()).toBe(2);

      const posts = await db.post.select('UserId', 'Title', 'Body');

      expect(posts).toEqual([
        {
          UserId: user.Id,
          Title: user.UserKey,
          Body: PostData.Body,
        },
      ]);
    });

    it('should support create', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);

      resetQueriesCount();

      const user = await db.user.create({
        ...UserData,
        Name: 'user 1',
        messages: {
          create: [
            {
              ...MessageData,
              Text: 'message 1',
              ChatId,
            },
            {
              ...MessageData,
              Text: 'message 2',
              ChatId,
            },
          ],
        },
      });

      expect(getQueriesCount()).toBe(1);

      assert.user(user, 'user 1');

      const messages = await db.message.order('Text');
      assert.messages({
        messages,
        UserId: user.Id,
        ChatId,
        text1: 'message 1',
        text2: 'message 2',
      });
    });

    it('should support create using `on`', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);

      resetQueriesCount();

      const user = await db.user.create({
        ...UserData,
        Name: 'user 1',
        activeMessages: {
          create: [
            {
              ...MessageData,
              Text: 'message 1',
              ChatId,
            },
            {
              ...MessageData,
              Text: 'message 2',
              ChatId,
            },
          ],
        },
      });

      expect(getQueriesCount()).toBe(1);

      assert.user(user, 'user 1');

      const messages = await db.message.order('Text');
      assert.activeMessages({
        messages,
        UserId: user.Id,
        ChatId,
        text1: 'message 1',
        text2: 'message 2',
      });
    });

    const testCreateMany = async (queriesCount: number) => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);

      resetQueriesCount();

      const user = await db.user.createMany([
        {
          ...UserData,
          Name: 'user 1',
          messages: {
            create: [
              {
                ...MessageData,
                Text: 'message 1',
                ChatId,
              },
              {
                ...MessageData,
                Text: 'message 2',
                ChatId,
              },
            ],
          },
        },
        {
          ...UserData,
          Name: 'user 2',
          messages: {
            create: [
              {
                ...MessageData,
                Text: 'message 3',
                ChatId,
              },
              {
                ...MessageData,
                Text: 'message 4',
                ChatId,
              },
            ],
          },
        },
      ]);

      expect(getQueriesCount()).toBe(queriesCount);

      assert.user(user[0], 'user 1');
      assert.user(user[1], 'user 2');

      const messages = await db.message.order('Text');
      assert.messages({
        messages: messages.slice(0, 2),
        UserId: user[0].Id,
        ChatId,
        text1: 'message 1',
        text2: 'message 2',
      });

      assert.messages({
        messages: messages.slice(2, 4),
        UserId: user[1].Id,
        ChatId,
        text1: 'message 3',
        text2: 'message 4',
      });
    };

    it('should support create in batch create', async () => {
      await testCreateMany(1);
    });

    describe('too many records', () => {
      useMultiQueryNestedCreate();

      it('should use a multi-query strategy when inserting too many records', async () => {
        await testCreateMany(2);
      });
    });

    it('should support create in batch create using `on`', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);

      resetQueriesCount();

      const user = await db.user.createMany([
        {
          ...UserData,
          Name: 'user 1',
          activeMessages: {
            create: [
              {
                ...MessageData,
                Text: 'message 1',
                ChatId,
              },
              {
                ...MessageData,
                Text: 'message 2',
                ChatId,
              },
            ],
          },
        },
        {
          ...UserData,
          Name: 'user 2',
          activeMessages: {
            create: [
              {
                ...MessageData,
                Text: 'message 3',
                ChatId,
              },
              {
                ...MessageData,
                Text: 'message 4',
                ChatId,
              },
            ],
          },
        },
      ]);

      expect(getQueriesCount()).toBe(1);

      assert.user(user[0], 'user 1');
      assert.user(user[1], 'user 2');

      const messages = await db.message.order('Text');
      assert.activeMessages({
        messages: messages.slice(0, 2),
        UserId: user[0].Id,
        ChatId,
        text1: 'message 1',
        text2: 'message 2',
      });

      assert.activeMessages({
        messages: messages.slice(2, 4),
        UserId: user[1].Id,
        ChatId,
        text1: 'message 3',
        text2: 'message 4',
      });
    });

    it('should ignore empty create list', async () => {
      resetQueriesCount();

      const user = await db.user.create({
        ...UserData,
        Name: 'user 1',
        messages: {
          create: [],
        },
      });

      expect(getQueriesCount()).toBe(1);

      assert.user(user, 'user 1');
    });

    describe('relation callbacks', () => {
      const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
        db.user.relations.messages,
        ['Id'],
      );

      it('should invoke callbacks', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        resetQueriesCount();

        await db.user.create({
          ...UserData,
          messages: {
            create: [
              { ...MessageData, ChatId },
              { ...MessageData, ChatId },
            ],
          },
        });

        expect(getQueriesCount()).toBe(1);

        const ids = await db.message.select('Id');

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
      });

      it('should invoke callbacks in a batch create', async () => {
        resetMocks();

        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        resetQueriesCount();

        await db.user.createMany([
          {
            ...UserData,
            messages: {
              create: [
                { ...MessageData, ChatId },
                { ...MessageData, ChatId },
              ],
            },
          },
          {
            ...UserData,
            messages: {
              create: [
                { ...MessageData, ChatId },
                { ...MessageData, ChatId },
              ],
            },
          },
        ]);

        expect(getQueriesCount()).toBe(1);

        const ids = await db.message.select('Id');

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
      });
    });
  });

  describe('connect', () => {
    it('should restrict the type', () => {
      db.user.create({
        ...UserData,
        messages: {
          // @ts-expect-error the type is restricted
          connect: 123,
        },
      });
    });

    it('should work in upsert', async () => {
      await db.post.create({
        ...PostData,
        Title: 'tmp',
      });

      resetQueriesCount();

      const user = await db.user
        .select('Id', 'UserKey')
        .find(123)
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            posts: { connect: [{ Body: PostData.Body }] },
          },
        });

      expect(getQueriesCount()).toBe(2);

      const posts = await db.post.select('UserId', 'Title', 'Body');

      expect(posts).toEqual([
        {
          UserId: user.Id,
          Title: user.UserKey,
          Body: PostData.Body,
        },
      ]);
    });

    it('should support connect', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const sender = await db.user.create({ ...UserData, Name: 'tmp' });

      await db.message.createMany([
        {
          ChatId,
          AuthorId: sender.Id,
          MessageKey: sender.UserKey,
          Text: 'message 1',
        },
        {
          ChatId,
          AuthorId: sender.Id,
          MessageKey: sender.UserKey,
          Text: 'message 2',
        },
      ]);

      resetQueriesCount();

      const user = await db.user.create({
        ...UserData,
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

      expect(getQueriesCount()).toBe(1);

      assert.user(user, 'user 1');

      const messages = await db.message.order('Text');
      assert.messages({
        messages,
        UserId: user.Id,
        ChatId,
        text1: 'message 1',
        text2: 'message 2',
      });
    });

    it('should support connect using `on`', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const sender = await db.user.create({ ...UserData, Name: 'tmp' });
      await db.message.createMany([
        {
          ChatId,
          AuthorId: sender.Id,
          Text: 'message 1',
          Active: true,
        },
        {
          ChatId,
          AuthorId: sender.Id,
          Text: 'message 2',
          Active: true,
        },
      ]);

      resetQueriesCount();

      const user = await db.user.create({
        ...UserData,
        Name: 'user 1',
        activeMessages: {
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

      expect(getQueriesCount()).toBe(1);

      assert.user(user, 'user 1');

      const messages = await db.message.order('Text');
      assert.activeMessages({
        messages,
        UserId: user.Id,
        ChatId,
        text1: 'message 1',
        text2: 'message 2',
      });
    });

    it('should fail if record for connect is not found', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const sender = await db.user.create({ ...UserData, Name: 'tmp' });
      await db.message.createMany([
        {
          ChatId,
          AuthorId: sender.Id,
          Text: 'message 1',
          Active: true,
        },
      ]);

      resetQueriesCount();

      await expect(
        db.user.create({
          ...UserData,
          Name: 'user 1',
          activeMessages: {
            connect: [
              {
                Text: 'message 1',
              },
              {
                Text: 'message 2',
              },
            ],
          },
        }),
      ).rejects.toThrow(NotFoundError);

      expect(getQueriesCount()).toBe(1);
    });

    const testConnectInCreateMany = async (queriesCount: number) => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const sender = await db.user.create({ ...UserData, Name: 'tmp' });
      await db.message.createMany([
        {
          ChatId,
          AuthorId: sender.Id,
          Text: 'message 1',
        },
        {
          ChatId,
          AuthorId: sender.Id,
          Text: 'message 2',
        },
        {
          ChatId,
          AuthorId: sender.Id,
          Text: 'message 3',
        },
        {
          ChatId,
          AuthorId: sender.Id,
          Text: 'message 4',
        },
      ]);

      resetQueriesCount();

      const user = await db.user.createMany([
        {
          ...UserData,
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
          ...UserData,
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

      expect(getQueriesCount()).toBe(queriesCount);

      assert.user(user[0], 'user 1');
      assert.user(user[1], 'user 2');

      const messages = await db.message.order('Text');
      assert.messages({
        messages: messages.slice(0, 2),
        UserId: user[0].Id,
        ChatId,
        text1: 'message 1',
        text2: 'message 2',
      });

      assert.messages({
        messages: messages.slice(2, 4),
        UserId: user[1].Id,
        ChatId,
        text1: 'message 3',
        text2: 'message 4',
      });
    };

    it('should support connect in batch create', async () => {
      await testConnectInCreateMany(1);
    });

    describe('too many records', () => {
      useMultiQueryNestedCreate();

      it('should use a multi-query strategy when inserting too many records', async () => {
        await testConnectInCreateMany(3);
      });
    });

    it('should support connect in batch create using `on`', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const sender = await db.user.create({ ...UserData, Name: 'tmp' });
      await db.message.createMany([
        {
          ChatId,
          AuthorId: sender.Id,
          Text: 'message 1',
          Active: true,
        },
        {
          ChatId,
          AuthorId: sender.Id,
          Text: 'message 2',
          Active: true,
        },
        {
          ChatId,
          AuthorId: sender.Id,
          Text: 'message 3',
          Active: true,
        },
        {
          ChatId,
          AuthorId: sender.Id,
          Text: 'message 4',
          Active: true,
        },
      ]);

      resetQueriesCount();

      const user = await db.user.createMany([
        {
          ...UserData,
          Name: 'user 1',
          activeMessages: {
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
          ...UserData,
          Name: 'user 2',
          activeMessages: {
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

      expect(getQueriesCount()).toBe(1);

      assert.user(user[0], 'user 1');
      assert.user(user[1], 'user 2');

      const messages = await db.message.order('Id');
      assert.activeMessages({
        messages: messages.slice(0, 2),
        UserId: user[0].Id,
        ChatId,
        text1: 'message 1',
        text2: 'message 2',
      });

      assert.activeMessages({
        messages: messages.slice(2, 4),
        UserId: user[1].Id,
        ChatId,
        text1: 'message 3',
        text2: 'message 4',
      });
    });

    it('should ignore empty connect list', async () => {
      resetQueriesCount();

      const user = await db.user.create({
        ...UserData,
        Name: 'user 1',
        messages: {
          connect: [],
        },
      });

      expect(getQueriesCount()).toBe(1);

      assert.user(user, 'user 1');
    });

    describe('relation callbacks', () => {
      const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
        db.user.relations.messages,
        ['Id'],
      );

      it('should invoke callbacks', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);
        const ids = await db.message.pluck('Id').createMany([
          { ...MessageData, ChatId },
          { ...MessageData, ChatId },
        ]);

        resetQueriesCount();

        await db.user.create({
          ...UserData,
          messages: {
            connect: [{ Id: ids[0] }, { Id: ids[1] }],
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [{ Id: ids[0] }, { Id: ids[1] }],
          expect.any(Db),
        );
      });

      it('should invoke callbacks in a batch create', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const ids = await db.message.pluck('Id').createMany([
          { ...MessageData, ChatId },
          { ...MessageData, ChatId },
          { ...MessageData, ChatId },
          { ...MessageData, ChatId },
        ]);

        resetMocks();

        resetQueriesCount();

        await db.user.createMany([
          {
            ...UserData,
            messages: {
              connect: [{ Id: ids[0] }, { Id: ids[1] }],
            },
          },
          {
            ...UserData,
            messages: {
              connect: [{ Id: ids[2] }, { Id: ids[3] }],
            },
          },
        ]);

        expect(getQueriesCount()).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [{ Id: ids[0] }, { Id: ids[1] }, { Id: ids[2] }, { Id: ids[3] }],
          expect.any(Db),
        );
      });
    });
  });

  describe('connect or create', () => {
    it('should restrict the type', () => {
      db.user.create({
        ...UserData,
        messages: {
          // @ts-expect-error the type is restricted
          connectOrCreate: 123,
        },
      });
    });

    it('should work in upsert', async () => {
      await db.post.create({
        ...PostData,
        Title: 'tmp',
      });

      resetQueriesCount();

      const user = await db.user
        .select('Id', 'UserKey')
        .find(123)
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            posts: {
              connectOrCreate: [
                {
                  where: { Body: PostData.Body },
                  create: PostData,
                },
              ],
            },
          },
        });

      expect(getQueriesCount()).toBe(2);

      const posts = await db.post.select('UserId', 'Title', 'Body');

      expect(posts).toEqual([
        {
          UserId: user.Id,
          Title: user.UserKey,
          Body: PostData.Body,
        },
      ]);
    });

    it('should support connect or create', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const messageId = await db.message.get('Id').create({
        ChatId,
        sender: { create: { ...UserData, Name: 'tmp' } },
        Text: 'message 1',
      });

      resetQueriesCount();

      const user = await db.user.create({
        ...UserData,
        Name: 'user 1',
        messages: {
          connectOrCreate: [
            {
              where: { Text: 'message 1' },
              create: { ...MessageData, ChatId, Text: 'message 1' },
            },
            {
              where: { Text: 'message 2' },
              create: { ...MessageData, ChatId, Text: 'message 2' },
            },
          ],
        },
      });

      expect(getQueriesCount()).toBe(1);

      assert.user(user, 'user 1');

      const messages = await db.message.order('Text');
      expect(messages[0].Id).toBe(messageId);

      assert.messages({
        messages,
        UserId: user.Id,
        ChatId,
        text1: 'message 1',
        text2: 'message 2',
      });
    });

    const testConnectOrCreateInCreateMany = async (queriesCount: number) => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const [{ Id: message1Id }, { Id: message4Id }] = await db.message
        .select('Id')
        .createMany([
          {
            ChatId,
            sender: { create: { ...UserData, Name: 'tmp' } },
            Text: 'message 1',
          },
          {
            ChatId,
            sender: { create: { ...UserData, Name: 'tmp' } },
            Text: 'message 4',
          },
        ]);

      resetQueriesCount();

      const users = await db.user.createMany([
        {
          ...UserData,
          Name: 'user 1',
          messages: {
            connectOrCreate: [
              {
                where: { Text: 'message 1' },
                create: { ...MessageData, ChatId, Text: 'message 1' },
              },
              {
                where: { Text: 'message 2' },
                create: { ...MessageData, ChatId, Text: 'message 2' },
              },
            ],
          },
        },
        {
          ...UserData,
          Name: 'user 2',
          messages: {
            connectOrCreate: [
              {
                where: { Text: 'message 3' },
                create: { ...MessageData, ChatId, Text: 'message 3' },
              },
              {
                where: { Text: 'message 4' },
                create: { ...MessageData, ChatId, Text: 'message 4' },
              },
            ],
          },
        },
      ]);

      expect(getQueriesCount()).toBe(queriesCount);

      assert.user(users[0], 'user 1');
      assert.user(users[1], 'user 2');

      const messages = await db.message.order('Text');
      expect(messages[0].Id).toBe(message1Id);
      expect(messages[3].Id).toBe(message4Id);

      assert.messages({
        messages: messages.slice(0, 2),
        UserId: users[0].Id,
        ChatId,
        text1: 'message 1',
        text2: 'message 2',
      });

      assert.messages({
        messages: messages.slice(2, 4),
        UserId: users[1].Id,
        ChatId,
        text1: 'message 3',
        text2: 'message 4',
      });
    };

    it('should support connect or create in batch create', async () => {
      await testConnectOrCreateInCreateMany(1);
    });

    describe('too many records', () => {
      useMultiQueryNestedCreate();

      it('should use a multi-query strategy when inserting too many records', async () => {
        await testConnectOrCreateInCreateMany(3);
      });
    });

    it('should connect or create using `on`', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const messageIds = await db.message.get('Id').createMany([
        {
          ChatId,
          sender: { create: { ...UserData, Name: 'tmp' } },
          Text: 'message 1',
          Active: true,
        },
        {
          ChatId,
          sender: { create: { ...UserData, Name: 'tmp' } },
          Text: 'message 2',
        },
      ]);

      resetQueriesCount();

      const user = await db.user.create({
        ...UserData,
        Name: 'user 1',
        activeMessages: {
          connectOrCreate: [
            {
              where: { Text: 'message 1' },
              create: { ...MessageData, ChatId, Text: 'created 1' },
            },
            {
              where: { Text: 'message 2' },
              create: { ...MessageData, ChatId, Text: 'created 2' },
            },
          ],
        },
      });

      expect(getQueriesCount()).toBe(1);

      assert.user(user, 'user 1');

      const messages = await db.user
        .queryRelated('activeMessages', user)
        .order('Id');
      expect(messages[0].Id).toBe(messageIds[0]);

      assert.activeMessages({
        messages,
        UserId: user.Id,
        ChatId,
        text1: 'message 1',
        text2: 'created 2',
      });
    });

    it('should ignore empty connectOrCreate list', async () => {
      resetQueriesCount();

      const user = await db.user.create({
        ...UserData,
        Name: 'user 1',
        messages: {
          connectOrCreate: [],
        },
      });

      expect(getQueriesCount()).toBe(1);

      assert.user(user, 'user 1');
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
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);
        const ids = await db.message.pluck('Id').createMany([
          { ...MessageData, ChatId },
          { ...MessageData, ChatId },
        ]);

        resetQueriesCount();

        await db.user.create({
          ...UserData,
          messages: {
            connectOrCreate: [
              {
                where: { Id: ids[0] },
                create: MessageData,
              },
              {
                where: { Id: ids[1] },
                create: MessageData,
              },
            ],
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [
            {
              Id: ids[0],
            },
            {
              Id: ids[1],
            },
          ],
          expect.any(Db),
        );
      });

      it('should invoke callbacks when creating', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        resetMocks();

        resetQueriesCount();

        await db.user.create({
          ...UserData,
          messages: {
            connectOrCreate: [
              {
                where: { Id: 0 },
                create: { ...MessageData, ChatId },
              },
              {
                where: { Id: 0 },
                create: { ...MessageData, ChatId },
              },
            ],
          },
        });

        expect(getQueriesCount()).toBe(1);

        const messages = await db.message.select('Id');

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(messages, expect.any(Db));
      });

      it('should invoke callbacks in a batch create', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);
        const ids = await db.message.pluck('Id').createMany([
          { ...MessageData, ChatId },
          { ...MessageData, ChatId },
        ]);

        resetMocks();

        resetQueriesCount();

        await db.user.createMany([
          {
            ...UserData,
            messages: {
              connectOrCreate: [
                {
                  where: { Id: ids[0] },
                  create: { ...MessageData, ChatId },
                },
                {
                  where: { Id: 0 },
                  create: { ...MessageData, ChatId },
                },
              ],
            },
          },
          {
            ...UserData,
            messages: {
              connectOrCreate: [
                {
                  where: { Id: ids[1] },
                  create: { ...MessageData, ChatId },
                },
                {
                  where: { Id: 0 },
                  create: { ...MessageData, ChatId },
                },
              ],
            },
          },
        ]);

        expect(getQueriesCount()).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [{ Id: ids[0] }, { Id: ids[1] }],
          expect.any(Db),
        );

        const created = await db.message
          .whereNot({ Id: { in: ids } })
          .select('Id');
        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(created, expect.any(Db));
      });
    });
  });

  describe('upsert', () => {
    it('should restrict the type', () => {
      expect(() =>
        db.user.create({
          ...UserData,
          messages: {
            // @ts-expect-error the type is restricted
            upsert: 123,
          },
        }),
      ).toThrow();
    });

    it('should update and create related records from an array', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const message = await db.message.create({
        ...MessageData,
        ChatId,
        sender: { create: UserData },
        Text: 'message 1',
      });

      resetQueriesCount();

      const user = await db.user.create({
        ...UserData,
        messages: {
          upsert: [
            {
              findBy: { Id: message.Id },
              update: { Text: 'updated 1' },
              create: { ...MessageData, ChatId, Text: 'created 1' },
            },
            {
              findBy: { Id: 0 },
              update: {},
              create: { ...MessageData, ChatId, Text: 'created 1' },
            },
          ],
        },
      });

      expect(getQueriesCount()).toBeLessThanOrEqual(2);

      const messages = await db.user
        .queryRelated('messages', user)
        .order('Text')
        .pluck('Text');
      expect(messages).toEqual(['created 1', 'updated 1']);
    });

    const testUpsertInCreateMany = async (queriesCount: number) => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const [{ Id: message1Id }, { Id: message4Id }] = await db.message
        .select('Id')
        .createMany([
          {
            ChatId,
            sender: { create: { ...UserData, Name: 'tmp' } },
            Text: 'message 1',
          },
          {
            ChatId,
            sender: { create: { ...UserData, Name: 'tmp' } },
            Text: 'message 4',
          },
        ]);

      resetQueriesCount();

      const users = await db.user.createMany([
        {
          ...UserData,
          Name: 'user 1',
          messages: {
            upsert: [
              {
                findBy: { Id: message1Id },
                update: { Text: 'message 1' },
                create: { ...MessageData, ChatId, Text: 'message 1' },
              },
              {
                findBy: { Id: 0 },
                update: {},
                create: { ...MessageData, ChatId, Text: 'message 2' },
              },
            ],
          },
        },
        {
          ...UserData,
          Name: 'user 2',
          messages: {
            upsert: [
              {
                findBy: { Id: 0 },
                update: {},
                create: { ...MessageData, ChatId, Text: 'message 3' },
              },
              {
                findBy: { Id: message4Id },
                update: { Text: 'message 4' },
                create: { ...MessageData, ChatId, Text: 'message 4' },
              },
            ],
          },
        },
      ]);

      expect(getQueriesCount()).toBe(queriesCount);

      const messages = await db.message.order('Text');
      expect(messages[0].Id).toBe(message1Id);
      expect(messages[3].Id).toBe(message4Id);
      assert.messages({
        messages: messages.slice(0, 2),
        UserId: users[0].Id,
        ChatId,
        text1: 'message 1',
        text2: 'message 2',
      });
      assert.messages({
        messages: messages.slice(2, 4),
        UserId: users[1].Id,
        ChatId,
        text1: 'message 3',
        text2: 'message 4',
      });
    };

    it('should support upsert in batch create', async () => {
      await testUpsertInCreateMany(1);
    });

    describe('too many records', () => {
      useMultiQueryNestedCreate();

      it('should use a multi-query strategy when inserting too many records', async () => {
        await testUpsertInCreateMany(2);
      });
    });

    it('should work in upsert', async () => {
      const post = await db.post.create({ ...PostData, Title: 'tmp' });

      resetQueriesCount();

      const user = await db.user
        .select('Id', 'UserKey')
        .find(123)
        .upsert({
          update: { Name: 'updated' },
          create: {
            ...UserData,
            posts: {
              upsert: [
                {
                  findBy: { Id: post.Id },
                  update: { Body: 'updated' },
                  create: PostData,
                },
              ],
            },
          },
        });

      expect(getQueriesCount()).toBe(2);
      expect(await db.post.select('UserId', 'Title', 'Body')).toEqual([
        { UserId: user.Id, Title: user.UserKey, Body: 'updated' },
      ]);
    });

    it('should upsert using `on`', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const ids = await db.message.pluck('Id').createMany([
        {
          ...MessageData,
          ChatId,
          sender: { create: { ...UserData, Name: 'tmp' } },
          Text: 'active',
          Active: true,
        },
        {
          ...MessageData,
          ChatId,
          sender: { create: { ...UserData, Name: 'tmp' } },
          Text: 'inactive',
        },
      ]);

      resetQueriesCount();

      const user = await db.user.create({
        ...UserData,
        activeMessages: {
          upsert: [
            {
              findBy: { Id: ids[0] },
              update: { Text: 'updated' },
              create: { ...MessageData, ChatId, Text: 'created active' },
            },
            {
              findBy: { Id: ids[1] },
              update: { Text: 'not updated' },
              create: { ...MessageData, ChatId, Text: 'created' },
            },
          ],
        },
      });

      expect(getQueriesCount()).toBe(1);
      const messages = await db.user
        .queryRelated('activeMessages', user)
        .order('Text');
      expect(messages).toMatchObject([
        { Id: expect.any(Number), Text: 'created', Active: true },
        { Id: ids[0], Text: 'updated', Active: true },
      ]);
    });

    describe('relation callbacks', () => {
      const {
        beforeCreate,
        afterCreate,
        beforeUpdate,
        afterUpdate,
        resetMocks,
      } = useRelationCallback(db.user.relations.messages, ['Id']);

      it('should invoke callbacks for updated and created records', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);
        const Id = await db.message.get('Id').create({
          ...MessageData,
          ChatId,
        });

        resetMocks();
        resetQueriesCount();

        await db.user.create({
          ...UserData,
          messages: {
            upsert: [
              {
                findBy: { Id },
                update: { Text: 'updated' },
                create: { ...MessageData, ChatId, Text: 'created' },
              },
              {
                findBy: { Id: 0 },
                update: {},
                create: { ...MessageData, ChatId, Text: 'created' },
              },
            ],
          },
        });

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith([{ Id }], expect.any(Db));
        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(
          [expect.objectContaining({ Id: expect.any(Number) })],
          expect.any(Db),
        );
      });
    });
  });

  describe('combined', () => {
    it('should work with all operations in create', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const sender = await db.user.create({ ...UserData, Name: 'tmp' });
      const [connected, connectOrCreated, upserted] =
        await db.message.createMany([
          {
            ...MessageData,
            ChatId,
            AuthorId: sender.Id,
            Text: 'connect',
          },
          {
            ...MessageData,
            ChatId,
            AuthorId: sender.Id,
            Text: 'connect or create: connected',
          },
          {
            ...MessageData,
            ChatId,
            AuthorId: sender.Id,
            Text: 'upsert: not updated',
          },
        ]);

      resetQueriesCount();

      const user = await db.user.select('Id', 'Name').create({
        ...UserData,
        Name: 'created',
        messages: {
          create: [{ ...MessageData, ChatId, Text: 'created' }],
          connect: [{ Id: connected.Id }],
          connectOrCreate: [
            {
              where: { Id: connectOrCreated.Id },
              create: {
                ...MessageData,
                ChatId,
                Text: 'connect or create: connected',
              },
            },
            {
              where: { Text: 'connect or create: created' },
              create: {
                ...MessageData,
                ChatId,
                Text: 'connect or create: created',
              },
            },
          ],
          upsert: [
            {
              findBy: { Id: upserted.Id },
              update: { Text: 'upsert: updated' },
              create: MessageData,
            },
            {
              findBy: { Id: 0 },
              update: {},
              create: {
                ...MessageData,
                ChatId,
                Text: 'upsert: created',
              },
            },
          ],
        },
      });

      expect(getQueriesCount()).toBe(1);
      expect(user.Name).toBe('created');

      const messages = await db.message
        .order('Text')
        .select('Id', 'Text', 'AuthorId');
      expect(messages).toEqual([
        { Id: connected.Id, Text: 'connect', AuthorId: user.Id },
        {
          Id: connectOrCreated.Id,
          Text: 'connect or create: connected',
          AuthorId: user.Id,
        },
        {
          Id: expect.any(Number),
          Text: 'connect or create: created',
          AuthorId: user.Id,
        },
        { Id: expect.any(Number), Text: 'created', AuthorId: user.Id },
        { Id: expect.any(Number), Text: 'upsert: created', AuthorId: user.Id },
        { Id: upserted.Id, Text: 'upsert: updated', AuthorId: user.Id },
      ]);
    });

    it('should work in upsert', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const sender = await db.user.create({ ...UserData, Name: 'tmp' });
      const [connected, connectOrCreated, upserted] =
        await db.message.createMany([
          {
            ...MessageData,
            ChatId,
            AuthorId: sender.Id,
            Text: 'connect',
          },
          {
            ...MessageData,
            ChatId,
            AuthorId: sender.Id,
            Text: 'connect or create: connected',
          },
          {
            ...MessageData,
            ChatId,
            AuthorId: sender.Id,
            Text: 'upsert: not updated',
          },
        ]);

      resetQueriesCount();

      const user = await db.user
        .select('Id', 'Name')
        .find(0)
        .upsert({
          update: { Name: 'updated' },
          create: {
            ...UserData,
            Name: 'created',
            messages: {
              create: [{ ...MessageData, ChatId, Text: 'created' }],
              connect: [{ Id: connected.Id }],
              connectOrCreate: [
                {
                  where: { Id: connectOrCreated.Id },
                  create: {
                    ...MessageData,
                    ChatId,
                    Text: 'connect or create: connected',
                  },
                },
                {
                  where: { Text: 'connect or create: created' },
                  create: {
                    ...MessageData,
                    ChatId,
                    Text: 'connect or create: created',
                  },
                },
              ],
              upsert: [
                {
                  findBy: { Id: upserted.Id },
                  update: { Text: 'upsert: updated' },
                  create: MessageData,
                },
                {
                  findBy: { Id: 0 },
                  update: {},
                  create: {
                    ...MessageData,
                    ChatId,
                    Text: 'upsert: created',
                  },
                },
              ],
            },
          },
        });

      expect(getQueriesCount()).toBe(2);
      expect(user.Name).toBe('created');

      const messages = await db.message
        .order('Text')
        .select('Id', 'Text', 'AuthorId');
      expect(messages).toEqual([
        { Id: connected.Id, Text: 'connect', AuthorId: user.Id },
        {
          Id: connectOrCreated.Id,
          Text: 'connect or create: connected',
          AuthorId: user.Id,
        },
        {
          Id: expect.any(Number),
          Text: 'connect or create: created',
          AuthorId: user.Id,
        },
        { Id: expect.any(Number), Text: 'created', AuthorId: user.Id },
        { Id: expect.any(Number), Text: 'upsert: created', AuthorId: user.Id },
        { Id: upserted.Id, Text: 'upsert: updated', AuthorId: user.Id },
      ]);
    });
  });
});
