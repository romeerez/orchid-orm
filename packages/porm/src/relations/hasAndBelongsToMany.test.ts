import { db } from '../test-utils/test-db';
import {
  AssertEqual,
  expectSql,
  insert,
  insertChat,
  insertUser,
  useTestDatabase,
} from '../test-utils/test-utils';
import { RelationQuery } from 'pqb';

describe('hasAndBelongsToMany', () => {
  useTestDatabase();

  it('should have method to query related data', async () => {
    const chatsQuery = db.chat.all();

    const eq: AssertEqual<
      typeof db.user.chats,
      RelationQuery<{ id: number }, typeof chatsQuery, false>
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
    const query = db.user.select('id', db.user.chats.where({ title: 'title' }));
    expectSql(
      query.toSql(),
      `
        SELECT
          "user"."id",
          (
            SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
            FROM (
              SELECT "chats".* FROM "chat" AS "chats"
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
});
