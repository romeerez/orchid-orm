import { assertType, expectSql } from 'test-utils';
import {
  chatData,
  db,
  messageData,
  messageSelectAll,
  Profile,
  profileData,
  profileSelectAll,
  userData,
  useTestORM,
} from '../test-utils/test-utils';

describe('relations', () => {
  useTestORM();

  it('should select multiple relations', () => {
    const query = db.user.select({
      profile: (q) => q.profile.where({ Bio: 'bio' }),
      messages: (q) => q.messages.where({ Text: 'text' }),
    });

    expectSql(
      query.toSQL(),
      `
        SELECT
          row_to_json("profile".*) "profile",
          COALESCE("messages".r, '[]') "messages"
        FROM "user"
        LEFT JOIN LATERAL (
          SELECT ${profileSelectAll} FROM "profile"
          WHERE "profile"."bio" = $1
            AND "profile"."userId" = "user"."id"
            AND "profile"."profileKey" = "user"."userKey"
        ) "profile" ON true
        LEFT JOIN LATERAL (
          SELECT json_agg(row_to_json("t".*)) r
          FROM (
            SELECT ${messageSelectAll} FROM "message" AS "messages"
            WHERE "messages"."text" = $2
              AND "messages"."authorId" = "user"."id"
              AND "messages"."messageKey" = "user"."userKey"
          ) AS "t"
        ) "messages" ON true
      `,
      ['bio', 'text'],
    );
  });

  it('should handle sub query pluck', async () => {
    const ChatId = await db.chat.get('IdOfChat').create(chatData);
    const AuthorId = await db.user.get('Id').create(userData);

    const data = {
      ChatId,
      AuthorId,
      ...messageData,
    };

    const ids = await db.message.pluck('Id').createMany([data, data]);

    const query = db.user
      .select({
        ids: (q) => q.messages.pluck('Id'),
        dates: (q) => q.messages.pluck('createdAt'),
      })
      .take();

    const result = await query;
    expect(result).toEqual({
      ids,
      dates: [expect.any(Date), expect.any(Date)],
    });
  });

  it('should handle sub query pluck with empty results', async () => {
    await db.user.insert(userData);

    const query = db.user
      .select({
        ids: (q) => q.messages.pluck('Id'),
      })
      .take();

    const result = await query;
    expect(result).toEqual({ ids: [] });
  });

  it('should load nested relations, parse columns correctly', async () => {
    await db.message.create({
      Text: 'text',
      chat: {
        create: chatData,
      },
      user: {
        create: {
          ...userData,
          profile: {
            create: profileData,
          },
        },
      },
    });

    const q = db.message.select('createdAt', {
      chatUser: (q) =>
        q.user.select('createdAt', {
          userProfile: (q) =>
            q.profile.as('p').where({ Bio: 'bio' }).select('createdAt'),
        }),
    });

    expectSql(
      q.toSQL(),
      `
        SELECT
          "message"."createdAt",
          row_to_json("chatUser".*) "chatUser"
        FROM "message"
        LEFT JOIN LATERAL (
          SELECT
            "user"."createdAt",
            row_to_json("userProfile".*) "userProfile"
          FROM "user"
          LEFT JOIN LATERAL (
            SELECT
              "p"."createdAt"
            FROM "profile" AS "p"
            WHERE "p"."bio" = $1
              AND "p"."userId" = "user"."id"
              AND "p"."profileKey" = "user"."userKey"
          ) "userProfile" ON true
          WHERE "user"."id" = "message"."authorId"
            AND "user"."userKey" = "message"."messageKey"
        ) "chatUser" ON true
      `,
      ['bio'],
    );

    const res = await q;
    expect(res).toEqual([
      {
        createdAt: expect.any(Date),
        chatUser: {
          createdAt: expect.any(Date),
          userProfile: {
            createdAt: expect.any(Date),
          },
        },
      },
    ]);
  });

  it('should select and order by relation count', () => {
    const q = db.user
      .select({
        messagesCount: (q) => q.messages.count(),
      })
      .order({ messagesCount: 'DESC' });

    assertType<Awaited<typeof q>, { messagesCount: number }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "messagesCount".r "messagesCount"
        FROM "user"
        LEFT JOIN LATERAL (
          SELECT count(*) r
          FROM "message" AS "messages"
          WHERE "messages"."authorId" = "user"."id"
            AND "messages"."messageKey" = "user"."userKey"
        ) "messagesCount" ON true
        ORDER BY "messagesCount".r DESC
      `,
    );
  });

  it('should select and order by relation value', () => {
    const q = db.user
      .select({
        bio: (q) => q.profile.get('Bio'),
      })
      .order({ bio: 'DESC' });

    assertType<Awaited<typeof q>, { bio: string | null }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "bio".r "bio"
        FROM "user"
        LEFT JOIN LATERAL (
          SELECT "profile"."bio" r
          FROM "profile"
          WHERE "profile"."userId" = "user"."id"
            AND "profile"."profileKey" = "user"."userKey"
        ) "bio" ON true
        ORDER BY "bio".r DESC
      `,
    );
  });

  it('should support join() when selecting relation for an INNER join', () => {
    const q = db.user.select({
      profile: (q) => {
        // console.log(Object.keys(q.profile.q.joinedShapes));
        return q.profile.join();
      },
    });

    assertType<Awaited<typeof q>, { profile: Profile }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT row_to_json("profile".*) "profile"
        FROM "user"
        JOIN LATERAL (
          SELECT ${profileSelectAll}
          FROM "profile"
          WHERE "profile"."userId" = "user"."id"
            AND "profile"."profileKey" = "user"."userKey"
        ) "profile" ON true
      `,
    );
  });

  it('should fit into `makeHelper` function', async () => {
    const fn = db.post.makeHelper((arg) => arg.select('post.Title'));

    const q = db.user.select({
      posts: (q) => fn(q.posts.select('posts.Id')),
    });

    assertType<
      Awaited<typeof q>,
      { posts: { Id: number; Title: string }[] }[]
    >();

    expectSql(
      q.toSQL(),
      `
        SELECT COALESCE("posts".r, '[]') "posts"
        FROM "user"
        LEFT JOIN LATERAL (
          SELECT json_agg(row_to_json("t".*)) r
          FROM (
            SELECT "post"."id" "Id", "post"."title" "Title"
            FROM "post"
            WHERE "post"."userId" = "user"."id"
              AND "post"."title" = "user"."userKey"
          ) AS "t"
        ) "posts" ON true
      `,
    );
  });

  it('should support nested where with count conditions', async () => {
    const q = db.user.count().where((q) =>
      q.posts
        .where((q) => q.postTags.where({ Tag: 'tag' }).exists())
        .count()
        .gt(3),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT count(*)
        FROM "user"
        WHERE (
          SELECT count(*) > $1
          FROM "post" AS "posts"
          WHERE (
            SELECT true
            FROM "postTag" AS "postTags"
            WHERE "postTags"."tag" = $2
              AND "postTags"."postId" = "posts"."id"
            LIMIT 1
          )
          AND "posts"."userId" = "user"."id"
          AND "posts"."title" = "user"."userKey"
        )
      `,
      [3, 'tag'],
    );
  });

  it('should ignore duplicated joins', () => {
    const q = db.user.select('Id').join('posts').join('posts');

    expectSql(
      q.toSQL(),
      `
        SELECT "user"."id" "Id"
        FROM "user"
        JOIN "post" AS "posts"
          ON "posts"."userId" = "user"."id"
         AND "posts"."title" = "user"."userKey"
      `,
    );
  });
});
