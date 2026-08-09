import { Db } from 'pqb';
import {
  useRelationCallback,
  useTestORM,
  useQueryCounter,
} from '../../test-utils/orm.test-utils';
import { ChatData, MessageData, UserData, PostData, db } from 'test-utils';

const activeMessageData = { ...MessageData, Active: true };

const { resetQueriesCount, getQueriesCount } = useQueryCounter();

describe('hasMany', () => {
  useTestORM();

  describe('update', () => {
    describe('add', () => {
      it('should connect many related records to one', async () => {
        const chatId = await db.chat.get('IdOfChat').create(ChatData);

        const [user1, user2] = await db.user.createMany([UserData, UserData]);

        const createdMessages = await db.message.createMany([
          { ...MessageData, ChatId: chatId, AuthorId: user1.Id },
          { ...MessageData, ChatId: chatId, AuthorId: user1.Id },
        ]);

        const count = await db.user.find(user2.Id).update({
          messages: {
            add: createdMessages.map((message) => ({ Id: message.Id })),
          },
        });
        expect(count).toBe(1);

        const user1Messages = await db.user
          .queryRelated('messages', user1)
          .pluck('Id');
        const user2Messages = await db.user
          .queryRelated('messages', user2)
          .pluck('Id');

        expect(user1Messages).toEqual([]);
        expect(user2Messages).toEqual(createdMessages.map((x) => x.Id));
      });

      it('should fail to connect many related records to one when `on` condition does not match', async () => {
        const chatId = await db.chat.get('IdOfChat').create(ChatData);

        const [user1, user2] = await db.user.createMany([UserData, UserData]);

        const createdMessages = await db.message.createMany([
          { ...MessageData, ChatId: chatId, AuthorId: user1.Id },
          { ...MessageData, ChatId: chatId, AuthorId: user1.Id },
        ]);

        const q = db.user.find(user2.Id).update({
          activeMessages: {
            add: createdMessages.map((message) => ({ Id: message.Id })),
          },
        });

        await expect(q).rejects.toThrow(
          'Expected to find at least 2 record(s) based on `add` conditions, but found 0',
        );
      });

      it('should not support connecting many related records to many', async () => {
        db.user.where({ Name: 'name' }).update({
          messages: {
            // @ts-expect-error not supported in a batch update
            add: { Id: 1 },
          },
        });
      });

      it('should throw when no related records were found by a condition', async () => {
        const user = await db.user.create(UserData);

        const result = await db.user
          .find(user.Id)
          .update({
            messages: {
              add: { Id: 123 },
            },
          })
          .catch((err) => ({ err }));

        expect(result).toEqual({
          err: expect.objectContaining({
            message:
              'Expected to find at least 1 record(s) based on `add` conditions, but found 0',
          }),
        });
      });
    });

    describe('disconnect', () => {
      it('should nullify foreignKey', async () => {
        const ChatId = await db.chat
          .get('IdOfChat')
          .create({ ...ChatData, Title: 'chat 1' });

        const UserId = await db.user.get('Id').create({
          ...UserData,
          messages: {
            create: [
              { ...MessageData, ChatId: ChatId, Text: 'message 1' },
              { ...MessageData, ChatId: ChatId, Text: 'message 2' },
              { ...MessageData, ChatId: ChatId, Text: 'message 3' },
            ],
          },
        });

        const count = await db.user.find(UserId).update({
          messages: {
            disconnect: [{ Text: 'message 1' }, { Text: 'message 2' }],
          },
        });
        expect(count).toBe(1);

        const messages = await db.message.order('Text');
        expect(messages[0].AuthorId).toBe(null);
        expect(messages[1].AuthorId).toBe(null);
        expect(messages[2].AuthorId).toBe(UserId);
      });

      it('should nullify foreignKey for matching records using `on`', async () => {
        const ChatId = await db.chat
          .get('IdOfChat')
          .create({ ...ChatData, Title: 'chat 1' });

        const UserId = await db.user.get('Id').create({
          ...UserData,
          messages: {
            create: [
              { ...MessageData, ChatId: ChatId, Text: 'message 1' },
              { ...activeMessageData, ChatId: ChatId, Text: 'message 2' },
              { ...MessageData, ChatId: ChatId, Text: 'message 3' },
            ],
          },
        });

        const count = await db.user.find(UserId).update({
          activeMessages: {
            disconnect: [{ Text: 'message 1' }, { Text: 'message 2' }],
          },
        });
        expect(count).toBe(1);

        const messages = await db.message.order('Text');
        expect(messages[0].AuthorId).toBe(UserId);
        expect(messages[1].AuthorId).toBe(null);
        expect(messages[2].AuthorId).toBe(UserId);
      });

      it('should nullify foreignKey in batch update', async () => {
        const ChatId = await db.chat
          .get('IdOfChat')
          .create({ ...ChatData, Title: 'chat 1' });

        const userIds = await db.user.pluck('Id').createMany([
          {
            ...UserData,
            messages: {
              create: [{ ...MessageData, ChatId: ChatId, Text: 'message 1' }],
            },
          },
          {
            ...UserData,
            messages: {
              create: [
                { ...MessageData, ChatId: ChatId, Text: 'message 2' },
                { ...MessageData, ChatId: ChatId, Text: 'message 3' },
              ],
            },
          },
        ]);

        const count = await db.user.where({ Id: { in: userIds } }).update({
          messages: {
            disconnect: [{ Text: 'message 1' }, { Text: 'message 2' }],
          },
        });
        expect(count).toBe(2);

        const messages = await db.message.order('Text');
        expect(messages[0].AuthorId).toBe(null);
        expect(messages[1].AuthorId).toBe(null);
        expect(messages[2].AuthorId).toBe(userIds[1]);
      });

      it('should nullify foreignKey in batch update for matching records using `on`', async () => {
        const ChatId = await db.chat
          .get('IdOfChat')
          .create({ ...ChatData, Title: 'chat 1' });

        const userIds = await db.user.pluck('Id').createMany([
          {
            ...UserData,
            messages: {
              create: [{ ...MessageData, ChatId: ChatId, Text: 'message 1' }],
            },
          },
          {
            ...UserData,
            messages: {
              create: [
                { ...activeMessageData, ChatId: ChatId, Text: 'message 2' },
                { ...MessageData, ChatId: ChatId, Text: 'message 3' },
              ],
            },
          },
        ]);

        const count = await db.user.where({ Id: { in: userIds } }).update({
          activeMessages: {
            disconnect: [{ Text: 'message 1' }, { Text: 'message 2' }],
          },
        });
        expect(count).toBe(2);

        const messages = await db.message.order('Text');
        expect(messages[0].AuthorId).toBe(userIds[0]);
        expect(messages[1].AuthorId).toBe(null);
        expect(messages[2].AuthorId).toBe(userIds[1]);
      });

      it('should ignore empty disconnect list', async () => {
        const id = await db.user.get('Id').create(UserData);

        const count = await db.user.find(id).update({
          messages: {
            disconnect: [],
          },
        });
        expect(count).toBe(1);
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
          db.user.relations.messages,
          ['Id'],
        );

        it('should invoke callbacks', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(ChatData);
          const UserId = await db.user.get('Id').create({
            ...UserData,
            messages: {
              create: [
                {
                  ...MessageData,
                  ChatId,
                  Text: 'message 1',
                },
                {
                  ...MessageData,
                  ChatId,
                  Text: 'message 2',
                },
              ],
            },
          });

          const count = await db.user.find(UserId).update({
            messages: {
              disconnect: [{ Text: 'message 1' }, { Text: 'message 2' }],
            },
          });
          expect(count).toBe(1);

          const ids = await db.message.select('Id');

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledWith(ids, expect.any(Db));
        });

        it('should invoke callbacks in a batch update', async () => {
          resetMocks();

          const ChatId = await db.chat.get('IdOfChat').create(ChatData);
          const UserIds = await db.user.pluck('Id').createMany([
            {
              ...UserData,
              messages: {
                create: [
                  {
                    ...MessageData,
                    ChatId,
                    Text: 'message 1',
                  },
                  {
                    ...MessageData,
                    ChatId,
                    Text: 'message 1',
                  },
                ],
              },
            },
            {
              ...UserData,
              messages: {
                create: [
                  {
                    ...MessageData,
                    ChatId,
                    Text: 'message 3',
                  },
                  {
                    ...MessageData,
                    ChatId,
                    Text: 'message 4',
                  },
                ],
              },
            },
          ]);

          const count = await db.user.where({ Id: { in: UserIds } }).update({
            messages: {
              disconnect: [{ Text: 'message 1' }, { Text: 'message 3' }],
            },
          });
          expect(count).toBe(2);

          const ids = await db.message
            .where({ Text: { in: ['message 1', 'message 3'] } })
            .select('Id');

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledWith(ids, expect.any(Db));
        });
      });
    });

    describe('set', () => {
      it('should nullify foreignKey of previous related record and set foreignKey to new related record', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);
        const id = await db.user.get('Id').create({
          ...UserData,
          messages: {
            create: [
              { ...MessageData, ChatId, Text: 'message 1' },
              { ...MessageData, ChatId, Text: 'message 2' },
            ],
          },
        });

        await db.message.create({ ...MessageData, ChatId, Text: 'message 3' });

        const count = await db.user.find(id).update({
          messages: {
            set: { Text: { in: ['message 2', 'message 3'] } },
          },
        });
        expect(count).toBe(1);

        const [message1, message2, message3] = await db.message.order({
          Text: 'ASC',
        });

        expect(message1.AuthorId).toBe(null);
        expect(message2.AuthorId).toBe(id);
        expect(message3.AuthorId).toBe(id);
      });

      it('should nullify foreignKey of previous related record and set foreignKey to new related record using `on`', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);
        const id = await db.user.get('Id').create({
          ...UserData,
          messages: {
            create: [
              { ...MessageData, ChatId, Text: 'message 1' },
              { ...activeMessageData, ChatId, Text: 'message 2' },
              { ...activeMessageData, ChatId, Text: 'message 3' },
            ],
          },
        });

        await db.message.create({
          ...activeMessageData,
          ChatId,
          Text: 'message 4',
        });

        const count = await db.user.find(id).update({
          activeMessages: {
            set: { Text: { in: ['message 3', 'message 4'] } },
          },
        });
        expect(count).toBe(1);

        const messages = await db.message.order({
          Text: 'ASC',
        });

        expect(messages[0].AuthorId).toBe(id);
        expect(messages[1].AuthorId).toBe(null);
        expect(messages[2].AuthorId).toBe(id);
        expect(messages[3].AuthorId).toBe(id);
      });

      it('should nullify all related records foreign keys when giving empty array', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);
        const id = await db.user.get('Id').create({
          ...UserData,
          messages: {
            create: [
              { ...MessageData, ChatId, Text: 'message 1' },
              { ...MessageData, ChatId, Text: 'message 2' },
            ],
          },
        });

        const count = await db.user.find(id).update({
          messages: {
            set: [],
          },
        });
        expect(count).toBe(1);

        const messages = await db.message;

        expect(messages.map((m) => m.AuthorId)).toEqual([null, null]);
      });

      it('should nullify matching related records foreign keys when giving empty array using `on`', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);
        const id = await db.user.get('Id').create({
          ...UserData,
          messages: {
            create: [
              { ...MessageData, ChatId, Text: 'message 1' },
              { ...activeMessageData, ChatId, Text: 'message 2' },
            ],
          },
        });

        const count = await db.user.find(id).update({
          activeMessages: {
            set: [],
          },
        });
        expect(count).toBe(1);

        const messages = await db.message;

        expect(messages.map((m) => m.AuthorId)).toEqual([id, null]);
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

      it('should not nullify the previous record when setting to the exact same record', async () => {
        const user = await db.user.create({
          ...UserData,
          posts: {
            create: [PostData],
          },
        });

        // It would fail if tried to nullify post's UserId because it's non-nullable.
        const count = await db.user.find(user.Id).update({
          posts: {
            set: [{ Title: user.UserKey }],
          },
        });
        expect(count).toBe(1);

        const posts = await db.post;
        expect(posts).toMatchObject([{ UserId: user.Id, Title: user.UserKey }]);
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate } = useRelationCallback(
          db.user.relations.messages,
          ['Id'],
        );

        it('should invoke callbacks', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(ChatData);
          const id = await db.user.get('Id').create({
            ...UserData,
            messages: {
              create: [
                { ...MessageData, ChatId, Text: 'message 1' },
                { ...MessageData, ChatId, Text: 'message 2' },
              ],
            },
          });

          await db.message.create({
            ...MessageData,
            ChatId,
            Text: 'message 3',
          });

          const count = await db.user.find(id).update({
            messages: {
              set: { Text: { in: ['message 2', 'message 3'] } },
            },
          });
          expect(count).toBe(1);

          const ids = await db.message.pluck('Id');

          expect(beforeUpdate).toHaveBeenCalledTimes(2);
          expect(afterUpdate).toHaveBeenCalledTimes(2);
          expect(afterUpdate).toHaveBeenCalledWith(
            [{ Id: ids[0] }],
            expect.any(Db),
          );
          expect(afterUpdate).toHaveBeenCalledWith(
            [{ Id: ids[1] }, { Id: ids[2] }],
            expect.any(Db),
          );
        });
      });
    });

    describe('delete', () => {
      it('should delete related records', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const Id = await db.user.get('Id').create({
          ...UserData,
          messages: {
            create: [
              { ...MessageData, ChatId, Text: 'message 1' },
              { ...MessageData, ChatId, Text: 'message 2' },
              { ...MessageData, ChatId, Text: 'message 3' },
            ],
          },
        });

        const count = await db.user.find(Id).update({
          messages: {
            delete: {
              Text: { in: ['message 1', 'message 2'] },
            },
          },
        });
        expect(count).toBe(1);

        expect(await db.message.count()).toBe(1);

        const messages = await db.user
          .queryRelated('messages', { Id, UserKey: 'key' })
          .select('Text');
        expect(messages).toEqual([{ Text: 'message 3' }]);
      });

      it('should delete matching related records using `on`', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const Id = await db.user.get('Id').create({
          ...UserData,
          messages: {
            create: [
              { ...MessageData, ChatId, Text: 'message 1' },
              { ...activeMessageData, ChatId, Text: 'message 2' },
              { ...MessageData, ChatId, Text: 'message 3' },
            ],
          },
        });

        const count = await db.user.find(Id).update({
          activeMessages: {
            delete: {
              Text: { in: ['message 1', 'message 2'] },
            },
          },
        });
        expect(count).toBe(1);

        expect(await db.message.count()).toBe(2);

        const messages = await db.user
          .queryRelated('messages', { Id, UserKey: 'key' })
          .select('Text');
        expect(messages).toEqual([
          { Text: 'message 1' },
          { Text: 'message 3' },
        ]);
      });

      it('should delete related records in batch update', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const userIds = await db.user.pluck('Id').createMany([
          {
            ...UserData,
            messages: {
              create: [{ ...MessageData, ChatId, Text: 'message 1' }],
            },
          },
          {
            ...UserData,
            messages: {
              create: [
                { ...MessageData, ChatId, Text: 'message 2' },
                { ...MessageData, ChatId, Text: 'message 3' },
              ],
            },
          },
        ]);

        const count = await db.user.where({ Id: { in: userIds } }).update({
          messages: {
            delete: [{ Text: 'message 1' }, { Text: 'message 2' }],
          },
        });
        expect(count).toBe(2);

        expect(await db.message.count()).toBe(1);

        const messages = await db.user
          .queryRelated('messages', { Id: userIds[1], UserKey: 'key' })
          .select('Text');
        expect(messages).toEqual([{ Text: 'message 3' }]);
      });

      it('should delete matching related records in batch update using `on`', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const userIds = await db.user.pluck('Id').createMany([
          {
            ...UserData,
            messages: {
              create: [
                { ...MessageData, ChatId, Text: 'message 1' },
                { ...activeMessageData, ChatId, Text: 'message 2' },
              ],
            },
          },
          {
            ...UserData,
            messages: {
              create: [
                { ...activeMessageData, ChatId, Text: 'message 3' },
                { ...MessageData, ChatId, Text: 'message 4' },
              ],
            },
          },
        ]);

        const count = await db.user.where({ Id: { in: userIds } }).update({
          activeMessages: {
            delete: [
              { Text: 'message 1' },
              { Text: 'message 2' },
              { Text: 'message 3' },
            ],
          },
        });
        expect(count).toBe(2);

        expect(await db.message.count()).toBe(2);

        const messages = await db.message.pluck('Text');
        expect(messages).toEqual(['message 1', 'message 4']);
      });

      it('should ignore empty delete list', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const Id = await db.user.get('Id').create({
          ...UserData,
          messages: {
            create: [{ ...MessageData, ChatId, Text: 'message 1' }],
          },
        });

        const count = await db.user.find(Id).update({
          messages: {
            delete: [],
          },
        });
        expect(count).toBe(1);

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
          const ChatId = await db.chat.get('IdOfChat').create(ChatData);
          const Id = await db.user.get('Id').create({
            ...UserData,
            messages: {
              create: [
                { ...MessageData, ChatId, Text: 'message 1' },
                { ...MessageData, ChatId, Text: 'message 2' },
                { ...MessageData, ChatId, Text: 'message 3' },
              ],
            },
          });

          const ids = await db.message.pluck('Id');

          const count = await db.user.find(Id).update({
            messages: {
              delete: [{ Text: 'message 1' }, { Text: 'message 2' }],
            },
          });
          expect(count).toBe(1);

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledWith(
            [{ Id: ids[0] }, { Id: ids[1] }],
            expect.any(Db),
          );
        });

        it('should invoke callbacks in a batch delete', async () => {
          resetMocks();

          const ChatId = await db.chat.get('IdOfChat').create(ChatData);
          const UserIds = await db.user.pluck('Id').createMany([
            {
              ...UserData,
              messages: {
                create: [
                  { ...MessageData, ChatId, Text: 'message 1' },
                  { ...MessageData, ChatId, Text: 'message 2' },
                  { ...MessageData, ChatId, Text: 'message 3' },
                ],
              },
            },
            {
              ...UserData,
              messages: {
                create: [
                  { ...MessageData, ChatId, Text: 'message 4' },
                  { ...MessageData, ChatId, Text: 'message 5' },
                  { ...MessageData, ChatId, Text: 'message 6' },
                ],
              },
            },
          ]);

          const ids = await db.message.pluck('Id');

          const count = await db.user.where({ Id: { in: UserIds } }).update({
            messages: {
              delete: [
                { Text: 'message 1' },
                { Text: 'message 2' },
                { Text: 'message 4' },
                { Text: 'message 5' },
              ],
            },
          });
          expect(count).toBe(2);

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledWith(
            [{ Id: ids[0] }, { Id: ids[1] }, { Id: ids[3] }, { Id: ids[4] }],
            expect.any(Db),
          );
        });
      });
    });

    describe('nested update', () => {
      it('should update related records', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const Id = await db.user.get('Id').create({
          ...UserData,
          messages: {
            create: [
              { ...MessageData, ChatId, Text: 'message 1' },
              { ...MessageData, ChatId, Text: 'message 2' },
              { ...MessageData, ChatId, Text: 'message 3' },
            ],
          },
        });

        const count = await db.user.find(Id).update({
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
        expect(count).toBe(1);

        const messages = await db.user
          .queryRelated('messages', { Id, UserKey: 'key' })
          .order('Id')
          .pluck('Text');
        expect(messages).toEqual(['updated', 'message 2', 'updated']);
      });

      it('should update matching related records using `on`', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const Id = await db.user.get('Id').create({
          ...UserData,
          messages: {
            create: [
              { ...MessageData, ChatId, Text: 'message 1' },
              { ...MessageData, ChatId, Text: 'message 2' },
              { ...activeMessageData, ChatId, Text: 'message 3' },
            ],
          },
        });

        const count = await db.user.find(Id).update({
          activeMessages: {
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
        expect(count).toBe(1);

        const messages = await db.message.pluck('Text');
        expect(messages).toEqual(['message 1', 'message 2', 'updated']);
      });

      it('should update related records in batch update', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const userIds = await db.user.pluck('Id').createMany([
          {
            ...UserData,
            messages: {
              create: [{ ...MessageData, ChatId, Text: 'message 1' }],
            },
          },
          {
            ...UserData,
            messages: {
              create: [
                { ...MessageData, ChatId, Text: 'message 2' },
                { ...MessageData, ChatId, Text: 'message 3' },
              ],
            },
          },
        ]);

        const count = await db.user.where({ Id: { in: userIds } }).update({
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
        expect(count).toBe(2);

        const messages = await db.message.order('Id').pluck('Text');
        expect(messages).toEqual(['updated', 'message 2', 'updated']);
      });

      it('should update matching related records in batch update using `on`', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const userIds = await db.user.pluck('Id').createMany([
          {
            ...UserData,
            messages: {
              create: [{ ...MessageData, ChatId, Text: 'message 1' }],
            },
          },
          {
            ...UserData,
            messages: {
              create: [
                { ...MessageData, ChatId, Text: 'message 2' },
                { ...activeMessageData, ChatId, Text: 'message 3' },
              ],
            },
          },
        ]);

        const count = await db.user.where({ Id: { in: userIds } }).update({
          activeMessages: {
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
        expect(count).toBe(2);

        const messages = await db.message.pluck('Text');
        expect(messages).toEqual(['message 1', 'message 2', 'updated']);
      });

      it('should ignore empty update where list', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const Id = await db.user.get('Id').create({
          ...UserData,
          messages: {
            create: [{ ...MessageData, ChatId, Text: 'message 1' }],
          },
        });

        const count = await db.user.find(Id).update({
          messages: {
            update: {
              where: [],
              data: {
                Text: 'updated',
              },
            },
          },
        });
        expect(count).toBe(1);

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
          const ChatId = await db.chat.get('IdOfChat').create(ChatData);
          const Id = await db.user.get('Id').create({
            ...UserData,
            messages: {
              create: [
                { ...MessageData, ChatId, Text: 'message 1' },
                { ...MessageData, ChatId, Text: 'message 2' },
                { ...MessageData, ChatId, Text: 'message 3' },
              ],
            },
          });

          const ids = await db.message.pluck('Id');

          const count = await db.user.find(Id).update({
            messages: {
              update: {
                where: [{ Text: 'message 1' }, { Text: 'message 2' }],
                data: {
                  Text: 'updated',
                },
              },
            },
          });
          expect(count).toBe(1);

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledWith(
            [{ Id: ids[0] }, { Id: ids[1] }],
            expect.any(Db),
          );
        });

        it('should invoke callbacks in a batch update', async () => {
          resetMocks();

          const ChatId = await db.chat.get('IdOfChat').create(ChatData);
          const UserIds = await db.user.pluck('Id').createMany([
            {
              ...UserData,
              messages: {
                create: [
                  { ...MessageData, ChatId, Text: 'message 1' },
                  { ...MessageData, ChatId, Text: 'message 2' },
                  { ...MessageData, ChatId, Text: 'message 3' },
                ],
              },
            },
            {
              ...UserData,
              messages: {
                create: [
                  { ...MessageData, ChatId, Text: 'message 1' },
                  { ...MessageData, ChatId, Text: 'message 2' },
                  { ...MessageData, ChatId, Text: 'message 3' },
                ],
              },
            },
          ]);

          const ids = await db.message.select('Id');

          const count = await db.user.where({ Id: { in: UserIds } }).update({
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
          expect(count).toBe(2);

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledWith(ids, expect.any(Db));
        });
      });
    });

    describe('nested upsert', () => {
      it('should update related records if they exist', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const data = await db.user
          .select('Id', { messageIds: (q) => q.messages.pluck('Id') })
          .create({
            ...UserData,
            messages: {
              create: [{ ...MessageData, ChatId, Text: 'message 1' }],
            },
          });

        resetQueriesCount();

        const count = await db.user.find(data.Id).update({
          messages: {
            upsert: {
              findBy: { Id: data.messageIds[0] },
              update: { Text: 'updated 1' },
              create: { ...MessageData, ChatId, Text: 'created 1' },
            },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        const messages = await db.user
          .queryRelated('messages', { Id: data.Id, UserKey: 'key' })
          .order('Text')
          .pluck('Text');
        expect(messages).toEqual(['updated 1']);
      });

      it('should create related records if they do not exist', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);
        const Id = await db.user.get('Id').create(UserData);

        resetQueriesCount();

        const count = await db.user.find(Id).update({
          messages: {
            upsert: {
              findBy: { Id: 0 },
              update: { Text: 'updated 1' },
              create: { ...MessageData, ChatId, Text: 'created 1' },
            },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        const messages = await db.user
          .queryRelated('messages', { Id, UserKey: 'key' })
          .order('Text')
          .pluck('Text');
        expect(messages).toEqual(['created 1']);
      });

      it('should create related records if they do not exist with data from callbacks', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);
        const Id = await db.user.get('Id').create(UserData);

        resetQueriesCount();

        const count = await db.user.find(Id).update({
          messages: {
            upsert: {
              findBy: { Id: 0 },
              update: { Text: 'updated 1' },
              create: () => ({ ...MessageData, ChatId, Text: 'created 1' }),
            },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        const messages = await db.user
          .queryRelated('messages', { Id, UserKey: 'key' })
          .order('Text')
          .pluck('Text');
        expect(messages).toEqual(['created 1']);
      });

      it('should create related records when `on` condition does not match for the update', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);

        const data = await db.user
          .select('Id', { messageIds: (q) => q.messages.pluck('Id') })
          .create({
            ...UserData,
            messages: {
              create: [
                { ...MessageData, ChatId, Text: 'message 1' },
                { ...MessageData, ChatId, Text: 'message 2' },
              ],
            },
          });

        resetQueriesCount();

        const count = await db.user.find(data.Id).update({
          activeMessages: {
            upsert: {
              findBy: { Id: data.messageIds[0] },
              update: { Text: 'updated 1' },
              create: { ...MessageData, ChatId, Text: 'created 1' },
            },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        const messages = await db.user
          .queryRelated('activeMessages', { Id: data.Id, UserKey: 'key' })
          .order('Text');
        expect(messages).toMatchObject([{ Text: 'created 1', Active: true }]);
      });

      it('should throw in batch update', async () => {
        expect(() =>
          db.user.where({ Id: { in: [1, 2, 3] } }).update({
            messages: {
              // @ts-expect-error not allowed in batch update
              upsert: {
                findBy: { Text: 0 },
                update: { Text: 'updated' },
                create: { ...MessageData, ChatId: 1, Text: 'created' },
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
        } = useRelationCallback(db.user.relations.messages, ['Id']);

        it('should invoke callbacks when updating', async () => {
          const ChatId = await db.chat.get('IdOfChat').create(ChatData);
          const Id = await db.user.get('Id').create({
            ...UserData,
            messages: {
              create: [{ ...MessageData, ChatId, Text: 'message 1' }],
            },
          });
          const ids = await db.message.select('Id');

          resetQueriesCount();

          const count = await db.user.find(Id).update({
            messages: {
              upsert: {
                findBy: { Id: ids[0].Id },
                update: { Text: 'updated 1' },
                create: { ...MessageData, ChatId, Text: 'created 1' },
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

          const ChatId = await db.chat.get('IdOfChat').create(ChatData);
          const Id = await db.user.get('Id').create(UserData);

          resetQueriesCount();

          const count = await db.user.find(Id).update({
            messages: {
              upsert: {
                findBy: { Id: 0 },
                update: { Text: 'updated 1' },
                create: { ...MessageData, ChatId, Text: 'created 1' },
              },
            },
          });

          expect(getQueriesCount()).toBe(1);

          expect(count).toBe(1);

          const ids = await db.message.select('Id');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
        });
      });
    });

    describe('nested create', () => {
      it('should create new related records', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);
        const user = await db.user.create({ ...UserData, Age: 1 });

        const updated = await db.user
          .select('Age')
          .find(user.Id)
          .increment('Age')
          .update({
            messages: {
              create: [
                { ...MessageData, ChatId, Text: 'created 1' },
                { ...MessageData, ChatId, Text: 'created 2' },
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

      it('should create new related records using `on`', async () => {
        const ChatId = await db.chat.get('IdOfChat').create(ChatData);
        const user = await db.user.create({ ...UserData, Age: 1 });

        const updated = await db.user
          .select('Age')
          .find(user.Id)
          .increment('Age')
          .update({
            activeMessages: {
              create: [
                { ...MessageData, ChatId, Text: 'created 1' },
                { ...MessageData, ChatId, Text: 'created 2' },
              ],
            },
          });

        expect(updated.Age).toBe(2);

        const texts = await db.user
          .queryRelated('messages', user)
          .order('Text');

        expect(texts).toMatchObject([
          { Text: 'created 1', Active: true },
          { Text: 'created 2', Active: true },
        ]);
      });

      it('should throw in batch update', async () => {
        expect(() =>
          db.user.where({ Id: { in: [1, 2, 3] } }).update({
            messages: {
              // @ts-expect-error not allows in batch update
              create: [{ ...MessageData, ChatId: 1, Text: 'created 1' }],
            },
          }),
        ).toThrow('`create` option is not allowed in a batch update');
      });

      it('should ignore empty create list', async () => {
        const Id = await db.user.get('Id').create(UserData);

        const count = await db.user.find(Id).update({
          messages: {
            create: [],
          },
        });
        expect(count).toBe(1);

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
          const ChatId = await db.chat.get('IdOfChat').create(ChatData);
          const Id = await db.user.get('Id').create({ ...UserData, Age: 1 });

          const count = await db.user.find(Id).update({
            messages: {
              create: [
                { ...MessageData, ChatId, Text: 'created 1' },
                { ...MessageData, ChatId, Text: 'created 2' },
              ],
            },
          });
          expect(count).toBe(1);

          const ids = await db.message.select('Id');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledWith(ids, expect.any(Db));
        });
      });
    });
  });
});
