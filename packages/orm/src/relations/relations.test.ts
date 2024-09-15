import { assertType, expectSql } from 'test-utils';
import {
  BaseTable,
  chatData,
  db,
  messageData,
  messageSelectAll,
  postData,
  Profile,
  profileData,
  profileSelectAll,
  userData,
  useTestORM,
} from '../test-utils/orm.test-utils';
import { orchidORM } from '../orm';

describe('relations', () => {
  useTestORM();

  it('should select multiple relations', () => {
    const query = db.user.select({
      profile: (q) => q.profile.where({ Bio: 'bio' }),
      messages: (q) => q.messages.where({ Text: 'text' }),
    });

    query.then((res) => res);

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
            SELECT ${messageSelectAll} FROM "message" "messages"
            WHERE "messages"."text" = $2
              AND "messages"."authorId" = "user"."id"
              AND "messages"."messageKey" = "user"."userKey"
          ) "t"
        ) "messages" ON true
      `,
      ['bio', 'text'],
    );
  });

  it('should correctly type nested selects', () => {
    const q = db.user.select({
      profile: (q) => q.profile.select({ bio: 'profile.Bio' }),
    });

    assertType<Awaited<typeof q>, { profile: { bio: string | null } }[]>();
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
      sender: {
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
        q.sender.select('createdAt', {
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
            "sender"."createdAt",
            row_to_json("userProfile".*) "userProfile"
          FROM "user" "sender"
          LEFT JOIN LATERAL (
            SELECT
              "p"."createdAt"
            FROM "profile" "p"
            WHERE "p"."bio" = $1
              AND "p"."userId" = "sender"."id"
              AND "p"."profileKey" = "sender"."userKey"
          ) "userProfile" ON true
          WHERE "sender"."id" = "message"."authorId"
            AND "sender"."userKey" = "message"."messageKey"
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
          FROM "message" "messages"
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
          ) "t"
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
          FROM "post" "posts"
          WHERE (
            SELECT true
            FROM "postTag" "postTags"
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

  it('should support implicit lateral join', () => {
    const q = db.user
      .select('Id')
      .join('messages', (q) => q.limit(5))
      .where({ 'messages.Text': 'text' });

    expectSql(
      q.toSQL(),
      `
        SELECT "user"."id" "Id"
        FROM "user"
        JOIN LATERAL (
          SELECT "message".*
          FROM "message" "messages"
          WHERE "messages"."authorId" = "user"."id"
            AND "messages"."messageKey" = "user"."userKey"
          LIMIT $1
        ) "messages" ON true
        WHERE "messages"."text" = $2
      `,
      [5, 'text'],
    );
  });

  it('should support implicit lateral join with select inside', () => {
    const q = db.user
      .select('Id')
      .join('messages', (q) => q.select('Text'))
      .where({ 'messages.Text': 'text' });

    expectSql(
      q.toSQL(),
      `
        SELECT "user"."id" "Id"
        FROM "user"
        JOIN LATERAL (
          SELECT "messages"."text" "Text"
          FROM "message" "messages"
          WHERE "messages"."authorId" = "user"."id"
            AND "messages"."messageKey" = "user"."userKey"
        ) "messages" ON true
        WHERE "messages"."Text" = $1
      `,
      ['text'],
    );
  });

  it('should select related records count and use it in `where`', () => {
    const q = db.user
      .select({
        postsCount: (q) => q.posts.count(),
      })
      .where({ postsCount: { gt: 10 } })
      .order({ postsCount: 'DESC' });

    expectSql(
      q.toSQL(),
      `
        SELECT "postsCount".r "postsCount"
        FROM "user"
        LEFT JOIN LATERAL (
          SELECT count(*) r
          FROM "post" "posts"
          WHERE "posts"."userId" = "user"."id" AND "posts"."title" = "user"."userKey"
        ) "postsCount" ON true
        WHERE "postsCount".r > $1
        ORDER BY "postsCount".r DESC
      `,
      [10],
    );
  });

  it('should support joining aliased relation', () => {
    const q = db.user.select('Id').join((q) => q.profile.as('p'));

    expectSql(
      q.toSQL(),
      `
        SELECT "user"."id" "Id"
        FROM "user"
        JOIN "profile" AS "p"
          ON "p"."userId" = "user"."id"
         AND "p"."profileKey" = "user"."userKey"
      `,
    );
  });

  describe('sub-select `none` queries', () => {
    it('should handle empty, undefined, null results', async () => {
      await db.user.create({ ...userData, posts: { create: [postData] } });

      const q = db.user.select({
        posts: (q) => q.posts.whereIn('Id', []).select('Id'),
        postsCount: (q) => q.posts.whereIn('Id', []).count(),
        firstPost: (q) => q.posts.whereIn('Id', []).select('Id').takeOptional(),
        firstPostTitle: (q) => q.posts.whereIn('Id', []).getOptional('Title'),
        pluckPostTitles: (q) => q.posts.whereIn('Id', []).pluck('Title'),
      });

      const res = await q;

      assertType<
        typeof res,
        {
          posts: { Id: number }[];
          postsCount: number;
          firstPost: { Id: number } | undefined;
          firstPostTitle: string | undefined;
          pluckPostTitles: string[];
        }[]
      >();

      expect(res).toEqual([
        {
          posts: [],
          postsCount: 0,
          firstPost: undefined,
          firstPostTitle: undefined,
          pluckPostTitles: [],
        },
      ]);
    });

    it('should throw when sub-query result is required', async () => {
      await db.user.create({ ...userData, posts: { create: [postData] } });

      const one = db.user.select({
        firstPost: (q) => q.posts.whereIn('Id', []).select('Id').take(),
      });

      await expect(one).rejects.toThrow('Record is not found');

      const get = db.user.select({
        firstPostTitle: (q) => q.posts.whereIn('Id', []).get('Title'),
      });

      await expect(get).rejects.toThrow('Record is not found');
    });

    it('should return no records when sub-select is joined', async () => {
      await db.user.create({ ...userData, posts: { create: [postData] } });

      const q = db.user.select({
        firstPost: (q) => q.posts.join().whereIn('Id', []).select('Id').take(),
      });

      const res = await q;
      expect(res).toEqual([]);
    });
  });

  it('should be able to update json on a table without relations (#311)', () => {
    class UserTable extends BaseTable {
      readonly table = 'user';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        data: t.json(),
      }));
    }

    const local = orchidORM({ db: db.$queryBuilder }, { user: UserTable });

    local.user.find(1).update({
      data: (q) => q.get('data').jsonSet('key', 'value'),
    });
  });
});
