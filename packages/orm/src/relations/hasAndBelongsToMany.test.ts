import { RelationQuery, TransactionAdapter } from 'pqb';
import {
  Chat,
  chatData,
  chatSelectAll,
  db,
  User,
  userData,
  useRelationCallback,
  userSelectAll,
  useTestORM,
} from '../test-utils/test-utils';
import { Sql } from 'orchid-core';
import { assertType, expectSql, now } from 'test-utils';

describe('hasAndBelongsToMany', () => {
  useTestORM();

  describe('querying', () => {
    it('should have method to query related data', async () => {
      const chatsQuery = db.chat.all();

      assertType<
        typeof db.user.chats,
        RelationQuery<
          'chats',
          { Id: number },
          never,
          typeof chatsQuery,
          false,
          true,
          true
        >
      >();

      const userId = await db.user.get('Id').create({
        ...userData,
        chats: {
          create: [chatData, chatData],
        },
      });

      const user = await db.user.find(userId);
      const query = db.user.chats(user);

      expectSql(
        query.toSql(),
        `
        SELECT ${chatSelectAll} FROM "chat" AS "chats"
        WHERE EXISTS (
          SELECT 1 FROM "chatUser"
          WHERE "chatUser"."chatId" = "chats"."idOfChat"
            AND "chatUser"."userId" = $1
          LIMIT 1
        )
      `,
        [userId],
      );

      const messages = await query;

      expect(messages).toMatchObject([chatData, chatData]);
    });

    it('should handle chained query', () => {
      const query = db.user
        .where({ Name: 'Name' })
        .chats.where({ Title: 'title' });

      expectSql(
        query.toSql(),
        `
          SELECT ${chatSelectAll} FROM "chat" AS "chats"
          WHERE EXISTS (
              SELECT 1 FROM "user"
              WHERE "user"."name" = $1
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chatId" = "chats"."idOfChat"
                    AND "chatUser"."userId" = "user"."id"
                  LIMIT 1
                )
              LIMIT 1
            )
            AND "chats"."title" = $2
        `,
        ['Name', 'title'],
      );
    });

    describe('create based on a query', () => {
      it('should have create based on find query', async () => {
        const user = await db.user.create(userData);

        const chat = await db.user.find(user.Id).chats.create({
          Title: 'title',
        });

        expect(chat.Title).toBe('title');
        const ids = await db.user.chats(user).pluck('IdOfChat');
        expect(ids).toEqual([chat.IdOfChat]);
      });

      it('should throw not found when not found even when searching with findOptional', async () => {
        const query = db.user.findOptional(1).chats.create({
          Title: 'title',
        });

        await expect(() => query).rejects.toThrow('Record is not found');
      });

      it('should throw when the main query returns many records', async () => {
        await expect(() =>
          db.user.chats.create({
            Title: 'title',
          }),
        ).rejects.toThrow(
          'Cannot create based on a query which returns multiple records',
        );
      });
    });

    it('should have chained delete method', () => {
      const query = db.user
        .where({ Name: 'Name' })
        .chats.where({ Title: 'title' })
        .delete();

      expectSql(
        query.toSql(),
        `
          DELETE FROM "chat" AS "chats"
          WHERE EXISTS (
              SELECT 1 FROM "user"
              WHERE "user"."name" = $1
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chatId" = "chats"."idOfChat"
                    AND "chatUser"."userId" = "user"."id"
                  LIMIT 1
                )
              LIMIT 1
            )
            AND "chats"."title" = $2
        `,
        ['Name', 'title'],
      );
    });

    it('should have proper joinQuery', () => {
      expectSql(
        db.user.relations.chats
          .joinQuery(db.user.as('u'), db.chat.as('c'))
          .toSql(),
        `
          SELECT ${chatSelectAll} FROM "chat" AS "c"
          WHERE EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chatId" = "c"."idOfChat"
              AND "chatUser"."userId" = "u"."id"
            LIMIT 1
          )
        `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.user.whereExists('chats').toSql(),
        `
          SELECT ${userSelectAll} FROM "user"
          WHERE EXISTS (
            SELECT 1 FROM "chat" AS "chats"
            WHERE EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."chatId" = "chats"."idOfChat"
                AND "chatUser"."userId" = "user"."id"
              LIMIT 1
            )
            LIMIT 1
          )
        `,
      );

      expectSql(
        db.user
          .as('u')
          .whereExists('chats', (q) => q.where({ Title: 'title' }))
          .toSql(),
        `
        SELECT ${userSelectAll} FROM "user" AS "u"
        WHERE EXISTS (
          SELECT 1 FROM "chat" AS "chats"
          WHERE
            EXISTS (
              SELECT 1 FROM "chatUser"
              WHERE "chatUser"."chatId" = "chats"."idOfChat"
                AND "chatUser"."userId" = "u"."id"
              LIMIT 1
            )
            AND "chats"."title" = $1
          LIMIT 1
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
        query.toSql(),
        `
        SELECT "u"."name" AS "Name", "chats"."title" AS "Title"
        FROM "user" AS "u"
        JOIN "chat" AS "chats"
          ON EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chatId" = "chats"."idOfChat"
              AND "chatUser"."userId" = "u"."id"
            LIMIT 1
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
        query.toSql(),
        `
        SELECT "u"."name" AS "Name", "c"."title" AS "Title"
        FROM "user" AS "u"
        JOIN "chat" AS "c"
          ON "c"."title" = $1
          AND "c"."updatedAt" = $2
          AND EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chatId" = "c"."idOfChat"
              AND "chatUser"."userId" = "u"."id"
            LIMIT 1
          )
      `,
        ['title', now],
      );
    });

    it('should be supported in joinLateral', () => {
      const q = db.user
        .joinLateral('chats', (q) => q.as('c').where({ Title: 'one' }))
        .where({ 'c.Title': 'two' })
        .select('Name', { chat: 'c' });

      assertType<Awaited<typeof q>, { Name: string; chat: Chat }[]>();

      expectSql(
        q.toSql(),
        `
          SELECT "user"."name" AS "Name", row_to_json("c".*) AS "chat"
          FROM "user"
          JOIN LATERAL (
            SELECT ${chatSelectAll}
            FROM "chat" AS "c"
            WHERE "c"."title" = $1
              AND EXISTS (
                SELECT 1
                FROM "chatUser"
                WHERE "chatUser"."chatId" = "c"."idOfChat"
                  AND "chatUser"."userId" = "user"."id"
                LIMIT 1
              )
          ) "c" ON true
          WHERE "c"."title" = $2
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
          query.toSql(),
          `
            SELECT
              "u"."id" AS "Id",
              (
                SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
                FROM (
                  SELECT
                    "chats"."idOfChat" AS "IdOfChat",
                    "chats"."title" AS "Title"
                  FROM "chat" AS "chats"
                  WHERE "chats"."title" = $1
                    AND EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."chatId" = "chats"."idOfChat"
                        AND "chatUser"."userId" = "u"."id"
                      LIMIT 1
                    )
                ) AS "t"
              ) AS "chats"
            FROM "user" AS "u"
          `,
          ['title'],
        );
      });

      it('should be selectable by relation name', () => {
        const query = db.user.select('*', 'chats');

        assertType<Awaited<typeof query>, (User & { chats: Chat[] })[]>();

        expectSql(
          query.toSql(),
          `
            SELECT
              ${userSelectAll},
              (
                SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
                FROM (
                  SELECT ${chatSelectAll} FROM "chat" AS "chats"
                  WHERE EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."chatId" = "chats"."idOfChat"
                      AND "chatUser"."userId" = "user"."id"
                    LIMIT 1
                  )
                ) AS "t"
              ) AS "chats"
            FROM "user"
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
        query.toSql(),
        `
          SELECT
            "u"."id" AS "Id",
            (
              SELECT count(*) FROM "chat" AS "chats"
              WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chatId" = "chats"."idOfChat"
                  AND "chatUser"."userId" = "u"."id"
                LIMIT 1
              )
            ) AS "chatsCount"
          FROM "user" AS "u"
        `,
      );
    });

    it('should allow to pluck values', () => {
      const query = db.user.as('u').select('Id', {
        titles: (q) => q.chats.pluck('Title'),
      });

      assertType<Awaited<typeof query>, { Id: number; titles: string[] }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            "u"."id" AS "Id",
            (
              SELECT COALESCE(json_agg("c"), '[]')
              FROM (
                SELECT "chats"."title" AS "c"
                FROM "chat" AS "chats"
                WHERE EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chatId" = "chats"."idOfChat"
                    AND "chatUser"."userId" = "u"."id"
                  LIMIT 1
                )
              ) AS "t"
            ) AS "titles"
          FROM "user" AS "u"
        `,
      );
    });

    it('should handle exists sub query', () => {
      const query = db.user.as('u').select('Id', {
        hasChats: (q) => q.chats.exists(),
      });

      assertType<Awaited<typeof query>, { Id: number; hasChats: boolean }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            "u"."id" AS "Id",
            COALESCE((
              SELECT true
              FROM "chat" AS "chats"
              WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chatId" = "chats"."idOfChat"
                  AND "chatUser"."userId" = "u"."id"
                LIMIT 1
              )
            ), false) AS "hasChats"
          FROM "user" AS "u"
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
        ...userData,
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
        const query = db.user.select('Id').create({
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
          .chats(user)
          .order('IdOfChat')
          .pluck('IdOfChat');

        const [createUserSql, createChatsSql] = querySpy.mock.calls.map(
          (item) => item[0],
        );
        const createChatUserSql = arraysSpy.mock.calls[0][0];

        expectSql(
          createUserSql as Sql,
          `
          INSERT INTO "user"("name", "password", "updatedAt", "createdAt")
          VALUES ($1, $2, $3, $4)
          RETURNING "user"."id" AS "Id"
        `,
          ['user 1', 'password', now, now],
        );

        expectSql(
          createChatsSql as Sql,
          `
          INSERT INTO "chat"("title", "updatedAt", "createdAt")
          VALUES ($1, $2, $3), ($4, $5, $6)
          RETURNING "chat"."idOfChat" AS "IdOfChat"
        `,
          ['chat 1', now, now, 'chat 2', now, now],
        );

        expectSql(
          createChatUserSql as Sql,
          `
          INSERT INTO "chatUser"("userId", "chatId")
          VALUES ($1, $2), ($3, $4)
        `,
          [user.Id, chatIds[0], user.Id, chatIds[1]],
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
          INSERT INTO "user"("name", "password", "updatedAt", "createdAt")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
          RETURNING "user"."id" AS "Id"
        `,
          ['user 1', 'password', now, now, 'user 2', 'password', now, now],
        );

        expectSql(
          createChatsSql as Sql,
          `
          INSERT INTO "chat"("title", "updatedAt", "createdAt")
          VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12)
          RETURNING "chat"."idOfChat" AS "IdOfChat"
        `,
          [
            'chat 1',
            now,
            now,
            'chat 2',
            now,
            now,
            'chat 3',
            now,
            now,
            'chat 4',
            now,
            now,
          ],
        );

        expectSql(
          createChatUserSql as Sql,
          `
          INSERT INTO "chatUser"("userId", "chatId")
          VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8)
        `,
          [
            users[0].Id,
            chatIds[0],
            users[0].Id,
            chatIds[1],
            users[1].Id,
            chatIds[2],
            users[1].Id,
            chatIds[3],
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
        );

        const data = {
          ...userData,
          chats: {
            create: [chatData, chatData],
          },
        };

        it('should invoke callbacks', async () => {
          await db.user.create(data);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          await db.user.createMany([data, data]);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('nested connect', () => {
      it('should support connect', async () => {
        await db.chat.createMany([
          { ...chatData, Title: 'chat 1' },
          { ...chatData, Title: 'chat 2' },
        ]);

        const query = db.user.select('Id').create({
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
          .chats(user)
          .order('IdOfChat')
          .pluck('IdOfChat');

        const [createUserSql, ...findChatsSql] = querySpy.mock.calls.map(
          (item) => item[0],
        );
        const createChatUserSql = arraysSpy.mock.calls[0][0];

        expectSql(
          createUserSql as Sql,
          `
          INSERT INTO "user"("name", "password", "updatedAt", "createdAt")
          VALUES ($1, $2, $3, $4)
          RETURNING "user"."id" AS "Id"
        `,
          ['user 1', 'password', now, now],
        );

        expect(findChatsSql.length).toBe(2);
        findChatsSql.forEach((sql, i) => {
          expectSql(
            sql as Sql,
            `
            SELECT "chats"."idOfChat" AS "IdOfChat"
            FROM "chat" AS "chats"
            WHERE "chats"."title" = $1
            LIMIT $2
          `,
            [`chat ${i + 1}`, 1],
          );
        });

        expectSql(
          createChatUserSql as Sql,
          `
          INSERT INTO "chatUser"("userId", "chatId")
          VALUES ($1, $2), ($3, $4)
        `,
          [user.Id, chatIds[0], user.Id, chatIds[1]],
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
          INSERT INTO "user"("name", "password", "updatedAt", "createdAt")
          VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
          RETURNING "user"."id" AS "Id"
        `,
          ['user 1', 'password', now, now, 'user 2', 'password', now, now],
        );

        expect(findChatsSql.length).toBe(4);
        findChatsSql.forEach((sql, i) => {
          expectSql(
            sql as Sql,
            `
            SELECT "chats"."idOfChat" AS "IdOfChat"
            FROM "chat" AS "chats"
            WHERE "chats"."title" = $1
            LIMIT $2
          `,
            [`chat ${i + 1}`, 1],
          );
        });

        expectSql(
          createChatUserSql as Sql,
          `
          INSERT INTO "chatUser"("userId", "chatId")
          VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8)
        `,
          [
            users[0].Id,
            chatIds[0],
            users[0].Id,
            chatIds[1],
            users[1].Id,
            chatIds[2],
            users[1].Id,
            chatIds[3],
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
        const chats = await db.user.chats(user).order('Title');

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

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          await db.user.createMany([data, data]);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('update', () => {
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

        const chats = await db.user.chats({ Id: userId });
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

        const chats = await db.user.chats({ Id }).pluck('Title');
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
          .chats({ Id })
          .select('Title')
          .order('Title');
        expect(chats).toEqual([{ Title: 'chat 2' }, { Title: 'chat 3' }]);
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

        const chats = await db.user.chats({ Id }).select('Title');
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

        const chats = await db.user.chats({ Id }).pluck('Title');
        expect(chats).toEqual(['chat 1']);
      });

      describe('relation callbacks', () => {
        const { beforeDelete, afterDelete, resetMocks } = useRelationCallback(
          db.user.relations.chats,
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

          await db.user.find(id).update(data);

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch update', async () => {
          resetMocks();

          const ids = await db.user.pluck('Id').createMany([
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

          await db.user.where({ Id: { in: ids } }).update(data);

          expect(beforeDelete).toHaveBeenCalledTimes(1);
          expect(afterDelete).toHaveBeenCalledTimes(1);
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

        const chats = await db.user.chats({ Id }).pluck('Title');
        expect(chats).toEqual(['chat 1']);
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
          db.user.relations.chats,
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

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch update', async () => {
          const id = await db.user.get('Id').createMany([
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

          await db.user.find(id).update(data);

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
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
          .chats({ Id: userIds[0] })
          .order('Title');
        expect(firstUserChats.map((chat) => chat.Title)).toEqual([
          'created 1',
          'created 2',
        ]);

        const secondUserChats = await db.user
          .chats({ Id: userIds[1] })
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

        const chats = await db.user.chats({ Id });
        expect(chats).toEqual([]);
      });

      describe('relation callbacks', () => {
        const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
          db.user.relations.chats,
        );

        const data = {
          chats: {
            create: [chatData, chatData],
          },
        };

        it('should invoke callbacks', async () => {
          const id = await db.user.get('Id').create(userData);

          await db.user.find(id).update(data);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });

        it('should invoke callbacks in a batch update', async () => {
          const ids = await db.user
            .pluck('Id')
            .createMany([userData, userData]);

          resetMocks();

          await db.user.where({ Id: { in: ids } }).update(data);

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
        });
      });
    });
  });
});
