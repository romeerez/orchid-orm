import { Db, Query, TransactionAdapter } from 'pqb';
import {
  Chat,
  chatData,
  chatSelectAll,
  db,
  PostTag,
  postTagSelectAll,
  User,
  userData,
  useRelationCallback,
  userSelectAll,
  useTestORM,
} from '../test-utils/orm.test-utils';
import { omit, RecordUnknown, Sql } from 'orchid-core';
import { assertType, expectSql, now } from 'test-utils';
import { createBaseTable } from '../baseTable';
import { orchidORM } from '../orm';

const ormParams = {
  db: db.$queryBuilder,
};

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

    const db = orchidORM(ormParams, { post: PostTable, tag: TagTable });
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

  describe('querying', () => {
    it('should support `queryRelated` to query related data', async () => {
      const userId = await db.user.get('Id').create({
        ...userData,
        chats: {
          create: [chatData, chatData],
        },
      });

      const user = await db.user.find(userId);
      const query = db.user.queryRelated('chats', user);

      expectSql(
        query.toSQL(),
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

      const messages = await query;

      expect(messages).toMatchObject([chatData, chatData]);
    });

    it('should handle chained query', () => {
      const query = db.user
        .where({ Name: 'Name' })
        .chain('chats')
        .where({ Title: 'title' });

      expectSql(
        query.toSQL(),
        `
          SELECT ${chatSelectAll} FROM "chat" "chats"
          WHERE EXISTS (
              SELECT 1 FROM "user"
              WHERE "user"."name" = $1
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                    AND "chatUser"."chat_key" = "chats"."chat_key"
                    AND "chatUser"."user_id" = "user"."id"
                    AND "chatUser"."user_key" = "user"."user_key"
                )
            )
            AND "chats"."title" = $2
        `,
        ['Name', 'title'],
      );
    });

    it('should handle long chained query', () => {
      const q = db.chat
        .where({ Title: 'title' })
        .chain('users')
        .where({ Name: 'name' })
        .chain('postTags')
        .where({ Tag: 'tag' });

      assertType<Awaited<typeof q>, PostTag[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${postTagSelectAll}
          FROM "postTag" "postTags"
          WHERE
            EXISTS (
              SELECT 1
              FROM "user" AS "users"
              WHERE
                EXISTS (
                  SELECT 1
                  FROM "chat"
                  WHERE "chat"."title" = $1
                    AND EXISTS (
                      SELECT 1
                      FROM "chatUser"
                      WHERE "chatUser"."user_id" = "users"."id"
                        AND "chatUser"."user_key" = "users"."user_key"
                        AND "chatUser"."chat_id" = "chat"."id_of_chat"
                        AND "chatUser"."chat_key" = "chat"."chat_key"
                    )
                )
                AND "users"."name" = $2
                AND EXISTS (
                  SELECT 1
                  FROM "post"
                  WHERE "post"."id" = "postTags"."post_id"
                    AND "post"."user_id" = "users"."id"
                    AND "post"."title" = "users"."user_key"
                )
            )
            AND "postTags"."tag" = $3
        `,
        ['title', 'name', 'tag'],
      );
    });

    describe('create based on a query', () => {
      it('should have create based on find query', async () => {
        const user = await db.user.create(userData);

        const chat = await db.user.find(user.Id).chain('chats').create({
          Title: 'title',
          ChatKey: 'key',
        });

        expect(chat.Title).toBe('title');
        const ids = await db.user.queryRelated('chats', user).pluck('IdOfChat');
        expect(ids).toEqual([chat.IdOfChat]);
      });

      it('should throw not found when not found even when searching with findOptional', async () => {
        const query = db.user.findOptional(1).chain('chats').create({
          Title: 'title',
          ChatKey: 'key',
        });

        await expect(() => query).rejects.toThrow('Record is not found');
      });

      it('should throw when the main query returns many records', async () => {
        await expect(() =>
          db.user.chain('chats').create({
            Title: 'title',
            ChatKey: 'key',
          }),
        ).rejects.toThrow(
          'Cannot create based on a query which returns multiple records',
        );
      });
    });

    it('should support chained delete', () => {
      const query = db.user
        .where({ Name: 'Name' })
        .chain('chats')
        .where({ Title: 'title' })
        .delete();

      expectSql(
        query.toSQL(),
        `
          DELETE FROM "chat" AS "chats"
          WHERE EXISTS (
              SELECT 1 FROM "user"
              WHERE "user"."name" = $1
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                    AND "chatUser"."chat_key" = "chats"."chat_key"
                    AND "chatUser"."user_id" = "user"."id"
                    AND "chatUser"."user_key" = "user"."user_key"
                )
            )
            AND "chats"."title" = $2
        `,
        ['Name', 'title'],
      );
    });

    it('should have proper joinQuery', () => {
      expectSql(
        (
          db.user.relations.chats.relationConfig.joinQuery(
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

    it('should be supported in whereExists', () => {
      expectSql(
        db.user.whereExists('chats').toSQL(),
        `
          SELECT ${userSelectAll} FROM "user"
          WHERE EXISTS (
            SELECT 1 FROM "chat" AS "chats"
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
            SELECT 1 FROM "chat" AS "chats"
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
            SELECT 1 FROM "chat" AS "chats"
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

    it('should be supported in join', () => {
      const query = db.user
        .as('u')
        .join('chats', (q) => q.where({ Title: 'title' }))
        .select('Name', 'chats.Title');

      assertType<Awaited<typeof query>, { Name: string; Title: string }[]>();

      expectSql(
        query.toSQL(),
        `
        SELECT "u"."name" "Name", "chats"."title" "Title"
        FROM "user" "u"
        JOIN "chat" AS "chats"
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

    it('should be supported in join with a callback', () => {
      const now = new Date();

      const query = db.user
        .as('u')
        .join(
          (q) => q.chats.as('c').where({ updatedAt: now }),
          (q) => q.where({ Title: 'title' }),
        )
        .select('Name', 'c.Title');

      assertType<Awaited<typeof query>, { Name: string; Title: string }[]>();

      expectSql(
        query.toSQL(),
        `
        SELECT "u"."name" "Name", "c"."title" "Title"
        FROM "user" "u"
        JOIN "chat" AS "c"
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

    it('should be supported in joinLateral', () => {
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

    describe('select', () => {
      it('should be selectable', () => {
        const query = db.user.as('u').select('Id', {
          chats: (q) =>
            q.chats.select('IdOfChat', 'Title').where({ Title: 'title' }),
        });

        assertType<
          Awaited<typeof query>,
          { Id: number; chats: { IdOfChat: number; Title: string }[] }[]
        >();

        expectSql(
          query.toSQL(),
          `
            SELECT
              "u"."id" "Id",
              COALESCE("chats".r, '[]') "chats"
            FROM "user" "u"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
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

      it('should support chained select', () => {
        const q = db.chat.select({
          items: (q) => q.users.chain('postTags'),
        });

        assertType<Awaited<typeof q>, { items: PostTag[] }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT COALESCE("items".r, '[]') "items"
            FROM "chat"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
              FROM (
                SELECT ${postTagSelectAll}
                FROM "postTag" "postTags"
                WHERE EXISTS (
                  SELECT 1 FROM "user" AS "users"
                  WHERE EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."user_id" = "users"."id"
                      AND "chatUser"."user_key" = "users"."user_key"
                      AND "chatUser"."chat_id" = "chat"."id_of_chat"
                      AND "chatUser"."chat_key" = "chat"."chat_key"
                  ) AND EXISTS (
                    SELECT 1 FROM "post"
                    WHERE "post"."id" = "postTags"."post_id"
                      AND "post"."user_id" = "users"."id"
                      AND "post"."title" = "users"."user_key"
                  )
                )
              ) "t"
            ) "items" ON true
          `,
        );
      });
    });

    it('should allow to select count', () => {
      const query = db.user.as('u').select('Id', {
        chatsCount: (q) => q.chats.count(),
      });

      assertType<Awaited<typeof query>, { Id: number; chatsCount: number }[]>();

      expectSql(
        query.toSQL(),
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

    it('should allow to pluck values', () => {
      const query = db.user.as('u').select('Id', {
        titles: (q) => q.chats.pluck('Title'),
      });

      assertType<Awaited<typeof query>, { Id: number; titles: string[] }[]>();

      expectSql(
        query.toSQL(),
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

    it('should handle exists sub query', () => {
      const query = db.user.as('u').select('Id', {
        hasChats: (q) => q.chats.exists(),
      });

      assertType<Awaited<typeof query>, { Id: number; hasChats: boolean }[]>();

      expectSql(
        query.toSQL(),
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
            SELECT json_agg(row_to_json("t".*)) r
            FROM (
              SELECT COALESCE("users".r, '[]') "users"
              FROM "chat" "chats"
              LEFT JOIN LATERAL (
                SELECT json_agg(row_to_json("t".*)) r
                FROM (
                  SELECT COALESCE("chats2".r, '[]') "chats"
                  FROM "user" "users"
                  LEFT JOIN LATERAL (
                    SELECT json_agg(row_to_json("t".*)) r
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
  });

  describe('create', () => {
    const checkUserAndChats = ({
      user,
      chats,
      Name,
      title1,
      title2,
    }: {
      user: User;
      chats: Chat[];
      Name: string;
      title1: string;
      title2: string;
    }) => {
      expect(user).toEqual({
        ...omit(userData, ['Password']),
        Active: null,
        Age: null,
        Data: null,
        Picture: null,
        Id: user.Id,
        Name,
      });

      expect(chats[0]).toEqual({
        ...chatData,
        IdOfChat: chats[0].IdOfChat,
        Title: title1,
      });

      expect(chats[1]).toEqual({
        ...chatData,
        IdOfChat: chats[1].IdOfChat,
        Title: title2,
      });
    };

    describe('nested create', () => {
      it('should support create', async () => {
        const query = db.user.select('Id', 'UserKey').create({
          ...userData,
          Name: 'user 1',
          chats: {
            create: [
              {
                ...chatData,
                Title: 'chat 1',
              },
              {
                ...chatData,
                Title: 'chat 2',
              },
            ],
          },
        });

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TransactionAdapter.prototype, 'query');
        const arraysSpy = jest.spyOn(TransactionAdapter.prototype, 'arrays');

        const user = await query;
        const chatIds = await db.user
          .queryRelated('chats', user)
          .order('IdOfChat')
          .pluck('IdOfChat');

        const [createUserSql, createChatsSql] = querySpy.mock.calls.map(
          (item) => item[0],
        );
        const createChatUserSql = arraysSpy.mock.calls[0][0];

        expectSql(
          createUserSql as Sql,
          `
          INSERT INTO "user"("name", "user_key", "password", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5)
          RETURNING "user"."id" "Id", "user"."user_key" "UserKey"
        `,
          ['user 1', 'key', 'password', now, now],
        );

        expectSql(
          createChatsSql as Sql,
          `
          INSERT INTO "chat"("title", "chat_key", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
          RETURNING "chat"."id_of_chat" "IdOfChat", "chat"."chat_key" "ChatKey"
        `,
          ['chat 1', 'key', now, now, 'chat 2', 'key', now, now],
        );

        expectSql(
          createChatUserSql as Sql,
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

      it('should support create many', async () => {
        const query = db.user.select('Id').createMany([
          {
            ...userData,
            Name: 'user 1',
            chats: {
              create: [
                {
                  ...chatData,
                  Title: 'chat 1',
                },
                {
                  ...chatData,
                  Title: 'chat 2',
                },
              ],
            },
          },
          {
            ...userData,
            Name: 'user 2',
            chats: {
              create: [
                {
                  ...chatData,
                  Title: 'chat 3',
                },
                {
                  ...chatData,
                  Title: 'chat 4',
                },
              ],
            },
          },
        ]);

        jest.clearAllMocks();
        const querySpy = jest.spyOn(TransactionAdapter.prototype, 'query');
        const arraysSpy = jest.spyOn(TransactionAdapter.prototype, 'arrays');

        const users = await query;
        const chatIds = await db.user.join('chats').pluck('chats.IdOfChat');

        const [createUserSql, createChatsSql] = querySpy.mock.calls.map(
          (item) => item[0],
        );
        const createChatUserSql = arraysSpy.mock.calls[0][0];

        expectSql(
          createUserSql as Sql,
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
          createChatsSql as Sql,
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
          createChatUserSql as Sql,
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

      it('should ignore empty create list', async () => {
        await db.user.create({
          ...userData,
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
          ...userData,
          chats: {
            create: [chatData, chatData],
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
          { ...chatData, Title: 'chat 1' },
          { ...chatData, Title: 'chat 2' },
        ]);

        const query = db.user.select('Id', 'UserKey').create({
          ...userData,
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
        const querySpy = jest.spyOn(TransactionAdapter.prototype, 'query');
        const arraysSpy = jest.spyOn(TransactionAdapter.prototype, 'arrays');

        const user = await query;
        const chatIds = await db.user
          .queryRelated('chats', user)
          .order('IdOfChat')
          .pluck('IdOfChat');

        const [createUserSql, ...findChatsSql] = querySpy.mock.calls.map(
          (item) => item[0],
        );
        const createChatUserSql = arraysSpy.mock.calls[0][0];

        expectSql(
          createUserSql as Sql,
          `
          INSERT INTO "user"("name", "user_key", "password", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5)
          RETURNING "user"."id" "Id", "user"."user_key" "UserKey"
        `,
          ['user 1', 'key', 'password', now, now],
        );

        expect(findChatsSql.length).toBe(2);
        findChatsSql.forEach((sql, i) => {
          expectSql(
            sql as Sql,
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
          createChatUserSql as Sql,
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

      it('should support connect many', async () => {
        await db.chat.createMany([
          { ...chatData, Title: 'chat 1' },
          { ...chatData, Title: 'chat 2' },
          { ...chatData, Title: 'chat 3' },
          { ...chatData, Title: 'chat 4' },
        ]);

        const query = db.user.select('Id').createMany([
          {
            ...userData,
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
            ...userData,
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
        const querySpy = jest.spyOn(TransactionAdapter.prototype, 'query');
        const arraysSpy = jest.spyOn(TransactionAdapter.prototype, 'arrays');

        const users = await query;
        const chatIds = await db.user.join('chats').pluck('chats.IdOfChat');

        const [createUserSql, ...findChatsSql] = querySpy.mock.calls.map(
          (item) => item[0],
        );
        const createChatUserSql = arraysSpy.mock.calls[0][0];

        expectSql(
          createUserSql as Sql,
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

        expect(findChatsSql.length).toBe(4);
        findChatsSql.forEach((sql, i) => {
          expectSql(
            sql as Sql,
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
          createChatUserSql as Sql,
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

      it('should ignore empty connect list', async () => {
        await db.user.create({
          ...userData,
          chats: {
            connect: [],
          },
        });
      });
    });

    describe('connectOrCreate', () => {
      it('should support connect or create', async () => {
        const chatId = await db.chat.get('IdOfChat').create({
          ...chatData,
          Title: 'chat 1',
        });

        const query = db.user.create({
          ...userData,
          Name: 'user 1',
          chats: {
            connectOrCreate: [
              {
                where: { Title: 'chat 1' },
                create: { ...chatData, Title: 'chat 1' },
              },
              {
                where: { Title: 'chat 2' },
                create: { ...chatData, Title: 'chat 2' },
              },
            ],
          },
        });

        const user = await query;
        const chats = await db.user.queryRelated('chats', user).order('Title');

        expect(chats[0].IdOfChat).toBe(chatId);

        checkUserAndChats({
          user,
          chats,
          Name: 'user 1',
          title1: 'chat 1',
          title2: 'chat 2',
        });
      });

      it('should support connect or create many', async () => {
        const [{ IdOfChat: chat1Id }, { IdOfChat: chat4Id }] = await db.chat
          .select('IdOfChat')
          .createMany([
            {
              ...chatData,
              Title: 'chat 1',
            },
            {
              ...chatData,
              Title: 'chat 4',
            },
          ]);

        const query = db.user.createMany([
          {
            ...userData,
            Name: 'user 1',
            chats: {
              connectOrCreate: [
                {
                  where: { Title: 'chat 1' },
                  create: { ...chatData, Title: 'chat 1' },
                },
                {
                  where: { Title: 'chat 2' },
                  create: { ...chatData, Title: 'chat 2' },
                },
              ],
            },
          },
          {
            ...userData,
            Name: 'user 2',
            chats: {
              connectOrCreate: [
                {
                  where: { Title: 'chat 3' },
                  create: { ...chatData, Title: 'chat 3' },
                },
                {
                  where: { Title: 'chat 4' },
                  create: { ...chatData, Title: 'chat 4' },
                },
              ],
            },
          },
        ]);

        const users = await query;
        const chats = await db.chat.order('Title');

        expect(chats[0].IdOfChat).toBe(chat1Id);
        expect(chats[3].IdOfChat).toBe(chat4Id);

        checkUserAndChats({
          user: users[0],
          chats: chats.slice(0, 2),
          Name: 'user 1',
          title1: 'chat 1',
          title2: 'chat 2',
        });

        checkUserAndChats({
          user: users[1],
          chats: chats.slice(2, 4),
          Name: 'user 2',
          title1: 'chat 3',
          title2: 'chat 4',
        });
      });

      it('should ignore empty connectOrCreate list', async () => {
        await db.user.create({
          ...userData,
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
          ...userData,
          chats: {
            connectOrCreate: [
              {
                where: { Title: 'one' },
                create: chatData,
              },
              {
                where: { Title: 'two' },
                create: chatData,
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
        const userId = await db.user.get('Id').create(userData);

        const createdChats = await db.chat.createMany([chatData, chatData]);

        await db.user.find(userId).update({
          chats: {
            add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
          },
        });

        const chats = await db.user.queryRelated('chats', {
          Id: userId,
          UserKey: 'key',
        });

        expect(chats).toEqual(createdChats);
      });

      it('should connect many related records to many', async () => {
        const [userId1, userId2] = await db.user
          .get('Id')
          .createMany([userData, userData]);

        const createdChats = await db.chat.createMany([chatData, chatData]);

        await db.user.whereIn('Id', [userId1, userId2]).update({
          chats: {
            add: createdChats.map((chat) => ({ IdOfChat: chat.IdOfChat })),
          },
        });

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

      it('should throw when no related records were found by a condition', async () => {
        const userId = await db.user.get('Id').create(userData);

        const result = await db.user
          .find(userId)
          .update({
            chats: {
              add: { IdOfChat: 123 },
            },
          })
          .catch((err) => ({ err }));

        expect(result).toEqual({
          err: expect.objectContaining({
            message:
              'Expected to find at least 1 record(s) based on `connect` conditions, but found 0',
          }),
        });
      });

      it('should not throw when adding a record that was already connected', async () => {
        const userId = await db.user.get('Id').create({
          ...userData,
          chats: {
            create: [chatData],
          },
        });

        await db.user.find(userId).update({
          chats: {
            add: { Title: chatData.Title },
          },
        });
      });
    });

    describe('disconnect', () => {
      it('should delete join table rows', async () => {
        const userId = await db.user.get('Id').create({
          ...userData,
          Name: 'user',
          chats: {
            create: [
              { ...chatData, Title: 'chat 1' },
              { ...chatData, Title: 'chat 2' },
              { ...chatData, Title: 'chat 3' },
            ],
          },
        });

        await db.user.where({ Id: userId }).update({
          chats: {
            disconnect: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
          },
        });

        const chats = await db.user.queryRelated('chats', {
          Id: userId,
          UserKey: 'key',
        });
        expect(chats.length).toBe(1);
        expect(chats[0].Title).toEqual('chat 3');
      });

      it('should ignore empty list', async () => {
        const Id = await db.user.get('Id').create({
          ...userData,
          chats: {
            create: [{ ...chatData, Title: 'chat 1' }],
          },
        });

        await db.user.find(Id).update({
          chats: {
            disconnect: [],
          },
        });

        const chats = await db.user
          .queryRelated('chats', { Id, UserKey: 'key' })
          .pluck('Title');
        expect(chats).toEqual(['chat 1']);
      });
    });

    describe('set', () => {
      it('should delete previous join records and create join records for matching related records', async () => {
        const Id = await db.user.get('Id').create({
          ...userData,
          chats: {
            create: [
              { ...chatData, Title: 'chat 1' },
              { ...chatData, Title: 'chat 2' },
            ],
          },
        });

        await db.chat.create({
          ...chatData,
          Title: 'chat 3',
        });

        await db.user.where({ Id }).update({
          chats: {
            set: [{ Title: 'chat 2' }, { Title: 'chat 3' }],
          },
        });

        const chats = await db.user
          .queryRelated('chats', { Id, UserKey: 'key' })
          .select('Title')
          .order('Title');

        expect(chats).toEqual([{ Title: 'chat 2' }, { Title: 'chat 3' }]);
      });

      it('should delete all previous connections when empty array is given', async () => {
        const Id = await db.user.get('Id').create({
          ...userData,
          chats: {
            create: [
              { ...chatData, Title: 'chat 1' },
              { ...chatData, Title: 'chat 2' },
            ],
          },
        });

        await db.user.where({ Id, UserKey: 'key' }).update({
          chats: {
            set: [],
          },
        });

        const chats = await db.user.queryRelated('chats', {
          Id,
          UserKey: 'key',
        });

        expect(chats).toEqual([]);
      });
    });

    describe('delete', () => {
      it('should delete related records', async () => {
        const Id = await db.user.get('Id').create({
          ...userData,
          chats: {
            create: [
              { ...chatData, Title: 'chat 1' },
              { ...chatData, Title: 'chat 2' },
              { ...chatData, Title: 'chat 3' },
            ],
          },
        });

        await db.user.create({
          ...userData,
          chats: {
            create: [{ ...chatData, Title: 'chat 4' }],
          },
        });

        await db.user.find(Id).update({
          chats: {
            delete: [{ Title: 'chat 1' }, { Title: 'chat 2' }],
          },
        });

        expect(await db.chat.count()).toBe(2);

        const chats = await db.user
          .queryRelated('chats', { Id, UserKey: 'key' })
          .select('Title');
        expect(chats).toEqual([{ Title: 'chat 3' }]);
      });

      it('should ignore empty list', async () => {
        const Id = await db.user.get('Id').create({
          ...userData,
          chats: {
            create: [{ ...chatData, Title: 'chat 1' }],
          },
        });

        await db.user.find(Id).update({
          chats: {
            delete: [],
          },
        });

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
            ...userData,
            chats: {
              create: [
                { ...chatData, Title: 'chat 1' },
                { ...chatData, Title: 'chat 2' },
              ],
            },
          });

          const ids = await db.chat.select('IdOfChat');

          await db.user.find(id).update(data);

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toBeCalledWith(ids, expect.any(Db));
        });

        it('should invoke callbacks in a batch update', async () => {
          resetMocks();

          const UserIds = await db.user.pluck('Id').createMany([
            {
              ...userData,
              chats: {
                create: [
                  { ...chatData, Title: 'chat 1' },
                  { ...chatData, Title: 'chat 3' },
                ],
              },
            },
            {
              ...userData,
              chats: {
                create: [
                  { ...chatData, Title: 'chat 2' },
                  { ...chatData, Title: 'chat 4' },
                ],
              },
            },
          ]);

          const ids = await db.chat.select('IdOfChat');

          await db.user.where({ Id: { in: UserIds } }).update(data);

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toBeCalledWith([ids[0], ids[2]], expect.any(Db));
        });
      });
    });

    describe('nested update', () => {
      it('should update related records', async () => {
        const id = await db.user.get('Id').create({
          ...userData,
          chats: {
            create: [
              { ...chatData, Title: 'chat 1' },
              { ...chatData, Title: 'chat 2' },
              { ...chatData, Title: 'chat 3' },
            ],
          },
        });

        await db.user.create({
          ...userData,
          chats: {
            create: [{ ...chatData, Title: 'chat 4' }],
          },
        });

        await db.user.find(id).update({
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

        const titles = await db.chat.order('IdOfChat').pluck('Title');
        expect(titles).toEqual(['chat 1', 'updated', 'updated', 'chat 4']);
      });

      it('should ignore update with empty where list', async () => {
        const Id = await db.user.get('Id').create({
          ...userData,
          chats: {
            create: [{ ...chatData, Title: 'chat 1' }],
          },
        });

        await db.user.find(Id).update({
          chats: {
            update: {
              where: [],
              data: {
                Title: 'updated',
              },
            },
          },
        });

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
            ...userData,
            chats: {
              create: [{ ...chatData, Title: 'chat 1' }],
            },
          });

          await db.user.find(id).update(data);

          const IdOfChat = await db.chat.get('IdOfChat');

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toBeCalledWith([{ IdOfChat }], expect.any(Db));
        });

        it('should invoke callbacks in a batch update', async () => {
          const userIds = await db.user.pluck('Id').createMany([
            {
              ...userData,
              chats: {
                create: [{ ...chatData, Title: 'chat 1' }],
              },
            },
            {
              ...userData,
              chats: {
                create: [{ ...chatData, Title: 'chat 2' }],
              },
            },
          ]);

          resetMocks();

          await db.user.where({ Id: { in: userIds } }).update(data);

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
      it('should create many records and connect all found updating with them', async () => {
        const userIds = await db.user
          .pluck('Id')
          .createMany([userData, userData]);

        await db.user.where({ Id: { in: userIds } }).update({
          chats: {
            create: [
              {
                ...chatData,
                Title: 'created 1',
              },
              {
                ...chatData,
                Title: 'created 2',
              },
            ],
          },
        });

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

      it('should ignore empty list', async () => {
        const Id = await db.user.get('Id').create(userData);

        await db.user.find(Id).update({
          chats: {
            create: [],
          },
        });

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
            create: [chatData, chatData],
          },
        };

        it('should invoke callbacks', async () => {
          const id = await db.user.get('Id').create(userData);

          await db.user.find(id).update(data);

          const ids = await db.chat.select('IdOfChat', 'ChatKey');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith(ids, expect.any(Db));
        });

        it('should invoke callbacks in a batch update', async () => {
          const userIds = await db.user
            .pluck('Id')
            .createMany([userData, userData]);

          resetMocks();

          await db.user.where({ Id: { in: userIds } }).update(data);

          const ids = await db.chat.select('IdOfChat', 'ChatKey');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(ids).toHaveLength(2);
          expect(afterCreate).toBeCalledWith(ids, expect.any(Db));
        });
      });
    });
  });

  it('should be supported in a `where` callback', () => {
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

    const local = orchidORM(
      { db: db.$queryBuilder },
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
          SELECT json_agg(row_to_json("t".*)) r
          FROM (
            SELECT "tag_id" AS "tagId"
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
