import { Query } from 'pqb';
import {
  messageSelectAll,
  useTestORM,
  messageRowToJSON,
  messageJSONBuildObject,
  userRowToJSON,
} from '../../test-utils/orm.test-utils';
import { orchidORMWithAdapter } from '../../orm-instance/orm-instance';
import {
  Message,
  db,
  assertType,
  expectSql,
  MessageData,
  ChatData,
  UserData,
  UserSelectAll,
} from 'test-utils';
import { createTableFactory } from '../../orm-table/table';

const ormParams = {
  db: db.$qb,
};

const activeMessageData = { ...MessageData, Active: true };

describe('hasMany', () => {
  useTestORM();

  it('should define foreign keys under autoForeignKeys option', () => {
    const { defineTable } = createTableFactory({
      autoForeignKeys: {
        onUpdate: 'CASCADE',
      },
    });

    const UserTable = defineTable('user', (t) => ({
      Id: t.name('id').identity().primaryKey(),
    })).relations((user) => ({
      user: user('Id').hasMany(() => ProfileTable('UserId')),
      user2: user('Id')
        .hasMany(() => ProfileTable('UserId2'))
        .foreignKey(false),
      user3: user('Id')
        .hasMany(() => ProfileTable('UserId3'))
        .foreignKey({ onDelete: 'CASCADE' }),
    }));

    const ProfileTable = defineTable('profile', (t) => ({
      Id: t.name('id').identity().primaryKey(),
      UserId: t.name('user_id').integer(),
      UserId2: t.name('user_id_2').integer(),
      UserId3: t.name('user_id_3').integer(),
    }));

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

  describe('queryRelated', () => {
    it('should query related records', async () => {
      const userId = await db.user.get('Id').create(UserData);
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);

      await db.message.createMany([
        { ...MessageData, AuthorId: userId, ChatId },
        { ...MessageData, AuthorId: userId, ChatId },
      ]);

      const user = await db.user.find(userId);
      const q = db.user.queryRelated('messages', user);

      expectSql(
        q.toSQL(),
        `
          SELECT ${messageSelectAll} FROM "schema"."message" "messages"
          WHERE ("messages"."author_id" = $1
            AND "messages"."message_key" = $2)
            AND ("messages"."deleted_at" IS NULL)
        `,
        [userId, 'key'],
      );

      const messages = await q;

      expect(messages).toMatchObject([MessageData, MessageData]);
    });

    it('should query related records using `on`', async () => {
      const userId = await db.user.get('Id').create(UserData);
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);

      await db.message.createMany([
        { ...MessageData, AuthorId: userId, ChatId },
        { ...activeMessageData, AuthorId: userId, ChatId },
      ]);

      const user = await db.user.find(userId);
      const q = db.user.queryRelated('activeMessages', user);

      expectSql(
        q.toSQL(),
        `
          SELECT ${messageSelectAll} FROM "schema"."message" "activeMessages"
          WHERE ("activeMessages"."active" = $1
            AND "activeMessages"."author_id" = $2
            AND "activeMessages"."message_key" = $3)
            AND ("activeMessages"."deleted_at" IS NULL)
        `,
        [true, userId, 'key'],
      );

      const messages = await q;

      expect(messages).toMatchObject([activeMessageData]);
    });

    it('should have create with defaults of provided id', () => {
      const user = { Id: 1, UserKey: 'key' };
      const q = db.user.queryRelated('messages', user).insert({
        ChatId: 2,
        Text: 'text',
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."message" AS "messages"("author_id", "message_key", "chat_id", "text")
          VALUES ($1, $2, $3, $4)
        `,
        [1, 'key', 2, 'text'],
      );
    });

    it('should have create with defaults of provided id using `on`', () => {
      const user = { Id: 1, UserKey: 'key' };
      const q = db.user.queryRelated('activeMessages', user).insert({
        ChatId: 2,
        Text: 'text',
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."message" AS "activeMessages"("active", "author_id", "message_key", "chat_id", "text")
          VALUES ($1, $2, $3, $4, $5)
        `,
        [true, 1, 'key', 2, 'text'],
      );
    });
  });

  it('should be supported in whereExists', () => {
    expectSql(
      db.user.whereExists('messages').toSQL(),
      `
        SELECT ${UserSelectAll} FROM "schema"."user" "User"
        WHERE EXISTS (
          SELECT 1 FROM "schema"."message" "messages"
          WHERE ("messages"."author_id" = "User"."id"
            AND "messages"."message_key" = "User"."user_key")
            AND ("messages"."deleted_at" IS NULL)
        )
      `,
    );

    expectSql(
      db.user
        .as('u')
        .whereExists((q) => q.messages.where({ Text: 'text' }))
        .toSQL(),
      `
        SELECT ${UserSelectAll} FROM "schema"."user" "u"
        WHERE EXISTS (
          SELECT 1 FROM "schema"."message" "messages"
          WHERE ("messages"."text" = $1
            AND "messages"."author_id" = "u"."id"
            AND "messages"."message_key" = "u"."user_key")
            AND ("messages"."deleted_at" IS NULL)
        )
      `,
      ['text'],
    );

    expectSql(
      db.user
        .as('u')
        .whereExists('messages', (q) => q.where({ 'messages.Text': 'text' }))
        .toSQL(),
      `
        SELECT ${UserSelectAll} FROM "schema"."user" "u"
        WHERE EXISTS (
          SELECT 1 FROM "schema"."message" "messages"
          WHERE ("messages"."author_id" = "u"."id"
            AND "messages"."message_key" = "u"."user_key"
            AND "messages"."text" = $1)
            AND ("messages"."deleted_at" IS NULL)
        )
      `,
      ['text'],
    );
  });

  it('should be supported in whereExists', () => {
    expectSql(
      db.user.whereExists('activeMessages').toSQL(),
      `
        SELECT ${UserSelectAll} FROM "schema"."user" "User"
        WHERE EXISTS (
          SELECT 1 FROM "schema"."message" "activeMessages"
          WHERE ("activeMessages"."active" = $1
            AND "activeMessages"."author_id" = "User"."id"
            AND "activeMessages"."message_key" = "User"."user_key")
            AND ("activeMessages"."deleted_at" IS NULL)
        )
      `,
      [true],
    );

    expectSql(
      db.user
        .as('u')
        .whereExists((q) => q.activeMessages.where({ Text: 'text' }))
        .toSQL(),
      `
        SELECT ${UserSelectAll} FROM "schema"."user" "u"
        WHERE EXISTS (
          SELECT 1 FROM "schema"."message" "activeMessages"
          WHERE ("activeMessages"."active" = $1
            AND "activeMessages"."text" = $2
            AND "activeMessages"."author_id" = "u"."id"
            AND "activeMessages"."message_key" = "u"."user_key")
            AND ("activeMessages"."deleted_at" IS NULL)
        )
      `,
      [true, 'text'],
    );

    expectSql(
      db.user
        .as('u')
        .whereExists('activeMessages', (q) =>
          q.where({ 'activeMessages.Text': 'text' }),
        )
        .toSQL(),
      `
        SELECT ${UserSelectAll} FROM "schema"."user" "u"
        WHERE EXISTS (
          SELECT 1 FROM "schema"."message" "activeMessages"
          WHERE ("activeMessages"."active" = $1
            AND "activeMessages"."author_id" = "u"."id"
            AND "activeMessages"."message_key" = "u"."user_key"
            AND "activeMessages"."text" = $2)
            AND ("activeMessages"."deleted_at" IS NULL)
        )
      `,
      [true, 'text'],
    );
  });

  it('should support nested where with exists', () => {
    // @ts-expect-error sub query must return a boolean
    db.user.where((q) => q.messages);

    const q = db.user.where((q) => q.messages.exists());

    expectSql(
      q.toSQL(),
      `
        SELECT ${UserSelectAll}
        FROM "schema"."user" "User"
        WHERE (
          SELECT true
          FROM "schema"."message" "messages"
          WHERE ("messages"."author_id" = "User"."id"
            AND "messages"."message_key" = "User"."user_key")
            AND ("messages"."deleted_at" IS NULL)
          LIMIT 1
        )
      `,
    );
  });

  it('should support nested where with exists using `on`', () => {
    const q = db.user.where((q) => q.activeMessages.exists());

    expectSql(
      q.toSQL(),
      `
        SELECT ${UserSelectAll}
        FROM "schema"."user" "User"
        WHERE (
          SELECT true
          FROM "schema"."message" "activeMessages"
          WHERE ("activeMessages"."active" = $1
            AND "activeMessages"."author_id" = "User"."id"
            AND "activeMessages"."message_key" = "User"."user_key")
            AND ("activeMessages"."deleted_at" IS NULL)
          LIMIT 1
        )
      `,
      [true],
    );
  });

  it('should have proper joinQuery', () => {
    expectSql(
      (
        db.user.relations.messages.joinQuery(
          db.message.as('m'),
          db.user.as('u'),
        ) as Query
      ).toSQL(),
      `
        SELECT ${messageSelectAll} FROM "schema"."message" "m"
        WHERE ("m"."author_id" = "u"."id"
          AND "m"."message_key" = "u"."user_key")
          AND ("m"."deleted_at" IS NULL)
      `,
    );
  });

  describe('join', () => {
    it('should be supported in join', () => {
      const q = db.user
        .as('u')
        .join('messages', (q) => q.where({ Text: 'text' }))
        .select('Name', 'messages.Text');

      assertType<Awaited<typeof q>, { Name: string; Text: string }[]>();

      expectSql(
        q.toSQL(),
        `
        SELECT "u"."name" "Name", "messages"."text" "Text"
        FROM "schema"."user" "u"
        JOIN "schema"."message" "messages"
          ON ("messages"."author_id" = "u"."id"
         AND "messages"."message_key" = "u"."user_key"
         AND "messages"."text" = $1)
         AND ("messages"."deleted_at" IS NULL)
      `,
        ['text'],
      );
    });

    it('should be supported in join using `on`', () => {
      const q = db.user
        .as('u')
        .join('activeMessages', (q) => q.where({ Text: 'text' }))
        .select('Name', 'activeMessages.Text');

      assertType<Awaited<typeof q>, { Name: string; Text: string }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "u"."name" "Name", "activeMessages"."text" "Text"
          FROM "schema"."user" "u"
          JOIN "schema"."message" "activeMessages"
            ON ("activeMessages"."active" = $1
           AND "activeMessages"."author_id" = "u"."id"
           AND "activeMessages"."message_key" = "u"."user_key"
           AND "activeMessages"."text" = $2)
           AND ("activeMessages"."deleted_at" IS NULL)
        `,
        [true, 'text'],
      );
    });

    it('should be supported in join with a callback', () => {
      const q = db.user
        .as('u')
        .join(
          (q) => q.messages.as('m').where({ ChatId: 123 }),
          (q) => q.where({ Text: 'text' }),
        )
        .select('Name', 'm.Text');

      assertType<Awaited<typeof q>, { Name: string; Text: string }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "u"."name" "Name", "m"."text" "Text"
          FROM "schema"."user" "u"
          JOIN "schema"."message" "m"
            ON "m"."text" = $1
           AND ("m"."chat_id" = $2
           AND "m"."author_id" = "u"."id"
           AND "m"."message_key" = "u"."user_key")
           AND ("m"."deleted_at" IS NULL)
        `,
        ['text', 123],
      );
    });

    it('should be supported in join with a callback using `on`', () => {
      const q = db.user
        .as('u')
        .join(
          (q) => q.activeMessages.as('m').where({ ChatId: 123 }),
          (q) => q.where({ Text: 'text' }),
        )
        .select('Name', 'm.Text');

      assertType<Awaited<typeof q>, { Name: string; Text: string }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "u"."name" "Name", "m"."text" "Text"
          FROM "schema"."user" "u"
          JOIN "schema"."message" "m"
            ON "m"."text" = $1
           AND ("m"."active" = $2
           AND "m"."chat_id" = $3
           AND "m"."author_id" = "u"."id"
           AND "m"."message_key" = "u"."user_key")
           AND ("m"."deleted_at" IS NULL)
        `,
        ['text', true, 123],
      );
    });

    it('should be supported in joinLateral', () => {
      const q = db.user
        .joinLateral('messages', (q) => q.as('m').where({ Text: 'one' }))
        .where({ 'm.Text': 'two' })
        .select('Name', { message: 'm.*' });

      assertType<Awaited<typeof q>, { Name: string; message: Message }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."name" "Name", ${messageRowToJSON('m')} "message"
          FROM "schema"."user" "User"
          JOIN LATERAL (
            SELECT ${messageSelectAll}
            FROM "schema"."message" "m"
            WHERE ("m"."text" = $1
              AND "m"."author_id" = "User"."id"
              AND "m"."message_key" = "User"."user_key")
              AND ("m"."deleted_at" IS NULL)
          ) "m" ON true
          WHERE "m"."Text" = $2
        `,
        ['one', 'two'],
      );
    });

    it('should be supported in joinLateral', () => {
      const q = db.user
        .joinLateral('activeMessages', (q) => q.as('m').where({ Text: 'one' }))
        .where({ 'm.Text': 'two' })
        .select('Name', { message: 'm.*' });

      assertType<Awaited<typeof q>, { Name: string; message: Message }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."name" "Name", ${messageRowToJSON('m')} "message"
          FROM "schema"."user" "User"
          JOIN LATERAL (
            SELECT ${messageSelectAll}
            FROM "schema"."message" "m"
            WHERE ("m"."active" = $1
              AND "m"."text" = $2
              AND "m"."author_id" = "User"."id"
              AND "m"."message_key" = "User"."user_key")
              AND ("m"."deleted_at" IS NULL)
          ) "m" ON true
          WHERE "m"."Text" = $3
        `,
        [true, 'one', 'two'],
      );
    });
  });

  describe('select', () => {
    it('should be selectable', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const AuthorId = await db.user.get('Id').create(UserData);
      const messageId = await db.message.get('Id').create({
        ChatId,
        AuthorId,
        ...MessageData,
      });

      const q = db.user.as('u').select('Id', {
        messages: (q) => q.messages.where({ Text: 'text' }),
      });

      const result = await q;
      expect(result).toEqual([
        {
          Id: AuthorId,
          messages: [
            {
              Id: messageId,
              AuthorId,
              ChatId,
              Decimal: null,
              DeletedAt: null,
              Active: null,
              ...MessageData,
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            },
          ],
        },
      ]);

      assertType<Awaited<typeof q>, { Id: number; messages: Message[] }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("messages"."messages", '[]') "messages"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg(${messageJSONBuildObject('t')}) "messages"
            FROM (
              SELECT ${messageSelectAll}
              FROM "schema"."message" "messages"
              WHERE ("messages"."text" = $1
                AND "messages"."author_id" = "u"."id"
                AND "messages"."message_key" = "u"."user_key")
                AND ("messages"."deleted_at" IS NULL)
            ) "t"
          ) "messages" ON true
        `,
        ['text'],
      );
    });

    it('should be selectable using `on`', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const AuthorId = await db.user.get('Id').create(UserData);
      const messageId = await db.message.get('Id').create({
        ChatId,
        AuthorId,
        ...activeMessageData,
      });

      const q = db.user.as('u').select('Id', {
        messages: (q) => q.activeMessages.where({ Text: 'text' }),
      });

      const result = await q;
      expect(result).toEqual([
        {
          Id: AuthorId,
          messages: [
            {
              Id: messageId,
              AuthorId,
              ChatId,
              Decimal: null,
              DeletedAt: null,
              ...activeMessageData,
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            },
          ],
        },
      ]);

      assertType<Awaited<typeof q>, { Id: number; messages: Message[] }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("messages"."messages", '[]') "messages"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg(${messageJSONBuildObject('t')}) "messages"
            FROM (
              SELECT ${messageSelectAll}
              FROM "schema"."message" "activeMessages"
              WHERE ("activeMessages"."active" = $1
                AND "activeMessages"."text" = $2
                AND "activeMessages"."author_id" = "u"."id"
                AND "activeMessages"."message_key" = "u"."user_key")
                AND ("activeMessages"."deleted_at" IS NULL)
            ) "t"
          ) "messages" ON true
        `,
        [true, 'text'],
      );
    });

    it('should support require() for inner join', () => {
      const q = db.user.as('u').select('Id', {
        p: (q) => q.posts.require().select('Id'),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT "u"."id" "Id", "p"."p" "p"
          FROM "schema"."user" "u"
          JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) "p"
            FROM (
              SELECT "posts"."id" "Id"
              FROM "schema"."post" "posts"
              WHERE "posts"."user_id" = "u"."id"
                AND "posts"."title" = "u"."user_key"
            ) "t"
          ) "p" ON "p"."p" IS NOT NULL
        `,
      );
    });

    it('should allow to select count', () => {
      const q = db.user.as('u').select('Id', {
        messagesCount: (q) => q.messages.count(),
      });

      assertType<Awaited<typeof q>, { Id: number; messagesCount: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            "messagesCount"."messagesCount" "messagesCount"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT count(*) "messagesCount"
            FROM "schema"."message" "messages"
            WHERE ("messages"."author_id" = "u"."id"
              AND "messages"."message_key" = "u"."user_key")
              AND ("messages"."deleted_at" IS NULL)
          ) "messagesCount" ON true
        `,
      );
    });

    it('should allow to select count using `on`', () => {
      const q = db.user.as('u').select('Id', {
        messagesCount: (q) => q.activeMessages.count(),
      });

      assertType<Awaited<typeof q>, { Id: number; messagesCount: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            "messagesCount"."messagesCount" "messagesCount"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT count(*) "messagesCount"
            FROM "schema"."message" "activeMessages"
            WHERE ("activeMessages"."active" = $1
              AND "activeMessages"."author_id" = "u"."id"
              AND "activeMessages"."message_key" = "u"."user_key")
              AND ("activeMessages"."deleted_at" IS NULL)
          ) "messagesCount" ON true
        `,
        [true],
      );
    });

    it('should allow to pluck values', () => {
      const q = db.user.as('u').select('Id', {
        texts: (q) => q.messages.pluck('Text'),
      });

      assertType<Awaited<typeof q>, { Id: number; texts: string[] }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("texts"."texts", '[]') "texts"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg("t"."Text") "texts"
            FROM (
              SELECT "messages"."text" "Text"
              FROM "schema"."message" "messages"
              WHERE ("messages"."author_id" = "u"."id"
                AND "messages"."message_key" = "u"."user_key")
                AND ("messages"."deleted_at" IS NULL)
            ) "t"
          ) "texts" ON true
        `,
      );
    });

    it('should allow to pluck values', () => {
      const q = db.user.as('u').select('Id', {
        texts: (q) => q.activeMessages.pluck('Text'),
      });

      assertType<Awaited<typeof q>, { Id: number; texts: string[] }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("texts"."texts", '[]') "texts"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg("t"."Text") "texts"
            FROM (
              SELECT "activeMessages"."text" "Text"
              FROM "schema"."message" "activeMessages"
              WHERE ("activeMessages"."active" = $1
                AND "activeMessages"."author_id" = "u"."id"
                AND "activeMessages"."message_key" = "u"."user_key")
                AND ("activeMessages"."deleted_at" IS NULL)
            ) "t"
          ) "texts" ON true
        `,
        [true],
      );
    });

    it('should handle exists sub query', () => {
      const q = db.user.as('u').select('Id', {
        hasMessages: (q) => q.messages.exists(),
      });

      assertType<Awaited<typeof q>, { Id: number; hasMessages: boolean }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("hasMessages"."hasMessages", false) "hasMessages"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT true "hasMessages"
            FROM "schema"."message" "messages"
            WHERE ("messages"."author_id" = "u"."id"
              AND "messages"."message_key" = "u"."user_key")
              AND ("messages"."deleted_at" IS NULL)
            LIMIT 1
          ) "hasMessages" ON true
        `,
      );
    });

    it('should handle exists sub query using `on`', () => {
      const q = db.user.as('u').select('Id', {
        hasMessages: (q) => q.activeMessages.exists(),
      });

      assertType<Awaited<typeof q>, { Id: number; hasMessages: boolean }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("hasMessages"."hasMessages", false) "hasMessages"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT true "hasMessages"
            FROM "schema"."message" "activeMessages"
            WHERE ("activeMessages"."active" = $1
              AND "activeMessages"."author_id" = "u"."id"
              AND "activeMessages"."message_key" = "u"."user_key")
              AND ("activeMessages"."deleted_at" IS NULL)
            LIMIT 1
          ) "hasMessages" ON true
        `,
        [true],
      );
    });

    it('should support recurring select', () => {
      const q = db.user.as('sender').select({
        messages: (q) =>
          q.messages.select({
            sender: (q) =>
              q.sender.select({
                messages: (q) => q.messages,
              }),
          }),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("messages"."messages", '[]') "messages"
          FROM "schema"."user" "sender"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) "messages"
            FROM (
              SELECT ${userRowToJSON('sender2')} "sender"
              FROM "schema"."message" "messages"
              LEFT JOIN LATERAL (
                SELECT COALESCE("messages2"."messages", '[]') "messages"
                FROM "schema"."user" "sender2"
                LEFT JOIN LATERAL (
                  SELECT json_agg(${messageJSONBuildObject('t')}) "messages"
                  FROM (
                    SELECT ${messageSelectAll}
                    FROM "schema"."message" "messages2"
                    WHERE ("messages2"."author_id" = "sender2"."id"
                      AND "messages2"."message_key" = "sender2"."user_key")
                      AND ("messages2"."deleted_at" IS NULL)
                  ) "t"
                ) "messages2" ON true
                WHERE "sender2"."id" = "messages"."author_id"
                  AND "sender2"."user_key" = "messages"."message_key"
              ) "sender2" ON true
              WHERE ("messages"."author_id" = "sender"."id"
                AND "messages"."message_key" = "sender"."user_key")
                AND ("messages"."deleted_at" IS NULL)
            ) "t"
          ) "messages" ON true
        `,
      );
    });

    it('should support recurring select using `on`', () => {
      const q = db.user.as('activeSender').select({
        activeMessages: (q) =>
          q.activeMessages.select({
            activeSender: (q) =>
              q.activeSender.select({
                activeMessages: (q) => q.activeMessages,
              }),
          }),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("activeMessages"."activeMessages", '[]') "activeMessages"
          FROM "schema"."user" "activeSender"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) "activeMessages"
            FROM (
              SELECT ${userRowToJSON('activeSender2')} "activeSender"
              FROM "schema"."message" "activeMessages"
              LEFT JOIN LATERAL (
                SELECT COALESCE("activeMessages2"."activeMessages", '[]') "activeMessages"
                FROM "schema"."user" "activeSender2"
                LEFT JOIN LATERAL (
                  SELECT json_agg(${messageJSONBuildObject(
                    't',
                  )}) "activeMessages"
                  FROM (
                    SELECT ${messageSelectAll}
                    FROM "schema"."message" "activeMessages2"
                    WHERE ("activeMessages2"."active" = $1
                      AND "activeMessages2"."author_id" = "activeSender2"."id"
                      AND "activeMessages2"."message_key" = "activeSender2"."user_key")
                      AND ("activeMessages2"."deleted_at" IS NULL)
                  ) "t"
                ) "activeMessages2" ON true
                WHERE "activeSender2"."active" = $2
                  AND "activeSender2"."id" = "activeMessages"."author_id"
                  AND "activeSender2"."user_key" = "activeMessages"."message_key"
              ) "activeSender2" ON true
              WHERE ("activeMessages"."active" = $3
                AND "activeMessages"."author_id" = "activeSender"."id"
                AND "activeMessages"."message_key" = "activeSender"."user_key")
                AND ("activeMessages"."deleted_at" IS NULL)
            ) "t"
          ) "activeMessages" ON true
        `,
        [true, true, true],
      );
    });
  });

  it('should be supported in a `where` callback', () => {
    const q = db.user.where((q) =>
      q.messages.whereIn('Text', ['a', 'b']).count().equals(10),
    );

    expectSql(
      q.toSQL(),
      `
          SELECT ${UserSelectAll} FROM "schema"."user" "User" WHERE (
            SELECT count(*) = $1
            FROM "schema"."message" "messages"
            WHERE ("messages"."text" IN ($2, $3)
              AND "messages"."author_id" = "User"."id"
              AND "messages"."message_key" = "User"."user_key")
              AND ("messages"."deleted_at" IS NULL)
          )
        `,
      [10, 'a', 'b'],
    );
  });

  it('should be supported in a `where` callback using `on`', () => {
    const q = db.user.where((q) =>
      q.activeMessages.whereIn('Text', ['a', 'b']).count().equals(10),
    );

    expectSql(
      q.toSQL(),
      `
          SELECT ${UserSelectAll} FROM "schema"."user" "User" WHERE (
            SELECT count(*) = $1
            FROM "schema"."message" "activeMessages"
            WHERE ("activeMessages"."active" = $2
              AND "activeMessages"."text" IN ($3, $4)
              AND "activeMessages"."author_id" = "User"."id"
              AND "activeMessages"."message_key" = "User"."user_key")
              AND ("activeMessages"."deleted_at" IS NULL)
          )
        `,
      [10, true, 'a', 'b'],
    );
  });
});
