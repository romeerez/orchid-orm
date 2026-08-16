import { Db } from 'pqb';
import {
  useRelationCallback,
  useTestORM,
  useQueryCounter,
} from '../../test-utils/orm.test-utils';
import { UserData, ChatData, TaskData, db } from 'test-utils';

const activeChatData = { ...ChatData, Active: true };

const { resetQueriesCount, getQueriesCount } = useQueryCounter();

describe('hasAndBelongsToMany update', () => {
  useTestORM();

  describe('add', () => {
    it('should connect many related records to one', async () => {
      const userId = await db.user.get('Id').create(UserData);

      const createdChats = await db.chat.createMany([ChatData, ChatData]);

      resetQueriesCount();

      const count = await db.user.find(userId).update({
        chats: {
          add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
        },
      });
      expect(count).toBe(1);

      expect(getQueriesCount()).toBe(1);

      const chats = await db.user.queryRelated('chats', {
        Id: userId,
        UserKey: 'key',
      });

      expect(chats).toEqual(createdChats);
    });

    it('should add related records in upsert update branch', async () => {
      const userId = await db.user.get('Id').create(UserData);
      const chat = await db.chat.create(ChatData);

      resetQueriesCount();

      const query = db.user.find(userId).upsert({
        update: { chats: { add: { IdOfChat: chat.IdOfChat } } },
        create: {
          ...UserData,
          chats: { create: [{ ...ChatData, Title: 'create branch chat' }] },
        },
      });

      await query;

      expect(getQueriesCount()).toBe(1);

      expect(
        await db.user.queryRelated('chats', { Id: userId, UserKey: 'key' }),
      ).toEqual([chat]);
    });

    it('should fail to connect when `on` condition does not match', async () => {
      const userId = await db.user.get('Id').create(UserData);

      const createdChats = await db.chat.createMany([ChatData, activeChatData]);

      resetQueriesCount();

      const q = db.user.find(userId).update({
        activeChats: {
          add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
        },
      });

      await expect(q).rejects.toThrow(
        'Expected to find at least 2 record(s) based on `add` conditions, but found 1',
      );

      expect(getQueriesCount()).toBe(1);
    });

    it('should connect many related records to one using `on`', async () => {
      const userId = await db.user.get('Id').create(UserData);

      const createdChats = await db.chat.createMany([
        activeChatData,
        activeChatData,
      ]);

      resetQueriesCount();

      const count = await db.user.find(userId).update({
        activeChats: {
          add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const chats = await db.user.queryRelated('activeChats', {
        Id: userId,
        UserKey: 'key',
      });

      expect(chats).toEqual(createdChats);
    });

    it('should connect many related records to many', async () => {
      const [userId1, userId2] = await db.user
        .get('Id')
        .createMany([UserData, UserData]);

      const createdChats = await db.chat.createMany([ChatData, ChatData]);

      resetQueriesCount();

      const count = await db.user.whereIn('Id', [userId1, userId2]).update({
        chats: {
          add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(2);

      const [chats1, chats2] = await Promise.all([
        db.user.queryRelated('chats', {
          Id: userId1,
          UserKey: 'key',
        }),
        db.user.queryRelated('chats', {
          Id: userId1,
          UserKey: 'key',
        }),
      ]);

      expect(chats1).toEqual(createdChats);
      expect(chats2).toEqual(createdChats);
    });

    it('should faile to connect many related records to many when `on` condition does not match', async () => {
      const [userId1, userId2] = await db.user
        .get('Id')
        .createMany([UserData, UserData]);

      const createdChats = await db.chat.createMany([ChatData, activeChatData]);

      resetQueriesCount();

      const q = db.user.whereIn('Id', [userId1, userId2]).update({
        activeChats: {
          add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
        },
      });

      await expect(q).rejects.toThrow(
        'Expected to find at least 2 record(s) based on `add` conditions, but found 1',
      );

      expect(getQueriesCount()).toBe(1);
    });

    it('should connect many related records to many using `on`', async () => {
      const [userId1, userId2] = await db.user
        .get('Id')
        .createMany([UserData, UserData]);

      const createdChats = await db.chat.createMany([
        activeChatData,
        activeChatData,
      ]);

      resetQueriesCount();

      const count = await db.user.whereIn('Id', [userId1, userId2]).update({
        activeChats: {
          add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(2);

      const [chats1, chats2] = await Promise.all([
        db.user.queryRelated('activeChats', {
          Id: userId1,
          UserKey: 'key',
        }),
        db.user.queryRelated('activeChats', {
          Id: userId1,
          UserKey: 'key',
        }),
      ]);

      expect(chats1).toEqual(createdChats);
      expect(chats2).toEqual(createdChats);
    });

    it('should throw when no related records were found by a condition', async () => {
      const userId = await db.user.get('Id').create(UserData);

      resetQueriesCount();

      const q = db.user.find(userId).update({
        chats: {
          add: { IdOfChat: 123 },
        },
      });

      await expect(q).rejects.toThrow(
        'Expected to find at least 1 record(s) based on `add` conditions, but found 0',
      );

      expect(getQueriesCount()).toBe(1);
    });

    it('should not throw when adding a record that was already connected', async () => {
      const userId = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [ChatData],
        },
      });

      resetQueriesCount();

      const count = await db.user.find(userId).update({
        chats: {
          add: { Title: ChatData.Title },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);
    });
  });

  describe('disconnect', () => {
    it('should delete join table rows', async () => {
      const userId = await db.user.get('Id').create({
        ...UserData,
        Name: 'user',
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...ChatData, Title: 'chat 2' },
            { ...ChatData, Title: 'chat 3' },
          ],
        },
      });

      resetQueriesCount();

      const count = await db.user.where({ Id: userId }).update({
        chats: {
          disconnect: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const chats = await db.user.queryRelated('chats', {
        Id: userId,
        UserKey: 'key',
      });
      expect(chats.length).toBe(1);
      expect(chats[0].Title).toEqual('chat 3');
    });

    it('should disconnect related records in upsert update branch', async () => {
      const userId = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'disconnect' },
            { ...ChatData, Title: 'keep' },
          ],
        },
      });

      resetQueriesCount();

      await db.user.find(userId).upsert({
        update: { chats: { disconnect: { Title: 'disconnect' } } },
        create: {
          ...UserData,
          chats: { create: [{ ...ChatData, Title: 'create branch chat' }] },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(
        await db.user
          .queryRelated('chats', { Id: userId, UserKey: 'key' })
          .pluck('Title'),
      ).toEqual(['keep']);
    });

    it('should delete matching join table rows using `on`', async () => {
      const userId = await db.user.get('Id').create({
        ...UserData,
        Name: 'user',
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...activeChatData, Title: 'chat 2' },
            { ...ChatData, Title: 'chat 3' },
          ],
        },
      });

      resetQueriesCount();

      const count = await db.user.where({ Id: userId }).update({
        activeChats: {
          disconnect: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const chats = await db.user.queryRelated('chats', {
        Id: userId,
        UserKey: 'key',
      });

      expect(chats.map((chat) => chat.Title)).toEqual(['chat 1', 'chat 3']);
    });

    it('should ignore empty list', async () => {
      const Id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [{ ...ChatData, Title: 'chat 1' }],
        },
      });

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        chats: {
          disconnect: [],
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const chats = await db.user
        .queryRelated('chats', { Id, UserKey: 'key' })
        .pluck('Title');
      expect(chats).toEqual(['chat 1']);
    });
  });

  describe('set', () => {
    it('should delete previous join records and create join records for matching related records', async () => {
      const Id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...ChatData, Title: 'chat 2' },
          ],
        },
      });

      await db.chat.create({
        ...ChatData,
        Title: 'chat 3',
      });

      resetQueriesCount();

      const count = await db.user.where({ Id }).update({
        chats: {
          set: [{ Title: 'chat 2' }, { Title: 'chat 3' }],
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const chats = await db.user
        .queryRelated('chats', { Id, UserKey: 'key' })
        .select('Title')
        .order('Title');

      expect(chats).toEqual([{ Title: 'chat 2' }, { Title: 'chat 3' }]);
    });

    it('should set related records in upsert update branch', async () => {
      const userId = await db.user.get('Id').create({
        ...UserData,
        chats: { create: [{ ...ChatData, Title: 'previous' }] },
      });
      await db.chat.create({ ...ChatData, Title: 'set' });

      resetQueriesCount();

      await db.user.find(userId).upsert({
        update: { chats: { set: { Title: 'set' } } },
        create: {
          ...UserData,
          chats: { create: [{ ...ChatData, Title: 'create branch chat' }] },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(
        await db.user
          .queryRelated('chats', { Id: userId, UserKey: 'key' })
          .pluck('Title'),
      ).toEqual(['set']);
    });

    it('should delete previous join records and create join records for matching related records', async () => {
      const Id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...activeChatData, Title: 'chat 2' },
          ],
        },
      });

      await db.chat.createMany([
        {
          ...activeChatData,
          Title: 'chat 3',
        },
        {
          ...activeChatData,
          Title: 'chat 4',
        },
      ]);

      resetQueriesCount();

      const count = await db.user.where({ Id }).update({
        activeChats: {
          set: [{ Title: 'chat 2' }, { Title: 'chat 3' }, { Title: 'chat 4' }],
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const chats = await db.user
        .queryRelated('activeChats', { Id, UserKey: 'key' })
        .order('Title')
        .pluck('Title');

      expect(chats).toEqual(['chat 2', 'chat 3', 'chat 4']);
    });

    it('should throw when not all related records match', async () => {
      const Id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...activeChatData, Title: 'chat 2' },
          ],
        },
      });

      await db.chat.createMany([
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

      const query = db.user.where({ Id }).update({
        activeChats: {
          set: [{ Title: 'chat 2' }, { Title: 'chat 3' }, { Title: 'chat 4' }],
        },
      });

      await expect(query).rejects.toThrow(
        'Expected to find at least 3 record(s) based on `set` conditions, but found 2',
      );

      expect(getQueriesCount()).toBe(1);
    });

    it('should delete all previous connections when empty array is given', async () => {
      const Id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...ChatData, Title: 'chat 2' },
          ],
        },
      });

      resetQueriesCount();

      const count = await db.user.where({ Id, UserKey: 'key' }).update({
        chats: {
          set: [],
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const chats = await db.user.queryRelated('chats', {
        Id,
        UserKey: 'key',
      });

      expect(chats).toEqual([]);
    });

    it('should not delete previous connections not matching `on` conditions', async () => {
      const Id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...activeChatData, Title: 'chat 2' },
          ],
        },
      });

      resetQueriesCount();

      const count = await db.user.where({ Id, UserKey: 'key' }).update({
        activeChats: {
          set: [],
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const chats = await db.user
        .queryRelated('chats', {
          Id,
          UserKey: 'key',
        })
        .pluck('Title');

      expect(chats).toEqual(['chat 1']);
    });
  });

  describe('delete', () => {
    it('should delete related records', async () => {
      const Id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...ChatData, Title: 'chat 2' },
            { ...ChatData, Title: 'chat 3' },
          ],
        },
      });

      await db.user.create({
        ...UserData,
        chats: {
          create: [{ ...ChatData, Title: 'chat 4' }],
        },
      });

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        chats: {
          delete: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      expect(await db.chat.count()).toBe(2);

      const chats = await db.user
        .queryRelated('chats', { Id, UserKey: 'key' })
        .select('Title');
      expect(chats).toEqual([{ Title: 'chat 3' }]);
    });

    it('should delete related records in upsert update branch', async () => {
      const userId = await db.user.get('Id').create({
        ...UserData,
        chats: { create: [{ ...ChatData, Title: 'delete' }] },
      });

      resetQueriesCount();

      await db.user.find(userId).upsert({
        update: { chats: { delete: { Title: 'delete' } } },
        create: {
          ...UserData,
          chats: { create: [{ ...ChatData, Title: 'create branch chat' }] },
        },
      });

      expect(getQueriesCount()).toBe(1);
      expect(await db.chat.count()).toBe(0);
      expect(
        await db.user.queryRelated('chats', { Id: userId, UserKey: 'key' }),
      ).toEqual([]);
    });

    it('should delete only matching related records using `on`', async () => {
      const Id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...activeChatData, Title: 'chat 2' },
            { ...activeChatData, Title: 'chat 3' },
          ],
        },
      });

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        activeChats: {
          delete: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      expect(await db.chat.count()).toBe(2);

      const chats = await db.user
        .queryRelated('chats', { Id, UserKey: 'key' })
        .pluck('Title');

      expect(chats).toEqual(['chat 1', 'chat 3']);
    });

    it('should ignore empty list', async () => {
      const Id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [{ ...ChatData, Title: 'chat 1' }],
        },
      });

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        chats: {
          delete: [],
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const chats = await db.user
        .queryRelated('chats', { Id, UserKey: 'key' })
        .pluck('Title');
      expect(chats).toEqual(['chat 1']);
    });

    describe('relation callbacks', () => {
      const { beforeDelete, afterDelete, resetMocks } = useRelationCallback(
        db.user.relations.chats,
        ['Title'],
      );

      const data = {
        chats: {
          delete: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
        },
      };

      it('should invoke callbacks', async () => {
        const id = await db.user.get('Id').create({
          ...UserData,
          chats: {
            create: [
              { ...ChatData, Title: 'chat 1' },
              { ...ChatData, Title: 'chat 2' },
            ],
          },
        });

        const hookData = await db.chat
          // Title is selected by the hook, keys are selected for CTE
          .select('Title', 'IdOfChat', 'ChatKey')
          .order('IdOfChat');

        resetQueriesCount();

        const count = await db.user.find(id).update(data);

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        expect(beforeDelete).toHaveBeenCalledTimes(1);
        expect(afterDelete).toHaveBeenCalledTimes(1);

        const actual = afterDelete.mock.calls[0][0].sort(
          (a: { IdOfChat: number }, b: { IdOfChat: number }) =>
            a.IdOfChat - b.IdOfChat,
        );
        expect(actual).toEqual(hookData);
      });

      it('should invoke callbacks in a batch update', async () => {
        resetMocks();

        const UserIds = await db.user.pluck('Id').createMany([
          {
            ...UserData,
            chats: {
              create: [
                { ...ChatData, Title: 'chat 1' },
                { ...ChatData, Title: 'chat 3' },
              ],
            },
          },
          {
            ...UserData,
            chats: {
              create: [
                { ...ChatData, Title: 'chat 2' },
                { ...ChatData, Title: 'chat 4' },
              ],
            },
          },
        ]);

        expect(getQueriesCount()).toBe(1);

        const hookData = await db.chat
          // Title is selected by the hook, keys are selected for CTE
          .select('Title', 'IdOfChat', 'ChatKey')
          .order('IdOfChat');

        const count = await db.user.where({ Id: { in: UserIds } }).update(data);
        expect(count).toBe(2);

        expect(beforeDelete).toHaveBeenCalledTimes(1);
        expect(afterDelete).toHaveBeenCalledTimes(1);

        const actual = afterDelete.mock.calls[0][0].sort(
          (a: { IdOfChat: number }, b: { IdOfChat: number }) =>
            a.IdOfChat - b.IdOfChat,
        );
        expect(actual).toEqual([hookData[0], hookData[2]]);
      });
    });
  });

  describe('update', () => {
    it('should update related records', async () => {
      const id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...ChatData, Title: 'chat 2' },
            { ...ChatData, Title: 'chat 3' },
          ],
        },
      });

      await db.user.create({
        ...UserData,
        chats: {
          create: [{ ...ChatData, Title: 'chat 4' }],
        },
      });

      resetQueriesCount();

      const count = await db.user.find(id).update({
        chats: {
          update: {
            where: {
              Title: { in: ['chat 2', 'chat 3', 'chat 4'] },
            },
            data: {
              Title: 'updated',
            },
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const titles = await db.chat.order('IdOfChat').pluck('Title');
      expect(titles).toEqual(['chat 1', 'updated', 'updated', 'chat 4']);
    });

    it('should update related records with distinct data for each condition', async () => {
      const id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...ChatData, Title: 'chat 2' },
            { ...ChatData, Title: 'chat 3' },
          ],
        },
      });

      resetQueriesCount();

      const count = await db.user.find(id).update({
        chats: {
          update: [
            {
              where: { Title: 'chat 1' },
              data: { Title: 'updated 1' },
            },
            {
              where: { Title: 'chat 2' },
              data: { Title: 'updated 2' },
            },
          ],
        },
      });

      expect(getQueriesCount()).toBe(1);
      expect(count).toBe(1);

      expect(await db.chat.order('IdOfChat').pluck('Title')).toEqual([
        'updated 1',
        'updated 2',
        'chat 3',
      ]);
    });

    it('should update related records in upsert update branch', async () => {
      const userId = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'previous 1' },
            { ...ChatData, Title: 'previous 2' },
          ],
        },
      });

      resetQueriesCount();

      await db.user.find(userId).upsert({
        update: {
          chats: {
            update: [
              {
                where: { Title: 'previous 1' },
                data: { Title: 'updated 1' },
              },
              {
                where: { Title: 'previous 2' },
                data: { Title: 'updated 2' },
              },
            ],
          },
        },
        create: {
          ...UserData,
          chats: { create: [{ ...ChatData, Title: 'create branch chat' }] },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(
        await db.user
          .queryRelated('chats', { Id: userId, UserKey: 'key' })
          .order('IdOfChat')
          .pluck('Title'),
      ).toEqual(['updated 1', 'updated 2']);
    });

    it('should throw when a related record to update is not found', async () => {
      const id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...ChatData, Title: 'chat 3' },
          ],
        },
      });

      await db.user.create({
        ...UserData,
        chats: {
          create: [{ ...ChatData, Title: 'chat 4' }],
        },
      });

      resetQueriesCount();

      const q = db.user.find(id).update({
        chats: {
          update: {
            where: [{ Title: 'chat 2' }, { Title: 'chat 3' }],
            data: {
              Title: 'updated',
            },
          },
        },
      });

      await expect(q).rejects.toThrow('Record is not found');

      expect(getQueriesCount()).toBe(1);
    });

    it('should update related records using `on`', async () => {
      const id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [
            { ...ChatData, Title: 'chat 1' },
            { ...ChatData, Title: 'chat 2' },
            { ...activeChatData, Title: 'chat 3' },
          ],
        },
      });

      await db.user.create({
        ...UserData,
        activeChats: {
          create: [{ ...ChatData, Title: 'chat 4' }],
        },
      });

      resetQueriesCount();

      const count = await db.user.find(id).update({
        activeChats: {
          update: {
            where: {
              Title: { in: ['chat 2', 'chat 3', 'chat 4'] },
            },
            data: {
              Title: 'updated',
            },
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const titles = await db.chat.order('IdOfChat').pluck('Title');
      expect(titles).toEqual(['chat 1', 'chat 2', 'updated', 'chat 4']);
    });

    it('should ignore update with empty where list', async () => {
      const Id = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [{ ...ChatData, Title: 'chat 1' }],
        },
      });

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        chats: {
          update: {
            where: [],
            data: {
              Title: 'updated',
            },
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const chats = await db.user
        .queryRelated('chats', { Id, UserKey: 'key' })
        .pluck('Title');
      expect(chats).toEqual(['chat 1']);
    });

    describe('relation callbacks', () => {
      const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
        db.user.relations.chats,
        ['IdOfChat'],
      );

      const data = {
        chats: {
          update: {
            where: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
            data: { Title: 'new title' },
          },
        },
      };

      it('should invoke callbacks', async () => {
        const id = await db.user.get('Id').create({
          ...UserData,
          chats: {
            create: [
              { ...ChatData, Title: 'chat 1' },
              { ...ChatData, Title: 'chat 2' },
            ],
          },
        });

        resetQueriesCount();

        const count = await db.user.find(id).update(data);

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        const hookData = await db.chat.select('IdOfChat');

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(hookData, expect.any(Db));
      });

      it('should invoke callbacks in a batch update', async () => {
        const userIds = await db.user.pluck('Id').createMany([
          {
            ...UserData,
            chats: {
              create: [{ ...ChatData, Title: 'chat 1' }],
            },
          },
          {
            ...UserData,
            chats: {
              create: [{ ...ChatData, Title: 'chat 2' }],
            },
          },
        ]);

        resetMocks();

        resetQueriesCount();

        const count = await db.user.where({ Id: { in: userIds } }).update(data);

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(2);

        const ids = await db.chat.pluck('IdOfChat');

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [{ IdOfChat: ids[0] }, { IdOfChat: ids[1] }],
          expect.any(Db),
        );
      });
    });
  });

  describe('upsert', () => {
    it('should update related records if they exist', async () => {
      const data = await db.user
        .select('Id', { taskIds: (q) => q.tasks.pluck('Id') })
        .create({
          ...UserData,
          tasks: {
            create: [{ ...TaskData, Title: 'task 1' }],
          },
        });

      resetQueriesCount();

      const q = db.user.find(data.Id).update({
        tasks: {
          upsert: {
            findBy: { Id: data.taskIds[0] },
            update: { Title: 'updated 1' },
            create: { ...TaskData, Title: 'created 1' },
          },
        },
      });

      const count = await q;

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const tasks = await db.user
        .queryRelated('tasks', { Id: data.Id, UserKey: 'key' })
        .order('Title')
        .pluck('Title');
      expect(tasks).toEqual(['updated 1']);
    });

    it('should upsert related records in upsert update branch', async () => {
      const data = await db.user
        .select('Id', { taskIds: (q) => q.tasks.pluck('Id') })
        .create({
          ...UserData,
          tasks: { create: [{ ...TaskData, Title: 'previous' }] },
        });

      resetQueriesCount();

      await db.user.find(data.Id).upsert({
        update: {
          tasks: {
            upsert: {
              findBy: { Id: data.taskIds[0] },
              update: { Title: 'updated' },
              create: { ...TaskData, Title: 'created' },
            },
          },
        },
        create: {
          ...UserData,
          chats: { create: [{ ...ChatData, Title: 'create branch chat' }] },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(
        await db.user
          .queryRelated('tasks', { Id: data.Id, UserKey: 'key' })
          .pluck('Title'),
      ).toEqual(['updated']);
    });

    it('should create related records if they do not exist', async () => {
      const Id = await db.user.get('Id').create(UserData);

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        tasks: {
          upsert: {
            findBy: { Id: 0 },
            update: { Title: 'updated 1' },
            create: { ...TaskData, Title: 'created 1' },
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const tasks = await db.user
        .queryRelated('tasks', { Id, UserKey: 'key' })
        .order('Title')
        .pluck('Title');
      expect(tasks).toEqual(['created 1']);
    });

    it('should upsert multiple related records', async () => {
      const data = await db.user
        .select('Id', { taskIds: (q) => q.tasks.pluck('Id') })
        .create({
          ...UserData,
          tasks: {
            create: [{ ...TaskData, Title: 'existing task' }],
          },
        });

      await db.user.find(data.Id).update({
        tasks: {
          upsert: [
            {
              findBy: { Id: data.taskIds[0] },
              update: { Title: 'updated task' },
              create: TaskData,
            },
            {
              findBy: { Id: 0 },
              update: {},
              create: { ...TaskData, Title: 'created task' },
            },
          ],
        },
      });

      expect(
        await db.user
          .queryRelated('tasks', { Id: data.Id, UserKey: 'key' })
          .order('Title')
          .pluck('Title'),
      ).toEqual(['created task', 'updated task']);
    });

    it('should create related records if they do not exist with data from callbacks', async () => {
      const Id = await db.user.get('Id').create(UserData);

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        tasks: {
          upsert: {
            findBy: { Id: 0 },
            update: { Title: 'updated 1' },
            create: () => ({ ...TaskData, Title: 'created 1' }),
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const tasks = await db.user
        .queryRelated('tasks', { Id, UserKey: 'key' })
        .order('Title')
        .pluck('Title');
      expect(tasks).toEqual(['created 1']);
    });

    it('should throw in batch update', async () => {
      expect(() =>
        db.user.where({ Id: { in: [1, 2, 3] } }).update({
          tasks: {
            // @ts-expect-error not allowed in batch update
            upsert: {
              findBy: { Title: 'task' },
              update: { Title: 'updated' },
              create: { ...TaskData, Title: 'created' },
            },
          },
        }),
      ).toThrow('`upsert` option is not allowed in a batch update');
    });

    describe('relation callbacks', () => {
      const {
        beforeUpdate,
        afterUpdate,
        beforeCreate,
        afterCreate,
        resetMocks,
      } = useRelationCallback(db.user.relations.tasks, ['Id', 'TaskKey']);

      it('should invoke callbacks when updating', async () => {
        const Id = await db.user.get('Id').create({
          ...UserData,
          tasks: {
            create: [{ ...TaskData, Title: 'task 1' }],
          },
        });
        const ids = await db.task.select('Id', 'TaskKey');

        resetQueriesCount();

        const count = await db.user.find(Id).update({
          tasks: {
            upsert: {
              findBy: { Id: ids[0].Id },
              update: { Title: 'updated 1' },
              create: { ...TaskData, Title: 'created 1' },
            },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(ids, expect.any(Db));
      });

      it('should invoke callbacks when creating', async () => {
        resetMocks();

        const Id = await db.user.get('Id').create(UserData);

        resetQueriesCount();

        const count = await db.user.find(Id).update({
          tasks: {
            upsert: {
              findBy: { Id: 0 },
              update: { Title: 'updated 1' },
              create: { ...TaskData, Title: 'created 1' },
            },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        const ids = await db.task.select('Id', 'TaskKey');

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
      });
    });
  });

  describe('create', () => {
    it('should create many records and connect them', async () => {
      const userIds = await db.user
        .pluck('Id')
        .createMany([UserData, UserData]);

      resetQueriesCount();

      const count = await db.user.where({ Id: { in: userIds } }).update({
        chats: {
          create: [
            {
              ...ChatData,
              Title: 'created 1',
            },
            {
              ...ChatData,
              Title: 'created 2',
            },
          ],
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(2);

      const firstUserChats = await db.user
        .queryRelated('chats', { Id: userIds[0], UserKey: 'key' })
        .order('Title');
      expect(firstUserChats.map((chat) => chat.Title)).toEqual([
        'created 1',
        'created 2',
      ]);

      const secondUserChats = await db.user
        .queryRelated('chats', { Id: userIds[1], UserKey: 'key' })
        .order('Title');
      expect(secondUserChats.map((chat) => chat.Title)).toEqual([
        'created 1',
        'created 2',
      ]);

      expect(firstUserChats.map((chat) => chat.IdOfChat)).toEqual(
        secondUserChats.map((chat) => chat.IdOfChat),
      );
    });

    it('should create related records in upsert update branch', async () => {
      const userId = await db.user.get('Id').create(UserData);

      resetQueriesCount();

      await db.user.find(userId).upsert({
        update: {
          chats: { create: [{ ...ChatData, Title: 'updated branch chat' }] },
        },
        create: {
          ...UserData,
          chats: { create: [{ ...ChatData, Title: 'create branch chat' }] },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(
        await db.user
          .queryRelated('chats', { Id: userId, UserKey: 'key' })
          .pluck('Title'),
      ).toEqual(['updated branch chat']);
    });

    it('should create many records and connect them, using `on`', async () => {
      const users = await db.user.createMany([UserData, UserData]);

      resetQueriesCount();

      const count = await db.user
        .where({ Id: { in: users.map((user) => user.Id) } })
        .update({
          activeChats: {
            create: [
              {
                ...ChatData,
                Title: 'created 1',
              },
              {
                ...ChatData,
                Title: 'created 2',
              },
            ],
          },
        });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(2);

      const user1Chats = await db.user
        .queryRelated('chats', users[0])
        .order('Title')
        .pluck('Title');

      const user2Chats = await db.user
        .queryRelated('chats', users[1])
        .order('Title')
        .pluck('Title');

      expect(user1Chats).toEqual(['created 1', 'created 2']);
      expect(user2Chats).toEqual(['created 1', 'created 2']);
    });

    it('should ignore empty list', async () => {
      const Id = await db.user.get('Id').create(UserData);

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        chats: {
          create: [],
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const chats = await db.user.queryRelated('chats', {
        Id,
        UserKey: 'key',
      });
      expect(chats).toEqual([]);
    });

    describe('relation callbacks', () => {
      const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
        db.user.relations.chats,
        ['IdOfChat'],
      );

      const data = {
        chats: {
          create: [ChatData, ChatData],
        },
      };

      it('should invoke callbacks', async () => {
        const id = await db.user.get('Id').create(UserData);

        const count = await db.user.find(id).update(data);
        expect(count).toBe(1);

        resetQueriesCount();

        const ids = await db.chat.select('IdOfChat', 'ChatKey');

        expect(getQueriesCount()).toBe(1);

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
      });

      it('should invoke callbacks in a batch update', async () => {
        const userIds = await db.user
          .pluck('Id')
          .createMany([UserData, UserData]);

        resetMocks();

        resetQueriesCount();

        const count = await db.user.where({ Id: { in: userIds } }).update(data);

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(2);

        const ids = await db.chat.select('IdOfChat', 'ChatKey');

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(ids).toHaveLength(2);
        expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
      });
    });
  });

  describe('combined', () => {
    it('should combine all supported nested operations successfully', async () => {
      const [user1, user2] = await db.user.createMany([UserData, UserData]);

      const createdChats = await db.chat.createMany([
        { ...ChatData, Title: 'add 1' },
        { ...ChatData, Title: 'add 2' },
        { ...ChatData, Title: 'disconnect 1' },
        { ...ChatData, Title: 'disconnect 2' },
        { ...ChatData, Title: 'delete 1' },
        { ...ChatData, Title: 'delete 2' },
        { ...ChatData, Title: 'existing' },
        { ...ChatData, Title: 'set: disconnected' },
        { ...ChatData, Title: 'set 1' },
        { ...ChatData, Title: 'set 2' },
      ]);
      const upsertedChat = await db.chat.create({
        ...ChatData,
        Title: 'upsert: not updated',
      });

      await db.user.find(user1.Id).update({
        chats: {
          add: createdChats
            .slice(0, 2)
            .concat(upsertedChat)
            .map((chat) => ({ IdOfChat: chat.IdOfChat })),
        },
      });
      await db.user.find(user2.Id).update({
        chats: {
          add: [
            ...createdChats.slice(2, 8),
            createdChats[9],
            { IdOfChat: upsertedChat.IdOfChat },
          ].map((chat) => ({ IdOfChat: chat.IdOfChat })),
        },
      });

      resetQueriesCount();

      const count = await db.user.find(user2.Id).update({
        chats: {
          add: createdChats
            .slice(0, 2)
            .concat(upsertedChat)
            .map((chat) => ({ IdOfChat: chat.IdOfChat })),
          disconnect: [{ Title: 'disconnect 1' }, { Title: 'disconnect 2' }],
          set: [{ Title: 'set 1' }, { Title: 'set 2' }],
          delete: [{ Title: 'delete 1' }, { Title: 'delete 2' }],
          update: [
            {
              where: { Title: 'add 1' },
              data: { Title: 'add 1 updated' },
            },
            {
              where: { Title: 'set 1' },
              data: { Title: 'set 1 updated' },
            },
            {
              where: { Title: 'disconnect 1' },
              data: { Title: 'disconnect 1 updated' },
            },
            {
              where: { Title: 'set: disconnected' },
              data: { Title: 'set: disconnected updated' },
            },
          ],
          upsert: [
            {
              findBy: { IdOfChat: upsertedChat.IdOfChat },
              update: { Title: 'upsert: updated' },
              create: ChatData,
            },
            {
              findBy: { IdOfChat: 0 },
              update: {},
              create: { ...ChatData, Title: 'upsert: created' },
            },
            {
              findBy: { IdOfChat: createdChats[1].IdOfChat },
              update: { Title: 'add 2 upserted' },
              create: ChatData,
            },
            {
              findBy: { IdOfChat: createdChats[9].IdOfChat },
              update: { Title: 'set 2 upserted' },
              create: ChatData,
            },
            {
              findBy: { IdOfChat: createdChats[3].IdOfChat },
              update: { Title: 'disconnect 2 upserted' },
              create: { ...ChatData, Title: 'disconnect 2 upsert created' },
            },
            {
              findBy: { IdOfChat: createdChats[7].IdOfChat },
              update: { Title: 'set: disconnected upserted' },
              create: {
                ...ChatData,
                Title: 'set: disconnected upsert created',
              },
            },
          ],
          create: [
            { ...ChatData, Title: 'created 1' },
            { ...ChatData, Title: 'created 2' },
          ],
        },
      });

      expect(getQueriesCount()).toBe(1);
      expect(count).toBe(1);

      expect(await db.chat.order('Title').pluck('Title')).toEqual([
        'add 1 updated',
        'add 2 upserted',
        'created 1',
        'created 2',
        'disconnect 1',
        'disconnect 2',
        'disconnect 2 upsert created',
        'existing',
        'set 1 updated',
        'set 2 upserted',
        'set: disconnected',
        'set: disconnected upsert created',
        'upsert: created',
        'upsert: updated',
      ]);
    });

    it('should work in upsert', async () => {
      const [user1, user2] = await db.user.createMany([UserData, UserData]);

      const createdChats = await db.chat.createMany([
        { ...ChatData, Title: 'add 1' },
        { ...ChatData, Title: 'add 2' },
        { ...ChatData, Title: 'disconnect 1' },
        { ...ChatData, Title: 'disconnect 2' },
        { ...ChatData, Title: 'delete 1' },
        { ...ChatData, Title: 'delete 2' },
        { ...ChatData, Title: 'existing' },
        { ...ChatData, Title: 'set: disconnected' },
        { ...ChatData, Title: 'set 1' },
        { ...ChatData, Title: 'set 2' },
      ]);
      const upsertedChat = await db.chat.create({
        ...ChatData,
        Title: 'upsert: not updated',
      });

      await db.user.find(user1.Id).update({
        chats: {
          add: createdChats
            .slice(0, 2)
            .map((chat) => ({ IdOfChat: chat.IdOfChat })),
        },
      });
      await db.user.find(user2.Id).update({
        chats: {
          add: [
            ...createdChats.slice(2, 8),
            createdChats[9],
            { IdOfChat: upsertedChat.IdOfChat },
          ].map((chat) => ({ IdOfChat: chat.IdOfChat })),
        },
      });

      resetQueriesCount();

      await db.user.find(user2.Id).upsert({
        update: {
          chats: {
            add: createdChats
              .slice(0, 2)
              .concat(upsertedChat)
              .map((chat) => ({ IdOfChat: chat.IdOfChat })),
            disconnect: [{ Title: 'disconnect 1' }, { Title: 'disconnect 2' }],
            set: [{ Title: 'set 1' }, { Title: 'set 2' }],
            delete: [{ Title: 'delete 1' }, { Title: 'delete 2' }],
            update: [
              {
                where: { Title: 'add 1' },
                data: { Title: 'add 1 updated' },
              },
              {
                where: { Title: 'set 1' },
                data: { Title: 'set 1 updated' },
              },
              {
                where: { Title: 'disconnect 1' },
                data: { Title: 'disconnect 1 updated' },
              },
              {
                where: { Title: 'set: disconnected' },
                data: { Title: 'set: disconnected updated' },
              },
            ],
            upsert: [
              {
                findBy: { IdOfChat: upsertedChat.IdOfChat },
                update: { Title: 'upsert: updated' },
                create: ChatData,
              },
              {
                findBy: { IdOfChat: 0 },
                update: {},
                create: { ...ChatData, Title: 'upsert: created' },
              },
              {
                findBy: { IdOfChat: createdChats[1].IdOfChat },
                update: { Title: 'add 2 upserted' },
                create: ChatData,
              },
              {
                findBy: { IdOfChat: createdChats[9].IdOfChat },
                update: { Title: 'set 2 upserted' },
                create: ChatData,
              },
              {
                findBy: { IdOfChat: createdChats[3].IdOfChat },
                update: { Title: 'disconnect 2 upserted' },
                create: { ...ChatData, Title: 'disconnect 2 upsert created' },
              },
              {
                findBy: { IdOfChat: createdChats[7].IdOfChat },
                update: { Title: 'set: disconnected upserted' },
                create: {
                  ...ChatData,
                  Title: 'set: disconnected upsert created',
                },
              },
            ],
            create: [
              { ...ChatData, Title: 'created 1' },
              { ...ChatData, Title: 'created 2' },
            ],
          },
        },
        create: UserData,
      });

      expect(getQueriesCount()).toBe(1);

      expect(await db.chat.order('Title').pluck('Title')).toEqual([
        'add 1 updated',
        'add 2 upserted',
        'created 1',
        'created 2',
        'disconnect 1',
        'disconnect 2',
        'disconnect 2 upsert created',
        'existing',
        'set 1 updated',
        'set 2 upserted',
        'set: disconnected',
        'set: disconnected upsert created',
        'upsert: created',
        'upsert: updated',
      ]);
    });
  });
});
