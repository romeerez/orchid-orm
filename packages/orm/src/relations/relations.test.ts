import { expectSql } from 'test-utils';
import {
  chatData,
  db,
  messageData,
  messageSelectAll,
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
      query.toSql(),
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
          userProfile: (q) => q.profile.select('createdAt'),
        }),
    });

    expectSql(
      q.toSql(),
      `
        SELECT
          "message"."createdAt",
          row_to_json("chatUser".*) "chatUser"
        FROM "message"
        LEFT JOIN LATERAL (
          SELECT
            "chatUser"."createdAt",
            row_to_json("userProfile".*) "userProfile"
          FROM "user" AS "chatUser"
          LEFT JOIN LATERAL (
            SELECT
              "userProfile"."createdAt"
            FROM "profile" AS "userProfile"
            WHERE "userProfile"."userId" = "chatUser"."id"
          ) "userProfile" ON true
          WHERE "chatUser"."id" = "message"."authorId"
        ) "chatUser" ON true
      `,
      [],
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
});
