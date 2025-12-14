import { Db, Query, NotFoundError, omit } from 'pqb';
import {
  messageSelectAll,
  profileSelectAll,
  useRelationCallback,
  userRowToJSON,
  userSelectAll,
  useTestORM,
} from '../test-utils/orm.test-utils';
import { orchidORMWithAdapter } from '../orm';
import {
  BaseTable,
  db,
  Profile,
  User,
  assertType,
  expectSql,
  MessageData,
  ChatData,
  ProfileData,
  UserData,
  TestAdapter,
  TestTransactionAdapter,
} from 'test-utils';
import { createBaseTable } from '../baseTable';

const ormParams = { db: db.$qb };

const activeUserData = { ...UserData, Active: true };

let querySpies: jest.SpyInstance[] | undefined;
const useQueryCounter = () => {
  querySpies = [
    jest.spyOn(TestAdapter.prototype, 'query'),
    jest.spyOn(TestAdapter.prototype, 'arrays'),
    jest.spyOn(TestTransactionAdapter.prototype, 'query'),
    jest.spyOn(TestTransactionAdapter.prototype, 'arrays'),
  ];

  beforeEach(resetQueriesCount);
};

const resetQueriesCount = () => querySpies?.forEach((spy) => spy.mockClear());

const getQueriesCount = () => {
  if (!querySpies) {
    throw new Error('Must use useQueryCounter');
  }

  return querySpies.reduce((acc, spy) => acc + spy.mock.calls.length, 0);
};

