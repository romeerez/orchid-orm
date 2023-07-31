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
        ) "profile" ON true
        LEFT JOIN LATERAL (
          SELECT json_agg(row_to_json("t".*)) r
          FROM (
            SELECT ${messageSelectAll} FROM "message" AS "messages"
            WHERE "messages"."text" = $2
              AND "messages"."authorId" = "user"."id"
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
    await db.user.count().create(userData);

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
      ...messageData,
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
            WHERE "p"."bio" = $1 AND "p"."userId" = "user"."id"
          ) "userProfile" ON true
          WHERE "user"."id" = "message"."authorId"
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
          SELECT "profile"."bio" AS "r"
          FROM "profile"
          WHERE "profile"."userId" = "user"."id"
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
        ) "profile" ON true
      `,
    );
  });

  it('should fit into `makeHelper` function', async () => {
    const fn = db.user.makeHelper((arg) => arg.select('Name'));

    const first = fn(db.user.select('Id'));
    assertType<Awaited<typeof first>, { Id: number; Name: string }[]>();

    const second = fn(db.profile.user.select('Id'));
    assertType<Awaited<typeof second>, { Id: number; Name: string }>();
  });
});
