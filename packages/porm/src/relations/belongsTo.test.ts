import { db } from '../test-utils/test-db';
import {
  assertType,
  chatData,
  expectSql,
  messageData,
  profileData,
  userData,
  useTestDatabase,
} from '../test-utils/test-utils';
import { RelationQuery } from 'pqb';
import { User } from '../test-utils/test-models';

describe('belongsTo', () => {
  useTestDatabase();

  describe('querying', () => {
    it('should have method to query related data', async () => {
      const userQuery = db.user.take();
      type UserQuery = typeof userQuery;

      assertType<
        typeof db.profile.user,
        RelationQuery<'user', { userId: number | null }, never, UserQuery, true>
      >();

      const userId = await db.user.get('id').create(userData);
      const profileId = await db.profile
        .get('id')
        .create({ ...profileData, userId });

      const profile = await db.profile.find(profileId);
      const query = db.profile.user(profile);

      expectSql(
        query.toSql(),
        `
        SELECT * FROM "user"
        WHERE "user"."id" = $1
        LIMIT $2
      `,
        [userId, 1],
      );

      const user = await query;

      expect(user).toMatchObject(userData);
    });

    it('should have disabled create method', () => {
      // @ts-expect-error belongsTo should not have chained create
      db.profile.user.create(userData);
    });

    it('should have proper joinQuery', () => {
      expectSql(
        db.profile.relations.user
          .joinQuery(db.profile.as('p'), db.user.as('u'))
          .toSql(),
        `
          SELECT * FROM "user" AS "u"
          WHERE "u"."id" = "p"."userId"
        `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.profile.whereExists('user').toSql(),
        `
          SELECT * FROM "profile"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE "user"."id" = "profile"."userId"
            LIMIT 1
          )
        `,
      );

      expectSql(
        db.profile
          .as('p')
          .whereExists('user', (q) => q.where({ name: 'name' }))
          .toSql(),
        `
        SELECT * FROM "profile" AS "p"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE "user"."id" = "p"."userId"
            AND "user"."name" = $1
          LIMIT 1
        )
      `,
        ['name'],
      );
    });

    it('should support nested whereExists', () => {
      expectSql(
        db.message
          .as('m')
          .whereExists('user', (q) =>
            q.whereExists('profile', (q) => q.where({ bio: 'bio' })),
          )
          .toSql(),
        `
          SELECT * FROM "message" AS "m"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE "user"."id" = "m"."authorId"
              AND EXISTS (
                SELECT 1 FROM "profile"
                WHERE "profile"."userId" = "user"."id"
                  AND "profile"."bio" = $1
                LIMIT 1
              )
            LIMIT 1
          )
        `,
        ['bio'],
      );
    });

    it('should be supported in join', () => {
      const query = db.profile
        .as('p')
        .join('user', (q) => q.where({ name: 'name' }))
        .select('bio', 'user.name');

      assertType<
        Awaited<typeof query>,
        { bio: string | null; name: string }[]
      >();

      expectSql(
        query.toSql(),
        `
        SELECT "p"."bio", "user"."name"
        FROM "profile" AS "p"
        JOIN "user" ON "user"."id" = "p"."userId" AND "user"."name" = $1
      `,
        ['name'],
      );
    });

    describe('select', () => {
      it('should be selectable', async () => {
        const query = db.profile.as('p').select('id', {
          user: (q) => q.user.select('id', 'name').where({ name: 'name' }),
        });

        assertType<
          Awaited<typeof query>,
          { id: number; user: { id: number; name: string } }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "p"."id",
              (
                SELECT row_to_json("t".*)
                FROM (
                  SELECT "user"."id", "user"."name" FROM "user"
                  WHERE "user"."id" = "p"."userId"
                    AND "user"."name" = $1
                  LIMIT $2
                ) AS "t"
              ) AS "user"
            FROM "profile" AS "p"
          `,
          ['name', 1],
        );
      });

      it('should be selectable by relation name', async () => {
        const query = db.profile.select('id', 'user');

        assertType<Awaited<typeof query>, { id: number; user: User }[]>();

        expectSql(
          query.toSql(),
          `
            SELECT
              "profile"."id",
              (
                SELECT row_to_json("t".*)
                FROM (
                  SELECT * FROM "user"
                  WHERE "user"."id" = "profile"."userId"
                  LIMIT $1
                ) AS "t"
              ) AS "user"
            FROM "profile"
          `,
          [1],
        );
      });

      it('should handle exists sub query', async () => {
        const query = db.profile.as('p').select('id', {
          hasUser: (q) => q.user.exists(),
        });

        assertType<Awaited<typeof query>, { id: number; hasUser: boolean }[]>();

        expectSql(
          query.toSql(),
          `
            SELECT
              "p"."id",
              COALESCE((
                SELECT true
                FROM "user"
                WHERE "user"."id" = "p"."userId"
              ), false) AS "hasUser"
            FROM "profile" AS "p"
          `,
        );
      });
    });
  });

  describe('create', () => {
    const checkCreatedResults = async ({
      messageId,
      chatId,
      authorId,
      text,
      title,
      name,
    }: {
      messageId: number;
      chatId: number;
      authorId: number | null;
      text: string;
      title: string;
      name: string;
    }) => {
      const message = await db.message.find(messageId);
      expect(message).toEqual({
        ...message,
        ...messageData,
        chatId,
        authorId,
        text,
      });

      const chat = await db.chat.find(chatId);
      expect(chat).toEqual({
        ...chat,
        ...chatData,
        title,
      });

      if (!authorId) return;
      const user = await db.user.find(authorId);
      expect(user).toEqual({
        ...user,
        ...userData,
        active: null,
        age: null,
        data: null,
        picture: null,
        name,
      });
    };

    describe('nested create', () => {
      it('should support create', async () => {
        const {
          id: messageId,
          chatId,
          authorId,
        } = await db.message.select('id', 'chatId', 'authorId').create({
          ...messageData,
          text: 'message',
          chat: {
            create: {
              ...chatData,
              title: 'chat',
            },
          },
          user: {
            create: {
              ...userData,
              name: 'user',
            },
          },
        });

        await checkCreatedResults({
          messageId,
          chatId,
          authorId,
          text: 'message',
          title: 'chat',
          name: 'user',
        });
      });

      it('should support create in batch create', async () => {
        const query = db.message.select('id', 'chatId', 'authorId').createMany([
          {
            ...messageData,
            text: 'message 1',
            chat: {
              create: {
                ...chatData,
                title: 'chat 1',
              },
            },
            user: {
              create: {
                ...userData,
                name: 'user 1',
              },
            },
          },
          {
            ...messageData,
            text: 'message 2',
            chat: {
              create: {
                ...chatData,
                title: 'chat 2',
              },
            },
            user: {
              create: {
                ...userData,
                name: 'user 2',
              },
            },
          },
        ]);

        const [first, second] = await query;

        await checkCreatedResults({
          messageId: first.id,
          chatId: first.chatId,
          authorId: first.authorId,
          text: 'message 1',
          title: 'chat 1',
          name: 'user 1',
        });

        await checkCreatedResults({
          messageId: second.id,
          chatId: second.chatId,
          authorId: second.authorId,
          text: 'message 2',
          title: 'chat 2',
          name: 'user 2',
        });
      });
    });

    describe('connect', () => {
      it('should support connect', async () => {
        await db.chat.create({ ...chatData, title: 'chat' });
        await db.user.create({ ...userData, name: 'user' });

        const query = db.message.select('id', 'chatId', 'authorId').create({
          ...messageData,
          text: 'message',
          chat: {
            connect: { title: 'chat' },
          },
          user: {
            connect: { name: 'user' },
          },
        });

        const { id: messageId, chatId, authorId } = await query;

        await checkCreatedResults({
          messageId,
          chatId,
          authorId,
          text: 'message',
          title: 'chat',
          name: 'user',
        });
      });

      it('should support connect in batch create', async () => {
        await db.chat.createMany([
          { ...chatData, title: 'chat 1' },
          { ...chatData, title: 'chat 2' },
        ]);
        await db.user.createMany([
          { ...userData, name: 'user 1' },
          { ...userData, name: 'user 2' },
        ]);

        const query = db.message.select('id', 'chatId', 'authorId').createMany([
          {
            ...messageData,
            text: 'message 1',
            chat: {
              connect: { title: 'chat 1' },
            },
            user: {
              connect: { name: 'user 1' },
            },
          },
          {
            ...messageData,
            text: 'message 2',
            chat: {
              connect: { title: 'chat 2' },
            },
            user: {
              connect: { name: 'user 2' },
            },
          },
        ]);

        const [first, second] = await query;

        await checkCreatedResults({
          messageId: first.id,
          chatId: first.chatId,
          authorId: first.authorId,
          text: 'message 1',
          title: 'chat 1',
          name: 'user 1',
        });

        await checkCreatedResults({
          messageId: second.id,
          chatId: second.chatId,
          authorId: second.authorId,
          text: 'message 2',
          title: 'chat 2',
          name: 'user 2',
        });
      });
    });

    describe('connectOrCreate', () => {
      it('should support connect or create', async () => {
        const chat = await db.chat.select('id').create({
          ...chatData,
          title: 'chat',
        });

        const query = await db.message
          .select('id', 'chatId', 'authorId')
          .create({
            ...messageData,
            text: 'message',
            chat: {
              connectOrCreate: {
                where: { title: 'chat' },
                create: { ...chatData, title: 'chat' },
              },
            },
            user: {
              connectOrCreate: {
                where: { name: 'user' },
                create: { ...userData, name: 'user' },
              },
            },
          });

        const { id: messageId, chatId, authorId } = await query;

        expect(chatId).toBe(chat.id);

        await checkCreatedResults({
          messageId,
          chatId,
          authorId,
          text: 'message',
          title: 'chat',
          name: 'user',
        });
      });

      it('should support connect or create in batch create', async () => {
        const chat = await db.chat.select('id').create({
          ...chatData,
          title: 'chat 1',
        });
        const user = await db.user.select('id').create({
          ...userData,
          name: 'user 2',
        });

        const query = await db.message
          .select('id', 'chatId', 'authorId')
          .createMany([
            {
              ...messageData,
              text: 'message 1',
              chat: {
                connectOrCreate: {
                  where: { title: 'chat 1' },
                  create: { ...chatData, title: 'chat 1' },
                },
              },
              user: {
                connectOrCreate: {
                  where: { name: 'user 1' },
                  create: { ...userData, name: 'user 1' },
                },
              },
            },
            {
              ...messageData,
              text: 'message 2',
              chat: {
                connectOrCreate: {
                  where: { title: 'chat 2' },
                  create: { ...chatData, title: 'chat 2' },
                },
              },
              user: {
                connectOrCreate: {
                  where: { name: 'user 2' },
                  create: { ...userData, name: 'user 2' },
                },
              },
            },
          ]);

        const [first, second] = await query;

        expect(first.chatId).toBe(chat.id);
        expect(second.authorId).toBe(user.id);

        await checkCreatedResults({
          messageId: first.id,
          chatId: first.chatId,
          authorId: first.authorId,
          text: 'message 1',
          title: 'chat 1',
          name: 'user 1',
        });

        await checkCreatedResults({
          messageId: second.id,
          chatId: second.chatId,
          authorId: second.authorId,
          text: 'message 2',
          title: 'chat 2',
          name: 'user 2',
        });
      });
    });
  });

  describe('update', () => {
    describe('disconnect', () => {
      it('should nullify foreignKey', async () => {
        const id = await db.profile
          .get('id')
          .create({ ...profileData, user: { create: userData } });

        const profile = await db.profile
          .select('userId')
          .find(id)
          .update({
            bio: 'string',
            user: { disconnect: true },
          });

        expect(profile.userId).toBe(null);
      });

      it('should nullify foreignKey in batch update', async () => {
        const ids = await db.profile.pluck('id').createMany([
          { ...profileData, user: { create: userData } },
          { ...profileData, user: { create: userData } },
        ]);

        const userIds = await db.profile
          .pluck('userId')
          .where({ id: { in: ids } })
          .update({
            bio: 'string',
            user: { disconnect: true },
          });

        expect(userIds).toEqual([null, null]);
      });
    });

    describe('set', () => {
      it('should set foreignKey of current record with provided primaryKey', async () => {
        const id = await db.profile.get('id').create(profileData);
        const user = await db.user.select('id').create(userData);

        const profile = await db.profile
          .selectAll()
          .find(id)
          .update({
            user: {
              set: user,
            },
          });

        expect(profile.userId).toBe(user.id);
      });

      it('should set foreignKey of current record from found related record', async () => {
        const id = await db.profile.get('id').create(profileData);
        const user = await db.user.select('id').create({
          ...userData,
          name: 'user',
        });

        const profile = await db.profile
          .selectAll()
          .find(id)
          .update({
            user: {
              set: { name: 'user' },
            },
          });

        expect(profile.userId).toBe(user.id);
      });

      it('should set foreignKey of current record with provided primaryKey in batch update', async () => {
        const profileIds = await db.profile
          .pluck('id')
          .createMany([profileData, profileData]);
        const user = await db.user.select('id').create(userData);

        const updatedUserIds = await db.profile
          .pluck('userId')
          .where({ id: { in: profileIds } })
          .update({
            user: {
              set: user,
            },
          });

        expect(updatedUserIds).toEqual([user.id, user.id]);
      });

      it('should set foreignKey of current record from found related record in batch update', async () => {
        const profileIds = await db.profile
          .pluck('id')
          .createMany([profileData, profileData]);
        const user = await db.user.select('id').create({
          ...userData,
          name: 'user',
        });

        const updatedUserIds = await db.profile
          .pluck('userId')
          .where({ id: { in: profileIds } })
          .update({
            user: {
              set: { name: 'user' },
            },
          });

        expect(updatedUserIds).toEqual([user.id, user.id]);
      });
    });

    describe('delete', () => {
      it('should nullify foreignKey and delete related record', async () => {
        const { id, userId } = await db.profile
          .select('id', 'userId')
          .create({ ...profileData, user: { create: userData } });

        const profile = await db.profile
          .select('userId')
          .find(id)
          .update({
            user: {
              delete: true,
            },
          });

        expect(profile.userId).toBe(null);

        const user = await db.user.findByOptional({ id: userId });
        expect(user).toBe(undefined);
      });

      it('should nullify foreignKey and delete related record in batch update', async () => {
        const user = await db.user.selectAll().create(userData);
        const profileIds = await db.profile.pluck('id').createMany([
          { ...profileData, userId: user.id },
          { ...profileData, userId: user.id },
        ]);

        const updatedUserIds = await db.profile
          .pluck('userId')
          .where({ id: { in: profileIds } })
          .update({
            user: {
              delete: true,
            },
          });

        expect(updatedUserIds).toEqual([null, null]);

        const deletedUser = await db.user.findOptional(user.id);
        expect(deletedUser).toBe(undefined);
      });
    });

    describe('nested update', () => {
      it('should update related record', async () => {
        const { id, userId } = await db.profile
          .select('id', 'userId')
          .create({ ...profileData, user: { create: userData } });

        await db.profile
          .select('userId')
          .find(id)
          .update({
            user: {
              update: {
                name: 'new name',
              },
            },
          });

        const user = await db.user.findBy({ id: userId });
        expect(user.name).toBe('new name');
      });

      it('should update related records in batch update', async () => {
        const profiles = await db.profile.select('id', 'userId').createMany([
          { ...profileData, user: { create: userData } },
          { ...profileData, user: { create: userData } },
        ]);

        await db.profile
          .where({ id: { in: profiles.map((profile) => profile.id) } })
          .update({
            user: {
              update: {
                name: 'new name',
              },
            },
          });

        const updatedNames = await db.user.pluck('name').where({
          id: { in: profiles.map((profile) => profile.userId as number) },
        });
        expect(updatedNames).toEqual(['new name', 'new name']);
      });
    });

    describe('nested upsert', () => {
      it('should update related record if it exists', async () => {
        const profile = await db.profile.create({
          ...profileData,
          user: {
            create: userData,
          },
        });

        await db.profile.find(profile.id).update({
          user: {
            upsert: {
              update: {
                name: 'updated',
              },
              create: userData,
            },
          },
        });

        const user = await db.profile.user(profile);
        expect(user.name).toBe('updated');
      });

      it('should create related record if it does not exist', async () => {
        const profile = await db.profile.create(profileData);

        const updated = await db.profile
          .selectAll()
          .find(profile.id)
          .update({
            user: {
              upsert: {
                update: {
                  name: 'updated',
                },
                create: {
                  ...userData,
                  name: 'created',
                },
              },
            },
          });

        const user = await db.profile.user(updated);
        expect(user.name).toBe('created');
      });

      it('should throw in batch update', () => {
        expect(() =>
          db.profile.where({ id: 1 }).update({
            user: {
              // @ts-expect-error not allows in batch update
              upsert: {
                update: {
                  name: 'updated',
                },
                create: {
                  ...userData,
                  name: 'created',
                },
              },
            },
          }),
        ).toThrow();
      });
    });

    describe('nested create', () => {
      it('should create new related record and update foreignKey', async () => {
        const profileId = await db.profile
          .get('id')
          .create({ ...profileData, user: { create: userData } });

        const updated = await db.profile
          .selectAll()
          .find(profileId)
          .update({
            user: {
              create: { ...userData, name: 'created' },
            },
          });

        const user = await db.profile.user(updated);
        expect(user.name).toBe('created');
      });

      it('should create new related record and update foreignKey in batch update', async () => {
        const profileIds = await db.profile
          .pluck('id')
          .createMany([profileData, profileData]);

        const updatedUserIds = await db.profile
          .pluck('userId')
          .where({ id: { in: profileIds } })
          .update({
            user: {
              create: { ...userData, name: 'created' },
            },
          });

        expect(updatedUserIds[0]).toBe(updatedUserIds[1]);

        const user = await db.user.find(updatedUserIds[0] as number);
        expect(user.name).toBe('created');
      });
    });
  });
});
