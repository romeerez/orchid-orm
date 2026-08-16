import { Db } from 'pqb';
import { omit } from 'pqb/internal';
import {
  useQueryCounter,
  useRelationCallback,
  useTestORM,
} from '../../test-utils/orm.test-utils';
import { Chat, UserData, UserDefaultSelect, ChatData, db } from 'test-utils';

const activeChatData = { ...ChatData, Active: true };

const { resetQueriesCount, getQueriesCount } = useQueryCounter();

describe('hasAndBelongsToMany create', () => {
  useTestORM();

  const useMultiQueryNestedCreate = () => {
    beforeAll(() => {
      db.$qb.internal.nestedCreateBatchMax = 1;
    });

    afterAll(() => {
      db.$qb.internal.nestedCreateBatchMax = 100;
    });
  };

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

  describe('create', () => {
    it('should support create', async () => {
      const q = db.user.insert({
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

      const count = await q;
      expect(count).toBe(1);

      expect(getQueriesCount()).toEqual(1);

      const users = await db.user;
      expect(users.length).toBe(1);

      const chats = await db.user
        .queryRelated('chats', users[0])
        .order('IdOfChat');

      expect(chats).toMatchObject([{ Title: 'chat 1' }, { Title: 'chat 2' }]);
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

      const user = await q;

      expect(getQueriesCount()).toEqual(1);

      const chats = await db.user.queryRelated('chats', user).order('IdOfChat');

      expect(chats).toMatchObject([
        { Active: true, Title: 'chat 1' },
        { Active: true, Title: 'chat 2' },
      ]);
    });

    const testCreateMany = async (queriesCount: number) => {
      const q = db.user.select('Id', 'UserKey').createMany([
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

      const users = await q;

      expect(getQueriesCount()).toEqual(queriesCount);

      const chats = await Promise.all([
        db.user.queryRelated('chats', users[0]).order('IdOfChat'),
        db.user.queryRelated('chats', users[1]).order('IdOfChat'),
      ]);

      expect(chats).toMatchObject([
        [{ Title: 'chat 1' }, { Title: 'chat 2' }],
        [{ Title: 'chat 3' }, { Title: 'chat 4' }],
      ]);
    };

    it('should support create many', async () => {
      await testCreateMany(1);
    });

    describe('too many records', () => {
      useMultiQueryNestedCreate();

      it('should use a multi-query strategy when inserting too many records', async () => {
        await testCreateMany(3);
      });
    });

    it('should support create many using `on`', async () => {
      const q = db.user.select('Id', 'UserKey').createMany([
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

      const users = await q;

      expect(getQueriesCount()).toEqual(1);

      const chats = await Promise.all([
        db.user.queryRelated('chats', users[0]).order('IdOfChat'),
        db.user.queryRelated('chats', users[1]).order('IdOfChat'),
      ]);

      expect(chats).toMatchObject([
        [
          { Active: true, Title: 'chat 1' },
          { Active: true, Title: 'chat 2' },
        ],
        [
          { Active: true, Title: 'chat 3' },
          { Active: true, Title: 'chat 4' },
        ],
      ]);
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

        resetQueriesCount();

        const ids = await db.chat.select('IdOfChat', 'ChatKey');

        expect(getQueriesCount()).toBe(1);

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
      });

      it('should invoke callbacks in a batch create', async () => {
        resetMocks();

        await db.user.createMany([data, data]);

        expect(getQueriesCount()).toBe(1);

        const ids = await db.chat.select('IdOfChat', 'ChatKey');

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
      });
    });

    it('should create hasAndBelongsToMany records in upsert', async () => {
      const user = await db.user
        .select('Id', 'UserKey')
        .find(0)
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            chats: { create: [ChatData] },
          },
        });

      expect(getQueriesCount()).toBe(2);

      const chats = await db.chat.select('Title');

      expect(chats).toEqual([
        {
          Title: ChatData.Title,
        },
      ]);

      expect(await db.user.queryRelated('chats', user)).toMatchObject([
        { Title: ChatData.Title },
      ]);
    });
  });

  describe('connect', () => {
    it('should support connect', async () => {
      await db.chat.createMany([
        { ...ChatData, Title: 'chat 1' },
        { ...ChatData, Title: 'chat 2' },
      ]);

      resetQueriesCount();

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

      const user = await q;

      expect(getQueriesCount()).toBe(1);

      const chats = await db.user.queryRelated('chats', user).order('IdOfChat');

      expect(chats).toMatchObject([{ Title: 'chat 1' }, { Title: 'chat 2' }]);
    });

    it('should fail to connect when `on` condition does not match', async () => {
      await db.chat.createMany([
        { ...ChatData, Title: 'chat 1' },
        { ...activeChatData, Title: 'chat 2' },
      ]);

      resetQueriesCount();

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

      expect(getQueriesCount()).toBe(1);
    });

    it('should connect using `on`', async () => {
      const chats = await db.chat.createMany([
        { ...activeChatData, Title: 'chat 1' },
        { ...activeChatData, Title: 'chat 2' },
      ]);

      resetQueriesCount();

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

      expect(getQueriesCount()).toBe(1);

      const userChats = await db.user.queryRelated('activeChats', user);

      expect(userChats.map((x) => x.IdOfChat)).toEqual(
        chats.map((x) => x.IdOfChat),
      );
    });

    const testConnectMany = async (queriesCount: number) => {
      await db.chat.createMany([
        { ...ChatData, Title: 'chat 1' },
        { ...ChatData, Title: 'chat 2' },
        { ...ChatData, Title: 'chat 3' },
        { ...ChatData, Title: 'chat 4' },
      ]);

      resetQueriesCount();

      const q = db.user.createMany([
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

      await q;

      expect(getQueriesCount()).toBe(queriesCount);

      const chats = await db.user.order('Id').select('Name', {
        chats: (q) => q.chats.select('Title').order('IdOfChat'),
      });

      expect(chats).toEqual([
        {
          Name: 'user 1',
          chats: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
        },
        {
          Name: 'user 2',
          chats: [{ Title: 'chat 3' }, { Title: 'chat 4' }],
        },
      ]);
    };

    it('should support connect many', async () => {
      await testConnectMany(1);
    });

    describe('too many records', () => {
      useMultiQueryNestedCreate();

      it('should use a multi-query strategy when inserting too many records', async () => {
        await testConnectMany(6);
      });
    });

    it('should fail to connect when `on` condition does not match', async () => {
      await db.chat.createMany([
        { ...ChatData, Title: 'chat 1' },
        { ...activeChatData, Title: 'chat 2' },
      ]);

      resetQueriesCount();

      const q = db.user.createMany([
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

      expect(getQueriesCount()).toBe(1);
    });

    it('should support connect many using `on`', async () => {
      const chats = await db.chat.createMany([
        { ...activeChatData, Title: 'chat 1' },
        { ...activeChatData, Title: 'chat 2' },
        { ...activeChatData, Title: 'chat 3' },
        { ...activeChatData, Title: 'chat 4' },
      ]);

      resetQueriesCount();

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

      expect(getQueriesCount()).toBe(1);

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

    it('should connect hasAndBelongsToMany records in upsert', async () => {
      await db.chat.create({
        ...ChatData,
        Title: 'chat 1',
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
            chats: { connect: [{ Title: 'chat 1' }] },
          },
        });

      expect(getQueriesCount()).toBe(2);

      const chats = await db.user.queryRelated('chats', user);

      expect(chats).toMatchObject([{ Title: 'chat 1' }]);
    });
  });

  describe('connectOrCreate', () => {
    it('should support connect or create', async () => {
      const chatId = await db.chat.get('IdOfChat').create({
        ...ChatData,
        Title: 'chat 1',
      });

      resetQueriesCount();

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

      expect(getQueriesCount()).toBe(1);

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

      resetQueriesCount();

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

      expect(getQueriesCount()).toBe(1);

      const chats = await db.user.queryRelated('chats', user);
      expect(chats[0].IdOfChat).toBe(chatId);
    });

    it('should create using `on`', async () => {
      const chatId = await db.chat.get('IdOfChat').create({
        ...ChatData,
        Title: 'chat 1',
      });

      resetQueriesCount();

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

      expect(getQueriesCount()).toBe(1);

      const chats = await db.user.queryRelated('chats', user);
      expect(chats[0].IdOfChat).not.toBe(chatId);
    });

    const testConnectOrCreateMany = async (queriesCount: number) => {
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

      resetQueriesCount();

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

      expect(getQueriesCount()).toBe(queriesCount);

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
    };

    it('should support connect or create many', async () => {
      await testConnectOrCreateMany(1);
    });

    describe('too many records', () => {
      useMultiQueryNestedCreate();

      it('should use a multi-query strategy when inserting too many records', async () => {
        await testConnectOrCreateMany(7);
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

      resetQueriesCount();

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

      expect(getQueriesCount()).toBe(1);

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

      expect(getQueriesCount()).toBe(1);
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

        expect(getQueriesCount()).toBe(1);

        const ids = await db.chat.select('IdOfChat', 'ChatKey');

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
      });

      it('should invoke callbacks in a batch create', async () => {
        resetMocks();

        await db.user.createMany([data, data]);

        expect(getQueriesCount()).toBe(1);

        const ids = await db.chat.select('IdOfChat', 'ChatKey');

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
      });
    });

    it('should connect or create hasAndBelongsToMany records in upsert', async () => {
      await db.chat.create({
        ...ChatData,
        Title: 'chat 1',
      });

      const user = await db.user
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

      const chats = await db.user.queryRelated('chats', user);

      expect(chats).toMatchObject([
        {
          Title: 'chat 1',
        },
      ]);
    });
  });

  describe('upsert', () => {
    it('should update and create related records from an array', async () => {
      const chat = await db.chat.create({
        ...ChatData,
        Title: 'existing chat',
      });

      const user = await db.user.create({
        ...UserData,
        chats: {
          upsert: [
            {
              findBy: { IdOfChat: chat.IdOfChat },
              update: { Title: 'updated chat' },
              create: ChatData,
            },
            {
              findBy: { IdOfChat: 0 },
              update: {},
              create: { ...ChatData, Title: 'created chat' },
            },
          ],
        },
      });

      expect(
        await db.user.queryRelated('chats', user).order('Title').pluck('Title'),
      ).toEqual(['created chat', 'updated chat']);
    });

    const testUpsertInCreateMany = async () => {
      const existing = await db.chat.create({
        ...ChatData,
        Title: 'existing chat',
      });

      const users = await db.user.createMany([
        {
          ...UserData,
          Name: 'first user',
          chats: {
            upsert: [
              {
                findBy: { IdOfChat: existing.IdOfChat },
                update: { Title: 'updated chat' },
                create: ChatData,
              },
              {
                findBy: { IdOfChat: 0 },
                update: {},
                create: { ...ChatData, Title: 'first created chat' },
              },
            ],
          },
        },
        {
          ...UserData,
          Name: 'second user',
          chats: {
            upsert: [
              {
                findBy: { IdOfChat: 0 },
                update: {},
                create: { ...ChatData, Title: 'second created chat' },
              },
            ],
          },
        },
      ]);

      expect(
        await Promise.all(
          users.map((user) =>
            db.user.queryRelated('chats', user).order('Title').pluck('Title'),
          ),
        ),
      ).toEqual([
        ['first created chat', 'updated chat'],
        ['second created chat'],
      ]);
    };

    it('should upsert related records in a batch create', async () => {
      await testUpsertInCreateMany();
    });

    describe('too many records', () => {
      useMultiQueryNestedCreate();

      it('should use a multi-query strategy for a batch create', async () => {
        await testUpsertInCreateMany();
      });
    });

    it('should upsert related records in upsert', async () => {
      const existing = await db.chat.create({
        ...ChatData,
        Title: 'existing chat',
      });

      const user = await db.user
        .select('Id', 'UserKey')
        .find(123)
        .upsert({
          update: { Name: 'updated user' },
          create: {
            ...UserData,
            chats: {
              upsert: [
                {
                  findBy: { IdOfChat: existing.IdOfChat },
                  update: { Title: 'updated chat' },
                },
                {
                  findBy: { IdOfChat: 0 },
                  update: {},
                  create: { ...ChatData, Title: 'created chat' },
                },
              ],
            },
          },
        });

      expect(
        await db.user.queryRelated('chats', user).order('Title').pluck('Title'),
      ).toEqual(['created chat', 'updated chat']);
    });

    it('should not upsert related records when updating in upsert', async () => {
      const existing = await db.chat.create({
        ...ChatData,
        Title: 'existing chat',
      });
      const user = await db.user.create(UserData);

      await db.user.find(user.Id).upsert({
        update: { Name: 'updated user' },
        create: {
          ...UserData,
          chats: {
            upsert: {
              findBy: { IdOfChat: existing.IdOfChat },
              update: { Title: 'updated chat' },
              create: { ...ChatData, Title: 'created chat' },
            },
          },
        },
      });

      expect(await db.chat.order('Title').pluck('Title')).toEqual([
        'existing chat',
      ]);
      expect(await db.user.queryRelated('chats', user)).toEqual([]);
    });
  });

  describe('combined', () => {
    it('should work with all operations in create', async () => {
      const [connected, connectOrCreated, upserted] = await db.chat.createMany([
        { ...ChatData, Title: 'connect' },
        { ...ChatData, Title: 'connect or create: connected' },
        { ...ChatData, Title: 'upsert: not updated' },
      ]);

      resetQueriesCount();

      const user = await db.user.create({
        ...UserData,
        Name: 'created',
        chats: {
          create: [{ ...ChatData, Title: 'created' }],
          connect: [{ IdOfChat: connected.IdOfChat }],
          connectOrCreate: [
            {
              where: { IdOfChat: connectOrCreated.IdOfChat },
              create: { ...ChatData, Title: 'connect or create: connected' },
            },
            {
              where: { Title: 'connect or create: created' },
              create: { ...ChatData, Title: 'connect or create: created' },
            },
          ],
          upsert: [
            {
              findBy: { IdOfChat: upserted.IdOfChat },
              update: { Title: 'upsert: updated' },
              create: ChatData,
            },
            {
              findBy: { IdOfChat: 0 },
              update: {},
              create: { ...ChatData, Title: 'upsert: created' },
            },
          ],
        },
      });

      expect(getQueriesCount()).toBe(1);
      expect(user.Name).toBe('created');

      expect(
        await db.user
          .queryRelated('chats', user)
          .order('Title')
          .select('Title'),
      ).toEqual([
        { Title: 'connect' },
        { Title: 'connect or create: connected' },
        { Title: 'connect or create: created' },
        { Title: 'created' },
        { Title: 'upsert: created' },
        { Title: 'upsert: updated' },
      ]);
    });

    it('should work in upsert', async () => {
      const [connected, connectOrCreated, upserted] = await db.chat.createMany([
        { ...ChatData, Title: 'connect' },
        { ...ChatData, Title: 'connect or create: connected' },
        { ...ChatData, Title: 'upsert: not updated' },
      ]);

      resetQueriesCount();

      const user = await db.user
        .selectAll()
        .find(0)
        .upsert({
          update: { Name: 'updated' },
          create: {
            ...UserData,
            Name: 'created',
            chats: {
              create: [{ ...ChatData, Title: 'created' }],
              connect: [{ IdOfChat: connected.IdOfChat }],
              connectOrCreate: [
                {
                  where: { IdOfChat: connectOrCreated.IdOfChat },
                  create: {
                    ...ChatData,
                    Title: 'connect or create: connected',
                  },
                },
                {
                  where: { Title: 'connect or create: created' },
                  create: {
                    ...ChatData,
                    Title: 'connect or create: created',
                  },
                },
              ],
              upsert: [
                {
                  findBy: { IdOfChat: upserted.IdOfChat },
                  update: { Title: 'upsert: updated' },
                  create: ChatData,
                },
                {
                  findBy: { IdOfChat: 0 },
                  update: {},
                  create: { ...ChatData, Title: 'upsert: created' },
                },
              ],
            },
          },
        });

      expect(getQueriesCount()).toBe(2);
      expect(user.Name).toBe('created');

      expect(
        await db.user
          .queryRelated('chats', user)
          .order('Title')
          .select('Title'),
      ).toEqual([
        { Title: 'connect' },
        { Title: 'connect or create: connected' },
        { Title: 'connect or create: created' },
        { Title: 'created' },
        { Title: 'upsert: created' },
        { Title: 'upsert: updated' },
      ]);
    });
  });
});
