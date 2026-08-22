import { Query } from 'pqb';
import { RecordUnknown } from 'pqb/internal';
import { chatSelectAll, useTestORM } from '../../test-utils/orm.test-utils';
import {
  Chat,
  db,
  assertType,
  expectSql,
  ChatData,
  UserData,
  UserSelectAll,
} from 'test-utils';
import { createTableFactory } from '../../orm-table/table';
import { orchidORMWithAdapter } from '../../orm-instance/orm-instance';

const ormParams = {
  db: db.$qb,
};

describe('hasAndBelongsToMany', () => {
  useTestORM();

  it('should define foreign keys under autoForeignKeys option', () => {
    const { defineTable } = createTableFactory({
      autoForeignKeys: {
        onUpdate: 'CASCADE',
      },
    });

    const PostTable = defineTable('post', (t) => ({
      Id: t.name('id').identity().primaryKey(),
    })).relations((post) => ({
      tags: post('Id')
        .hasAndBelongsToMany(() => TagTable('Id'))
        .through('postTags', ['PostId'], ['TagId']),
      tags2: post('Id')
        .hasAndBelongsToMany(() => TagTable('Id'))
        .foreignKey(false)
        .through('postTags', ['PostId2'], ['TagId2'])
        .foreignKey(false),
      tags3: post('Id')
        .hasAndBelongsToMany(() => TagTable('Id'))
        .through('postTags', ['PostId3'], ['TagId3'])
        .foreignKey({
          forThisTable: { onDelete: 'CASCADE' },
          forRelatedTable: { onDelete: 'CASCADE' },
        }),
    }));

    const TagTable = defineTable('tag', (t) => ({
      Id: t.name('id').identity().primaryKey(),
    }));

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
          SELECT ${chatSelectAll} FROM "schema"."chat" "chats"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."chat_user"
            WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
              AND "chat_user"."chat_key" = "chats"."chat_key"
              AND "chat_user"."user_id" = $1
              AND "chat_user"."user_key" = $2
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
          SELECT ${chatSelectAll} FROM "schema"."chat" "activeChats"
          WHERE "activeChats"."active" = $1
            AND EXISTS (
              SELECT 1 FROM "schema"."chat_user"
              WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                AND "chat_user"."chat_key" = "activeChats"."chat_key"
                AND "chat_user"."user_id" = $2
                AND "chat_user"."user_key" = $3
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
        SELECT ${chatSelectAll} FROM "schema"."chat" "c"
        WHERE EXISTS (
          SELECT 1 FROM "schema"."chat_user"
          WHERE "chat_user"."chat_id" = "c"."id_of_chat"
            AND "chat_user"."chat_key" = "c"."chat_key"
            AND "chat_user"."user_id" = "u"."id"
            AND "chat_user"."user_key" = "u"."user_key"
        )
      `,
    );
  });

  describe('whereExists', () => {
    it('should support whereExists', () => {
      expectSql(
        db.user.whereExists('chats').toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user" "User"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."chat"  "chats"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."chat_user"
              WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                AND "chat_user"."chat_key" = "chats"."chat_key"
                AND "chat_user"."user_id" = "User"."id"
                AND "chat_user"."user_key" = "User"."user_key"
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
          SELECT ${UserSelectAll} FROM "schema"."user" "u"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."chat"  "chats"
            WHERE "chats"."title" = $1
              AND EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                  AND "chat_user"."chat_key" = "chats"."chat_key"
                  AND "chat_user"."user_id" = "u"."id"
                  AND "chat_user"."user_key" = "u"."user_key"
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
          SELECT ${UserSelectAll} FROM "schema"."user" "u"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."chat"  "chats"
            WHERE
              EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                  AND "chat_user"."chat_key" = "chats"."chat_key"
                  AND "chat_user"."user_id" = "u"."id"
                  AND "chat_user"."user_key" = "u"."user_key"
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
          SELECT ${UserSelectAll} FROM "schema"."user" "User"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."chat"  "activeChats"
            WHERE "activeChats"."active" = $1
              AND EXISTS (
              SELECT 1 FROM "schema"."chat_user"
              WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                AND "chat_user"."chat_key" = "activeChats"."chat_key"
                AND "chat_user"."user_id" = "User"."id"
                AND "chat_user"."user_key" = "User"."user_key"
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
          SELECT ${UserSelectAll} FROM "schema"."user" "u"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."chat"  "activeChats"
            WHERE "activeChats"."active" = $1
              AND "activeChats"."title" = $2
              AND EXISTS (
              SELECT 1 FROM "schema"."chat_user"
              WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                AND "chat_user"."chat_key" = "activeChats"."chat_key"
                AND "chat_user"."user_id" = "u"."id"
                AND "chat_user"."user_key" = "u"."user_key"
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
          SELECT ${UserSelectAll} FROM "schema"."user" "u"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."chat"  "activeChats"
            WHERE "activeChats"."active" = $1
              AND EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                  AND "chat_user"."chat_key" = "activeChats"."chat_key"
                  AND "chat_user"."user_id" = "u"."id"
                  AND "chat_user"."user_key" = "u"."user_key"
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
        FROM "schema"."user" "u"
        JOIN "schema"."chat"  "chats"
          ON EXISTS (
            SELECT 1 FROM "schema"."chat_user"
            WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
              AND "chat_user"."chat_key" = "chats"."chat_key"
              AND "chat_user"."user_id" = "u"."id"
              AND "chat_user"."user_key" = "u"."user_key"
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
          FROM "schema"."user" "u"
          JOIN "schema"."chat"  "activeChats"
            ON "activeChats"."active" = $1
              AND EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                  AND "chat_user"."chat_key" = "activeChats"."chat_key"
                  AND "chat_user"."user_id" = "u"."id"
                  AND "chat_user"."user_key" = "u"."user_key"
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
        FROM "schema"."user" "u"
        JOIN "schema"."chat" "c"
          ON "c"."title" = $1
          AND "c"."updated_at" = $2
          AND EXISTS (
            SELECT 1 FROM "schema"."chat_user"
            WHERE "chat_user"."chat_id" = "c"."id_of_chat"
              AND "chat_user"."chat_key" = "c"."chat_key"
              AND "chat_user"."user_id" = "u"."id"
              AND "chat_user"."user_key" = "u"."user_key"
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
          FROM "schema"."user" "u"
          JOIN "schema"."chat" "c"
            ON "c"."title" = $1
           AND "c"."active" = $2
           AND "c"."updated_at" = $3
           AND EXISTS (
             SELECT 1 FROM "schema"."chat_user"
             WHERE "chat_user"."chat_id" = "c"."id_of_chat"
               AND "chat_user"."chat_key" = "c"."chat_key"
               AND "chat_user"."user_id" = "u"."id"
               AND "chat_user"."user_key" = "u"."user_key"
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
          SELECT "User"."name" "Name", row_to_json("c".*) "chat"
          FROM "schema"."user" "User"
          JOIN LATERAL (
            SELECT ${chatSelectAll}
            FROM "schema"."chat" "c"
            WHERE "c"."title" = $1
              AND EXISTS (
                SELECT 1
                FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "c"."id_of_chat"
                  AND "chat_user"."chat_key" = "c"."chat_key"
                  AND "chat_user"."user_id" = "User"."id"
                  AND "chat_user"."user_key" = "User"."user_key"
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
          SELECT "User"."name" "Name", row_to_json("c".*) "chat"
          FROM "schema"."user" "User"
          JOIN LATERAL (
            SELECT ${chatSelectAll}
            FROM "schema"."chat" "c"
            WHERE "c"."active" = $1
              AND "c"."title" = $2
              AND EXISTS (
                SELECT 1
                FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "c"."id_of_chat"
                  AND "chat_user"."chat_key" = "c"."chat_key"
                  AND "chat_user"."user_id" = "User"."id"
                  AND "chat_user"."user_key" = "User"."user_key"
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
            COALESCE("chats"."chats", '[]') "chats"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) "chats"
            FROM (
              SELECT
                "chats"."id_of_chat" "IdOfChat",
                "chats"."title" "Title"
              FROM "schema"."chat" "chats"
              WHERE "chats"."title" = $1
                AND EXISTS (
                  SELECT 1 FROM "schema"."chat_user"
                  WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                    AND "chat_user"."chat_key" = "chats"."chat_key"
                    AND "chat_user"."user_id" = "u"."id"
                    AND "chat_user"."user_key" = "u"."user_key"
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
            COALESCE("chats"."chats", '[]') "chats"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) "chats"
            FROM (
              SELECT
                "activeChats"."id_of_chat" "IdOfChat",
                "activeChats"."title" "Title"
              FROM "schema"."chat" "activeChats"
              WHERE "activeChats"."active" = $1
                AND "activeChats"."title" = $2
                AND EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                  AND "chat_user"."chat_key" = "activeChats"."chat_key"
                  AND "chat_user"."user_id" = "u"."id"
                  AND "chat_user"."user_key" = "u"."user_key"
              )
            ) "t"
          ) "chats" ON true
        `,
        [true, 'title'],
      );
    });

    it('should support require() for inner join', () => {
      const q = db.user.as('u').select('Id', {
        chats: (q) => q.chats.require().select('IdOfChat'),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT
            "u"."id" "Id",
            "chats"."chats" "chats"
          FROM "schema"."user" "u"
          JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) "chats"
            FROM (
              SELECT "chats"."id_of_chat" "IdOfChat"
              FROM "schema"."chat" "chats"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                  AND "chat_user"."chat_key" = "chats"."chat_key"
                  AND "chat_user"."user_id" = "u"."id"
                  AND "chat_user"."user_key" = "u"."user_key"
              )
            ) "t"
          ) "chats" ON "chats"."chats" IS NOT NULL
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
            "chatsCount"."chatsCount" "chatsCount"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT count(*) "chatsCount"
            FROM "schema"."chat" "chats"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."chat_user"
              WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                AND "chat_user"."chat_key" = "chats"."chat_key"
                AND "chat_user"."user_id" = "u"."id"
                AND "chat_user"."user_key" = "u"."user_key"
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
            "chatsCount"."chatsCount" "chatsCount"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT count(*) "chatsCount"
            FROM "schema"."chat" "activeChats"
            WHERE "activeChats"."active" = $1
              AND EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                  AND "chat_user"."chat_key" = "activeChats"."chat_key"
                  AND "chat_user"."user_id" = "u"."id"
                  AND "chat_user"."user_key" = "u"."user_key"
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
            COALESCE("titles"."titles", '[]') "titles"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg("t"."Title") "titles"
            FROM (
              SELECT "chats"."title" "Title"
              FROM "schema"."chat" "chats"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                  AND "chat_user"."chat_key" = "chats"."chat_key"
                  AND "chat_user"."user_id" = "u"."id"
                  AND "chat_user"."user_key" = "u"."user_key"
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
            COALESCE("titles"."titles", '[]') "titles"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT json_agg("t"."Title") "titles"
            FROM (
                   SELECT "activeChats"."title" "Title"
                   FROM "schema"."chat" "activeChats"
                   WHERE "activeChats"."active" = $1
                     AND EXISTS (
                       SELECT 1 FROM "schema"."chat_user"
                       WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                         AND "chat_user"."chat_key" = "activeChats"."chat_key"
                         AND "chat_user"."user_id" = "u"."id"
                         AND "chat_user"."user_key" = "u"."user_key"
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
            COALESCE("hasChats"."hasChats", false) "hasChats"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT true "hasChats"
            FROM "schema"."chat" "chats"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."chat_user"
              WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                AND "chat_user"."chat_key" = "chats"."chat_key"
                AND "chat_user"."user_id" = "u"."id"
                AND "chat_user"."user_key" = "u"."user_key"
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
            COALESCE("hasChats"."hasChats", false) "hasChats"
          FROM "schema"."user" "u"
          LEFT JOIN LATERAL (
            SELECT true "hasChats"
            FROM "schema"."chat" "activeChats"
            WHERE "activeChats"."active" = $1
              AND EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                  AND "chat_user"."chat_key" = "activeChats"."chat_key"
                  AND "chat_user"."user_id" = "u"."id"
                  AND "chat_user"."user_key" = "u"."user_key"
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
          SELECT COALESCE("chats"."chats", '[]') "chats"
          FROM "schema"."user" "User"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) "chats"
            FROM (
              SELECT COALESCE("users"."users", '[]') "users"
              FROM "schema"."chat" "chats"
              LEFT JOIN LATERAL (
                SELECT json_agg(row_to_json(t.*)) "users"
                FROM (
                  SELECT COALESCE("chats2"."chats", '[]') "chats"
                  FROM "schema"."user" "users"
                  LEFT JOIN LATERAL (
                    SELECT json_agg(row_to_json(t.*)) "chats"
                    FROM (
                      SELECT ${chatSelectAll}
                      FROM "schema"."chat" "chats2"
                      WHERE EXISTS (
                        SELECT 1
                        FROM "schema"."chat_user"
                        WHERE "chat_user"."chat_id" = "chats2"."id_of_chat"
                          AND "chat_user"."chat_key" = "chats2"."chat_key"
                          AND "chat_user"."user_id" = "users"."id"
                          AND "chat_user"."user_key" = "users"."user_key"
                      )
                    ) "t"
                  ) "chats2" ON true
                  WHERE EXISTS (
                    SELECT 1
                    FROM "schema"."chat_user"
                    WHERE "chat_user"."user_id" = "users"."id"
                      AND "chat_user"."user_key" = "users"."user_key"
                      AND "chat_user"."chat_id" = "chats"."id_of_chat"
                      AND "chat_user"."chat_key" = "chats"."chat_key"
                  )
                ) "t"
              ) "users" ON true
              WHERE EXISTS (
                SELECT 1
                FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                  AND "chat_user"."chat_key" = "chats"."chat_key"
                  AND "chat_user"."user_id" = "User"."id"
                  AND "chat_user"."user_key" = "User"."user_key"
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
          SELECT COALESCE("activeChats"."activeChats", '[]') "activeChats"
          FROM "schema"."user" "activeUsers"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) "activeChats"
            FROM (
              SELECT COALESCE("activeUsers2"."activeUsers", '[]') "activeUsers"
              FROM "schema"."chat" "activeChats"
              LEFT JOIN LATERAL (
                SELECT json_agg(row_to_json(t.*)) "activeUsers"
                FROM (
                  SELECT COALESCE("activeChats2"."activeChats", '[]') "activeChats"
                  FROM "schema"."user" "activeUsers2"
                  LEFT JOIN LATERAL (
                    SELECT json_agg(row_to_json(t.*)) "activeChats"
                    FROM (
                      SELECT ${chatSelectAll}
                      FROM "schema"."chat" "activeChats2"
                      WHERE "activeChats2"."active" = $1
                        AND EXISTS (
                          SELECT 1
                          FROM "schema"."chat_user"
                          WHERE "chat_user"."chat_id" = "activeChats2"."id_of_chat"
                            AND "chat_user"."chat_key" = "activeChats2"."chat_key"
                            AND "chat_user"."user_id" = "activeUsers2"."id"
                            AND "chat_user"."user_key" = "activeUsers2"."user_key"
                        )
                    ) "t"
                  ) "activeChats2" ON true
                  WHERE "activeUsers2"."active" = $2
                    AND EXISTS (
                      SELECT 1
                      FROM "schema"."chat_user"
                      WHERE "chat_user"."user_id" = "activeUsers2"."id"
                        AND "chat_user"."user_key" = "activeUsers2"."user_key"
                        AND "chat_user"."chat_id" = "activeChats"."id_of_chat"
                        AND "chat_user"."chat_key" = "activeChats"."chat_key"
                    )
                ) "t"
              ) "activeUsers2" ON true
              WHERE "activeChats"."active" = $3
                AND EXISTS (
                  SELECT 1
                  FROM "schema"."chat_user"
                  WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                    AND "chat_user"."chat_key" = "activeChats"."chat_key"
                    AND "chat_user"."user_id" = "activeUsers"."id"
                    AND "chat_user"."user_key" = "activeUsers"."user_key"
                )
            ) "t"
          ) "activeChats" ON true
        `,
        [true, true, true],
      );
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
          SELECT ${UserSelectAll} FROM "schema"."user" "User" WHERE (
            SELECT count(*) = $1
            FROM "schema"."chat" "chats"
            WHERE "chats"."title" IN ($2, $3)
              AND EXISTS (
                SELECT 1
                FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                  AND "chat_user"."chat_key" = "chats"."chat_key"
                  AND "chat_user"."user_id" = "User"."id"
                  AND "chat_user"."user_key" = "User"."user_key"
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
          SELECT ${UserSelectAll} FROM "schema"."user" "User" WHERE (
            SELECT count(*) = $1
            FROM "schema"."chat" "activeChats"
            WHERE "activeChats"."active" = $2
              AND "activeChats"."title" IN ($3, $4)
              AND EXISTS (
                SELECT 1
                FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "activeChats"."id_of_chat"
                  AND "chat_user"."chat_key" = "activeChats"."chat_key"
                  AND "chat_user"."user_id" = "User"."id"
                  AND "chat_user"."user_key" = "User"."user_key"
              )
          )
        `,
        [10, true, 'a', 'b'],
      );
    });
  });

  // for: https://github.com/romeerez/orchid-orm/issues/250
  it('should obey to `snake_case` properly for the intermediate table', async () => {
    const { defineTable } = createTableFactory({
      snakeCase: true,
    });

    const PostTable = defineTable('post', (t) => ({
      postId: t.integer().primaryKey(),
    })).relations((post) => ({
      tags: post('postId')
        .hasAndBelongsToMany(() => TagTable('tagId'))
        .through('postTag', ['postId'], ['tagId']),
    }));

    const TagTable = defineTable('tag', (t) => ({
      tagId: t.text().primaryKey(),
    })).relations((tag) => ({
      posts: tag('tagId')
        .hasAndBelongsToMany(() => PostTable('postId'))
        .through('postTag', ['tagId'], ['postId']),
    }));

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
        SELECT COALESCE("tags"."tags", '[]') "tags"
        FROM "post"
        LEFT JOIN LATERAL (
          SELECT json_agg(row_to_json(t.*)) "tags"
          FROM (
            SELECT "tag_id"  "tagId"
            FROM "tag" "tags"
            WHERE EXISTS (
              SELECT 1
              FROM "post_tag"
              WHERE "post_tag"."tag_id" = "tags"."tag_id"
                AND "post_tag"."post_id" = "post"."post_id"
            )
          ) "t"
        ) "tags" ON true
      `,
    );
  });
});
