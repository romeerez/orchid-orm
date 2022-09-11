import { db } from '../test-utils/test-db';
import {
  AssertEqual,
  expectSql,
  insertProfile,
  insertUser,
  useTestDatabase,
} from '../test-utils/test-utils';
import { RelationQuery } from 'pqb';

describe('belongsTo', () => {
  useTestDatabase();

  it('should have method to query related data', async () => {
    const userQuery = db.user.takeOrThrow();
    type UserQuery = typeof userQuery;

    const eq: AssertEqual<
      typeof db.profile.user,
      RelationQuery<'user', { userId: number }, never, UserQuery, true>
    > = true;

    expect(eq).toBe(true);

    const userData = {
      id: 1,
      name: 'name',
      password: 'password',
      active: true,
    };
    const userId = await insertUser(userData);
    const profileId = await insertProfile({ userId });

    const profile = await db.profile.find(profileId).takeOrThrow();
    const query = db.profile.user(profile);

    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1
        LIMIT $2
      `,
      [userId, 1],
    );

    const user = await query;

    expect(user).toMatchObject(userData);
  });

  it('should have proper joinQuery', () => {
    expectSql(
      db.profile.relations.user.joinQuery.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = "profile"."userId"
      `,
    );
  });

  it('should be supported in whereExists', () => {
    expectSql(
      db.profile.whereExists('user').toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE "user"."id" = "profile"."userId"
          LIMIT 1
        )
      `,
    );

    expectSql(
      db.profile
        .whereExists('user', (q) => q.where({ 'user.name': 'name' }))
        .toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE "user"."id" = "profile"."userId"
            AND "user"."name" = $1
          LIMIT 1
        )
      `,
      ['name'],
    );
  });

  it('should be supported in join', () => {
    const query = db.profile
      .join('user', (q) => q.where({ 'user.name': 'name' }))
      .select('bio', 'user.name');

    const eq: AssertEqual<
      Awaited<typeof query>,
      { bio: string | null; name: string }[]
    > = true;
    expect(eq).toBe(true);

    expectSql(
      query.toSql(),
      `
        SELECT "profile"."bio", "user"."name" FROM "profile"
        JOIN "user" ON "user"."id" = "profile"."userId" AND "user"."name" = $1
      `,
      ['name'],
    );
  });

  it('should be selectable', async () => {
    const query = db.profile.select(
      'id',
      db.profile.user.select('id', 'name').where({ 'user.name': 'name' }),
    );

    const userQuery = db.profile.user;
    userQuery.table;

    const eq: AssertEqual<
      Awaited<typeof query>,
      { id: number; user: { id: number; name: string } }[]
    > = true;
    expect(eq).toBe(true);

    expectSql(
      query.toSql(),
      `
        SELECT
          "profile"."id",
          (
            SELECT row_to_json("t".*) AS "json"
            FROM (
              SELECT "user"."id", "user"."name" FROM "user"
              WHERE "user"."id" = "profile"."userId"
                AND "user"."name" = $1
              LIMIT $2
            ) AS "t"
          ) AS "user"
        FROM "profile"
      `,
      ['name', 1],
    );
  });

  describe('insert', () => {
    const now = new Date();
    const messageData = {
      meta: null,
      updatedAt: now,
      createdAt: now,
    };

    const chatData = {
      updatedAt: now,
      createdAt: now,
    };

    const userData = {
      password: 'password',
      updatedAt: now,
      createdAt: now,
    };

    const checkInsertedResults = async ({
      messageId,
      chatId,
      authorId,
      text,
      title,
      name,
    }: {
      messageId: number;
      chatId: number;
      authorId: number;
      text: string;
      title: string;
      name: string;
    }) => {
      const message = await db.message.find(messageId);
      expect(message).toEqual({
        id: messageId,
        chatId,
        authorId,
        text,
        ...messageData,
      });

      const chat = await db.chat.find(chatId);
      expect(chat).toEqual({
        id: chatId,
        title,
        ...chatData,
      });

      const user = await db.user.find(authorId);
      expect(user).toEqual({
        id: authorId,
        active: null,
        age: null,
        data: null,
        picture: null,
        name,
        ...userData,
      });
    };

    it('should support create', async () => {
      const query = db.message.insert(
        {
          text: 'text',
          ...messageData,
          chat: {
            create: {
              title: 'title',
              ...chatData,
            },
          },
          user: {
            create: {
              name: 'name',
              ...userData,
            },
          },
        },
        ['id', 'chatId', 'authorId'],
      );

      const { id: messageId, chatId, authorId } = await query;

      await checkInsertedResults({
        messageId,
        chatId,
        authorId,
        text: 'text',
        title: 'title',
        name: 'name',
      });
    });

    it('should support create many', async () => {
      const query = db.message.insert(
        [
          {
            text: 'message 1',
            ...messageData,
            chat: {
              create: {
                title: 'chat 1',
                ...chatData,
              },
            },
            user: {
              create: {
                name: 'user 1',
                ...userData,
              },
            },
          },
          {
            text: 'message 2',
            ...messageData,
            chat: {
              create: {
                title: 'chat 2',
                ...chatData,
              },
            },
            user: {
              create: {
                name: 'user 2',
                ...userData,
              },
            },
          },
        ],
        ['id', 'chatId', 'authorId'],
      );

      const [first, second] = await query;

      await checkInsertedResults({
        messageId: first.id,
        chatId: first.chatId,
        authorId: first.authorId,
        text: 'message 1',
        title: 'chat 1',
        name: 'user 1',
      });

      await checkInsertedResults({
        messageId: second.id,
        chatId: second.chatId,
        authorId: second.authorId,
        text: 'message 2',
        title: 'chat 2',
        name: 'user 2',
      });
    });
  });
});