describe('belongsTo', () => {
  useTestORM();
  useQueryCounter();

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

    const db = orchidORMWithAdapter(ormParams, {
      user: UserTable,
      profile: ProfileTable,
    });
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
    describe('queryRelated', () => {
      it('should query related data', async () => {
        const user = await db.user.create(UserData);
        const profile = await db.profile.create({
          ...ProfileData,
          UserId: user.Id,
        });

        const q = db.profile.queryRelated('user', profile);

        expectSql(
          q.toSQL(),
          `
            SELECT ${userSelectAll} FROM "user"
            WHERE "user"."id" = $1
              AND "user"."user_key" = $2
          `,
          [user.Id, 'key'],
        );

        const loaded = await q;
        expect(loaded).toMatchObject(user);
      });

      it('should query related data using `on`', async () => {
        const user = await db.user.create(activeUserData);
        const profile = await db.profile.create({
          ...ProfileData,
          UserId: user.Id,
        });

        const q = db.profile.queryRelated('activeUser', profile);

        expectSql(
          q.toSQL(),
          `
            SELECT ${userSelectAll} FROM "user" "activeUser"
            WHERE "activeUser"."active" = $1
              AND "activeUser"."id" = $2
              AND "activeUser"."user_key" = $3
          `,
          [true, user.Id, 'key'],
        );

        const loaded = await q;
        expect(loaded).toMatchObject(user);
      });
    });

    it('should have proper joinQuery', () => {
      expectSql(
        (
          db.profile.relations.user.joinQuery(
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

    describe('whereExists', () => {
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

      it('should be supported in whereExists using `on`', () => {
        expectSql(
          db.profile
            .as('p')
            .whereExists((q) => q.activeUser.where({ Name: 'name' }))
            .toSQL(),
          `
            SELECT ${profileSelectAll} FROM "profile" "p"
            WHERE EXISTS (
              SELECT 1 FROM "user"  "activeUser"
              WHERE "activeUser"."active" = $1
                AND "activeUser"."name" = $2
                AND "activeUser"."id" = "p"."user_id"
                AND "activeUser"."user_key" = "p"."profile_key"
            )
          `,
          [true, 'name'],
        );

        expectSql(
          db.profile
            .as('p')
            .whereExists('activeUser', (q) =>
              q.where({ 'activeUser.Name': 'name' }),
            )
            .toSQL(),
          `
            SELECT ${profileSelectAll} FROM "profile" "p"
            WHERE EXISTS (
              SELECT 1 FROM "user"  "activeUser"
              WHERE "activeUser"."active" = $1
                AND "activeUser"."id" = "p"."user_id"
                AND "activeUser"."user_key" = "p"."profile_key"
                AND "activeUser"."name" = $2
            )
          `,
          [true, 'name'],
        );
      });

      it('should support nested whereExists using `on`', () => {
        expectSql(
          db.message
            .as('m')
            .whereExists((q) =>
              q.activeSender.whereExists('profile', (q) =>
                q.where({ Bio: 'bio' }),
              ),
            )
            .toSQL(),
          `
              SELECT ${messageSelectAll} FROM "message" "m"
              WHERE (EXISTS (
                SELECT 1 FROM "user"  "activeSender"
                WHERE "activeSender"."active" = $1
                  AND EXISTS (
                    SELECT 1 FROM "profile"
                    WHERE "profile"."user_id" = "activeSender"."id"
                      AND "profile"."profile_key" = "activeSender"."user_key"
                      AND "profile"."bio" = $2
                  )
                  AND "activeSender"."id" = "m"."author_id"
                  AND "activeSender"."user_key" = "m"."message_key"
              ))
                AND ("m"."deleted_at" IS NULL)
            `,
          [true, 'bio'],
        );

        expectSql(
          db.message
            .as('m')
            .whereExists('activeSender', (q) =>
              q.whereExists('activeProfile', (q) =>
                q.where({ 'activeProfile.Bio': 'bio' }),
              ),
            )
            .toSQL(),
          `
              SELECT ${messageSelectAll} FROM "message" "m"
              WHERE (EXISTS (
                SELECT 1 FROM "user"  "activeSender"
                WHERE "activeSender"."active" = $1
                  AND "activeSender"."id" = "m"."author_id"
                  AND "activeSender"."user_key" = "m"."message_key"
                  AND EXISTS (
                    SELECT 1 FROM "profile"  "activeProfile"
                    WHERE "activeProfile"."active" = $2
                      AND "activeProfile"."user_id" = "activeSender"."id"
                      AND "activeProfile"."profile_key" = "activeSender"."user_key"
                      AND "activeProfile"."bio" = $3
                  )
              ))
                AND ("m"."deleted_at" IS NULL)
            `,
          [true, true, 'bio'],
        );
      });
    });

    describe('join', () => {
      it('should be supported in join', () => {
        const q = db.profile
          .as('p')
          .join('user', (q) => q.where({ Name: 'name' }))
          .select('Bio', 'user.Name');

        assertType<Awaited<typeof q>, { Bio: string | null; Name: string }[]>();

        expectSql(
          q.toSQL(),
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

      it('should be supported in join using `on`', () => {
        const q = db.profile
          .as('p')
          .join('activeUser', (q) => q.where({ Name: 'name' }))
          .select('Bio', 'activeUser.Name');

        assertType<Awaited<typeof q>, { Bio: string | null; Name: string }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "p"."bio" "Bio", "activeUser"."name" "Name"
            FROM "profile" "p"
            JOIN "user"  "activeUser"
              ON "activeUser"."active" = $1
             AND "activeUser"."id" = "p"."user_id"
             AND "activeUser"."user_key" = "p"."profile_key"
             AND "activeUser"."name" = $2
          `,
          [true, 'name'],
        );
      });

      it('should be supported in join with a callback', () => {
        const q = db.profile
          .as('p')
          .join(
            (q) => q.user.as('u').where({ Age: 20 }),
            (q) => q.where({ Name: 'name' }),
          )
          .select('Bio', 'u.Name');

        assertType<Awaited<typeof q>, { Bio: string | null; Name: string }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "p"."bio" "Bio", "u"."name" "Name"
            FROM "profile" "p"
            JOIN "user"  "u"
              ON "u"."name" = $1
             AND "u"."age" = $2
             AND "u"."id" = "p"."user_id"
             AND "u"."user_key" = "p"."profile_key"
          `,
          ['name', 20],
        );
      });

      it('should be supported in join with a callback using `on`', () => {
        const q = db.profile
          .as('p')
          .join(
            (q) => q.activeUser.as('u').where({ Age: 20 }),
            (q) => q.where({ Name: 'name' }),
          )
          .select('Bio', 'u.Name');

        assertType<Awaited<typeof q>, { Bio: string | null; Name: string }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "p"."bio" "Bio", "u"."name" "Name"
            FROM "profile" "p"
            JOIN "user"  "u"
              ON "u"."name" = $1
             AND "u"."active" = $2
             AND "u"."age" = $3
             AND "u"."id" = "p"."user_id"
             AND "u"."user_key" = "p"."profile_key"
          `,
          ['name', true, 20],
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
            SELECT "profile"."bio" "Bio", ${userRowToJSON('u')} "u"
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

      it('should be supported in joinLateral using `on`', () => {
        const q = db.profile
          .joinLateral('activeUser', (q) => q.as('u').where({ Name: 'one' }))
          .where({ 'u.Name': 'two' })
          .select('Bio', 'u.*');

        assertType<Awaited<typeof q>, { Bio: string | null; u: User }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "profile"."bio" "Bio", ${userRowToJSON('u')} "u"
            FROM "profile"
            JOIN LATERAL (
              SELECT ${userSelectAll}
              FROM "user" "u"
              WHERE "u"."active" = $1
                AND "u"."name" = $2
                AND "u"."id" = "profile"."user_id"
                AND "u"."user_key" = "profile"."profile_key"
            ) "u" ON true
            WHERE "u"."Name" = $3
          `,
          [true, 'one', 'two'],
        );
      });
    });

    describe('select', () => {
      it('should be selectable', () => {
        const q = db.profile
          .as('p')
          .select('Id', {
            user: (q) => q.user.select('Id', 'Name').where({ Name: 'name' }),
          })
          .order('user.Name');

        assertType<
          Awaited<typeof q>,
          { Id: number; user: { Id: number; Name: string } | undefined }[]
        >();

        expectSql(
          q.toSQL(),
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

      it('should be selectable using `on`', () => {
        const q = db.profile
          .as('p')
          .select('Id', {
            user: (q) =>
              q.activeUser.select('Id', 'Name').where({ Name: 'name' }),
          })
          .order('user.Name');

        assertType<
          Awaited<typeof q>,
          { Id: number; user: { Id: number; Name: string } | undefined }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              row_to_json("user".*) "user"
            FROM "profile" "p"
            LEFT JOIN LATERAL (
              SELECT "activeUser"."id" "Id", "activeUser"."name" "Name"
              FROM "user" "activeUser"
              WHERE "activeUser"."active" = $1
                AND "activeUser"."name" = $2
                AND "activeUser"."id" = "p"."user_id"
                AND "activeUser"."user_key" = "p"."profile_key"
              ) "user" ON true
            ORDER BY "user"."Name" ASC
          `,
          [true, 'name'],
        );
      });

      it('should support join() for inner join', () => {
        const q = db.profile.as('p').select('Id', {
          u: (q) => q.user.join().select('Id'),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              row_to_json("u".*) "u"
            FROM "profile" "p"
            JOIN LATERAL (
              SELECT "user"."id" "Id"
              FROM "user"
              WHERE "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
            ) "u" ON true
          `,
        );
      });

      it('should handle exists sub query', () => {
        const q = db.profile.as('p').select('Id', {
          hasUser: (q) => q.user.exists(),
        });

        assertType<Awaited<typeof q>, { Id: number; hasUser: boolean }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              COALESCE("hasUser"."hasUser", false) "hasUser"
            FROM "profile" "p"
            LEFT JOIN LATERAL (
              SELECT true "hasUser"
              FROM "user"
              WHERE "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
            ) "hasUser" ON true
          `,
        );
      });

      it('should handle exists sub query using `on`', () => {
        const q = db.profile.as('p').select('Id', {
          hasUser: (q) => q.activeUser.exists(),
        });

        assertType<Awaited<typeof q>, { Id: number; hasUser: boolean }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              COALESCE("hasUser"."hasUser", false) "hasUser"
            FROM "profile" "p"
            LEFT JOIN LATERAL (
              SELECT true "hasUser"
              FROM "user" "activeUser"
              WHERE "activeUser"."active" = $1
                AND "activeUser"."id" = "p"."user_id"
                AND "activeUser"."user_key" = "p"."profile_key"
            ) "hasUser" ON true
          `,
          [true],
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
                SELECT ${userRowToJSON('user2')} "user"
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

      it('should support recurring select using `on`', () => {
        const q = db.profile.select({
          activeUser: (q) =>
            q.activeUser.select({
              profile: (q) =>
                q.profile
                  .select({
                    activeUser: (q) => q.activeUser,
                  })
                  .where({ 'activeUser.Name': 'name' }),
            }),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT row_to_json("activeUser".*) "activeUser"
            FROM "profile"
            LEFT JOIN LATERAL (
              SELECT row_to_json("profile2".*) "profile"
              FROM "user" "activeUser"
              LEFT JOIN LATERAL (
                SELECT ${userRowToJSON('activeUser2')} "activeUser"
                FROM "profile" "profile2"
                LEFT JOIN LATERAL (
                  SELECT ${userSelectAll}
                  FROM "user" "activeUser2"
                  WHERE "activeUser2"."active" = $1
                    AND "activeUser2"."id" = "profile2"."user_id"
                    AND "activeUser2"."user_key" = "profile2"."profile_key"
                ) "activeUser2" ON true
                WHERE "activeUser2"."Name" = $2
                  AND "profile2"."user_id" = "activeUser"."id"
                  AND "profile2"."profile_key" = "activeUser"."user_key"
              ) "profile2" ON true
              WHERE "activeUser"."active" = $3
                AND "activeUser"."id" = "profile"."user_id"
                AND "activeUser"."user_key" = "profile"."profile_key"
            ) "activeUser" ON true
          `,
          [true, 'name', true],
        );
      });
    });
  });

  describe('create', () => {
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

      activeSender(params: {
        AuthorId: number;
        Name: string;
        Active?: boolean;
      }) {
        return this.sender({ ...params, Active: true });
      },
    };

    describe('nested create', () => {
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

        await assert.message({
          messageId: first.Id,
          ChatId: first.ChatId,
          AuthorId: first.AuthorId,
          Text: 'message 1',
        });
        await assert.chat({ ChatId: first.ChatId, Title: 'chat 1' });
        await assert.sender({ AuthorId: first.AuthorId, Name: 'user 1' });

        await assert.message({
          messageId: second.Id,
          ChatId: second.ChatId,
          AuthorId: second.AuthorId,
          Text: 'message 2',
        });
        await assert.chat({ ChatId: second.ChatId, Title: 'chat 2' });
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

        await assert.message({
          messageId: first.Id,
          ChatId: first.ChatId,
          AuthorId: first.AuthorId,
          Text: 'message 1',
        });
        await assert.activeChat({ ChatId: first.ChatId, Title: 'chat 1' });
        await assert.activeSender({ AuthorId: first.AuthorId, Name: 'user 1' });

        await assert.message({
          messageId: second.Id,
          ChatId: second.ChatId,
          AuthorId: second.AuthorId,
          Text: 'message 2',
        });
        await assert.activeChat({ ChatId: second.ChatId, Title: 'chat 2' });
        await assert.activeSender({
          AuthorId: second.AuthorId,
          Name: 'user 2',
        });
      });

      it('should support nested create with a value from `with`', () => {
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
              INSERT INTO "user"("name", "user_key", "password", "updated_at", "created_at")
              VALUES ($1, $2, $3, $4, $5)
              RETURNING ${userSelectAll}
            ),
            "profile" AS (
              INSERT INTO "profile"("bio", "profile_key", "updated_at", "created_at", "user_id")
              VALUES (
                $6, $7, $8, $9,
                (
                  SELECT "user"."Id" FROM "user" LIMIT 1
                )
              )
              RETURNING ${profileSelectAll}
            )
            SELECT * FROM "profile"
          `,
          [...Object.values(UserData), ...Object.values(ProfileData)],
        );
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
              Active: t.name('active').boolean().nullable(),
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
            create: ChatData,
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

        await assert.message({
          messageId: first.Id,
          ChatId: first.ChatId,
          AuthorId: first.AuthorId,
          Text: 'message 1',
        });
        await assert.chat({ ChatId: first.ChatId, Title: 'chat 1' });
        await assert.sender({ AuthorId: first.AuthorId, Name: 'user 1' });

        await assert.message({
          messageId: second.Id,
          ChatId: second.ChatId,
          AuthorId: second.AuthorId,
          Text: 'message 2',
        });
        await assert.chat({ ChatId: second.ChatId, Title: 'chat 2' });
        await assert.sender({ AuthorId: second.AuthorId, Name: 'user 2' });
      });

      it('should not connect in batch create if `on` condition does not match', async () => {
        await db.chat.create(ChatData);
        await db.user.create(UserData);

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

        expect(res).toEqual(expect.any(NotFoundError));
      });
    });

    describe('connectOrCreate', () => {
      it('should support connect or create', async () => {
        const chat = await db.chat.select('IdOfChat').create({
          ...ChatData,
          Title: 'chat',
        });

        const q = db.message.select('Id', 'ChatId', 'AuthorId').create({
          updatedAt: MessageData.updatedAt,
          createdAt: MessageData.createdAt,
          Text: 'message',
          chat: testData.createOrConnectMessageChat(),
          sender: testData.createOrConnectMessageSender(),
        });

        const { Id: messageId, ChatId, AuthorId } = await q;

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

        const q = await db.message.select('Id', 'ChatId', 'AuthorId').create({
          updatedAt: MessageData.updatedAt,
          createdAt: MessageData.createdAt,
          Text: 'message',
          activeChat: testData.createOrConnectMessageChat(),
          activeSender: testData.createOrConnectMessageSender(),
        });

        const { Id: messageId, ChatId, AuthorId } = await q;

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

        const q = await db.message
          .select('Id', 'ChatId', 'AuthorId')
          .createMany([
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

        expect(first.ChatId).toBe(chat.IdOfChat);
        expect(second.AuthorId).toBe(user.Id);

        await assert.message({
          messageId: first.Id,
          ChatId: first.ChatId,
          AuthorId: first.AuthorId,
          Text: 'message 1',
        });
        await assert.chat({ ChatId: first.ChatId, Title: 'chat 1' });
        await assert.sender({ AuthorId: first.AuthorId, Name: 'user 1' });

        await assert.message({
          messageId: second.Id,
          ChatId: second.ChatId,
          AuthorId: second.AuthorId,
          Text: 'message 2',
        });
        await assert.chat({ ChatId: second.ChatId, Title: 'chat 2' });
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

        const q = await db.message
          .select('Id', 'ChatId', 'AuthorId')
          .createMany([
            {
              updatedAt: MessageData.updatedAt,
              createdAt: MessageData.createdAt,
              Text: 'message',
              activeChat: testData.createOrConnectMessageChat(),
              activeSender: testData.createOrConnectMessageSender(),
            },
          ]);

        const [{ Id: messageId, ChatId, AuthorId }] = await q;

        expect(ChatId).toBe(activeChat.IdOfChat);
        expect(AuthorId).not.toBe(user.Id);

        await assert.message({ messageId, ChatId, AuthorId, Text: 'message' });
        await assert.chat({ ChatId, Title: 'chat' });
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
          .create({ Bio: 'bio', user: { create: UserData } });

        const profile = await db.profile
          .select('UserId')
          .find(id)
          .update({
            Bio: 'string',
            user: { disconnect: true },
          });

        expect(profile.UserId).toBe(null);
      });

      it('should nullify even if `on` condition does not match, the will of disconnect prevails over `on`', async () => {
        const id = await db.profile
          .get('Id')
          .create({ Bio: 'bio', user: { create: UserData } });

        const profile = await db.profile
          .select('UserId')
          .find(id)
          .update({
            Bio: 'string',
            activeUser: { disconnect: true },
          });

        expect(profile.UserId).toBe(null);
      });

      it('should nullify foreignKey in batch update using `on`', async () => {
        const ids = await db.profile.pluck('Id').createMany([
          { Bio: 'bio', user: { create: UserData } },
          { Bio: 'bio', user: { create: UserData } },
        ]);

        const userIds = await db.profile
          .pluck('UserId')
          .where({ Id: { in: ids } })
          .update({
            Bio: 'string',
            activeUser: { disconnect: true },
          });

        expect(userIds).toEqual([null, null]);
      });
    });

    describe('set', () => {
      it('should set foreignKey of current record with provided primaryKey', async () => {
        const firstUserId = await db.user.get('Id').create(UserData);
        const id = await db.profile
          .get('Id')
          .create({ ...ProfileData, UserId: firstUserId });
        const user = await db.user.select('Id').create(UserData);

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

      it('should fail to set when `on` condition does not match', async () => {
        const firstUserId = await db.user.get('Id').create(UserData);
        const id = await db.profile
          .get('Id')
          .create({ ...ProfileData, UserId: firstUserId });
        const user = await db.user.select('Id').create(UserData);

        const q = db.profile.find(id).update({
          activeUser: {
            set: user,
          },
        });

        const res = await q.catch((err) => err);

        expect(res).toEqual(expect.any(NotFoundError));
      });

      it('should set foreignKey of current record from found related record', async () => {
        const firstUserId = await db.user.get('Id').create(UserData);
        const id = await db.profile
          .get('Id')
          .create({ ...ProfileData, UserId: firstUserId });
        const user = await db.user.select('Id').create({
          ...UserData,
          Name: 'user',
        });

        const profile = await db.profile
          .select('UserId')
          .find(id)
          .update({
            user: {
              set: { Name: 'user' },
            },
          });

        expect(profile.UserId).toBe(user.Id);
      });

      it('should fail to set foreignKey of current record from found record if `on` condition does not match', async () => {
        const firstUserId = await db.user.get('Id').create(UserData);
        const id = await db.profile
          .get('Id')
          .create({ ...ProfileData, UserId: firstUserId });
        await db.user.select('Id').create({
          ...UserData,
          Name: 'user',
        });

        const q = db.profile.find(id).update({
          activeUser: {
            set: { Name: 'user' },
          },
        });

        const res = await q.catch((err) => err);

        expect(res).toEqual(expect.any(NotFoundError));
      });

      it('should set foreignKey of current record with provided primaryKey in batch update', async () => {
        const UserId = await db.user.get('Id').create(UserData);
        const profileIds = await db.profile.pluck('Id').createMany([
          { ...ProfileData, UserId },
          { ...ProfileData, UserId },
        ]);
        const user = await db.user.select('Id').create(UserData);

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

      it('should fail to set foreignKey of current record in a batch update when `on` condition does not match', async () => {
        const UserId = await db.user.get('Id').create(UserData);
        const profileIds = await db.profile.pluck('Id').createMany([
          { ...ProfileData, UserId },
          { ...ProfileData, UserId },
        ]);
        const user = await db.user.select('Id').create(UserData);

        const q = db.profile.where({ Id: { in: profileIds } }).update({
          activeUser: {
            set: user,
          },
        });

        const res = await q.catch((err) => err);

        expect(res).toEqual(expect.any(NotFoundError));
      });

      it('should set foreignKey of current record from found related record in batch update', async () => {
        const firstUserId = await db.user.get('Id').create(UserData);
        const profileIds = await db.profile.pluck('Id').createMany([
          { ...ProfileData, UserId: firstUserId },
          { ...ProfileData, UserId: firstUserId },
        ]);
        const user = await db.user.select('Id').create({
          ...UserData,
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

      it('should fail to set foreignKey of current record in a batch update when `on` condition does not match', async () => {
        const firstUserId = await db.user.get('Id').create(UserData);
        const profileIds = await db.profile.pluck('Id').createMany([
          { ...ProfileData, UserId: firstUserId },
          { ...ProfileData, UserId: firstUserId },
        ]);
        await db.user.select('Id').create({
          ...UserData,
          Name: 'user',
        });

        const q = db.profile.where({ Id: { in: profileIds } }).update({
          activeUser: {
            set: { Name: 'user' },
          },
        });

        const res = await q.catch((err) => err);
        expect(res).toEqual(expect.any(NotFoundError));
      });
    });

    describe('delete', () => {
      it('should nullify foreignKey and delete related record', async () => {
        const { Id, UserId } = await db.profile
          .select('Id', 'UserId')
          .create({ Bio: 'bio', user: { create: UserData } });

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

      it('should nullify but not delete related record when `on` condition does not match', async () => {
        const { Id, UserId } = await db.profile
          .select('Id', 'UserId')
          .create({ Bio: 'bio', user: { create: UserData } });

        const profile = await db.profile
          .select('UserId')
          .find(Id)
          .update({
            activeUser: {
              delete: true,
            },
          });

        expect(profile.UserId).toBe(null);

        const exists = await db.user.findByOptional({ Id: UserId }).exists();
        expect(exists).toBe(true);
      });

      it('should nullify foreignKey and delete related record in batch update', async () => {
        const user = await db.user.selectAll().create(UserData);
        const profileIds = await db.profile.pluck('Id').createMany([
          { ...ProfileData, UserId: user.Id },
          { ...ProfileData, UserId: user.Id },
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

      it('should nullify but not delete related record in batch update when `on` condition does not match', async () => {
        const user = await db.user.selectAll().create(UserData);
        const profileIds = await db.profile.pluck('Id').createMany([
          { ...ProfileData, UserId: user.Id, Active: true },
          { ...ProfileData, UserId: user.Id },
        ]);

        const updatedUserIds = await db.profile
          .pluck('UserId')
          .where({ Id: { in: profileIds } })
          .update({
            activeUser: {
              delete: true,
            },
          });

        expect(updatedUserIds).toEqual([null, null]);

        const exists = await db.user.findOptional(user.Id).exists();
        expect(exists).toBe(true);
      });

      describe('relation callbacks', () => {
        const { beforeDelete, afterDelete, resetMocks } = useRelationCallback(
          db.profile.relations.user,
          ['Id'],
        );

        const profileWithUserData = {
          Bio: 'bio',
          user: {
            create: UserData,
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
          .create({ Bio: 'bio', user: { create: UserData } });

        const updated = await db.profile.find(Id).update({
          user: {
            update: {
              Name: 'new name',
            },
          },
        });

        expect(updated).toBe(1);

        const user = await db.user.findBy({ Id: UserId });
        expect(user.Name).toBe('new name');
      });

      it('should not update related records when `on` condition does not match', async () => {
        const { Id, UserId } = await db.profile
          .select('Id', 'UserId')
          .create({ Bio: 'bio', user: { create: UserData } });

        const count = await db.profile.find(Id).update({
          activeUser: {
            update: {
              Name: 'new name',
            },
          },
        });

        expect(count).toBe(1);

        const user = await db.user.findBy({ Id: UserId });
        expect(user.Name).toBe(UserData.Name);
      });

      it('should update related records in batch update', async () => {
        const profiles = await db.profile.select('Id', 'UserId').createMany([
          { Bio: 'bio', user: { create: UserData } },
          { Bio: 'bio', user: { create: UserData } },
        ]);

        const count = await db.profile
          .where({ Id: { in: profiles.map((profile) => profile.Id) } })
          .update({
            user: {
              update: {
                Name: 'new name',
              },
            },
          });

        expect(count).toBe(2);

        const updatedNames = await db.user.pluck('Name').where({
          Id: { in: profiles.map((profile) => profile.UserId) },
        });
        expect(updatedNames).toEqual(['new name', 'new name']);
      });

      it('should update only matching by `on` condition records in a batch update', async () => {
        const profiles = await db.profile.select('Id', 'UserId').createMany([
          { Bio: 'bio', user: { create: { ...UserData, Active: true } } },
          { Bio: 'bio', user: { create: UserData } },
        ]);

        const count = await db.profile
          .where({ Id: { in: profiles.map((profile) => profile.Id) } })
          .update({
            activeUser: {
              update: {
                Name: 'new name',
              },
            },
          });

        expect(count).toBe(2);

        const updatedNames = await db.user
          .pluck('Name')
          .where({
            Id: { in: profiles.map((profile) => profile.UserId) },
          })
          .order('Id');

        expect(updatedNames).toEqual(['new name', UserData.Name]);
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
          db.profile.relations.user,
          ['Id'],
        );

        const profileWithUserData = {
          Bio: 'bio',
          user: {
            create: UserData,
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

          const count = await db.profile.find(Id).update(data);

          expect(count).toBe(1);
          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toBeCalledWith([{ Id: UserId }], expect.any(Db));
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          const profiles = await db.profile
            .select('Id', 'UserId')
            .createMany([profileWithUserData, profileWithUserData]);

          const count = await db.profile
            .where({ Id: { in: profiles.map((p) => p.Id) } })
            .update(data);

          expect(count).toBe(2);
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
            create: UserData,
          },
        });

        const count = await db.profile.find(profile.Id).update({
          user: {
            upsert: {
              update: {
                Name: 'updated',
              },
              create: UserData,
            },
          },
        });

        expect(count).toBe(1);

        const user = await db.profile.queryRelated('user', profile);
        expect(user?.Name).toBe('updated');
      });

      it('should create related record if it does not exist', async () => {
        const profile = await db.profile.create(ProfileData);

        const count = await db.profile.find(profile.Id).update({
          user: {
            upsert: {
              update: {
                Name: 'updated',
              },
              create: {
                ...UserData,
                Name: 'created',
              },
            },
          },
        });
        expect(count).toBe(1);

        const profiles = await db.profile.select('*', { user: (q) => q.user });
        expect(profiles).toMatchObject([
          {
            Id: profile.Id,
            user: { Name: 'created' },
          },
        ]);
      });

      it('should create related record if it does not exist with a data from a callback', async () => {
        const profile = await db.profile.create(ProfileData);

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
                  ...UserData,
                  Name: 'created',
                }),
              },
            },
          });

        const user = await db.profile.queryRelated('user', updated);
        expect(user?.Name).toBe('created');
      });

      it('should create a related record when `on` condition does not match for the update', async () => {
        const profile = await db.profile.create({
          Bio: 'bio',
          user: {
            create: UserData,
          },
        });

        const updated = await db.profile
          .selectAll()
          .find(profile.Id)
          .update({
            activeUser: {
              upsert: {
                update: {
                  Name: 'updated',
                },
                create: {
                  ...UserData,
                  Name: 'created',
                },
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
                  ...UserData,
                  Name: 'created',
                },
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
        } = useRelationCallback(db.profile.relations.user, ['Id']);

        const data = {
          user: {
            upsert: {
              update: {
                Name: 'new name',
              },
              create: UserData,
            },
          },
        };

        it('should invoke update callbacks when updating', async () => {
          const { Id, UserId } = await db.profile
            .select('Id', 'UserId')
            .create({
              Bio: 'bio',
              user: {
                create: UserData,
              },
            });

          resetMocks();

          const count = await db.profile.find(Id).update(data);

          expect(count).toBe(1);
          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toBeCalledWith([{ Id: UserId }], expect.any(Db));
          expect(beforeCreate).not.toBeCalled();
          expect(afterCreate).not.toBeCalled();
        });

        it('should invoke create callbacks when creating', async () => {
          resetMocks();

          const Id = await db.profile.get('Id').create(ProfileData);

          const count = await db.profile.find(Id).update(data);

          expect(count).toBe(1);
          expect(beforeUpdate).toHaveBeenCalledTimes(0);
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
          .create({ Bio: 'bio', user: { create: UserData } });

        const updated = await db.profile
          .selectAll()
          .find(profileId)
          .update({
            user: {
              create: { ...UserData, Name: 'created' },
            },
          });

        const user = await db.profile.queryRelated('user', updated);
        expect(user?.Name).toBe('created');
      });

      it('should create new related record using `on` conditions and update foreignKey', async () => {
        const profileId = await db.profile
          .get('Id')
          .create({ Bio: 'bio', user: { create: UserData } });

        const updated = await db.profile
          .selectAll()
          .find(profileId)
          .update({
            activeUser: {
              create: { ...UserData, Name: 'created' },
            },
          });

        const user = await db.profile.queryRelated('user', updated);
        expect(user).toMatchObject({ Name: 'created', Active: true });
      });

      it('should create a new related record and update foreignKey in batch update', async () => {
        const UserId = await db.user.get('Id').create(UserData);
        const profileIds = await db.profile.pluck('Id').createMany([
          { ...ProfileData, UserId },
          { ...ProfileData, UserId },
        ]);

        const updatedUserIds = await db.profile
          .pluck('UserId')
          .where({ Id: { in: profileIds } })
          .update({
            user: {
              create: { ...UserData, Name: 'created' },
            },
          });

        expect(updatedUserIds[0]).toBe(updatedUserIds[1]);

        const user = await db.user.find(updatedUserIds[0] as number);
        expect(user.Name).toBe('created');
      });

      it('should create a new related record with `on` conditions and update foreignKey in batch update', async () => {
        const UserId = await db.user.get('Id').create(UserData);
        const profileIds = await db.profile.pluck('Id').createMany([
          { ...ProfileData, UserId },
          { ...ProfileData, UserId },
        ]);

        const updatedUserIds = await db.profile
          .pluck('UserId')
          .where({ Id: { in: profileIds } })
          .update({
            activeUser: {
              create: { ...UserData, Name: 'created' },
            },
          });

        expect(updatedUserIds[0]).toBe(updatedUserIds[1]);

        const user = await db.user.find(updatedUserIds[0] as number);
        expect(user).toMatchObject({ Name: 'created', Active: true });
      });

      describe('relation callbacks', () => {
        const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
          db.profile.relations.user,
          ['Id'],
        );

        const data = {
          user: {
            create: UserData,
          },
        };

        it('should invoke callbacks', async () => {
          const UserId = await db.user.get('Id').create(UserData);
          const Id = await db.profile
            .get('Id')
            .create({ ...ProfileData, UserId });

          const count = await db.profile.find(Id).update(data);

          expect(count).toBe(1);
          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(
            [{ Id: expect.any(Number), UserKey: 'key' }],
            expect.any(Db),
          );
        });

        it('should invoke callbacks in a batch update', async () => {
          const UserId = await db.user.get('Id').create(UserData);
          const ids = await db.profile.pluck('Id').createMany([
            { ...ProfileData, UserId },
            { ...ProfileData, UserId },
          ]);

          resetMocks();

          const count = await db.profile
            .where({ Id: { in: ids } })
            .update(data);

          expect(count).toBe(2);
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

    const db = orchidORMWithAdapter(ormParams, {
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
        .create({ ...ProfileData, UserId: null });

      const result = await db.profile.select('Id', {
        user: (q) => q.user,
      });

      assertType<
        typeof result,
        {
          Id: number;
          user: { Id: number; Name: string; Password: string } | undefined;
        }[]
      >();

      expect(result).toEqual([
        {
          Id: id,
          user: undefined,
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

    const db = orchidORMWithAdapter(ormParams, { a: Table });

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
