import { RelationQuery } from 'pqb';
import {
  BaseTable,
  chatData,
  db,
  messageData,
  messageSelectAll,
  profileData,
  profileSelectAll,
  User,
  userData,
  useRelationCallback,
  userSelectAll,
  useTestORM,
} from '../test-utils/test-utils';
import { orchidORM } from '../orm';
import { assertType, expectSql } from 'test-utils';

describe('belongsTo', () => {
  useTestORM();

  describe('querying', () => {
    it('should have method to query related data', async () => {
      const userQuery = db.user.take();
      type UserQuery = typeof userQuery;

      assertType<
        typeof db.profile.user,
        RelationQuery<'user', { UserId: number | null }, never, UserQuery, true>
      >();

      const UserId = await db.user.get('Id').create(userData);
      const profileId = await db.profile
        .get('Id')
        .create({ ...profileData, UserId });

      const profile = await db.profile.find(profileId);
      const query = db.profile.user(profile);

      expectSql(
        query.toSql(),
        `
        SELECT ${userSelectAll} FROM "user"
        WHERE "user"."id" = $1
      `,
        [UserId],
      );

      const user = await query;

      expect(user).toMatchObject(userData);
    });

    it('should handle chained query', () => {
      const query = db.profile
        .where({ Bio: 'bio' })
        .user.where({ Name: 'name' });

      assertType<Awaited<typeof query>, User>();

      expectSql(
        query.toSql(),
        `
          SELECT ${userSelectAll} FROM "user"
          WHERE EXISTS (
              SELECT 1 FROM "profile"
              WHERE "profile"."bio" = $1
                AND "profile"."userId" = "user"."id"
              LIMIT 1
            )
            AND "user"."name" = $2
        `,
        ['bio', 'name'],
      );
    });

    it('should have disabled create and delete method', () => {
      // @ts-expect-error belongsTo should not have chained create
      db.profile.user.create(userData);

      // @ts-expect-error belongsTo should not have chained create
      db.profile.user.find(1).delete();
    });

    it('should have proper joinQuery', () => {
      expectSql(
        db.profile.relations.user
          .joinQuery(db.profile.as('p'), db.user.as('u'))
          .toSql(),
        `
          SELECT ${userSelectAll} FROM "user" AS "u"
          WHERE "u"."id" = "p"."userId"
        `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.profile.whereExists('user').toSql(),
        `
          SELECT ${profileSelectAll} FROM "profile"
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
          .whereExists('user', (q) => q.where({ Name: 'name' }))
          .toSql(),
        `
        SELECT ${profileSelectAll} FROM "profile" AS "p"
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
            q.whereExists('profile', (q) => q.where({ Bio: 'bio' })),
          )
          .toSql(),
        `
          SELECT ${messageSelectAll} FROM "message" AS "m"
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
        .join('user', (q) => q.where({ Name: 'name' }))
        .select('Bio', 'user.Name');

      assertType<
        Awaited<typeof query>,
        { Bio: string | null; Name: string }[]
      >();

      expectSql(
        query.toSql(),
        `
        SELECT "p"."bio" AS "Bio", "user"."name" AS "Name"
        FROM "profile" AS "p"
        JOIN "user" ON "user"."id" = "p"."userId" AND "user"."name" = $1
      `,
        ['name'],
      );
    });

    it('should be supported in join with a callback', () => {
      const query = db.profile
        .as('p')
        .join(
          (q) => q.user.as('u').where({ Age: 20 }),
          (q) => q.where({ Name: 'name' }),
        )
        .select('Bio', 'u.Name');

      assertType<
        Awaited<typeof query>,
        { Bio: string | null; Name: string }[]
      >();

      expectSql(
        query.toSql(),
        `
        SELECT "p"."bio" AS "Bio", "u"."name" AS "Name"
        FROM "profile" AS "p"
        JOIN "user" AS "u"
          ON "u"."name" = $1 AND "u"."age" = $2 AND "u"."id" = "p"."userId"
      `,
        ['name', 20],
      );
    });

    it('should be supported in joinLateral', () => {
      const q = db.profile
        .joinLateral('user', (q) => q.as('u').where({ Name: 'one' }))
        .where({ 'u.Name': 'two' })
        .select('Bio', 'u');

      assertType<Awaited<typeof q>, { Bio: string | null; u: User }[]>();

      expectSql(
        q.toSql(),
        `
          SELECT "profile"."bio" AS "Bio", row_to_json("u".*) "u"
          FROM "profile"
          JOIN LATERAL (
            SELECT ${userSelectAll}
            FROM "user" AS "u"
            WHERE "u"."name" = $1 AND "u"."id" = "profile"."userId"
          ) "u" ON true
          WHERE "u"."name" = $2
        `,
        ['one', 'two'],
      );
    });

    describe('select', () => {
      it('should be selectable', async () => {
        const query = db.profile.as('p').select('Id', {
          user: (q) => q.user.select('Id', 'Name').where({ Name: 'name' }),
        });

        assertType<
          Awaited<typeof query>,
          { Id: number; user: { Id: number; Name: string } }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "p"."id" AS "Id",
              row_to_json("user".*) "user"
            FROM "profile" AS "p"
            LEFT JOIN LATERAL (
              SELECT "user"."id" AS "Id", "user"."name" AS "Name"
              FROM "user"
              WHERE "user"."name" = $1
                AND "user"."id" = "p"."userId"
            ) "user" ON true
          `,
          ['name'],
        );
      });

      it('should handle exists sub query', async () => {
        const query = db.profile.as('p').select('Id', {
          hasUser: (q) => q.user.exists(),
        });

        assertType<Awaited<typeof query>, { Id: number; hasUser: boolean }[]>();

        expectSql(
          query.toSql(),
          `
            SELECT
              "p"."id" AS "Id",
              COALESCE("hasUser".r, false) "hasUser"
            FROM "profile" AS "p"
            LEFT JOIN LATERAL (
              SELECT true r
              FROM "user"
              WHERE "user"."id" = "p"."userId"
            ) "hasUser" ON true
          `,
        );
      });
    });
  });

  describe('create', () => {
    const checkCreatedResults = async ({
      messageId,
      ChatId,
      AuthorId,
      Text,
      Title,
      Name,
    }: {
      messageId: number;
      ChatId: number;
      AuthorId: number | null;
      Text: string;
      Title: string;
      Name: string;
    }) => {
      const message = await db.message.find(messageId);
      expect(message).toEqual({
        ...message,
        ...messageData,
        ChatId,
        AuthorId,
        Text,
      });

      const chat = await db.chat.find(ChatId);
      expect(chat).toEqual({
        ...chat,
        ...chatData,
        Title,
      });

      if (!AuthorId) return;
      const user = await db.user.find(AuthorId);
      expect(user).toEqual({
        ...user,
        ...userData,
        Active: null,
        Age: null,
        Data: null,
        Picture: null,
        Name,
      });
    };

    describe('nested create', () => {
      it('should support create', async () => {
        const {
          Id: messageId,
          ChatId,
          AuthorId,
        } = await db.message.select('Id', 'ChatId', 'AuthorId').create({
          ...messageData,
          Text: 'message',
          chat: {
            create: {
              ...chatData,
              Title: 'chat',
            },
          },
          user: {
            create: {
              ...userData,
              Name: 'user',
            },
          },
        });

        await checkCreatedResults({
          messageId,
          ChatId,
          AuthorId,
          Text: 'message',
          Title: 'chat',
          Name: 'user',
        });
      });

      it('should support create in batch create', async () => {
        const query = db.message.select('Id', 'ChatId', 'AuthorId').createMany([
          {
            ...messageData,
            Text: 'message 1',
            chat: {
              create: {
                ...chatData,
                Title: 'chat 1',
              },
            },
            user: {
              create: {
                ...userData,
                Name: 'user 1',
              },
            },
          },
          {
            ...messageData,
            Text: 'message 2',
            chat: {
              create: {
                ...chatData,
                Title: 'chat 2',
              },
            },
            user: {
              create: {
                ...userData,
                Name: 'user 2',
              },
            },
          },
        ]);

        const [first, second] = await query;

        await checkCreatedResults({
          messageId: first.Id,
          ChatId: first.ChatId,
          AuthorId: first.AuthorId,
          Text: 'message 1',
          Title: 'chat 1',
          Name: 'user 1',
        });

        await checkCreatedResults({
          messageId: second.Id,
          ChatId: second.ChatId,
          AuthorId: second.AuthorId,
          Text: 'message 2',
          Title: 'chat 2',
          Name: 'user 2',
        });
      });

      describe('id has no default', () => {
        // for this issue: https://github.com/romeerez/orchid-orm/issues/34
        it('should create record with explicitly setting id and foreign key', async () => {
          const UserId = await db.user.get('Id').create(userData);

          class UserTable extends BaseTable {
            readonly table = 'user';
            columns = this.setColumns((t) => ({
              Id: t.name('id').identity().primaryKey(),
            }));
          }

          class ProfileTable extends BaseTable {
            readonly table = 'profile';
            columns = this.setColumns((t) => ({
              Id: t.name('id').identity().primaryKey(),
              UserId: t
                .name('userId')
                .integer()
                .nullable()
                .foreignKey(() => UserTable, 'Id'),
              Bio: t.name('bio').text().nullable(),
              ...t.timestamps(),
            }));

            relations = {
              user: this.belongsTo(() => UserTable, {
                required: true,
                primaryKey: 'Id',
                foreignKey: 'UserId',
              }),
            };
          }

          const local = orchidORM(
            { db: db.$queryBuilder },
            {
              user: UserTable,
              profile: ProfileTable,
            },
          );

          const q = local.profile.create({
            Id: 1,
            UserId,
            Bio: 'bio',
          });

          expectSql(
            q.toSql(),
            `
              INSERT INTO "profile"("id", "userId", "bio")
              VALUES ($1, $2, $3)
              RETURNING ${profileSelectAll}
            `,
            [1, UserId, 'bio'],
          );

          const result = await q;
          expect(result).toMatchObject({
            Id: 1,
            UserId,
            Bio: 'bio',
          });
        });
      });

      describe('relation callbacks', () => {
        const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
          db.message.relations.chat,
        );

        const data = {
          ...messageData,
          chat: {
            create: chatData,
          },
        };

        it('should invoke callbacks', async () => {
          await db.message.create(data);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          await db.message.createMany([data, data]);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('connect', () => {
      it('should support connect', async () => {
        await db.chat.create({ ...chatData, Title: 'chat' });
        await db.user.create({ ...userData, Name: 'user' });

        const query = db.message.select('Id', 'ChatId', 'AuthorId').create({
          ...messageData,
          Text: 'message',
          chat: {
            connect: { Title: 'chat' },
          },
          user: {
            connect: { Name: 'user' },
          },
        });

        const { Id: messageId, ChatId, AuthorId } = await query;

        await checkCreatedResults({
          messageId,
          ChatId,
          AuthorId,
          Text: 'message',
          Title: 'chat',
          Name: 'user',
        });
      });

      it('should support connect in batch create', async () => {
        await db.chat.createMany([
          { ...chatData, Title: 'chat 1' },
          { ...chatData, Title: 'chat 2' },
        ]);
        await db.user.createMany([
          { ...userData, Name: 'user 1' },
          { ...userData, Name: 'user 2' },
        ]);

        const query = db.message.select('Id', 'ChatId', 'AuthorId').createMany([
          {
            ...messageData,
            Text: 'message 1',
            chat: {
              connect: { Title: 'chat 1' },
            },
            user: {
              connect: { Name: 'user 1' },
            },
          },
          {
            ...messageData,
            Text: 'message 2',
            chat: {
              connect: { Title: 'chat 2' },
            },
            user: {
              connect: { Name: 'user 2' },
            },
          },
        ]);

        const [first, second] = await query;

        await checkCreatedResults({
          messageId: first.Id,
          ChatId: first.ChatId,
          AuthorId: first.AuthorId,
          Text: 'message 1',
          Title: 'chat 1',
          Name: 'user 1',
        });

        await checkCreatedResults({
          messageId: second.Id,
          ChatId: second.ChatId,
          AuthorId: second.AuthorId,
          Text: 'message 2',
          Title: 'chat 2',
          Name: 'user 2',
        });
      });
    });

    describe('connectOrCreate', () => {
      it('should support connect or create', async () => {
        const chat = await db.chat.select('IdOfChat').create({
          ...chatData,
          Title: 'chat',
        });

        const query = await db.message
          .select('Id', 'ChatId', 'AuthorId')
          .create({
            ...messageData,
            Text: 'message',
            chat: {
              connectOrCreate: {
                where: { Title: 'chat' },
                create: { ...chatData, Title: 'chat' },
              },
            },
            user: {
              connectOrCreate: {
                where: { Name: 'user' },
                create: { ...userData, Name: 'user' },
              },
            },
          });

        const { Id: messageId, ChatId, AuthorId } = await query;

        expect(ChatId).toBe(chat.IdOfChat);

        await checkCreatedResults({
          messageId,
          ChatId,
          AuthorId,
          Text: 'message',
          Title: 'chat',
          Name: 'user',
        });
      });

      it('should support connect or create in batch create', async () => {
        const chat = await db.chat.select('IdOfChat').create({
          ...chatData,
          Title: 'chat 1',
        });
        const user = await db.user.select('Id').create({
          ...userData,
          Name: 'user 2',
        });

        const query = await db.message
          .select('Id', 'ChatId', 'AuthorId')
          .createMany([
            {
              ...messageData,
              Text: 'message 1',
              chat: {
                connectOrCreate: {
                  where: { Title: 'chat 1' },
                  create: { ...chatData, Title: 'chat 1' },
                },
              },
              user: {
                connectOrCreate: {
                  where: { Name: 'user 1' },
                  create: { ...userData, Name: 'user 1' },
                },
              },
            },
            {
              ...messageData,
              Text: 'message 2',
              chat: {
                connectOrCreate: {
                  where: { Title: 'chat 2' },
                  create: { ...chatData, Title: 'chat 2' },
                },
              },
              user: {
                connectOrCreate: {
                  where: { Name: 'user 2' },
                  create: { ...userData, Name: 'user 2' },
                },
              },
            },
          ]);

        const [first, second] = await query;

        expect(first.ChatId).toBe(chat.IdOfChat);
        expect(second.AuthorId).toBe(user.Id);

        await checkCreatedResults({
          messageId: first.Id,
          ChatId: first.ChatId,
          AuthorId: first.AuthorId,
          Text: 'message 1',
          Title: 'chat 1',
          Name: 'user 1',
        });

        await checkCreatedResults({
          messageId: second.Id,
          ChatId: second.ChatId,
          AuthorId: second.AuthorId,
          Text: 'message 2',
          Title: 'chat 2',
          Name: 'user 2',
        });
      });

      describe('relation callbacks', () => {
        const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
          db.message.relations.chat,
        );

        const data = {
          ...messageData,
          chat: {
            connectOrCreate: {
              where: { Title: 'title' },
              create: chatData,
            },
          },
        };

        it('should invoke callbacks', async () => {
          await db.message.create(data);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          await db.message.createMany([data, data]);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('update', () => {
    describe('disconnect', () => {
      it('should nullify foreignKey', async () => {
        const id = await db.profile
          .get('Id')
          .create({ ...profileData, user: { create: userData } });

        const profile = await db.profile
          .select('UserId')
          .find(id)
          .update({
            Bio: 'string',
            user: { disconnect: true },
          });

        expect(profile.UserId).toBe(null);
      });

      it('should nullify foreignKey in batch update', async () => {
        const ids = await db.profile.pluck('Id').createMany([
          { ...profileData, user: { create: userData } },
          { ...profileData, user: { create: userData } },
        ]);

        const userIds = await db.profile
          .pluck('UserId')
          .where({ Id: { in: ids } })
          .update({
            Bio: 'string',
            user: { disconnect: true },
          });

        expect(userIds).toEqual([null, null]);
      });
    });

    describe('set', () => {
      it('should set foreignKey of current record with provided primaryKey', async () => {
        const id = await db.profile.get('Id').create(profileData);
        const user = await db.user.select('Id').create(userData);

        const profile = await db.profile
          .selectAll()
          .find(id)
          .update({
            user: {
              set: user,
            },
          });

        expect(profile.UserId).toBe(user.Id);
      });

      it('should set foreignKey of current record from found related record', async () => {
        const id = await db.profile.get('Id').create(profileData);
        const user = await db.user.select('Id').create({
          ...userData,
          Name: 'user',
        });

        const profile = await db.profile
          .selectAll()
          .find(id)
          .update({
            user: {
              set: { Name: 'user' },
            },
          });

        expect(profile.UserId).toBe(user.Id);
      });

      it('should set foreignKey of current record with provided primaryKey in batch update', async () => {
        const profileIds = await db.profile
          .pluck('Id')
          .createMany([profileData, profileData]);
        const user = await db.user.select('Id').create(userData);

        const updatedUserIds = await db.profile
          .pluck('UserId')
          .where({ Id: { in: profileIds } })
          .update({
            user: {
              set: user,
            },
          });

        expect(updatedUserIds).toEqual([user.Id, user.Id]);
      });

      it('should set foreignKey of current record from found related record in batch update', async () => {
        const profileIds = await db.profile
          .pluck('Id')
          .createMany([profileData, profileData]);
        const user = await db.user.select('Id').create({
          ...userData,
          Name: 'user',
        });

        const updatedUserIds = await db.profile
          .pluck('UserId')
          .where({ Id: { in: profileIds } })
          .update({
            user: {
              set: { Name: 'user' },
            },
          });

        expect(updatedUserIds).toEqual([user.Id, user.Id]);
      });
    });

    describe('delete', () => {
      it('should nullify foreignKey and delete related record', async () => {
        const { Id, UserId } = await db.profile
          .select('Id', 'UserId')
          .create({ ...profileData, user: { create: userData } });

        const profile = await db.profile
          .select('UserId')
          .find(Id)
          .update({
            user: {
              delete: true,
            },
          });

        expect(profile.UserId).toBe(null);

        const user = await db.user.findByOptional({ Id: UserId });
        expect(user).toBe(undefined);
      });

      it('should nullify foreignKey and delete related record in batch update', async () => {
        const user = await db.user.selectAll().create(userData);
        const profileIds = await db.profile.pluck('Id').createMany([
          { ...profileData, UserId: user.Id },
          { ...profileData, UserId: user.Id },
        ]);

        const updatedUserIds = await db.profile
          .pluck('UserId')
          .where({ Id: { in: profileIds } })
          .update({
            user: {
              delete: true,
            },
          });

        expect(updatedUserIds).toEqual([null, null]);

        const deletedUser = await db.user.findOptional(user.Id);
        expect(deletedUser).toBe(undefined);
      });

      describe('relation callbacks', () => {
        const { beforeDelete, afterDelete, resetMocks } = useRelationCallback(
          db.profile.relations.user,
        );

        const profileWithUserData = {
          ...profileData,
          user: {
            create: userData,
          },
        };

        const data = {
          user: {
            delete: true,
          },
        };

        it('should invoke callbacks', async () => {
          const Id = await db.profile.get('Id').create(profileWithUserData);

          await db.profile.find(Id).update(data);

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch delete', async () => {
          resetMocks();

          const ids = await db.profile
            .pluck('Id')
            .createMany([profileWithUserData, profileWithUserData]);

          await db.profile.where({ Id: { in: ids } }).update(data);

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('nested update', () => {
      it('should update related record', async () => {
        const { Id, UserId } = await db.profile
          .select('Id', 'UserId')
          .create({ ...profileData, user: { create: userData } });

        await db.profile
          .select('UserId')
          .find(Id)
          .update({
            user: {
              update: {
                Name: 'new name',
              },
            },
          });

        const user = await db.user.findBy({ Id: UserId });
        expect(user.Name).toBe('new name');
      });

      it('should update related records in batch update', async () => {
        const profiles = await db.profile.select('Id', 'UserId').createMany([
          { ...profileData, user: { create: userData } },
          { ...profileData, user: { create: userData } },
        ]);

        await db.profile
          .where({ Id: { in: profiles.map((profile) => profile.Id) } })
          .update({
            user: {
              update: {
                Name: 'new name',
              },
            },
          });

        const updatedNames = await db.user.pluck('Name').where({
          Id: { in: profiles.map((profile) => profile.UserId as number) },
        });
        expect(updatedNames).toEqual(['new name', 'new name']);
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
          db.profile.relations.user,
        );

        const profileWithUserData = {
          ...profileData,
          user: {
            create: userData,
          },
        };

        const data = {
          user: {
            update: {
              Name: 'new name',
            },
          },
        };

        it('should invoke callbacks', async () => {
          const Id = await db.profile.get('Id').create(profileWithUserData);

          await db.profile.find(Id).update(data);

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          const ids = await db.profile
            .pluck('Id')
            .createMany([profileWithUserData, profileWithUserData]);

          await db.profile.where({ Id: { in: ids } }).update(data);

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
        });
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

        await db.profile.find(profile.Id).update({
          user: {
            upsert: {
              update: {
                Name: 'updated',
              },
              create: userData,
            },
          },
        });

        const user = await db.profile.user(profile);
        expect(user.Name).toBe('updated');
      });

      it('should create related record if it does not exist', async () => {
        const profile = await db.profile.create(profileData);

        const updated = await db.profile
          .selectAll()
          .find(profile.Id)
          .update({
            user: {
              upsert: {
                update: {
                  Name: 'updated',
                },
                create: {
                  ...userData,
                  Name: 'created',
                },
              },
            },
          });

        const user = await db.profile.user(updated);
        expect(user.Name).toBe('created');
      });

      it('should create related record if it does not exist with a data from a callback', async () => {
        const profile = await db.profile.create(profileData);

        const updated = await db.profile
          .selectAll()
          .find(profile.Id)
          .update({
            user: {
              upsert: {
                update: {
                  Name: 'updated',
                },
                create: () => ({
                  ...userData,
                  Name: 'created',
                }),
              },
            },
          });

        const user = await db.profile.user(updated);
        expect(user.Name).toBe('created');
      });

      it('should throw in batch update', () => {
        expect(() =>
          db.profile.where({ Id: 1 }).update({
            user: {
              // @ts-expect-error not allows in batch update
              upsert: {
                update: {
                  Name: 'updated',
                },
                create: {
                  ...userData,
                  Name: 'created',
                },
              },
            },
          }),
        ).toThrow();
      });

      describe('relation callbacks', () => {
        const {
          beforeUpdate,
          afterUpdate,
          beforeCreate,
          afterCreate,
          resetMocks,
        } = useRelationCallback(db.profile.relations.user);

        const data = {
          user: {
            upsert: {
              update: {
                Name: 'new name',
              },
              create: userData,
            },
          },
        };

        it('should invoke update callbacks when updating', async () => {
          const Id = await db.profile.get('Id').create({
            ...profileData,
            user: {
              create: userData,
            },
          });

          resetMocks();

          await db.profile.find(Id).update(data);

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(beforeCreate).not.toBeCalled();
          expect(afterCreate).not.toBeCalled();
        });

        it('should invoke create callbacks when creating', async () => {
          resetMocks();

          const Id = await db.profile.get('Id').create(profileData);

          await db.profile.find(Id).update(data);

          expect(beforeUpdate).not.toBeCalled();
          expect(afterUpdate).not.toBeCalled();
          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('nested create', () => {
      it('should create new related record and update foreignKey', async () => {
        const profileId = await db.profile
          .get('Id')
          .create({ ...profileData, user: { create: userData } });

        const updated = await db.profile
          .selectAll()
          .find(profileId)
          .update({
            user: {
              create: { ...userData, Name: 'created' },
            },
          });

        const user = await db.profile.user(updated);
        expect(user.Name).toBe('created');
      });

      it('should create new related record and update foreignKey in batch update', async () => {
        const profileIds = await db.profile
          .pluck('Id')
          .createMany([profileData, profileData]);

        const updatedUserIds = await db.profile
          .pluck('UserId')
          .where({ Id: { in: profileIds } })
          .update({
            user: {
              create: { ...userData, Name: 'created' },
            },
          });

        expect(updatedUserIds[0]).toBe(updatedUserIds[1]);

        const user = await db.user.find(updatedUserIds[0] as number);
        expect(user.Name).toBe('created');
      });

      describe('relation callbacks', () => {
        const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
          db.profile.relations.user,
        );

        const data = {
          user: {
            create: userData,
          },
        };

        it('should invoke callbacks', async () => {
          const Id = await db.profile.get('Id').create(profileData);

          await db.profile.find(Id).update(data);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch update', async () => {
          const ids = await db.profile
            .pluck('Id')
            .createMany([profileData, profileData]);

          resetMocks();

          await db.profile.where({ Id: { in: ids } }).update(data);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });
      });
    });
  });
});
