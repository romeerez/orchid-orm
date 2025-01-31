import { Db, Query } from 'pqb';
import {
  BaseTable,
  chatData,
  db,
  messageData,
  messageSelectAll,
  Profile,
  profileData,
  profileSelectAll,
  User,
  userData,
  useRelationCallback,
  userSelectAll,
  useTestORM,
} from '../test-utils/orm.test-utils';
import { orchidORM } from '../orm';
import { assertType, expectSql } from 'test-utils';
import { omit } from 'orchid-core';
import { createBaseTable } from '../baseTable';

const ormParams = { db: db.$queryBuilder };

describe('belongsTo', () => {
  useTestORM();

  it('should define foreign keys under autoForeignKeys option', () => {
    const BaseTable = createBaseTable({
      autoForeignKeys: {
        onUpdate: 'CASCADE',
      },
    });

    class UserTable extends BaseTable {
      table = 'user';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
      }));
    }

    class ProfileTable extends BaseTable {
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        UserId: t.name('user_id').integer(),
        UserId2: t.name('user_id_2').integer(),
        UserId3: t.name('user_id_3').integer(),
      }));

      relations = {
        user: this.belongsTo(() => UserTable, {
          columns: ['UserId'],
          references: ['Id'],
        }),
        user2: this.belongsTo(() => UserTable, {
          columns: ['UserId2'],
          references: ['Id'],
          foreignKey: false,
        }),
        user3: this.belongsTo(() => UserTable, {
          columns: ['UserId3'],
          references: ['Id'],
          foreignKey: {
            onDelete: 'CASCADE',
          },
        }),
      };
    }

    const db = orchidORM(ormParams, { user: UserTable, profile: ProfileTable });
    expect(db.profile.internal.tableData.constraints).toEqual([
      {
        references: {
          columns: ['UserId'],
          fnOrTable: 'user',
          foreignColumns: ['Id'],
          options: { onUpdate: 'CASCADE' },
        },
      },
      {
        references: {
          columns: ['UserId3'],
          fnOrTable: 'user',
          foreignColumns: ['Id'],
          options: { onDelete: 'CASCADE' },
        },
      },
    ]);
  });

  describe('querying', () => {
    it('should support `queryRelated` to query related data', async () => {
      const UserId = await db.user.get('Id').create(userData);
      const profileId = await db.profile
        .get('Id')
        .create({ ...profileData, UserId });

      const profile = await db.profile.find(profileId);
      const query = db.profile.queryRelated('user', profile);

      expectSql(
        query.toSQL(),
        `
        SELECT ${userSelectAll} FROM "user"
        WHERE "user"."id" = $1
          AND "user"."user_key" = $2
      `,
        [UserId, 'key'],
      );

      const user = await query;

      expect(user).toMatchObject(omit(userData, ['Password']));
    });

    it('should handle chained query', async () => {
      const [oneId, twoId] = await db.user
        .pluck('Id')
        .createMany([userData, userData]);

      await db.profile.createMany([
        {
          UserId: oneId,
          ProfileKey: userData.UserKey,
          Bio: 'bio',
        },
        {
          UserId: twoId,
          ProfileKey: userData.UserKey,
          Bio: 'bio',
        },
      ]);

      const query = db.profile
        .where({ Bio: 'bio' })
        .chain('user')
        .where({ Name: userData.Name });

      expectSql(
        query.toSQL(),
        `
          SELECT ${userSelectAll} FROM "user"
          WHERE EXISTS (
              SELECT 1 FROM "profile"
              WHERE "profile"."bio" = $1
                AND "profile"."user_id" = "user"."id"
                AND "profile"."profile_key" = "user"."user_key"
            )
            AND "user"."name" = $2
        `,
        ['bio', 'name'],
      );

      const res = await query;

      assertType<typeof res, User[]>();

      expect(res.length).toBe(2);
    });

    it('should handle long chained query', () => {
      const q = db.postTag
        .where({ Tag: 'tag' })
        .chain('post')
        .where({ Body: 'body' })
        .chain('user')
        .where({ Name: 'name' });

      assertType<Awaited<typeof q>, User[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${userSelectAll}
          FROM "user"
          WHERE
            EXISTS (
              SELECT 1
              FROM "post"
              WHERE
                EXISTS (
                  SELECT 1
                  FROM "postTag"
                  WHERE "postTag"."tag" = $1
                    AND "postTag"."post_id" = "post"."id"
                )
                AND "post"."body" = $2
                AND "post"."user_id" = "user"."id"
                AND "post"."title" = "user"."user_key"
            )
            AND "user"."name" = $3
        `,
        ['tag', 'body', 'name'],
      );
    });

    it('should disable create and delete', () => {
      // @ts-expect-error belongsTo should not have chained create
      db.profile.chain('user').create(userData);

      // @ts-expect-error belongsTo should not have chained create
      db.profile.chain('user').find(1).delete();
    });

    it('should have proper joinQuery', () => {
      expectSql(
        (
          db.profile.relations.user.relationConfig.joinQuery(
            db.user.as('u'),
            db.profile.as('p'),
          ) as Query
        ).toSQL(),
        `
          SELECT ${userSelectAll} FROM "user" "u"
          WHERE "u"."id" = "p"."user_id"
            AND "u"."user_key" = "p"."profile_key"
        `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.profile
          .as('p')
          .whereExists((q) => q.user.where({ Name: 'name' }))
          .toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile" "p"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE "user"."name" = $1
              AND "user"."id" = "p"."user_id"
              AND "user"."user_key" = "p"."profile_key"
          )
        `,
        ['name'],
      );

      expectSql(
        db.profile
          .as('p')
          .whereExists('user', (q) => q.where({ 'user.Name': 'name' }))
          .toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile" "p"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE "user"."id" = "p"."user_id"
              AND "user"."user_key" = "p"."profile_key"
              AND "user"."name" = $1
          )
        `,
        ['name'],
      );
    });

    it('should support nested whereExists', () => {
      expectSql(
        db.message
          .as('m')
          .whereExists((q) =>
            q.sender.whereExists('profile', (q) => q.where({ Bio: 'bio' })),
          )
          .toSQL(),
        `
            SELECT ${messageSelectAll} FROM "message" "m"
            WHERE EXISTS (
              SELECT 1 FROM "user" AS "sender"
              WHERE EXISTS (
                  SELECT 1 FROM "profile"
                  WHERE "profile"."user_id" = "sender"."id"
                    AND "profile"."profile_key" = "sender"."user_key"
                    AND "profile"."bio" = $1
                )
                AND "sender"."id" = "m"."author_id"
                AND "sender"."user_key" = "m"."message_key"
            )
          `,
        ['bio'],
      );

      expectSql(
        db.message
          .as('m')
          .whereExists('sender', (q) =>
            q.whereExists('profile', (q) => q.where({ 'profile.Bio': 'bio' })),
          )
          .toSQL(),
        `
            SELECT ${messageSelectAll} FROM "message" "m"
            WHERE EXISTS (
              SELECT 1 FROM "user" AS "sender"
              WHERE "sender"."id" = "m"."author_id"
                AND "sender"."user_key" = "m"."message_key"
                AND EXISTS (
                SELECT 1 FROM "profile"
                WHERE "profile"."user_id" = "sender"."id"
                  AND "profile"."profile_key" = "sender"."user_key"
                  AND "profile"."bio" = $1
              )
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
        query.toSQL(),
        `
        SELECT "p"."bio" "Bio", "user"."name" "Name"
        FROM "profile" "p"
        JOIN "user"
          ON "user"."id" = "p"."user_id"
         AND "user"."user_key" = "p"."profile_key"
         AND "user"."name" = $1
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
        query.toSQL(),
        `
        SELECT "p"."bio" "Bio", "u"."name" "Name"
        FROM "profile" "p"
        JOIN "user" AS "u"
          ON "u"."name" = $1
         AND "u"."age" = $2
         AND "u"."id" = "p"."user_id"
         AND "u"."user_key" = "p"."profile_key"
      `,
        ['name', 20],
      );
    });

    it('should be supported in joinLateral', () => {
      const q = db.profile
        .joinLateral('user', (q) => q.as('u').where({ Name: 'one' }))
        .where({ 'u.Name': 'two' })
        .select('Bio', 'u.*');

      assertType<Awaited<typeof q>, { Bio: string | null; u: User }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "profile"."bio" "Bio", row_to_json("u".*) "u"
          FROM "profile"
          JOIN LATERAL (
            SELECT ${userSelectAll}
            FROM "user" "u"
            WHERE "u"."name" = $1 
              AND "u"."id" = "profile"."user_id"
              AND "u"."user_key" = "profile"."profile_key"
          ) "u" ON true
          WHERE "u"."Name" = $2
        `,
        ['one', 'two'],
      );
    });

    describe('select', () => {
      it('should be selectable', () => {
        const query = db.profile
          .as('p')
          .select('Id', {
            user: (q) => q.user.select('Id', 'Name').where({ Name: 'name' }),
          })
          .order('user.Name');

        assertType<
          Awaited<typeof query>,
          { Id: number; user: { Id: number; Name: string } | undefined }[]
        >();

        expectSql(
          query.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              row_to_json("user".*) "user"
            FROM "profile" "p"
            LEFT JOIN LATERAL (
              SELECT "user"."id" "Id", "user"."name" "Name"
              FROM "user"
              WHERE "user"."name" = $1
                AND "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
            ) "user" ON true
            ORDER BY "user"."Name" ASC
          `,
          ['name'],
        );
      });

      it('should support chained select', () => {
        const q = db.postTag.select({
          items: (q) => q.post.chain('user'),
        });

        assertType<Awaited<typeof q>, { items: User[] }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT COALESCE("items".r, '[]') "items"
            FROM "postTag"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
              FROM (
                SELECT ${userSelectAll}
                FROM "user"
                WHERE EXISTS (
                  SELECT 1 FROM "post"
                  WHERE "post"."id" = "postTag"."post_id"
                    AND "post"."user_id" = "user"."id"
                    AND "post"."title" = "user"."user_key"
                )
              ) "t"
            ) "items" ON true
          `,
        );
      });

      it('should handle exists sub query', () => {
        const query = db.profile.as('p').select('Id', {
          hasUser: (q) => q.user.exists(),
        });

        assertType<Awaited<typeof query>, { Id: number; hasUser: boolean }[]>();

        expectSql(
          query.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              COALESCE("hasUser".r, false) "hasUser"
            FROM "profile" "p"
            LEFT JOIN LATERAL (
              SELECT true r
              FROM "user"
              WHERE "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
            ) "hasUser" ON true
          `,
        );
      });

      it('should support recurring select', () => {
        const q = db.profile.select({
          user: (q) =>
            q.user.select({
              profile: (q) =>
                q.profile
                  .select({
                    user: (q) => q.user,
                  })
                  .where({ 'user.Name': 'name' }),
            }),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT row_to_json("user".*) "user"
            FROM "profile"
            LEFT JOIN LATERAL (
              SELECT row_to_json("profile2".*) "profile"
              FROM "user"
              LEFT JOIN LATERAL (
                SELECT row_to_json("user2".*) "user"
                FROM "profile" "profile2"
                LEFT JOIN LATERAL (
                  SELECT ${userSelectAll}
                  FROM "user" "user2"
                  WHERE "user2"."id" = "profile2"."user_id"
                    AND "user2"."user_key" = "profile2"."profile_key"
                ) "user2" ON true
                WHERE "user2"."Name" = $1
                  AND "profile2"."user_id" = "user"."id"
                  AND "profile2"."profile_key" = "user"."user_key"
              ) "profile2" ON true
              WHERE "user"."id" = "profile"."user_id"
                AND "user"."user_key" = "profile"."profile_key"
            ) "user" ON true
          `,
          ['name'],
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
        ...omit(userData, ['Password']),
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
          createdAt: messageData.createdAt,
          updatedAt: messageData.updatedAt,
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
            createdAt: messageData.createdAt,
            updatedAt: messageData.updatedAt,
            Text: 'message 1',
            chat: {
              create: {
                ...chatData,
                Title: 'chat 1',
              },
            },
            sender: {
              create: {
                ...userData,
                Name: 'user 1',
              },
            },
          },
          {
            createdAt: messageData.createdAt,
            updatedAt: messageData.updatedAt,
            Text: 'message 2',
            chat: {
              create: {
                ...chatData,
                Title: 'chat 2',
              },
            },
            sender: {
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

      it('should support nested create with a value from `with`', () => {
        const q = db.$queryBuilder
          .with('user', db.user.create(userData))
          .with('profile', (q) =>
            db.profile.create({
              ...profileData,
              UserId: () => q.from('user').get('Id'),
            }),
          )
          .from('profile');

        assertType<Awaited<typeof q>, Profile[]>();
      });

      describe('id has no default', () => {
        // for this issue: https://github.com/romeerez/orchid-orm/issues/34
        it('should create record with explicitly setting id and foreign key', async () => {
          class UserTable extends BaseTable {
            readonly table = 'user';
            columns = this.setColumns((t) => ({
              Id: t.name('id').identity().primaryKey(),
              UserKey: t.name('user_key').text(),
              Name: t.name('name').text(),
              Password: t.name('password').text(),
            }));
          }

          class ProfileTable extends BaseTable {
            readonly table = 'profile';
            columns = this.setColumns((t) => ({
              Id: t.name('id').identity().primaryKey(),
              ProfileKey: t.name('profile_key').text(),
              UserId: t
                .name('user_id')
                .integer()
                .nullable()
                .foreignKey(() => UserTable, 'Id'),
              Bio: t.name('bio').text().nullable(),
              ...t.timestamps(),
            }));

            relations = {
              user: this.belongsTo(() => UserTable, {
                required: true,
                columns: ['UserId', 'ProfileKey'],
                references: ['Id', 'UserKey'],
              }),
            };
          }

          const db = orchidORM(ormParams, {
            user: UserTable,
            profile: ProfileTable,
          });

          const UserId = await db.user.get('Id').create(userData);

          const q = db.profile.create({
            Id: 1,
            UserId,
            ProfileKey: 'key',
            Bio: 'bio',
          });

          expectSql(
            q.toSQL(),
            `
              INSERT INTO "profile"("id", "user_id", "profile_key", "bio")
              VALUES ($1, $2, $3, $4)
              RETURNING ${profileSelectAll}
            `,
            [1, UserId, 'key', 'bio'],
          );

          const result = await q;
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
            create: chatData,
          },
        };

        it('should invoke callbacks', async () => {
          await db.message.create(data);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(
            [{ IdOfChat: expect.any(Number), ChatKey: 'key' }],
            expect.any(Db),
          );
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          await db.message.createMany([data, data]);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(
            [
              { IdOfChat: expect.any(Number), ChatKey: 'key' },
              { IdOfChat: expect.any(Number), ChatKey: 'key' },
            ],
            expect.any(Db),
          );
        });
      });
    });

    describe('connect', () => {
      it('should support connect', async () => {
        await db.chat.create({ ...chatData, Title: 'chat' });
        await db.user.create({ ...userData, Name: 'user' });

        const query = db.message.select('Id', 'ChatId', 'AuthorId').create({
          createdAt: messageData.createdAt,
          updatedAt: messageData.updatedAt,
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
            createdAt: messageData.createdAt,
            updatedAt: messageData.updatedAt,
            Text: 'message 1',
            chat: {
              connect: { Title: 'chat 1' },
            },
            user: {
              connect: { Name: 'user 1' },
            },
          },
          {
            createdAt: messageData.createdAt,
            updatedAt: messageData.updatedAt,
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
            updatedAt: messageData.updatedAt,
            createdAt: messageData.createdAt,
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
              updatedAt: messageData.updatedAt,
              createdAt: messageData.createdAt,
              Text: 'message 1',
              chat: {
                connectOrCreate: {
                  where: { Title: 'chat 1' },
                  create: { ...chatData, Title: 'chat 1' },
                },
              },
              sender: {
                connectOrCreate: {
                  where: { Name: 'user 1' },
                  create: { ...userData, Name: 'user 1' },
                },
              },
            },
            {
              updatedAt: messageData.updatedAt,
              createdAt: messageData.createdAt,
              Text: 'message 2',
              chat: {
                connectOrCreate: {
                  where: { Title: 'chat 2' },
                  create: { ...chatData, Title: 'chat 2' },
                },
              },
              sender: {
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
          ['IdOfChat'],
        );

        const data = {
          Text: 'text',
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
          expect(afterCreate).toBeCalledWith(
            [{ IdOfChat: expect.any(Number), ChatKey: 'key' }],
            expect.any(Db),
          );
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          await db.message.createMany([data, data]);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(
            [
              { IdOfChat: expect.any(Number), ChatKey: 'key' },
              { IdOfChat: expect.any(Number), ChatKey: 'key' },
            ],
            expect.any(Db),
          );
        });
      });
    });
  });

  describe('update', () => {
    describe('disconnect', () => {
      it('should nullify foreignKey', async () => {
        const id = await db.profile
          .get('Id')
          .create({ Bio: 'bio', user: { create: userData } });

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
          { Bio: 'bio', user: { create: userData } },
          { Bio: 'bio', user: { create: userData } },
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
        const firstUserId = await db.user.get('Id').create(userData);
        const id = await db.profile
          .get('Id')
          .create({ ...profileData, UserId: firstUserId });
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
        const firstUserId = await db.user.get('Id').create(userData);
        const id = await db.profile
          .get('Id')
          .create({ ...profileData, UserId: firstUserId });
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
        const UserId = await db.user.get('Id').create(userData);
        const profileIds = await db.profile.pluck('Id').createMany([
          { ...profileData, UserId },
          { ...profileData, UserId },
        ]);
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
        const firstUserId = await db.user.get('Id').create(userData);
        const profileIds = await db.profile.pluck('Id').createMany([
          { ...profileData, UserId: firstUserId },
          { ...profileData, UserId: firstUserId },
        ]);
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
          .create({ Bio: 'bio', user: { create: userData } });

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
          ['Id'],
        );

        const profileWithUserData = {
          Bio: 'bio',
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
          expect(afterDelete).toBeCalledWith(
            [{ Id: expect.any(Number) }],
            expect.any(Db),
          );
        });

        it('should invoke callbacks in a batch delete', async () => {
          resetMocks();

          const profiles = await db.profile
            .select('Id', 'UserId')
            .createMany([profileWithUserData, profileWithUserData]);

          await db.profile
            .where({ Id: { in: profiles.map((p) => p.Id) } })
            .update(data);

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toBeCalledWith(
            profiles.map((p) => ({ Id: p.UserId })),
            expect.any(Db),
          );
        });
      });
    });

    describe('nested update', () => {
      it('should update related record', async () => {
        const { Id, UserId } = await db.profile
          .select('Id', 'UserId')
          .create({ Bio: 'bio', user: { create: userData } });

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
          { Bio: 'bio', user: { create: userData } },
          { Bio: 'bio', user: { create: userData } },
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
          Id: { in: profiles.map((profile) => profile.UserId) },
        });
        expect(updatedNames).toEqual(['new name', 'new name']);
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
          db.profile.relations.user,
          ['Id'],
        );

        const profileWithUserData = {
          Bio: 'bio',
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
          const { Id, UserId } = await db.profile
            .select('Id', 'UserId')
            .create(profileWithUserData);

          await db.profile.find(Id).update(data);

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toBeCalledWith([{ Id: UserId }], expect.any(Db));
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          const profiles = await db.profile
            .select('Id', 'UserId')
            .createMany([profileWithUserData, profileWithUserData]);

          await db.profile
            .where({ Id: { in: profiles.map((p) => p.Id) } })
            .update(data);

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toBeCalledWith(
            profiles.map((p) => ({ Id: p.UserId })),
            expect.any(Db),
          );
        });
      });
    });

    describe('nested upsert', () => {
      it('should update related record if it exists', async () => {
        const profile = await db.profile.create({
          Bio: 'bio',
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

        const user = await db.profile.queryRelated('user', profile);
        expect(user?.Name).toBe('updated');
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

        const user = await db.profile.queryRelated('user', updated);
        expect(user?.Name).toBe('created');
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

        const user = await db.profile.queryRelated('user', updated);
        expect(user?.Name).toBe('created');
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
        } = useRelationCallback(db.profile.relations.user, ['Id']);

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
          const { Id, UserId } = await db.profile
            .select('Id', 'UserId')
            .create({
              Bio: 'bio',
              user: {
                create: userData,
              },
            });

          resetMocks();

          await db.profile.find(Id).update(data);

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toBeCalledWith([{ Id: UserId }], expect.any(Db));
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
          expect(afterCreate).toBeCalledWith(
            [{ Id: expect.any(Number), UserKey: 'key' }],
            expect.any(Db),
          );
        });
      });
    });

    describe('nested create', () => {
      it('should create new related record and update foreignKey', async () => {
        const profileId = await db.profile
          .get('Id')
          .create({ Bio: 'bio', user: { create: userData } });

        const updated = await db.profile
          .selectAll()
          .find(profileId)
          .update({
            user: {
              create: { ...userData, Name: 'created' },
            },
          });

        const user = await db.profile.queryRelated('user', updated);
        expect(user?.Name).toBe('created');
      });

      it('should create new related record and update foreignKey in batch update', async () => {
        const UserId = await db.user.get('Id').create(userData);
        const profileIds = await db.profile.pluck('Id').createMany([
          { ...profileData, UserId },
          { ...profileData, UserId },
        ]);

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
          ['Id'],
        );

        const data = {
          user: {
            create: userData,
          },
        };

        it('should invoke callbacks', async () => {
          const UserId = await db.user.get('Id').create(userData);
          const Id = await db.profile
            .get('Id')
            .create({ ...profileData, UserId });

          await db.profile.find(Id).update(data);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(
            [{ Id: expect.any(Number), UserKey: 'key' }],
            expect.any(Db),
          );
        });

        it('should invoke callbacks in a batch update', async () => {
          const UserId = await db.user.get('Id').create(userData);
          const ids = await db.profile.pluck('Id').createMany([
            { ...profileData, UserId },
            { ...profileData, UserId },
          ]);

          resetMocks();

          await db.profile.where({ Id: { in: ids } }).update(data);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(
            [{ Id: expect.any(Number), UserKey: 'key' }],
            expect.any(Db),
          );
        });
      });
    });
  });

  describe('not required belongsTo', () => {
    class UserTable extends BaseTable {
      readonly table = 'user';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        Name: t.name('name').text(),
        Password: t.name('password').text(),
      }));
    }

    class ProfileTable extends BaseTable {
      readonly table = 'profile';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        UserId: t.name('user_id').integer().nullable(),
      }));

      relations = {
        user: this.belongsTo(() => UserTable, {
          columns: ['UserId'],
          references: ['Id'],
        }),
      };
    }

    const db = orchidORM(ormParams, {
      user: UserTable,
      profile: ProfileTable,
    });

    it('should query related record and get `undefined`', async () => {
      const user = await db.profile.queryRelated('user', { UserId: 123 });
      assertType<
        typeof user,
        { Id: number; Name: string; Password: string } | undefined
      >();

      expect(user).toBe(undefined);
    });

    it('should be selectable', async () => {
      const id = await db.profile
        .get('Id')
        .create({ ...profileData, UserId: null });

      const result = await db.profile.select('Id', {
        user: (q) => q.user,
      });

      expect(result).toEqual([
        {
          Id: id,
          user: null,
        },
      ]);
    });
  });

  it('should be supported in a `where` callback', () => {
    const q = db.profile.where((q) =>
      q.user.whereIn('Name', ['a', 'b']).count().equals(1),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT ${profileSelectAll} FROM "profile" WHERE (
          SELECT count(*) = $1
          FROM "user"
          WHERE "user"."name" IN ($2, $3)
            AND "user"."id" = "profile"."user_id"
            AND "user"."user_key" = "profile"."profile_key"
        )
      `,
      [1, 'a', 'b'],
    );
  });

  it('should have a proper argument type in `create` when the table has 2+ `belongsTo` relations', () => {
    class Table extends BaseTable {
      readonly table = 'a';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        bId: t.integer(),
        cId: t.integer(),
      }));

      relations = {
        b: this.belongsTo(() => Table, {
          required: true,
          columns: ['bId'],
          references: ['id'],
        }),

        c: this.belongsTo(() => Table, {
          required: true,
          columns: ['cId'],
          references: ['id'],
        }),
      };
    }

    const db = orchidORM(ormParams, { a: Table });

    // @ts-expect-error cId or c is required
    db.a.create({
      bId: 1,
    });

    db.a.create({
      bId: 1,
      cId: 1,
    });

    // @ts-expect-error cId or c is required
    db.a.create({
      b: {
        create: {
          bId: 1,
          cId: 1,
        },
      },
    });

    db.a.create({
      b: {
        create: {
          bId: 1,
          cId: 1,
        },
      },
      c: {
        create: {
          bId: 1,
          cId: 1,
        },
      },
    });

    db.a.create({
      b: {
        create: {
          bId: 1,
          cId: 1,
        },
      },
      cId: 1,
    });
  });
});
