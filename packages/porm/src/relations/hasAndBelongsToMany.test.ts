import { db } from '../test-utils/test-db';
import {
  AssertEqual,
  expectSql,
  insert,
  insertChat,
  insertUser,
  useTestDatabase,
} from '../test-utils/test-utils';
import { RelationQuery, Sql, TransactionAdapter } from 'pqb';

describe('hasAndBelongsToMany', () => {
  useTestDatabase();

  describe('querying', () => {
    it('should have method to query related data', async () => {
      const chatsQuery = db.chat.all();

      const eq: AssertEqual<
        typeof db.user.chats,
        RelationQuery<'chats', { id: number }, never, typeof chatsQuery, false>
      > = true;

      expect(eq).toBe(true);

      const userId = await insertUser();

      const chatData = {
        title: 'title',
      };
      const chat1Id = await insertChat(chatData);
      const chat2Id = await insertChat(chatData);

      await insert('chatUser', {
        id: 1,
        userId,
        chatId: chat1Id,
      });
      await insert('chatUser', {
        id: 2,
        userId,
        chatId: chat2Id,
      });

      const user = await db.user.find(userId).takeOrThrow();
      const query = db.user.chats(user);

      expectSql(
        query.toSql(),
        `
        SELECT "chats".* FROM "chat" AS "chats"
        WHERE EXISTS (
          SELECT 1 FROM "chatUser"
          WHERE "chatUser"."chatId" = "chats"."id"
            AND "chatUser"."userId" = $1
          LIMIT 1
        )
      `,
        [userId],
      );

      const messages = await query;

      expect(messages).toMatchObject([chatData, chatData]);
    });

    it('should have proper joinQuery', () => {
      expectSql(
        db.user.relations.chats.joinQuery.toSql(),
        `
        SELECT "chats".* FROM "chat" AS "chats"
        WHERE EXISTS (
          SELECT 1 FROM "chatUser"
          WHERE "chatUser"."chatId" = "chats"."id"
            AND "chatUser"."userId" = "user"."id"
          LIMIT 1
        )
      `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.user.whereExists('chats').toSql(),
        `
        SELECT "user".* FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "chat" AS "chats"
          WHERE EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chatId" = "chats"."id"
              AND "chatUser"."userId" = "user"."id"
            LIMIT 1
          )
          LIMIT 1
        )
      `,
      );

      expectSql(
        db.user
          .whereExists('chats', (q) => q.where({ 'user.name': 'name' }))
          .toSql(),
        `
        SELECT "user".* FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "chat" AS "chats"
          WHERE EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chatId" = "chats"."id"
              AND "chatUser"."userId" = "user"."id"
            LIMIT 1
          )
            AND "user"."name" = $1
          LIMIT 1
        )
      `,
        ['name'],
      );
    });

    it('should be supported in join', () => {
      const query = db.user
        .join('chats', (q) => q.where({ 'user.name': 'name' }))
        .select('name', 'chats.title');

      const eq: AssertEqual<
        Awaited<typeof query>,
        { name: string; title: string }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
        SELECT "user"."name", "chats"."title" FROM "user"
        JOIN "chat" AS "chats"
          ON EXISTS (
            SELECT 1 FROM "chatUser"
            WHERE "chatUser"."chatId" = "chats"."id"
              AND "chatUser"."userId" = "user"."id"
            LIMIT 1
          )
          AND "user"."name" = $1
      `,
        ['name'],
      );
    });

    it('should be selectable', () => {
      const query = db.user.select(
        'id',
        db.user.chats.select('id', 'title').where({ title: 'title' }),
      );

      const eq: AssertEqual<
        Awaited<typeof query>,
        { id: number; chats: { id: number; title: string }[] }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
        SELECT
          "user"."id",
          (
            SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
            FROM (
              SELECT "chats"."id", "chats"."title" FROM "chat" AS "chats"
              WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chatId" = "chats"."id"
                  AND "chatUser"."userId" = "user"."id"
                LIMIT 1
              )
              AND "chats"."title" = $1
            ) AS "t"
          ) AS "chats"
        FROM "user"
      `,
        ['title'],
      );
    });

    it('should allow to select count', () => {
      const query = db.user.select('id', db.user.chats.count());

      const eq: AssertEqual<
        Awaited<typeof query>,
        { id: number; chats: number }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
          SELECT
            "user"."id",
            (
              SELECT count(*) FROM "chat" AS "chats"
              WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chatId" = "chats"."id"
                  AND "chatUser"."userId" = "user"."id"
                LIMIT 1
              )
            ) AS "chats"
          FROM "user"
        `,
      );
    });

    it('should allow to select count with alias', () => {
      const query = db.user.select(
        'id',
        db.user.chats.count().as('chatsCount'),
      );

      const eq: AssertEqual<
        Awaited<typeof query>,
        { id: number; chatsCount: number }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
          SELECT
            "user"."id",
            (
              SELECT count(*) FROM "chat" AS "chats"
              WHERE EXISTS (
                SELECT 1 FROM "chatUser"
                WHERE "chatUser"."chatId" = "chats"."id"
                  AND "chatUser"."userId" = "user"."id"
                LIMIT 1
              )
            ) AS "chatsCount"
          FROM "user"
        `,
      );
    });
  });

  describe('insert', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    const now = new Date();
    const userData = {
      password: 'password',
      updatedAt: now,
      createdAt: now,
    };

    const chatData = {
      updatedAt: now,
      createdAt: now,
    };

    it('should support create', async () => {
      const query = db.user.insert(
        {
          name: 'user 1',
          ...userData,
          chats: {
            create: [
              {
                ...chatData,
                title: 'chat 1',
              },
              {
                ...chatData,
                title: 'chat 2',
              },
            ],
          },
        },
        ['id'],
      );

      const querySpy = jest.spyOn(TransactionAdapter.prototype, 'query');
      const arraysSpy = jest.spyOn(TransactionAdapter.prototype, 'arrays');

      const user = await query;
      const chatIds = await db.user
        .chats(user)
        .order({ id: 'ASC' })
        .pluck('id');

      const [insertUserSql, insertChatsSql] = querySpy.mock.calls.map(
        (item) => item[0],
      );
      const insertChatUserSql = arraysSpy.mock.calls[0][0];

      expectSql(
        insertUserSql as Sql,
        `
        INSERT INTO "user"("name", "password", "updatedAt", "createdAt")
        VALUES ($1, $2, $3, $4)
        RETURNING "user"."id"
      `,
        ['user 1', 'password', now, now],
      );

      expectSql(
        insertChatsSql as Sql,
        `
        INSERT INTO "chat"("updatedAt", "createdAt", "title")
        VALUES ($1, $2, $3), ($4, $5, $6)
        RETURNING "chat"."id"
      `,
        [now, now, 'chat 1', now, now, 'chat 2'],
      );

      expectSql(
        insertChatUserSql as Sql,
        `
        INSERT INTO "chatUser"("userId", "chatId")
        VALUES ($1, $2), ($3, $4)
      `,
        [user.id, chatIds[0], user.id, chatIds[1]],
      );
    });

    it('should support create many', async () => {
      const query = db.user.insert(
        [
          {
            name: 'user 1',
            ...userData,
            chats: {
              create: [
                {
                  title: 'chat 1',
                  ...chatData,
                },
                {
                  title: 'chat 2',
                  ...chatData,
                },
              ],
            },
          },
          {
            name: 'user 2',
            ...userData,
            chats: {
              create: [
                {
                  title: 'chat 3',
                  ...chatData,
                },
                {
                  title: 'chat 4',
                  ...chatData,
                },
              ],
            },
          },
        ],
        ['id'],
      );

      const querySpy = jest.spyOn(TransactionAdapter.prototype, 'query');
      const arraysSpy = jest.spyOn(TransactionAdapter.prototype, 'arrays');

      const users = await query;
      const chatIds = await db.user.join('chats').pluck('chats.id');

      const [insertUserSql, insertChatsSql] = querySpy.mock.calls.map(
        (item) => item[0],
      );
      const insertChatUserSql = arraysSpy.mock.calls[0][0];

      expectSql(
        insertUserSql as Sql,
        `
        INSERT INTO "user"("name", "password", "updatedAt", "createdAt")
        VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
        RETURNING "user"."id"
      `,
        ['user 1', 'password', now, now, 'user 2', 'password', now, now],
      );

      expectSql(
        insertChatsSql as Sql,
        `
        INSERT INTO "chat"("title", "updatedAt", "createdAt")
        VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12)
        RETURNING "chat"."id"
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
        insertChatUserSql as Sql,
        `
        INSERT INTO "chatUser"("userId", "chatId")
        VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8)
      `,
        [
          users[0].id,
          chatIds[0],
          users[0].id,
          chatIds[1],
          users[1].id,
          chatIds[2],
          users[1].id,
          chatIds[3],
        ],
      );
    });
  });
});
