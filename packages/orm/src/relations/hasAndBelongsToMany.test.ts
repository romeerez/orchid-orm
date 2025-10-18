import { Db, Query } from 'pqb';
import {
  chatSelectAll,
  useRelationCallback,
  userSelectAll,
  useTestORM,
} from '../test-utils/orm.test-utils';
import { omit, RecordUnknown } from 'orchid-core';
import {
  Chat,
  db,
  User,
  assertType,
  expectSql,
  now,
  TestTransactionAdapter,
  ChatData,
  UserData,
} from 'test-utils';
import { createBaseTable } from '../baseTable';
import { orchidORMWithAdapter } from '../orm';

const ormParams = {
  db: db.$qb,
};

const activeChatData = { ...ChatData, Active: true };

describe('hasAndBelongsToMany', () => {
  useTestORM();

  it('should define foreign keys under autoForeignKeys option', () => {
    const BaseTable = createBaseTable({
      autoForeignKeys: {
        onUpdate: 'CASCADE',
      },
    });

    class PostTable extends BaseTable {
      table = 'post';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
      }));

      relations = {
        tags: this.hasAndBelongsToMany(() => TagTable, {
          columns: ['Id'],
          references: ['PostId'],
          through: {
            table: 'postTags',
            columns: ['TagId'],
            references: ['Id'],
          },
        }),
        tags2: this.hasAndBelongsToMany(() => TagTable, {
          columns: ['Id'],
          references: ['PostId2'],
          foreignKey: false,
          through: {
            table: 'postTags',
            columns: ['TagId2'],
            references: ['Id'],
            foreignKey: false,
          },
        }),
        tags3: this.hasAndBelongsToMany(() => TagTable, {
          columns: ['Id'],
          references: ['PostId3'],
          foreignKey: {
            onDelete: 'CASCADE',
          },
          through: {
            table: 'postTags',
            columns: ['TagId3'],
            references: ['Id'],
            foreignKey: {
              onDelete: 'CASCADE',
            },
          },
        }),
      };
    }

    class TagTable extends BaseTable {
      table = 'tag';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
      }));
    }

    const db = orchidORMWithAdapter(ormParams, {
      post: PostTable,
      tag: TagTable,
    });
    expect(
      ((db.post.shape as RecordUnknown).tags as { joinTable: Query }).joinTable
        .internal.tableData.constraints,
    ).toEqual([
      {
        references: {
          columns: ['PostId'],
          fnOrTable: 'post',
          foreignColumns: ['Id'],
          options: { onUpdate: 'CASCADE' },
        },
      },
      {
        references: {
          columns: ['TagId'],
          fnOrTable: 'tag',
          foreignColumns: ['Id'],
          options: { onUpdate: 'CASCADE' },
        },
      },
      {
        references: {
          columns: ['PostId3'],
          fnOrTable: 'post',
          foreignColumns: ['Id'],
          options: { onDelete: 'CASCADE' },
        },
      },
      {
        references: {
          columns: ['TagId3'],
          fnOrTable: 'tag',
          foreignColumns: ['Id'],
          options: { onDelete: 'CASCADE' },
        },
      },
    ]);
  });

  describe('queryRelated', () => {
    it('should query related data', async () => {
      const userId = await db.user.get('Id').create({
        ...UserData,
        chats: {
          create: [ChatData, ChatData],
        },
      });

      const user = await db.user.find(userId);
      const q = db.user.queryRelated('chats', user);

      expectSql(
        q.toSQL(),
        `
          SELECT ${chatSelectAll} FROM "chat" "chats"
          WHERE EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
              AND "chatUser"."chat_key" = "chats"."chat_key"
              AND "chatUser"."user_id" = $1
              AND "chatUser"."user_key" = $2
          )
        `,
        [userId, 'key'],
      );

      const messages = await q;

      expect(messages).toMatchObject([ChatData, ChatData]);
    });

    it('should query related data using `on`', async () => {
      const userId = await db.user.get('Id').create({
        ...UserData,
        activeChats: {
          create: [ChatData, ChatData],
        },
      });

      const user = await db.user.find(userId);
      const q = db.user.queryRelated('activeChats', user);

      expectSql(
        q.toSQL(),
        `
          SELECT ${chatSelectAll} FROM "chat" "activeChats"
          WHERE "activeChats"."active" = $1
            AND EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                AND "chatUser"."chat_key" = "activeChats"."chat_key"
                AND "chatUser"."user_id" = $2
                AND "chatUser"."user_key" = $3
            )
        `,
        [true, userId, 'key'],
      );

      const messages = await q;

      expect(messages).toMatchObject([ChatData, ChatData]);
    });
  });

  it('should have proper joinQuery', () => {
    expectSql(
      (
        db.user.relations.chats.joinQuery(
          db.chat.as('c'),
          db.user.as('u'),
        ) as Query
      ).toSQL(),
      `
        SELECT ${chatSelectAll} FROM "chat" "c"
        WHERE EXISTS (
          SELECT 1 FROM "chatUser"
          WHERE "chatUser"."chat_id" = "c"."id_of_chat"
            AND "chatUser"."chat_key" = "c"."chat_key"
            AND "chatUser"."user_id" = "u"."id"
            AND "chatUser"."user_key" = "u"."user_key"
        )
      `,
    );
  });

  describe('whereExists', () => {
    it('should support whereExists', () => {
      expectSql(
        db.user.whereExists('chats').toSQL(),
        `
          SELECT ${userSelectAll} FROM "user"
          WHERE EXISTS (
            SELECT 1 FROM "chat"  "chats"
            WHERE EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                AND "chatUser"."chat_key" = "chats"."chat_key"
                AND "chatUser"."user_id" = "user"."id"
                AND "chatUser"."user_key" = "user"."user_key"
            )
          )
        `,
      );

      expectSql(
        db.user
          .as('u')
          .whereExists((q) => q.chats.where({ Title: 'title' }))
          .toSQL(),
        `
          SELECT ${userSelectAll} FROM "user" "u"
          WHERE EXISTS (
            SELECT 1 FROM "chat"  "chats"
            WHERE "chats"."title" = $1
              AND EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                  AND "chatUser"."chat_key" = "chats"."chat_key"
                  AND "chatUser"."user_id" = "u"."id"
                  AND "chatUser"."user_key" = "u"."user_key"
              )
          )
        `,
        ['title'],
      );

      expectSql(
        db.user
          .as('u')
          .whereExists('chats', (q) => q.where({ 'chats.Title': 'title' }))
          .toSQL(),
        `
          SELECT ${userSelectAll} FROM "user" "u"
          WHERE EXISTS (
            SELECT 1 FROM "chat"  "chats"
            WHERE
              EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                  AND "chatUser"."chat_key" = "chats"."chat_key"
                  AND "chatUser"."user_id" = "u"."id"
                  AND "chatUser"."user_key" = "u"."user_key"
              )
              AND "chats"."title" = $1
          )
        `,
        ['title'],
      );
    });

    it('should support whereExists using `on`', () => {
      expectSql(
        db.user.whereExists('activeChats').toSQL(),
        `
          SELECT ${userSelectAll} FROM "user"
          WHERE EXISTS (
            SELECT 1 FROM "chat"  "activeChats"
            WHERE "activeChats"."active" = $1
              AND EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                AND "chatUser"."chat_key" = "activeChats"."chat_key"
                AND "chatUser"."user_id" = "user"."id"
                AND "chatUser"."user_key" = "user"."user_key"
            )
          )
        `,
        [true],
      );

      expectSql(
        db.user
          .as('u')
          .whereExists((q) => q.activeChats.where({ Title: 'title' }))
          .toSQL(),
        `
          SELECT ${userSelectAll} FROM "user" "u"
          WHERE EXISTS (
            SELECT 1 FROM "chat"  "activeChats"
            WHERE "activeChats"."active" = $1
              AND "activeChats"."title" = $2
              AND EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                AND "chatUser"."chat_key" = "activeChats"."chat_key"
                AND "chatUser"."user_id" = "u"."id"
                AND "chatUser"."user_key" = "u"."user_key"
            )
          )
        `,
        [true, 'title'],
      );

      expectSql(
        db.user
          .as('u')
          .whereExists('activeChats', (q) =>
            q.where({ 'activeChats.Title': 'title' }),
          )
          .toSQL(),
        `
          SELECT ${userSelectAll} FROM "user" "u"
          WHERE EXISTS (
            SELECT 1 FROM "chat"  "activeChats"
            WHERE "activeChats"."active" = $1
              AND EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                  AND "chatUser"."chat_key" = "activeChats"."chat_key"
                  AND "chatUser"."user_id" = "u"."id"
                  AND "chatUser"."user_key" = "u"."user_key"
              )
              AND "activeChats"."title" = $2
          )
        `,
        [true, 'title'],
      );
    });
  });

  describe('join', () => {
    it('should support join', () => {
      const q = db.user
        .as('u')
        .join('chats', (q) => q.where({ Title: 'title' }))
        .select('Name', 'chats.Title');

      assertType<Awaited<typeof q>, { Name: string; Title: string }[]>();

      expectSql(
        q.toSQL(),
        `
        SELECT "u"."name" "Name", "chats"."title" "Title"
        FROM "user" "u"
        JOIN "chat"  "chats"
          ON EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
              AND "chatUser"."chat_key" = "chats"."chat_key"
              AND "chatUser"."user_id" = "u"."id"
              AND "chatUser"."user_key" = "u"."user_key"
          )
          AND "chats"."title" = $1
      `,
        ['title'],
      );
    });

    it('should support join using `on`', () => {
      const q = db.user
        .as('u')
        .join('activeChats', (q) => q.where({ Title: 'title' }))
        .select('Name', 'activeChats.Title');

      assertType<Awaited<typeof q>, { Name: string; Title: string }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "u"."name" "Name", "activeChats"."title" "Title"
          FROM "user" "u"
          JOIN "chat"  "activeChats"
            ON "activeChats"."active" = $1
              AND EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                  AND "chatUser"."chat_key" = "activeChats"."chat_key"
                  AND "chatUser"."user_id" = "u"."id"
                  AND "chatUser"."user_key" = "u"."user_key"
              )
              AND "activeChats"."title" = $2
        `,
        [true, 'title'],
      );
    });

    it('should support join with a callback', () => {
      const now = new Date();

      const q = db.user
        .as('u')
        .join(
          (q) => q.chats.as('c').where({ updatedAt: now }),
          (q) => q.where({ Title: 'title' }),
        )
        .select('Name', 'c.Title');

      assertType<Awaited<typeof q>, { Name: string; Title: string }[]>();

      expectSql(
        q.toSQL(),
        `
        SELECT "u"."name" "Name", "c"."title" "Title"
        FROM "user" "u"
        JOIN "chat"  "c"
          ON "c"."title" = $1
          AND "c"."updated_at" = $2
          AND EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chat_id" = "c"."id_of_chat"
              AND "chatUser"."chat_key" = "c"."chat_key"
              AND "chatUser"."user_id" = "u"."id"
              AND "chatUser"."user_key" = "u"."user_key"
          )
      `,
        ['title', now],
      );
    });

    it('should support join with a callback using `on`', () => {
      const now = new Date();

      const q = db.user
        .as('u')
        .join(
          (q) => q.activeChats.as('c').where({ updatedAt: now }),
          (q) => q.where({ Title: 'title' }),
        )
        .select('Name', 'c.Title');

      assertType<Awaited<typeof q>, { Name: string; Title: string }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "u"."name" "Name", "c"."title" "Title"
          FROM "user" "u"
          JOIN "chat"  "c"
            ON "c"."title" = $1
           AND "c"."active" = $2
           AND "c"."updated_at" = $3
           AND EXISTS (
             SELECT 1 FROM "chatUser"
             WHERE "chatUser"."chat_id" = "c"."id_of_chat"
               AND "chatUser"."chat_key" = "c"."chat_key"
               AND "chatUser"."user_id" = "u"."id"
               AND "chatUser"."user_key" = "u"."user_key"
           )
        `,
        ['title', true, now],
      );
    });

    it('should support joinLateral', () => {
      const q = db.user
        .joinLateral('chats', (q) => q.as('c').where({ Title: 'one' }))
        .where({ 'c.Title': 'two' })
        .select('Name', { chat: 'c.*' });

      assertType<Awaited<typeof q>, { Name: string; chat: Chat }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."name" "Name", row_to_json("c".*) "chat"
          FROM "user"
          JOIN LATERAL (
            SELECT ${chatSelectAll}
            FROM "chat" "c"
            WHERE "c"."title" = $1
              AND EXISTS (
                SELECT 1
                FROM "chatUser"
                WHERE "chatUser"."chat_id" = "c"."id_of_chat"
                  AND "chatUser"."chat_key" = "c"."chat_key"
                  AND "chatUser"."user_id" = "user"."id"
                  AND "chatUser"."user_key" = "user"."user_key"
              )
          ) "c" ON true
          WHERE "c"."Title" = $2
        `,
        ['one', 'two'],
      );
    });

    it('should support joinLateral using `on`', () => {
      const q = db.user
        .joinLateral('activeChats', (q) => q.as('c').where({ Title: 'one' }))
        .where({ 'c.Title': 'two' })
        .select('Name', { chat: 'c.*' });

      assertType<Awaited<typeof q>, { Name: string; chat: Chat }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."name" "Name", row_to_json("c".*) "chat"
          FROM "user"
          JOIN LATERAL (
            SELECT ${chatSelectAll}
            FROM "chat" "c"
            WHERE "c"."active" = $1
              AND "c"."title" = $2
              AND EXISTS (
                SELECT 1
                FROM "chatUser"
                WHERE "chatUser"."chat_id" = "c"."id_of_chat"
                  AND "chatUser"."chat_key" = "c"."chat_key"
                  AND "chatUser"."user_id" = "user"."id"
                  AND "chatUser"."user_key" = "user"."user_key"
              )
          ) "c" ON true
          WHERE "c"."Title" = $3
        `,
        [true, 'one', 'two'],
      );
    });
  });

  describe('select', () => {
    it('should be selectable', () => {
      const q = db.user.as('u').select('Id', {
        chats: (q) =>
          q.chats.select('IdOfChat', 'Title').where({ Title: 'title' }),
      });

      assertType<
        Awaited<typeof q>,
        { Id: number; chats: { IdOfChat: number; Title: string }[] }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("chats".r, '[]') "chats"
          FROM "user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT
                "chats"."id_of_chat" "IdOfChat",
                "chats"."title" "Title"
              FROM "chat" "chats"
              WHERE "chats"."title" = $1
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                    AND "chatUser"."chat_key" = "chats"."chat_key"
                    AND "chatUser"."user_id" = "u"."id"
                    AND "chatUser"."user_key" = "u"."user_key"
                )
            ) "t"
          ) "chats" ON true
        `,
        ['title'],
      );
    });

    it('should be selectable using `on`', () => {
      const q = db.user.as('u').select('Id', {
        chats: (q) =>
          q.activeChats.select('IdOfChat', 'Title').where({ Title: 'title' }),
      });

      assertType<
        Awaited<typeof q>,
        { Id: number; chats: { IdOfChat: number; Title: string }[] }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("chats".r, '[]') "chats"
          FROM "user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT
                "activeChats"."id_of_chat" "IdOfChat",
                "activeChats"."title" "Title"
              FROM "chat" "activeChats"
              WHERE "activeChats"."active" = $1
                AND "activeChats"."title" = $2
                AND EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                  AND "chatUser"."chat_key" = "activeChats"."chat_key"
                  AND "chatUser"."user_id" = "u"."id"
                  AND "chatUser"."user_key" = "u"."user_key"
              )
            ) "t"
          ) "chats" ON true
        `,
        [true, 'title'],
      );
    });

    it('should support join() for inner join', () => {
      const q = db.user.as('u').select('Id', {
        chats: (q) => q.chats.join().select('IdOfChat'),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            "chats".r "chats"
          FROM "user" "u"
          JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT "chats"."id_of_chat" "IdOfChat"
              FROM "chat" "chats"
              WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                  AND "chatUser"."chat_key" = "chats"."chat_key"
                  AND "chatUser"."user_id" = "u"."id"
                  AND "chatUser"."user_key" = "u"."user_key"
              )
            ) "t"
          ) "chats" ON "chats".r IS NOT NULL
        `,
      );
    });

    it('should allow to select count', () => {
      const q = db.user.as('u').select('Id', {
        chatsCount: (q) => q.chats.count(),
      });

      assertType<Awaited<typeof q>, { Id: number; chatsCount: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            "chatsCount".r "chatsCount"
          FROM "user" "u"
          LEFT JOIN LATERAL (
            SELECT count(*) r
            FROM "chat" "chats"
            WHERE EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                AND "chatUser"."chat_key" = "chats"."chat_key"
                AND "chatUser"."user_id" = "u"."id"
                AND "chatUser"."user_key" = "u"."user_key"
            )
          ) "chatsCount" ON true
        `,
      );
    });

    it('should allow to select count using `on`', () => {
      const q = db.user.as('u').select('Id', {
        chatsCount: (q) => q.activeChats.count(),
      });

      assertType<Awaited<typeof q>, { Id: number; chatsCount: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            "chatsCount".r "chatsCount"
          FROM "user" "u"
          LEFT JOIN LATERAL (
            SELECT count(*) r
            FROM "chat" "activeChats"
            WHERE "activeChats"."active" = $1
              AND EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                  AND "chatUser"."chat_key" = "activeChats"."chat_key"
                  AND "chatUser"."user_id" = "u"."id"
                  AND "chatUser"."user_key" = "u"."user_key"
              )
            ) "chatsCount" ON true
        `,
        [true],
      );
    });

    it('should allow to pluck values', () => {
      const q = db.user.as('u').select('Id', {
        titles: (q) => q.chats.pluck('Title'),
      });

      assertType<Awaited<typeof q>, { Id: number; titles: string[] }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("titles".r, '[]') "titles"
          FROM "user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg("t"."Title") r
            FROM (
              SELECT "chats"."title" "Title"
              FROM "chat" "chats"
              WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                  AND "chatUser"."chat_key" = "chats"."chat_key"
                  AND "chatUser"."user_id" = "u"."id"
                  AND "chatUser"."user_key" = "u"."user_key"
              )
            ) "t"
          ) "titles" ON true
        `,
      );
    });

    it('should allow to pluck values using `on`', () => {
      const q = db.user.as('u').select('Id', {
        titles: (q) => q.activeChats.pluck('Title'),
      });

      assertType<Awaited<typeof q>, { Id: number; titles: string[] }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("titles".r, '[]') "titles"
          FROM "user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg("t"."Title") r
            FROM (
                   SELECT "activeChats"."title" "Title"
                   FROM "chat" "activeChats"
                   WHERE "activeChats"."active" = $1
                     AND EXISTS (
                       SELECT 1 FROM "chatUser"
                       WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                         AND "chatUser"."chat_key" = "activeChats"."chat_key"
                         AND "chatUser"."user_id" = "u"."id"
                         AND "chatUser"."user_key" = "u"."user_key"
                     )
                 ) "t"
            ) "titles" ON true
        `,
        [true],
      );
    });

    it('should handle exists sub query', () => {
      const q = db.user.as('u').select('Id', {
        hasChats: (q) => q.chats.exists(),
      });

      assertType<Awaited<typeof q>, { Id: number; hasChats: boolean }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("hasChats".r, false) "hasChats"
          FROM "user" "u"
          LEFT JOIN LATERAL (
            SELECT true r
            FROM "chat" "chats"
            WHERE EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                AND "chatUser"."chat_key" = "chats"."chat_key"
                AND "chatUser"."user_id" = "u"."id"
                AND "chatUser"."user_key" = "u"."user_key"
            )
            LIMIT 1
          ) "hasChats" ON true
        `,
      );
    });

    it('should handle exists sub query using `on`', () => {
      const q = db.user.as('u').select('Id', {
        hasChats: (q) => q.activeChats.exists(),
      });

      assertType<Awaited<typeof q>, { Id: number; hasChats: boolean }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            COALESCE("hasChats".r, false) "hasChats"
          FROM "user" "u"
          LEFT JOIN LATERAL (
            SELECT true r
            FROM "chat" "activeChats"
            WHERE "activeChats"."active" = $1
              AND EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                  AND "chatUser"."chat_key" = "activeChats"."chat_key"
                  AND "chatUser"."user_id" = "u"."id"
                  AND "chatUser"."user_key" = "u"."user_key"
              )
            LIMIT 1
          ) "hasChats" ON true
        `,
        [true],
      );
    });

    it('should support recurring select', () => {
      const q = db.user.select({
        chats: (q) =>
          q.chats.select({
            users: (q) =>
              q.users.select({
                chats: (q) => q.chats,
              }),
          }),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("chats".r, '[]') "chats"
          FROM "user"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT COALESCE("users".r, '[]') "users"
              FROM "chat" "chats"
              LEFT JOIN LATERAL (
                SELECT json_agg(row_to_json(t.*)) r
                FROM (
                  SELECT COALESCE("chats2".r, '[]') "chats"
                  FROM "user" "users"
                  LEFT JOIN LATERAL (
                    SELECT json_agg(row_to_json(t.*)) r
                    FROM (
                      SELECT ${chatSelectAll}
                      FROM "chat" "chats2"
                      WHERE EXISTS (
                        SELECT 1
                        FROM "chatUser"
                        WHERE "chatUser"."chat_id" = "chats2"."id_of_chat"
                          AND "chatUser"."chat_key" = "chats2"."chat_key"
                          AND "chatUser"."user_id" = "users"."id"
                          AND "chatUser"."user_key" = "users"."user_key"
                      )
                    ) "t"
                  ) "chats2" ON true
                  WHERE EXISTS (
                    SELECT 1
                    FROM "chatUser"
                    WHERE "chatUser"."user_id" = "users"."id"
                      AND "chatUser"."user_key" = "users"."user_key"
                      AND "chatUser"."chat_id" = "chats"."id_of_chat"
                      AND "chatUser"."chat_key" = "chats"."chat_key"
                  )
                ) "t"
              ) "users" ON true
              WHERE EXISTS (
                SELECT 1
                FROM "chatUser"
                WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                  AND "chatUser"."chat_key" = "chats"."chat_key"
                  AND "chatUser"."user_id" = "user"."id"
                  AND "chatUser"."user_key" = "user"."user_key"
              )
            ) "t"
          ) "chats" ON true
        `,
      );
    });

    it('should support recurring select using `on`', () => {
      const q = db.user.as('activeUsers').select({
        activeChats: (q) =>
          q.activeChats.select({
            activeUsers: (q) =>
              q.activeUsers.select({
                activeChats: (q) => q.activeChats,
              }),
          }),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("activeChats".r, '[]') "activeChats"
          FROM "user" "activeUsers"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT COALESCE("activeUsers2".r, '[]') "activeUsers"
              FROM "chat" "activeChats"
              LEFT JOIN LATERAL (
                SELECT json_agg(row_to_json(t.*)) r
                FROM (
                  SELECT COALESCE("activeChats2".r, '[]') "activeChats"
                  FROM "user" "activeUsers2"
                  LEFT JOIN LATERAL (
                    SELECT json_agg(row_to_json(t.*)) r
                    FROM (
                      SELECT ${chatSelectAll}
                      FROM "chat" "activeChats2"
                      WHERE "activeChats2"."active" = $1
                        AND EXISTS (
                          SELECT 1
                          FROM "chatUser"
                          WHERE "chatUser"."chat_id" = "activeChats2"."id_of_chat"
                            AND "chatUser"."chat_key" = "activeChats2"."chat_key"
                            AND "chatUser"."user_id" = "activeUsers2"."id"
                            AND "chatUser"."user_key" = "activeUsers2"."user_key"
                        )
                    ) "t"
                  ) "activeChats2" ON true
                  WHERE "activeUsers2"."active" = $2
                    AND EXISTS (
                      SELECT 1
                      FROM "chatUser"
                      WHERE "chatUser"."user_id" = "activeUsers2"."id"
                        AND "chatUser"."user_key" = "activeUsers2"."user_key"
                        AND "chatUser"."chat_id" = "activeChats"."id_of_chat"
                        AND "chatUser"."chat_key" = "activeChats"."chat_key"
                    )
                ) "t"
              ) "activeUsers2" ON true
              WHERE "activeChats"."active" = $3
                AND EXISTS (
                  SELECT 1
                  FROM "chatUser"
                  WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                    AND "chatUser"."chat_key" = "activeChats"."chat_key"
                    AND "chatUser"."user_id" = "activeUsers"."id"
                    AND "chatUser"."user_key" = "activeUsers"."user_key"
                )
            ) "t"
          ) "activeChats" ON true
        `,
        [true, true, true],
      );
    });
  });

  describe('create', () => {
    const assert = {
      user({
        user,
        Name,
        Active = null,
      }: {
        user: User;
        Name: string;
        Active?: boolean | null;
      }) {
        expect(user).toEqual({
          ...omit(UserData, ['Password']),
          Active,
          Age: null,
          Data: null,
          Picture: null,
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

    describe('nested create', () => {
      it('should support create', async () => {
        const q = db.user.select('Id', 'UserKey').create({
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

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TestTransactionAdapter.prototype, 'query');
        const arraysSpy = jest.spyOn(
          TestTransactionAdapter.prototype,
          'arrays',
        );

        const user = await q;
        const chatIds = await db.user
          .queryRelated('chats', user)
          .order('IdOfChat')
          .pluck('IdOfChat');

        const [createUserSqlCall, createChatsSqlCall] = querySpy.mock.calls;
        const createUserSql = {
          text: createUserSqlCall[0],
          values: createUserSqlCall[1],
        };
        const createChatsSql = {
          text: createChatsSqlCall[0],
          values: createChatsSqlCall[1],
        };
        const createChatUserSqlCall = arraysSpy.mock.calls[0];
        const createChatUserSql = {
          text: createChatUserSqlCall[0],
          values: createChatUserSqlCall[1],
        };

        expectSql(
          createUserSql,
          `
          INSERT INTO "user"("name", "user_key", "password", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5)
          RETURNING "user"."id" "Id", "user"."user_key" "UserKey"
        `,
          ['user 1', 'key', 'password', now, now],
        );

        expectSql(
          createChatsSql,
          `
          INSERT INTO "chat"("title", "chat_key", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
          RETURNING "chat"."id_of_chat" "IdOfChat", "chat"."chat_key" "ChatKey"
        `,
          ['chat 1', 'key', now, now, 'chat 2', 'key', now, now],
        );

        expectSql(
          createChatUserSql,
          `
          INSERT INTO "chatUser"("user_id", "user_key", "chat_id", "chat_key")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
        `,
          [
            user.Id,
            'key',
            chatIds[0],
            'key',
            user.Id,
            'key',
            chatIds[1],
            'key',
          ],
        );
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

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TestTransactionAdapter.prototype, 'query');

        const user = await q;
        await db.user
          .queryRelated('chats', user)
          .order('IdOfChat')
          .pluck('IdOfChat');

        const [_, createChatsSqlCall] = querySpy.mock.calls;
        const createChatsSql = {
          text: createChatsSqlCall[0],
          values: createChatsSqlCall[1],
        };

        expectSql(
          createChatsSql,
          `
            INSERT INTO "chat"("active", "title", "chat_key", "updated_at", "created_at")
            VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)
            RETURNING "chat"."id_of_chat" "IdOfChat", "chat"."chat_key" "ChatKey"
          `,
          [true, 'chat 1', 'key', now, now, true, 'chat 2', 'key', now, now],
        );
      });

      it('should support create many', async () => {
        const q = db.user.select('Id').createMany([
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

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TestTransactionAdapter.prototype, 'query');
        const arraysSpy = jest.spyOn(
          TestTransactionAdapter.prototype,
          'arrays',
        );

        const users = await q;
        const chatIds = await db.user.join('chats').pluck('chats.IdOfChat');

        const [createUserSqlCall, createChatsSqlCall] = querySpy.mock.calls;
        const createUserSql = {
          text: createUserSqlCall[0],
          values: createUserSqlCall[1],
        };
        const createChatsSql = {
          text: createChatsSqlCall[0],
          values: createChatsSqlCall[1],
        };
        const createChatUserSqlCall = arraysSpy.mock.calls[0];
        const createChatUserSql = {
          text: createChatUserSqlCall[0],
          values: createChatUserSqlCall[1],
        };

        expectSql(
          createUserSql,
          `
          INSERT INTO "user"("name", "user_key", "password", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)
          RETURNING "user"."id" "Id", "user"."user_key" "UserKey"
        `,
          [
            'user 1',
            'key',
            'password',
            now,
            now,
            'user 2',
            'key',
            'password',
            now,
            now,
          ],
        );

        expectSql(
          createChatsSql,
          `
          INSERT INTO "chat"("title", "chat_key", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12), ($13, $14, $15, $16)
          RETURNING "chat"."id_of_chat" "IdOfChat", "chat"."chat_key" "ChatKey"
        `,
          [
            'chat 1',
            'key',
            now,
            now,
            'chat 2',
            'key',
            now,
            now,
            'chat 3',
            'key',
            now,
            now,
            'chat 4',
            'key',
            now,
            now,
          ],
        );

        expectSql(
          createChatUserSql,
          `
          INSERT INTO "chatUser"("user_id", "user_key", "chat_id", "chat_key")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12), ($13, $14, $15, $16)
        `,
          [
            users[0].Id,
            'key',
            chatIds[0],
            'key',
            users[0].Id,
            'key',
            chatIds[1],
            'key',
            users[1].Id,
            'key',
            chatIds[2],
            'key',
            users[1].Id,
            'key',
            chatIds[3],
            'key',
          ],
        );
      });

      it('should support create many using `on`', async () => {
        const q = db.user.select('Id').createMany([
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

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TestTransactionAdapter.prototype, 'query');

        await q;

        const [, createChatsSqlCall] = querySpy.mock.calls;

        expectSql(
          { text: createChatsSqlCall[0], values: createChatsSqlCall[1] },
          `
          INSERT INTO "chat"("active", "title", "chat_key", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15), ($16, $17, $18, $19, $20)
          RETURNING "chat"."id_of_chat" "IdOfChat", "chat"."chat_key" "ChatKey"
        `,
          [
            true,
            'chat 1',
            'key',
            now,
            now,
            true,
            'chat 2',
            'key',
            now,
            now,
            true,
            'chat 3',
            'key',
            now,
            now,
            true,
            'chat 4',
            'key',
            now,
            now,
          ],
        );
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

          const ids = await db.chat.select('IdOfChat', 'ChatKey');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(ids, expect.any(Db));
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          await db.user.createMany([data, data]);

          const ids = await db.chat.select('IdOfChat', 'ChatKey');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(ids, expect.any(Db));
        });
      });
    });

    describe('nested connect', () => {
      it('should support connect', async () => {
        await db.chat.createMany([
          { ...ChatData, Title: 'chat 1' },
          { ...ChatData, Title: 'chat 2' },
        ]);

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

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TestTransactionAdapter.prototype, 'query');
        const arraysSpy = jest.spyOn(
          TestTransactionAdapter.prototype,
          'arrays',
        );

        const user = await q;
        const chatIds = await db.user
          .queryRelated('chats', user)
          .order('IdOfChat')
          .pluck('IdOfChat');

        const [createUserSqlCall, ...findChatsSqlCalls] = querySpy.mock.calls;
        const createUserSql = {
          text: createUserSqlCall[0],
          values: createUserSqlCall[1],
        };
        const createChatUserSqlCall = arraysSpy.mock.calls[0];
        const createChatUserSql = {
          text: createChatUserSqlCall[0],
          values: createChatUserSqlCall[1],
        };

        expectSql(
          createUserSql,
          `
          INSERT INTO "user"("name", "user_key", "password", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5)
          RETURNING "user"."id" "Id", "user"."user_key" "UserKey"
        `,
          ['user 1', 'key', 'password', now, now],
        );

        expect(findChatsSqlCalls.length).toBe(2);
        findChatsSqlCalls.forEach((call, i) => {
          expectSql(
            { text: call[0], values: call[1] },
            `
            SELECT "chats"."id_of_chat" "IdOfChat", "chats"."chat_key" "ChatKey"
            FROM "chat" "chats"
            WHERE "chats"."title" = $1
            LIMIT 1
          `,
            [`chat ${i + 1}`],
          );
        });

        expectSql(
          createChatUserSql,
          `
          INSERT INTO "chatUser"("user_id", "user_key", "chat_id", "chat_key")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
        `,
          [
            user.Id,
            'key',
            chatIds[0],
            'key',
            user.Id,
            'key',
            chatIds[1],
            'key',
          ],
        );
      });

      it('should fail to connect when `on` condition does not match', async () => {
        await db.chat.createMany([
          { ...ChatData, Title: 'chat 1' },
          { ...activeChatData, Title: 'chat 2' },
        ]);

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
      });

      it('should connect using `on`', async () => {
        const chats = await db.chat.createMany([
          { ...activeChatData, Title: 'chat 1' },
          { ...activeChatData, Title: 'chat 2' },
        ]);

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
        const userChats = await db.user.queryRelated('activeChats', user);

        expect(userChats.map((x) => x.IdOfChat)).toEqual(
          chats.map((x) => x.IdOfChat),
        );
      });

      it('should support connect many', async () => {
        await db.chat.createMany([
          { ...ChatData, Title: 'chat 1' },
          { ...ChatData, Title: 'chat 2' },
          { ...ChatData, Title: 'chat 3' },
          { ...ChatData, Title: 'chat 4' },
        ]);

        const q = db.user.select('Id').createMany([
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

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TestTransactionAdapter.prototype, 'query');
        const arraysSpy = jest.spyOn(
          TestTransactionAdapter.prototype,
          'arrays',
        );

        const users = await q;
        const chatIds = await db.user.join('chats').pluck('chats.IdOfChat');

        const createUserSqlCall = querySpy.mock.calls[0];
        const findChatsSqlCalls = querySpy.mock.calls.slice(1);
        const createUserSql = {
          text: createUserSqlCall[0],
          values: createUserSqlCall[1],
        };

        const createChatUserSqlCall = arraysSpy.mock.calls[0];
        const createChatUserSql = {
          text: createChatUserSqlCall[0],
          values: createChatUserSqlCall[1],
        };

        expectSql(
          createUserSql,
          `
          INSERT INTO "user"("name", "user_key", "password", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)
          RETURNING "user"."id" "Id", "user"."user_key" "UserKey"
        `,
          [
            'user 1',
            'key',
            'password',
            now,
            now,
            'user 2',
            'key',
            'password',
            now,
            now,
          ],
        );

        expect(findChatsSqlCalls.length).toBe(4);
        findChatsSqlCalls.forEach((call, i) => {
          expectSql(
            { text: call[0], values: call[1] },
            `
            SELECT "chats"."id_of_chat" "IdOfChat", "chats"."chat_key" "ChatKey"
            FROM "chat" "chats"
            WHERE "chats"."title" = $1
            LIMIT 1
          `,
            [`chat ${i + 1}`],
          );
        });

        expectSql(
          createChatUserSql,
          `
          INSERT INTO "chatUser"("user_id", "user_key", "chat_id", "chat_key")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12), ($13, $14, $15, $16)
        `,
          [
            users[0].Id,
            'key',
            chatIds[0],
            'key',
            users[0].Id,
            'key',
            chatIds[1],
            'key',
            users[1].Id,
            'key',
            chatIds[2],
            'key',
            users[1].Id,
            'key',
            chatIds[3],
            'key',
          ],
        );
      });

      it('should fail to connect when `on` condition does not match', async () => {
        await db.chat.createMany([
          { ...ChatData, Title: 'chat 1' },
          { ...activeChatData, Title: 'chat 2' },
        ]);

        const q = db.user.select('Id').createMany([
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
      });

      it('should support connect many using `on`', async () => {
        const chats = await db.chat.createMany([
          { ...activeChatData, Title: 'chat 1' },
          { ...activeChatData, Title: 'chat 2' },
          { ...activeChatData, Title: 'chat 3' },
          { ...activeChatData, Title: 'chat 4' },
        ]);

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
    });

    describe('connectOrCreate', () => {
      it('should support connect or create', async () => {
        const chatId = await db.chat.get('IdOfChat').create({
          ...ChatData,
          Title: 'chat 1',
        });

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

        const chats = await db.user.queryRelated('chats', user);
        expect(chats[0].IdOfChat).toBe(chatId);
      });

      it('should create using `on`', async () => {
        const chatId = await db.chat.get('IdOfChat').create({
          ...ChatData,
          Title: 'chat 1',
        });

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

        const chats = await db.user.queryRelated('chats', user);
        expect(chats[0].IdOfChat).not.toBe(chatId);
      });

      it('should support connect or create many', async () => {
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

          const ids = await db.chat.select('IdOfChat', 'ChatKey');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(ids, expect.any(Db));
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          await db.user.createMany([data, data]);

          const ids = await db.chat.select('IdOfChat', 'ChatKey');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(ids, expect.any(Db));
        });
      });
    });
  });

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
          expect(afterDelete).toBeCalledWith(ids, expect.any(Db));
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
          expect(afterDelete).toBeCalledWith([ids[0], ids[2]], expect.any(Db));
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
          expect(afterUpdate).toBeCalledWith([{ IdOfChat }], expect.any(Db));
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
          expect(afterUpdate).toBeCalledWith(
            [{ IdOfChat: ids[0] }, { IdOfChat: ids[1] }],
            expect.any(Db),
          );
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
          expect(afterCreate).toBeCalledWith(ids, expect.any(Db));
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
          expect(afterCreate).toBeCalledWith(ids, expect.any(Db));
        });
      });
    });
  });

  describe('where callback', () => {
    it('should support a `where` callback', () => {
      const q = db.user.where((q) =>
        q.chats.whereIn('Title', ['a', 'b']).count().equals(10),
      );

      expectSql(
        q.toSQL(),
        `
          SELECT ${userSelectAll} FROM "user" WHERE (
            SELECT count(*) = $1
            FROM "chat" "chats"
            WHERE "chats"."title" IN ($2, $3)
              AND EXISTS (
                SELECT 1
                FROM "chatUser"
                WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                  AND "chatUser"."chat_key" = "chats"."chat_key"
                  AND "chatUser"."user_id" = "user"."id"
                  AND "chatUser"."user_key" = "user"."user_key"
              )
          )
        `,
        [10, 'a', 'b'],
      );
    });

    it('should support a `where` callback using `on`', () => {
      const q = db.user.where((q) =>
        q.activeChats.whereIn('Title', ['a', 'b']).count().equals(10),
      );

      expectSql(
        q.toSQL(),
        `
          SELECT ${userSelectAll} FROM "user" WHERE (
            SELECT count(*) = $1
            FROM "chat" "activeChats"
            WHERE "activeChats"."active" = $2
              AND "activeChats"."title" IN ($3, $4)
              AND EXISTS (
                SELECT 1
                FROM "chatUser"
                WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                  AND "chatUser"."chat_key" = "activeChats"."chat_key"
                  AND "chatUser"."user_id" = "user"."id"
                  AND "chatUser"."user_key" = "user"."user_key"
              )
          )
        `,
        [10, true, 'a', 'b'],
      );
    });
  });

  // for: https://github.com/romeerez/orchid-orm/issues/250
  it('should obey to `snake_case` properly for the intermediate table', async () => {
    const BaseTable = createBaseTable({
      snakeCase: true,
    });

    class PostTable extends BaseTable {
      readonly table = 'post';
      columns = this.setColumns((t) => ({
        postId: t.integer().primaryKey(),
      }));

      relations = {
        tags: this.hasAndBelongsToMany(() => TagTable, {
          columns: ['postId'],
          references: ['postId'],
          through: {
            table: 'postTag',
            columns: ['tagId'],
            references: ['tagId'],
          },
        }),
      };
    }

    class TagTable extends BaseTable {
      readonly table = 'tag';
      columns = this.setColumns((t) => ({
        tagId: t.text().primaryKey(),
      }));

      relations = {
        posts: this.hasAndBelongsToMany(() => PostTable, {
          columns: ['tagId'],
          references: ['tagId'],
          through: {
            table: 'postTag',
            columns: ['postId'],
            references: ['postId'],
          },
        }),
      };
    }

    const local = orchidORMWithAdapter(
      { db: db.$qb },
      {
        post: PostTable,
        tag: TagTable,
      },
    );

    const q = local.post.select({
      tags: (q) => q.tags,
    });

    expectSql(
      q.toSQL(),
      `
        SELECT COALESCE("tags".r, '[]') "tags"
        FROM "post"
        LEFT JOIN LATERAL (
          SELECT json_agg(row_to_json(t.*)) r
          FROM (
            SELECT "tag_id"  "tagId"
            FROM "tag" "tags"
            WHERE EXISTS (
              SELECT 1
              FROM "postTag"
              WHERE "postTag"."tag_id" = "tags"."tag_id"
                AND "postTag"."post_id" = "post"."post_id"
            )
          ) "t"
        ) "tags" ON true
      `,
    );
  });
});
