import { Db } from 'pqb';
import {
  useRelationCallback,
  useTestORM,
  useQueryCounter,
} from '../../test-utils/orm.test-utils';
import { UserData, ChatData, TaskData, db } from 'test-utils';

const activeChatData = { ...ChatData, Active: true };

const { resetQueriesCount, getQueriesCount } = useQueryCounter();

describe('hasAndBelongsToMany', () => {
  useTestORM();

  describe('update', () => {
    describe('add', () => {
      it('should connect many related records to one', async () => {
        const userId = await db.user.get('Id').create(UserData);

        const createdChats = await db.chat.createMany([ChatData, ChatData]);

        const count = await db.user.find(userId).update({
          chats: {
            add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
          },
        });
        expect(count).toBe(1);

        const chats = await db.user.queryRelated('chats', {
          Id: userId,
          UserKey: 'key',
        });

        expect(chats).toEqual(createdChats);
      });

      it('should fail to connect when `on` condition does not match', async () => {
        const userId = await db.user.get('Id').create(UserData);

        const createdChats = await db.chat.createMany([
          ChatData,
          activeChatData,
        ]);

        const q = db.user.find(userId).update({
          activeChats: {
            add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
          },
        });

        await expect(q).rejects.toThrow(
          'Expected to find at least 2 record(s) based on `add` conditions, but found 1',
        );
      });

      it('should connect many related records to one using `on`', async () => {
        const userId = await db.user.get('Id').create(UserData);

        const createdChats = await db.chat.createMany([
          activeChatData,
          activeChatData,
        ]);

        const count = await db.user.find(userId).update({
          activeChats: {
            add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
          },
        });
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

        const count = await db.user.whereIn('Id', [userId1, userId2]).update({
          chats: {
            add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
          },
        });
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

        const createdChats = await db.chat.createMany([
          ChatData,
          activeChatData,
        ]);

        const q = db.user.whereIn('Id', [userId1, userId2]).update({
          activeChats: {
            add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
          },
        });

        await expect(q).rejects.toThrow(
          'Expected to find at least 2 record(s) based on `add` conditions, but found 1',
        );
      });

      it('should connect many related records to many using `on`', async () => {
        const [userId1, userId2] = await db.user
          .get('Id')
          .createMany([UserData, UserData]);

        const createdChats = await db.chat.createMany([
          activeChatData,
          activeChatData,
        ]);

        const count = await db.user.whereIn('Id', [userId1, userId2]).update({
          activeChats: {
            add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
          },
        });
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

        const q = db.user.find(userId).update({
          chats: {
            add: { IdOfChat: 123 },
          },
        });

        await expect(q).rejects.toThrow(
          'Expected to find at least 1 record(s) based on `add` conditions, but found 0',
        );
      });

      it('should not throw when adding a record that was already connected', async () => {
        const userId = await db.user.get('Id').create({
          ...UserData,
          chats: {
            create: [ChatData],
          },
        });

        const count = await db.user.find(userId).update({
          chats: {
            add: { Title: ChatData.Title },
          },
        });
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

        const count = await db.user.where({ Id: userId }).update({
          chats: {
            disconnect: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
          },
        });
        expect(count).toBe(1);

        const chats = await db.user.queryRelated('chats', {
          Id: userId,
          UserKey: 'key',
        });
        expect(chats.length).toBe(1);
        expect(chats[0].Title).toEqual('chat 3');
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

        const count = await db.user.where({ Id: userId }).update({
          activeChats: {
            disconnect: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
          },
        });
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

        const count = await db.user.find(Id).update({
          chats: {
            disconnect: [],
          },
        });
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

        const count = await db.user.where({ Id }).update({
          chats: {
            set: [{ Title: 'chat 2' }, { Title: 'chat 3' }],
          },
        });
        expect(count).toBe(1);

        const chats = await db.user
          .queryRelated('chats', { Id, UserKey: 'key' })
          .select('Title')
          .order('Title');

        expect(chats).toEqual([{ Title: 'chat 2' }, { Title: 'chat 3' }]);
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
            ...ChatData,
            Title: 'chat 3',
          },
          {
            ...activeChatData,
            Title: 'chat 4',
          },
        ]);

        const count = await db.user.where({ Id }).update({
          activeChats: {
            set: [
              { Title: 'chat 2' },
              { Title: 'chat 3' },
              { Title: 'chat 4' },
            ],
          },
        });
        expect(count).toBe(1);

        const chats = await db.user
          .queryRelated('activeChats', { Id, UserKey: 'key' })
          .order('Title')
          .pluck('Title');

        expect(chats).toEqual(['chat 2', 'chat 4']);
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

        const count = await db.user.where({ Id, UserKey: 'key' }).update({
          chats: {
            set: [],
          },
        });
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

        const count = await db.user.where({ Id, UserKey: 'key' }).update({
          activeChats: {
            set: [],
          },
        });
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

        const count = await db.user.find(Id).update({
          chats: {
            delete: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
          },
        });
        expect(count).toBe(1);

        expect(await db.chat.count()).toBe(2);

        const chats = await db.user
          .queryRelated('chats', { Id, UserKey: 'key' })
          .select('Title');
        expect(chats).toEqual([{ Title: 'chat 3' }]);
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

        const count = await db.user.find(Id).update({
          activeChats: {
            delete: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
          },
        });
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

        const count = await db.user.find(Id).update({
          chats: {
            delete: [],
          },
        });
        expect(count).toBe(1);

        const chats = await db.user
          .queryRelated('chats', { Id, UserKey: 'key' })
          .pluck('Title');
        expect(chats).toEqual(['chat 1']);
      });

      describe('relation callbacks', () => {
        const { beforeDelete, afterDelete, resetMocks } = useRelationCallback(
          db.user.relations.chats,
          ['IdOfChat'],
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

          const ids = await db.chat.select('IdOfChat');

          const count = await db.user.find(id).update(data);
          expect(count).toBe(1);

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledWith(ids, expect.any(Db));
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

          const ids = await db.chat.select('IdOfChat');

          const count = await db.user
            .where({ Id: { in: UserIds } })
            .update(data);
          expect(count).toBe(2);

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledWith(
            [ids[0], ids[2]],
            expect.any(Db),
          );
        });
      });
    });

    describe('nested update', () => {
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
        expect(count).toBe(1);

        const titles = await db.chat.order('IdOfChat').pluck('Title');
        expect(titles).toEqual(['chat 1', 'updated', 'updated', 'chat 4']);
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
              create: [{ ...ChatData, Title: 'chat 1' }],
            },
          });

          const count = await db.user.find(id).update(data);
          expect(count).toBe(1);

          const IdOfChat = await db.chat.get('IdOfChat');

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledWith(
            [{ IdOfChat }],
            expect.any(Db),
          );
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

          const count = await db.user
            .where({ Id: { in: userIds } })
            .update(data);
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

    describe('nested upsert', () => {
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

    describe('nested create', () => {
      it('should create many records and connect them', async () => {
        const userIds = await db.user
          .pluck('Id')
          .createMany([UserData, UserData]);

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

      it('should create many records and connect them, using `on`', async () => {
        const users = await db.user.createMany([UserData, UserData]);

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

        const count = await db.user.find(Id).update({
          chats: {
            create: [],
          },
        });
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

          const ids = await db.chat.select('IdOfChat', 'ChatKey');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
        });

        it('should invoke callbacks in a batch update', async () => {
          const userIds = await db.user
            .pluck('Id')
            .createMany([UserData, UserData]);

          resetMocks();

          const count = await db.user
            .where({ Id: { in: userIds } })
            .update(data);
          expect(count).toBe(2);

          const ids = await db.chat.select('IdOfChat', 'ChatKey');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(ids).toHaveLength(2);
          expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
        });
      });
    });
  });
});
