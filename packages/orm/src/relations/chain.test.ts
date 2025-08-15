import {
  chatData,
  chatSelectAll,
  db,
  messageData,
  messageSelectAll,
  Post,
  postData,
  postSelectAll,
  PostTag,
  postTagData,
  postTagSelectAll,
  postTagSelectTableAll,
  profileData,
  profileSelectAll,
  tagData,
  User,
  userData,
  userJsonBuildObject,
  userSelectAll,
  userSelectAliasedAs,
  useTestORM,
  userSelectAs,
} from '../test-utils/orm.test-utils';
import { assertType, expectSql } from 'test-utils';

const activeUserData = { ...userData, Active: true };

describe('relations chain', () => {
  useTestORM();

  describe('chain select', () => {
    it('should support selecting all columns via row_number', () => {
      const q = db.chat.select({
        users: (q) => q.messages.chain('sender').order('messages.createdAt'),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("users".r, '[]') "users"
          FROM "chat"
          LEFT JOIN LATERAL (
            SELECT json_agg(${userJsonBuildObject('t')}) r
            FROM (
              SELECT ${userSelectAliasedAs('t')}
              FROM (
                SELECT ${userSelectAs(
                  'sender',
                )}, row_number() OVER (PARTITION BY "sender"."id") "r"
                FROM "user" "sender"
                JOIN "message" "messages"
                  ON (
                    "messages"."chat_id" = "chat"."id_of_chat"
                      AND "messages"."message_key" = "chat"."chat_key"
                      AND "messages"."author_id" = "sender"."id"
                      AND "messages"."message_key" = "sender"."user_key"
                  ) AND (
                    "messages"."deleted_at" IS NULL
                  )
                ORDER BY "messages"."created_at" ASC
              ) "t"
              WHERE (r = 1)
            ) "t"
          ) "users" ON true`,
      );
    });

    it('should support selecting all columns via where exists', () => {
      const q = db.chat.select({
        users: (q) => q.messages.chain('sender'),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("users".r, '[]') "users"
          FROM "chat"
          LEFT JOIN LATERAL (
            SELECT json_agg(${userJsonBuildObject('t')}) r
            FROM (
              SELECT ${userSelectAll}
              FROM "user" "sender"
              WHERE EXISTS (
                SELECT 1
                FROM "message" "messages"
                WHERE (
                  "messages"."chat_id" = "chat"."id_of_chat"
                    AND "messages"."message_key" = "chat"."chat_key"
                    AND "messages"."author_id" = "sender"."id"
                    AND "messages"."message_key" = "sender"."user_key"
                ) AND (
                  "messages"."deleted_at" IS NULL
                )
              )
            ) "t"
          ) "users" ON true`,
      );
    });

    it('should support aggregation via where exists', async () => {
      const q = db.chat.select({
        users: (q) => q.messages.chain('sender').sum('Age'),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT "users".r "users"
          FROM "chat"
          LEFT JOIN LATERAL (
            SELECT sum("sender"."age") r
            FROM "user" "sender"
            WHERE EXISTS (
              SELECT 1
              FROM "message" "messages"
              WHERE (
                "messages"."chat_id" = "chat"."id_of_chat"
                  AND "messages"."message_key" = "chat"."chat_key"
                  AND "messages"."author_id" = "sender"."id"
                  AND "messages"."message_key" = "sender"."user_key"
              ) AND (
                "messages"."deleted_at" IS NULL
              )
            )
          ) "users" ON true`,
      );
    });
  });

  describe('belongsTo', () => {
    it('should handle chained query', async () => {
      await db.user.pluck('Id').createMany(
        [userData, userData].map((data) => ({
          ...data,
          profile: {
            create: {
              ProfileKey: data.UserKey,
              Bio: 'bio',
            },
          },
        })),
      );

      const query = db.profile
        .where({ Bio: 'bio' })
        .chain('user')
        .where({ Name: userData.Name });

      expectSql(
        query.toSQL(),
        `
            SELECT ${userSelectAll} FROM "user"
            WHERE EXISTS (
                SELECT 1 FROM "profile"
                WHERE "profile"."bio" = $1
                  AND "profile"."user_id" = "user"."id"
                  AND "profile"."profile_key" = "user"."user_key"
              )
              AND "user"."name" = $2
          `,
        ['bio', 'name'],
      );

      const res = await query;

      assertType<typeof res, User[]>();

      expect(res.length).toBe(2);
    });

    it('should handle chained query with limit', async () => {
      await db.user.pluck('Id').createMany(
        [userData, userData].map((data) => ({
          ...data,
          profile: {
            create: {
              ProfileKey: data.UserKey,
              Bio: 'bio',
            },
          },
        })),
      );

      const query = db.profile
        .where({ Bio: 'bio' })
        .chain('user')
        .limit(3)
        .where({ Name: userData.Name });

      expectSql(
        query.toSQL(),
        `
            SELECT ${userSelectAll} FROM "user"
            WHERE EXISTS (
              SELECT 1 FROM "profile"
              WHERE "profile"."bio" = $1
                AND "profile"."user_id" = "user"."id"
                AND "profile"."profile_key" = "user"."user_key"
            )
              AND "user"."name" = $2
            LIMIT $3
          `,
        ['bio', 'name', 3],
      );

      const res = await query;

      assertType<typeof res, User[]>();

      expect(res.length).toBe(2);
    });

    it('should handle chained query using `on`', async () => {
      await db.user.pluck('Id').createMany(
        [activeUserData, activeUserData].map((data) => ({
          ...data,
          profile: {
            create: {
              ProfileKey: data.UserKey,
              Bio: 'bio',
            },
          },
        })),
      );

      const query = db.profile
        .where({ Bio: 'bio' })
        .chain('activeUser')
        .where({ Name: userData.Name });

      expectSql(
        query.toSQL(),
        `
            SELECT ${userSelectAll} FROM "user" "activeUser"
            WHERE "activeUser"."active" = $1
              AND EXISTS (
                SELECT 1 FROM "profile"
                WHERE "profile"."bio" = $2
                  AND "profile"."user_id" = "activeUser"."id"
                  AND "profile"."profile_key" = "activeUser"."user_key"
              )
              AND "activeUser"."name" = $3
          `,
        [true, 'bio', 'name'],
      );

      const res = await query;

      assertType<typeof res, User[]>();

      expect(res.length).toBe(2);
    });

    it('should handle long chained query', () => {
      const q = db.postTag
        .where({ Tag: 'tag' })
        .chain('post')
        .where({ Body: 'body' })
        .chain('user')
        .where({ Name: 'name' })
        .limit(3);

      assertType<Awaited<typeof q>, User[]>();

      expectSql(
        q.toSQL(),
        `
            SELECT ${userSelectAll}
            FROM "user"
            WHERE
              EXISTS (
                SELECT 1
                FROM "post"
                WHERE
                  EXISTS (
                    SELECT 1
                    FROM "postTag"
                    WHERE "postTag"."tag" = $1
                      AND "postTag"."post_id" = "post"."id"
                  )
                  AND "post"."body" = $2
                  AND "post"."user_id" = "user"."id"
                  AND "post"."title" = "user"."user_key"
              )
              AND "user"."name" = $3
            LIMIT $4
          `,
        ['tag', 'body', 'name', 3],
      );
    });

    it('should handle long chained query with `on`', () => {
      const q = db.postTag
        .where({ Tag: 'tag' })
        .chain('activePost')
        .where({ Body: 'body' })
        .chain('activeUser')
        .where({ Name: 'name' });

      assertType<Awaited<typeof q>, User[]>();

      expectSql(
        q.toSQL(),
        `
            SELECT ${userSelectAll}
            FROM "user" "activeUser"
            WHERE "activeUser"."active" = $1
              AND EXISTS (
                SELECT 1
                FROM "post"  "activePost"
                WHERE "activePost"."active" = $2
                  AND EXISTS (
                    SELECT 1
                    FROM "postTag"
                    WHERE "postTag"."tag" = $3
                      AND "postTag"."post_id" = "activePost"."id"
                  )
                  AND "activePost"."body" = $4
                  AND "activePost"."user_id" = "activeUser"."id"
                  AND "activePost"."title" = "activeUser"."user_key"
              )
              AND "activeUser"."name" = $5
          `,
        [true, true, 'tag', 'body', 'name'],
      );
    });

    it('should disable create and delete, for `on` as well', () => {
      // @ts-expect-error belongsTo should not have chained create
      db.profile.chain('user').create(userData);

      // @ts-expect-error belongsTo should not have chained create
      db.profile.chain('user').find(1).delete();

      // @ts-expect-error belongsTo should not have chained create
      db.profile.chain('activeUser').create(userData);

      // @ts-expect-error belongsTo should not have chained create
      db.profile.chain('activeUser').find(1).delete();
    });

    it('should forbid limit on belongsTo or hasOne relations', () => {
      db.postTag.select({
        // @ts-expect-error cannot apply limit here
        items: (q) => q.post.chain('user').limit(3),
      });
    });

    it('should support chaining with query query', async () => {
      const chatId = await db.chat.get('IdOfChat').create(chatData);
      await db.message.createMany([
        {
          ...messageData,
          Text: 'message c',
          Decimal: 1,
          sender: {
            create: { ...userData, Name: 'user a' },
          },
          ChatId: chatId,
        },
        {
          ...messageData,
          Text: 'message c',
          Decimal: 2,
          sender: {
            create: { ...userData, Name: 'user b' },
          },
          ChatId: chatId,
        },
        {
          ...messageData,
          Text: 'message b',
          Decimal: 3,
          sender: {
            connect: { Name: 'user b' },
          },
          ChatId: chatId,
        },
        {
          ...messageData,
          Text: 'message a',
          Decimal: 4,
          sender: {
            create: { ...userData, Name: 'user c' },
          },
          ChatId: chatId,
        },
      ]);

      const q = db.chat
        .select({
          users: (q) =>
            q.messages
              .where({ Active: null })
              .order({ Text: 'ASC' })
              .chain('sender')
              .select({
                r: 'Name',
                t: 'messages.Text',
                d: 'messages.Decimal',
              })
              .where({
                'messages.MessageKey': messageData.MessageKey,
                Name: { not: userData.Name },
              })
              .order({ Name: 'ASC', 'messages.createdAt': 'DESC' })
              .limit(2)
              .offset(1),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
            SELECT COALESCE("users".r, '[]') "users"
            FROM "chat"
            LEFT JOIN LATERAL (
              SELECT
                json_agg(json_build_object(
                  'r', t."r",
                  't', t."t",
                  'd', t."d"::text
                )) r
              FROM (
                SELECT "t"."r", "t"."t", "t"."d"
                FROM (
                  SELECT
                    "sender"."name" "r",
                    "messages"."text" "t",
                    "messages"."decimal" "d",
                    row_number() OVER (PARTITION BY "sender"."id") "r2"
                  FROM "user" "sender"
                  JOIN "message" "messages" ON (
                    "messages"."active" IS NULL AND
                    "messages"."chat_id" = "chat"."id_of_chat" AND
                    "messages"."message_key" = "chat"."chat_key" AND
                    "messages"."author_id" = "sender"."id" AND
                    "messages"."message_key" = "sender"."user_key"
                  ) AND (
                    "messages"."deleted_at" IS NULL
                  )
                  WHERE "messages"."message_key" = $1 AND "sender"."name" <> $2
                  ORDER BY "messages"."text" ASC, "sender"."name" ASC, "messages"."created_at" DESC
                ) "t"
                WHERE (r2 = 1)
                LIMIT $3
                OFFSET $4
              ) "t"
            ) "users" ON true
            LIMIT 1
          `,
        [messageData.MessageKey, userData.Name, 2, 1],
      );

      const result = await q;

      assertType<
        typeof result,
        { users: { r: string; t: string; d: string | null }[] }
      >();

      expect(result).toEqual({
        users: [
          { r: 'user a', t: 'message c', d: '1' },
          { r: 'user b', t: 'message c', d: '2' },
        ],
      });
    });

    it('should support chained select of a single record', async () => {
      await db.tag.create({
        ...tagData,
        postTags: {
          create: [
            {
              ...postTagData,
              post: {
                create: {
                  ...postData,
                  user: {
                    create: userData,
                  },
                },
              },
            },
          ],
        },
      });

      const q = db.postTag
        .select({
          item: (q) =>
            q.post
              .chain('user')
              .order('post.Id')
              .select('Name', 'Age', 'post.Title'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
            SELECT
              CASE WHEN "item".* IS NULL THEN NULL
              ELSE
                json_build_object(
                  'Name', "item"."Name",
                  'Age', "item"."Age"::text,
                  'Title', "item"."Title"
                )
              END "item"
            FROM "postTag"
            LEFT JOIN LATERAL (
              SELECT
                "user"."name" "Name",
                "user"."age" "Age",
                "post"."title" "Title"
              FROM "user"
              JOIN "post"
                ON "post"."id" = "postTag"."post_id"
               AND "post"."user_id" = "user"."id"
               AND "post"."title" = "user"."user_key"
              ORDER BY "post"."id" ASC
            ) "item" ON true
            LIMIT 1
          `,
      );

      const result = await q;

      assertType<
        typeof result,
        {
          item: { Name: string; Age: string | null; Title: string } | undefined;
        }
      >();

      expect(result).toEqual({
        item: { Name: 'name', Age: null, Title: 'key' },
      });
    });

    it('should support chained select of a single record via where exists', async () => {
      await db.tag.create({
        ...tagData,
        postTags: {
          create: [
            {
              ...postTagData,
              post: {
                create: {
                  ...postData,
                  user: {
                    create: userData,
                  },
                },
              },
            },
          ],
        },
      });

      const q = db.postTag
        .select({
          item: (q) => q.post.chain('user').select('Name', 'Age'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
            SELECT
              CASE WHEN "item".* IS NULL THEN NULL
              ELSE
                json_build_object(
                  'Name', "item"."Name",
                  'Age', "item"."Age"::text
                )
              END "item"
            FROM "postTag"
            LEFT JOIN LATERAL (
              SELECT
                "user"."name" "Name",
                "user"."age" "Age"
              FROM "user"
              WHERE EXISTS (
                SELECT 1
                FROM "post"
                WHERE "post"."id" = "postTag"."post_id"
                  AND "post"."user_id" = "user"."id"
                  AND "post"."title" = "user"."user_key"
              )
            ) "item" ON true
            LIMIT 1
        `,
      );

      const result = await q;

      assertType<
        typeof result,
        {
          item: { Name: string; Age: string | null } | undefined;
        }
      >();

      expect(result).toEqual({
        item: { Name: 'name', Age: null },
      });
    });

    it('should support chained select using `on`', async () => {
      await db.tag.create({
        ...tagData,
        postTags: {
          create: [
            {
              ...postTagData,
              post: {
                create: {
                  ...postData,
                  user: {
                    create: { ...userData, Active: true },
                  },
                },
              },
            },
          ],
        },
      });

      const q = db.postTag
        .select({
          item: (q) =>
            q.post
              .chain('activeUser')
              .order('post.Id')
              .select('Name', 'Age', 'post.Title'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
            SELECT
              CASE WHEN "item".* IS NULL THEN NULL
              ELSE
                json_build_object(
                  'Name', "item"."Name",
                  'Age', "item"."Age"::text,
                  'Title', "item"."Title"
                )
              END "item"
            FROM "postTag"
            LEFT JOIN LATERAL (
              SELECT
                "activeUser"."name" "Name",
                "activeUser"."age" "Age",
                "post"."title" "Title"
              FROM "user" "activeUser"
              JOIN "post"
                ON "post"."id" = "postTag"."post_id"
               AND "post"."user_id" = "activeUser"."id"
               AND "post"."title" = "activeUser"."user_key"
              WHERE "activeUser"."active" = $1
              ORDER BY "post"."id" ASC
            ) "item" ON true
            LIMIT 1
          `,
        [true],
      );

      const result = await q;

      assertType<
        typeof result,
        {
          item: { Name: string; Age: string | null; Title: string } | undefined;
        }
      >();

      expect(result).toEqual({
        item: { Name: 'name', Age: null, Title: 'key' },
      });
    });

    it('should support chained select using `on` via where exists', async () => {
      await db.tag.create({
        ...tagData,
        postTags: {
          create: [
            {
              ...postTagData,
              post: {
                create: {
                  ...postData,
                  user: {
                    create: { ...userData, Active: true },
                  },
                },
              },
            },
          ],
        },
      });

      const q = db.postTag
        .select({
          item: (q) => q.post.chain('activeUser').select('Name', 'Age'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
            SELECT
              CASE WHEN "item".* IS NULL THEN NULL
              ELSE
                json_build_object(
                  'Name', "item"."Name",
                  'Age', "item"."Age"::text
                )
              END "item"
            FROM "postTag"
            LEFT JOIN LATERAL (
              SELECT
                "activeUser"."name" "Name",
                "activeUser"."age" "Age"
              FROM "user" "activeUser"
              WHERE "activeUser"."active" = $1
                AND EXISTS (
                  SELECT 1
                  FROM "post"
                  WHERE "post"."id" = "postTag"."post_id"
                    AND "post"."user_id" = "activeUser"."id"
                    AND "post"."title" = "activeUser"."user_key"
                )
            ) "item" ON true
            LIMIT 1
          `,
        [true],
      );

      const result = await q;

      assertType<
        typeof result,
        {
          item: { Name: string; Age: string | null } | undefined;
        }
      >();

      expect(result).toEqual({
        item: { Name: 'name', Age: null },
      });
    });
  });

  describe('hasOne', () => {
    it('should handle chained query', () => {
      const query = db.user
        .where({ Name: 'name' })
        .chain('profile')
        .where({ Bio: 'bio' });

      expectSql(
        query.toSQL(),
        `
            SELECT ${profileSelectAll} FROM "profile"
            WHERE EXISTS (
                SELECT 1 FROM "user"
                WHERE "user"."name" = $1
                  AND "user"."id" = "profile"."user_id"
              AND "user"."user_key" = "profile"."profile_key"
              )
              AND "profile"."bio" = $2
          `,
        ['name', 'bio'],
      );
    });

    it('should handle chained query using `on`', () => {
      const query = db.user
        .where({ Name: 'name' })
        .chain('activeProfile')
        .where({ Bio: 'bio' });

      expectSql(
        query.toSQL(),
        `
            SELECT ${profileSelectAll} FROM "profile" "activeProfile"
            WHERE "activeProfile"."active" = $1
              AND EXISTS (
                SELECT 1 FROM "user"
                WHERE "user"."name" = $2
                  AND "user"."id" = "activeProfile"."user_id"
              AND "user"."user_key" = "activeProfile"."profile_key"
              )
              AND "activeProfile"."bio" = $3
          `,
        [true, 'name', 'bio'],
      );
    });

    it('should handle long chained query', () => {
      const q = db.user
        .where({ Name: 'name' })
        .chain('onePost')
        .where({ Body: 'body' })
        .chain('onePostTag')
        .where({ Tag: 'tag' });

      assertType<Awaited<typeof q>, PostTag[]>();

      expectSql(
        q.toSQL(),
        `
            SELECT ${postTagSelectAll}
            FROM "postTag" "onePostTag"
            WHERE
              EXISTS (
                SELECT 1
                FROM "post"  "onePost"
                WHERE
                  EXISTS (
                    SELECT 1
                    FROM "user"
                    WHERE "user"."name" = $1
                      AND "user"."id" = "onePost"."user_id"
                      AND "user"."user_key" = "onePost"."title"
                  )
                  AND "onePost"."body" = $2
                  AND "onePost"."id" = "onePostTag"."post_id"
              )
              AND "onePostTag"."tag" = $3
          `,
        ['name', 'body', 'tag'],
      );
    });

    it('should handle long chained query using `on`', () => {
      const q = db.user
        .where({ Name: 'name' })
        .chain('activeOnePost')
        .where({ Body: 'body' })
        .chain('activeOnePostTag')
        .where({ Tag: 'tag' });

      assertType<Awaited<typeof q>, PostTag[]>();

      expectSql(
        q.toSQL(),
        `
            SELECT ${postTagSelectAll}
            FROM "postTag" "activeOnePostTag"
            WHERE "activeOnePostTag"."active" = $1
              AND EXISTS (
                SELECT 1
                FROM "post"  "activeOnePost"
                WHERE "activeOnePost"."active" = $2
                  AND EXISTS (
                    SELECT 1
                    FROM "user"
                    WHERE "user"."name" = $3
                      AND "user"."id" = "activeOnePost"."user_id"
                      AND "user"."user_key" = "activeOnePost"."title"
                  )
                  AND "activeOnePost"."body" = $4
                  AND "activeOnePost"."id" = "activeOnePostTag"."post_id"
              )
              AND "activeOnePostTag"."tag" = $5
          `,
        [true, true, 'name', 'body', 'tag'],
      );
    });

    describe('chained create', () => {
      it('should create based on find query', () => {
        const query = db.user.find(1).chain('profile').create({
          Bio: 'bio',
        });

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "profile"("user_id", "profile_key", "bio")
            SELECT "user"."id" "UserId", "user"."user_key" "ProfileKey", $1
            FROM "user"
            WHERE "user"."id" = $2
            LIMIT 1
            RETURNING ${profileSelectAll}
          `,
          ['bio', 1],
        );
      });

      it('should create based on find query using `on`', () => {
        const query = db.user.find(1).chain('activeProfile').create({
          Bio: 'bio',
        });

        expectSql(
          query.toSQL(),
          `
              INSERT INTO "profile"("user_id", "profile_key", "active", "bio")
              SELECT "user"."id" "UserId", "user"."user_key" "ProfileKey", $1, $2
              FROM "user"
              WHERE "user"."id" = $3
              LIMIT 1
              RETURNING ${profileSelectAll}
            `,
          [true, 'bio', 1],
        );
      });

      it('should throw when the main query returns many records', async () => {
        await expect(
          async () =>
            await db.user.chain('profile').create({
              Bio: 'bio',
            }),
        ).rejects.toThrow(
          'Cannot create based on a query which returns multiple records',
        );
      });

      it('should throw when main record is not found', async () => {
        const q = db.user.find(1).chain('profile').create({
          Bio: 'bio',
        });

        await expect(q).rejects.toThrow('Record is not found');
      });

      it('should not throw when searching with findOptional', async () => {
        await db.user.findOptional(1).chain('profile').takeOptional().create({
          Bio: 'bio',
        });
      });
    });

    describe('chained delete', () => {
      it('should delete relation records', () => {
        const query = db.user
          .where({ Name: 'name' })
          .chain('profile')
          .where({ Bio: 'bio' })
          .delete();

        expectSql(
          query.toSQL(),
          `
              DELETE FROM "profile"
              WHERE EXISTS (
                  SELECT 1 FROM "user"
                  WHERE "user"."name" = $1
                    AND "user"."id" = "profile"."user_id"
                AND "user"."user_key" = "profile"."profile_key"
                )
                AND "profile"."bio" = $2
            `,
          ['name', 'bio'],
        );
      });

      it('should delete relation records using `on`', () => {
        const query = db.user
          .where({ Name: 'name' })
          .chain('activeProfile')
          .where({ Bio: 'bio' })
          .delete();

        expectSql(
          query.toSQL(),
          `
              DELETE FROM "profile"  "activeProfile"
              WHERE "activeProfile"."active" = $1
                AND EXISTS (
                  SELECT 1 FROM "user"
                  WHERE "user"."name" = $2
                    AND "user"."id" = "activeProfile"."user_id"
                AND "user"."user_key" = "activeProfile"."profile_key"
                )
                AND "activeProfile"."bio" = $3
            `,
          [true, 'name', 'bio'],
        );
      });
    });

    it('should support chained select returning multiple', async () => {
      await db.user.create({
        ...userData,
        posts: {
          create: [
            {
              ...postData,
              Body: 'post 2',
              postTags: {
                create: [
                  {
                    ...postTagData,
                    Tag: 'tag 1',
                    tag: {
                      create: { Tag: 'tag 1' },
                    },
                  },
                ],
              },
            },
            {
              ...postData,
              Body: 'post 1',
              postTags: {
                create: [
                  {
                    ...postTagData,
                    Tag: 'tag 2',
                    tag: {
                      create: { Tag: 'tag 2' },
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      const q = db.user
        .select({
          item: (q) =>
            q.posts
              .chain('onePostTag')
              .select('Tag', 'posts.Body')
              .order('posts.Body', 'Tag'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
            SELECT COALESCE("item".r, '[]') "item"
            FROM "user"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) r
              FROM (
                SELECT "t"."Tag", "t"."Body"
                FROM (
                  SELECT
                    "onePostTag"."tag" "Tag",
                    "posts"."body" "Body",
                    row_number() OVER (PARTITION BY "onePostTag"."post_id", "onePostTag"."tag") "r"
                  FROM "postTag" "onePostTag"
                  JOIN "post" "posts"
                    ON "posts"."user_id" = "user"."id"
                   AND "posts"."title" = "user"."user_key"
                   AND "posts"."id" = "onePostTag"."post_id"
                  ORDER BY "posts"."body" ASC, "onePostTag"."tag" ASC
                ) "t"
                WHERE (r = 1)
              ) "t"
            ) "item" ON true
            LIMIT 1
          `,
      );

      const result = await q;

      assertType<typeof result, { item: { Tag: string; Body: string }[] }>();

      expect(result).toEqual({
        item: [
          { Tag: 'tag 2', Body: 'post 1' },
          { Tag: 'tag 1', Body: 'post 2' },
        ],
      });
    });

    it('should support chained select returning single', async () => {
      await db.user.create({
        ...userData,
        onePost: {
          create: {
            ...postData,
            postTags: {
              create: [
                {
                  ...postTagData,
                  tag: {
                    create: tagData,
                  },
                },
              ],
            },
          },
        },
      });

      const q = db.user
        .select({
          item: (q) =>
            q.onePost
              .chain('onePostTag')
              .order('onePost.Id')
              .select('Tag', 'onePost.Body'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
            SELECT row_to_json("item".*) "item"
            FROM "user"
            LEFT JOIN LATERAL (
              SELECT "onePostTag"."tag" "Tag", "onePost"."body" "Body"
              FROM "postTag" "onePostTag"
              JOIN "post" "onePost"
                ON "onePost"."user_id" = "user"."id"
               AND "onePost"."title" = "user"."user_key"
               AND "onePost"."id" = "onePostTag"."post_id"
              ORDER BY "onePost"."id" ASC
            ) "item" ON true
            LIMIT 1
          `,
      );

      const result = await q;

      assertType<
        typeof result,
        { item: { Tag: string; Body: string } | undefined }
      >();

      expect(result).toEqual({
        item: { Tag: 'tag', Body: 'body' },
      });
    });

    it('should support chained select returning single via where exists', async () => {
      await db.user.create({
        ...userData,
        onePost: {
          create: {
            ...postData,
            postTags: {
              create: [
                {
                  ...postTagData,
                  tag: {
                    create: tagData,
                  },
                },
              ],
            },
          },
        },
      });

      const q = db.user
        .select({
          item: (q) => q.onePost.chain('onePostTag').select('Tag'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json("item".*) "item"
          FROM "user"
          LEFT JOIN LATERAL (
            SELECT "onePostTag"."tag" "Tag"
            FROM "postTag" "onePostTag"
            WHERE EXISTS (
              SELECT 1
              FROM "post" "onePost"
              WHERE "onePost"."user_id" = "user"."id"
                AND "onePost"."title" = "user"."user_key"
                AND "onePost"."id" = "onePostTag"."post_id"
            )
          ) "item" ON true
          LIMIT 1
        `,
      );

      const result = await q;

      assertType<typeof result, { item: { Tag: string } | undefined }>();

      expect(result).toEqual({
        item: { Tag: 'tag' },
      });
    });

    it('should support chained select using `on`', async () => {
      await db.user.create({
        ...userData,
        onePost: {
          create: {
            ...postData,
            Active: true,
            postTags: {
              create: [
                {
                  ...postTagData,
                  Active: true,
                  tag: {
                    create: tagData,
                  },
                },
              ],
            },
          },
        },
      });

      const q = db.user
        .select({
          item: (q) =>
            q.activeOnePost.chain('activeOnePostTag').order('activeOnePost.Id'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
            SELECT row_to_json("item".*) "item"
            FROM "user"
            LEFT JOIN LATERAL (
              SELECT ${postTagSelectTableAll('activeOnePostTag')}
              FROM "postTag" "activeOnePostTag"
              JOIN "post" "activeOnePost"
                ON "activeOnePost"."active" = $1
               AND "activeOnePost"."user_id" = "user"."id"
               AND "activeOnePost"."title" = "user"."user_key"
               AND "activeOnePost"."id" = "activeOnePostTag"."post_id"
              WHERE "activeOnePostTag"."active" = $2
              ORDER BY "activeOnePost"."id" ASC
            ) "item" ON true
            LIMIT 1
          `,
        [true, true],
      );

      const result = await q;

      assertType<typeof result, { item: PostTag | undefined }>();

      expect(result).toEqual({
        item: { PostId: expect.any(Number), Tag: 'tag', Active: true },
      });
    });

    it('should support chained select using `on` via where exists', async () => {
      await db.user.create({
        ...userData,
        onePost: {
          create: {
            ...postData,
            Active: true,
            postTags: {
              create: [
                {
                  ...postTagData,
                  Active: true,
                  tag: {
                    create: tagData,
                  },
                },
              ],
            },
          },
        },
      });

      const q = db.user
        .select({
          item: (q) => q.activeOnePost.chain('activeOnePostTag'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
            SELECT row_to_json("item".*) "item"
            FROM "user"
            LEFT JOIN LATERAL (
              SELECT ${postTagSelectAll}
              FROM "postTag" "activeOnePostTag"
              WHERE "activeOnePostTag"."active" = $1
                AND EXISTS (
                  SELECT 1
                  FROM "post" "activeOnePost"
                  WHERE "activeOnePost"."active" = $2
                    AND "activeOnePost"."user_id" = "user"."id"
                    AND "activeOnePost"."title" = "user"."user_key"
                    AND "activeOnePost"."id" = "activeOnePostTag"."post_id"
                )
            ) "item" ON true
            LIMIT 1
          `,
        [true, true],
      );

      const result = await q;

      assertType<typeof result, { item: PostTag | undefined }>();

      expect(result).toEqual({
        item: { PostId: expect.any(Number), Tag: 'tag', Active: true },
      });
    });
  });

  describe('hasOne through', () => {
    it('should handle chained query', () => {
      const query = db.message
        .where({ Text: 'text' })
        .chain('profile')
        .where({ Bio: 'bio' });

      expectSql(
        query.toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile"
          WHERE EXISTS (
              SELECT 1 FROM "message"
              WHERE ("message"."text" = $1
                AND EXISTS (
                  SELECT 1 FROM "user"  "sender"
                  WHERE "profile"."user_id" = "sender"."id"
                    AND "profile"."profile_key" = "sender"."user_key"
                    AND "sender"."id" = "message"."author_id"
                    AND "sender"."user_key" = "message"."message_key"
                ))
                AND ("message"."deleted_at" IS NULL)
            )
            AND "profile"."bio" = $2
        `,
        ['text', 'bio'],
      );
    });

    it('should handle chained query using `on`', () => {
      const query = db.message
        .where({ Text: 'text' })
        .chain('activeProfile')
        .where({ Bio: 'bio' });

      expectSql(
        query.toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile" "activeProfile"
          WHERE EXISTS (
              SELECT 1 FROM "message"
              WHERE ("message"."text" = $1
                AND EXISTS (
                  SELECT 1 FROM "user"  "activeSender"
                  WHERE "activeProfile"."active" = $2
                    AND "activeProfile"."user_id" = "activeSender"."id"
                    AND "activeProfile"."profile_key" = "activeSender"."user_key"
                    AND "activeSender"."active" = $3
                    AND "activeSender"."id" = "message"."author_id"
                    AND "activeSender"."user_key" = "message"."message_key"
                ))
                AND ("message"."deleted_at" IS NULL)
            )
            AND "activeProfile"."bio" = $4
        `,
        ['text', true, true, 'bio'],
      );
    });

    it('should handle long chained query', () => {
      const q = db.message
        .where({ Text: 'text' })
        .chain('profile')
        .where({ Bio: 'bio' })
        .chain('onePost')
        .where({ Body: 'body' });

      assertType<Awaited<typeof q>, Post[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${postSelectAll}
          FROM "post" "onePost"
          WHERE
            EXISTS (
              SELECT 1
              FROM "profile"
              WHERE
                EXISTS (
                  SELECT 1
                  FROM "message"
                  WHERE ("message"."text" = $1
                    AND EXISTS (
                      SELECT 1
                      FROM "user"  "sender"
                      WHERE "profile"."user_id" = "sender"."id"
                        AND "profile"."profile_key" = "sender"."user_key"
                        AND "sender"."id" = "message"."author_id"
                        AND "sender"."user_key" = "message"."message_key"
                    ))
                    AND ("message"."deleted_at" IS NULL)
                )
                AND "profile"."bio" = $2
                AND EXISTS (
                  SELECT 1
                  FROM "user"
                  WHERE "onePost"."user_id" = "user"."id"
                    AND "onePost"."title" = "user"."user_key"
                    AND "user"."id" = "profile"."user_id"
                    AND "user"."user_key" = "profile"."profile_key"
                )
            )
            AND "onePost"."body" = $3
        `,
        ['text', 'bio', 'body'],
      );
    });

    it('should handle long chained query using `on`', () => {
      const q = db.message
        .where({ Text: 'text' })
        .chain('activeProfile')
        .where({ Bio: 'bio' })
        .chain('activeOnePost')
        .where({ Body: 'body' });

      assertType<Awaited<typeof q>, Post[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${postSelectAll}
          FROM "post" "activeOnePost"
          WHERE
            EXISTS (
              SELECT 1
              FROM "profile"  "activeProfile"
              WHERE
                EXISTS (
                  SELECT 1
                  FROM "message"
                  WHERE ("message"."text" = $1
                    AND EXISTS (
                      SELECT 1
                      FROM "user"  "activeSender"
                      WHERE "activeProfile"."active" = $2
                        AND "activeProfile"."user_id" = "activeSender"."id"
                        AND "activeProfile"."profile_key" = "activeSender"."user_key"
                        AND "activeSender"."active" = $3
                        AND "activeSender"."id" = "message"."author_id"
                        AND "activeSender"."user_key" = "message"."message_key"
                    ))
                    AND ("message"."deleted_at" IS NULL)
                )
                AND "activeProfile"."bio" = $4
                AND EXISTS (
                  SELECT 1
                  FROM "user"  "activeUser"
                  WHERE "activeOnePost"."active" = $5
                    AND "activeOnePost"."user_id" = "activeUser"."id"
                    AND "activeOnePost"."title" = "activeUser"."user_key"
                    AND "activeUser"."active" = $6
                    AND "activeUser"."id" = "activeProfile"."user_id"
                    AND "activeUser"."user_key" = "activeProfile"."profile_key"
                )
            )
            AND "activeOnePost"."body" = $7
        `,
        ['text', true, true, 'bio', true, true, 'body'],
      );
    });

    it('should disable create', () => {
      // @ts-expect-error hasOne with through option should not have chained create
      db.message.chain('profile').create(chatData);
    });

    it('should support chained delete', () => {
      const query = db.message
        .where({ Text: 'text' })
        .chain('profile')
        .where({ Bio: 'bio' })
        .delete();

      expectSql(
        query.toSQL(),
        `
          DELETE FROM "profile"
          WHERE EXISTS (
              SELECT 1 FROM "message"
              WHERE ("message"."text" = $1
                AND EXISTS (
                  SELECT 1 FROM "user"  "sender"
                  WHERE "profile"."user_id" = "sender"."id"
                    AND "profile"."profile_key" = "sender"."user_key"
                    AND "sender"."id" = "message"."author_id"
                    AND "sender"."user_key" = "message"."message_key"
                ))
                AND ("message"."deleted_at" IS NULL)
            )
            AND "profile"."bio" = $2
        `,
        ['text', 'bio'],
      );
    });

    it('should support chained delete using `on`', () => {
      const query = db.message
        .where({ Text: 'text' })
        .chain('activeProfile')
        .where({ Bio: 'bio' })
        .delete();

      expectSql(
        query.toSQL(),
        `
          DELETE FROM "profile"  "activeProfile"
          WHERE EXISTS (
              SELECT 1 FROM "message"
              WHERE ("message"."text" = $1
                AND EXISTS (
                  SELECT 1 FROM "user"  "activeSender"
                  WHERE "activeProfile"."active" = $2
                    AND "activeProfile"."user_id" = "activeSender"."id"
                    AND "activeProfile"."profile_key" = "activeSender"."user_key"
                    AND "activeSender"."active" = $3
                    AND "activeSender"."id" = "message"."author_id"
                    AND "activeSender"."user_key" = "message"."message_key"
                ))
                AND ("message"."deleted_at" IS NULL)
            )
            AND "activeProfile"."bio" = $4
        `,
        ['text', true, true, 'bio'],
      );
    });

    it('should support chained select returning multiple', async () => {
      await db.user.create({
        ...userData,
        posts: {
          create: [
            {
              ...postData,
              Body: 'post 2',
              onePostTag: {
                create: {
                  ...postTagData,
                  Tag: 'tag 1',
                  tag: {
                    create: { Tag: 'tag 1' },
                  },
                },
              },
            },
            {
              ...postData,
              Body: 'post 1',
              onePostTag: {
                create: {
                  ...postTagData,
                  Tag: 'tag 2',
                  tag: {
                    create: { Tag: 'tag 2' },
                  },
                },
              },
            },
          ],
        },
      });

      const q = db.user
        .select({
          tags: (q) =>
            q.posts
              .chain('onePostTag')
              .select('Tag', 'posts.Body')
              .order('posts.Body', 'Tag'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("tags".r, '[]') "tags"
          FROM "user"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT "t"."Tag", "t"."Body"
              FROM (
                SELECT
                  "onePostTag"."tag" "Tag",
                  "posts"."body" "Body",
                  row_number() OVER (PARTITION BY "onePostTag"."post_id", "onePostTag"."tag") "r"
                FROM "postTag" "onePostTag"
                JOIN "post" "posts"
                  ON "posts"."user_id" = "user"."id"
                 AND "posts"."title" = "user"."user_key"
                 AND "posts"."id" = "onePostTag"."post_id"
                ORDER BY "posts"."body" ASC, "onePostTag"."tag" ASC
              ) "t"
              WHERE (r = 1)
            ) "t"
          ) "tags" ON true
          LIMIT 1
        `,
      );

      const result = await q;

      assertType<typeof result, { tags: { Tag: string; Body: string }[] }>();

      expect(result).toEqual({
        tags: [
          { Tag: 'tag 2', Body: 'post 1' },
          { Tag: 'tag 1', Body: 'post 2' },
        ],
      });
    });

    it('should support chained select returning single', async () => {
      await db.message.create({
        ...messageData,
        chat: { create: chatData },
        sender: {
          create: {
            ...userData,
            profile: { create: profileData },
            posts: { create: [postData] },
          },
        },
      });

      const q = db.message
        .select({
          item: (q) =>
            q.profile.chain('onePost').order('profile.Id').select('Body'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json("item".*) "item"
          FROM "message"
          LEFT JOIN LATERAL (
            SELECT "onePost"."body" "Body"
            FROM "post" "onePost"
            JOIN "profile" ON EXISTS (
                SELECT 1 FROM "user"  "sender"
                WHERE "profile"."user_id" = "sender"."id"
                  AND "profile"."profile_key" = "sender"."user_key"
                  AND "sender"."id" = "message"."author_id"
                  AND "sender"."user_key" = "message"."message_key"
              ) AND EXISTS (
                SELECT 1 FROM "user"
                WHERE "onePost"."user_id" = "user"."id"
                  AND "onePost"."title" = "user"."user_key"
                  AND "user"."id" = "profile"."user_id"
                  AND "user"."user_key" = "profile"."profile_key"
              )
            ORDER BY "profile"."id" ASC
          ) "item" ON true
          WHERE ("message"."deleted_at" IS NULL)
          LIMIT 1
        `,
      );

      const result = await q;

      assertType<typeof result, { item: { Body: string } | undefined }>();

      expect(result).toEqual({ item: { Body: postData.Body } });
    });

    it('should support chained select returning single via where exists', async () => {
      await db.message.create({
        ...messageData,
        chat: { create: chatData },
        sender: {
          create: {
            ...userData,
            profile: { create: profileData },
            posts: { create: [postData] },
          },
        },
      });

      const q = db.message
        .select({
          item: (q) => q.profile.chain('onePost').select('Body'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json("item".*) "item"
          FROM "message"
          LEFT JOIN LATERAL (
            SELECT "onePost"."body" "Body"
            FROM "post" "onePost"
            WHERE EXISTS (
              SELECT 1
              FROM "profile"
              WHERE EXISTS (
                SELECT 1 FROM "user" "sender"
                WHERE "profile"."user_id" = "sender"."id"
                  AND "profile"."profile_key" = "sender"."user_key"
                  AND "sender"."id" = "message"."author_id"
                  AND "sender"."user_key" = "message"."message_key"
              ) AND EXISTS (
                SELECT 1 FROM "user"
                WHERE "onePost"."user_id" = "user"."id"
                  AND "onePost"."title" = "user"."user_key"
                  AND "user"."id" = "profile"."user_id"
                  AND "user"."user_key" = "profile"."profile_key"
              )
            )
          ) "item" ON true
          WHERE ("message"."deleted_at" IS NULL)
            LIMIT 1
        `,
      );

      const result = await q;

      assertType<typeof result, { item: { Body: string } | undefined }>();

      expect(result).toEqual({ item: { Body: postData.Body } });
    });

    it('should support chained select using `on`', async () => {
      await db.message.create({
        ...messageData,
        chat: { create: chatData },
        sender: {
          create: {
            ...userData,
            Active: true,
            profile: { create: { ...profileData, Active: true } },
            posts: { create: [{ ...postData, Active: true }] },
          },
        },
      });

      const q = db.message
        .select({
          item: (q) =>
            q.activeProfile
              .chain('activeOnePost')
              .order('activeProfile.Id')
              .select('Body'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json("item".*) "item"
          FROM "message"
          LEFT JOIN LATERAL (
            SELECT "activeOnePost"."body" "Body"
            FROM "post" "activeOnePost"
            JOIN "profile" "activeProfile" ON EXISTS (
                SELECT 1 FROM "user"  "activeSender"
                WHERE "activeProfile"."active" = $1
                  AND "activeProfile"."user_id" = "activeSender"."id"
                  AND "activeProfile"."profile_key" = "activeSender"."user_key"
                  AND "activeSender"."active" = $2
                  AND "activeSender"."id" = "message"."author_id"
                  AND "activeSender"."user_key" = "message"."message_key"
              ) AND EXISTS (
                SELECT 1 FROM "user" "activeUser"
                WHERE "activeOnePost"."active" = $3
                  AND "activeOnePost"."user_id" = "activeUser"."id"
                  AND "activeOnePost"."title" = "activeUser"."user_key"
                  AND "activeUser"."active" = $4
                  AND "activeUser"."id" = "activeProfile"."user_id"
                  AND "activeUser"."user_key" = "activeProfile"."profile_key"
              )
              ORDER BY "activeProfile"."id" ASC
          ) "item" ON true
          WHERE ("message"."deleted_at" IS NULL)
          LIMIT 1
        `,
        [true, true, true, true],
      );

      const result = await q;

      assertType<typeof result, { item: { Body: string } | undefined }>();

      expect(result).toEqual({ item: { Body: postData.Body } });
    });

    it('should support chained select using `on` via where exists', async () => {
      await db.message.create({
        ...messageData,
        chat: { create: chatData },
        sender: {
          create: {
            ...userData,
            Active: true,
            profile: { create: { ...profileData, Active: true } },
            posts: { create: [{ ...postData, Active: true }] },
          },
        },
      });

      const q = db.message
        .select({
          item: (q) => q.activeProfile.chain('activeOnePost').select('Body'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json("item".*) "item"
          FROM "message"
          LEFT JOIN LATERAL (
            SELECT "activeOnePost"."body" "Body"
            FROM "post" "activeOnePost"
            WHERE EXISTS (
              SELECT 1
              FROM "profile" "activeProfile"
              WHERE EXISTS (
                SELECT 1 FROM "user"  "activeSender"
                WHERE "activeProfile"."active" = $1
                  AND "activeProfile"."user_id" = "activeSender"."id"
                  AND "activeProfile"."profile_key" = "activeSender"."user_key"
                  AND "activeSender"."active" = $2
                  AND "activeSender"."id" = "message"."author_id"
                  AND "activeSender"."user_key" = "message"."message_key"
              ) AND EXISTS (
                SELECT 1 FROM "user" "activeUser"
                WHERE "activeOnePost"."active" = $3
                  AND "activeOnePost"."user_id" = "activeUser"."id"
                  AND "activeOnePost"."title" = "activeUser"."user_key"
                  AND "activeUser"."active" = $4
                  AND "activeUser"."id" = "activeProfile"."user_id"
                  AND "activeUser"."user_key" = "activeProfile"."profile_key"
              )
            )
          ) "item" ON true
          WHERE ("message"."deleted_at" IS NULL)
          LIMIT 1
        `,
        [true, true, true, true],
      );

      const result = await q;

      assertType<typeof result, { item: { Body: string } | undefined }>();

      expect(result).toEqual({ item: { Body: postData.Body } });
    });

    it('should support chained select using `on`', async () => {
      await db.message.create({
        ...messageData,
        chat: { create: chatData },
        sender: {
          create: {
            ...userData,
            Active: true,
            profile: { create: { ...profileData, Active: true } },
            posts: { create: [{ ...postData, Active: true }] },
          },
        },
      });

      const q = db.message
        .select({
          item: (q) =>
            q.activeProfile
              .chain('activeOnePost')
              .order('activeProfile.Id')
              .select('Body'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json("item".*) "item"
          FROM "message"
          LEFT JOIN LATERAL (
            SELECT "activeOnePost"."body" "Body"
            FROM "post" "activeOnePost"
            JOIN "profile" "activeProfile" ON
              EXISTS (
                SELECT 1 FROM "user"  "activeSender"
                WHERE "activeProfile"."active" = $1
                  AND "activeProfile"."user_id" = "activeSender"."id"
                  AND "activeProfile"."profile_key" = "activeSender"."user_key"
                  AND "activeSender"."active" = $2
                  AND "activeSender"."id" = "message"."author_id"
                  AND "activeSender"."user_key" = "message"."message_key"
              ) AND EXISTS (
                SELECT 1 FROM "user"  "activeUser"
                WHERE "activeOnePost"."active" = $3
                  AND "activeOnePost"."user_id" = "activeUser"."id"
                  AND "activeOnePost"."title" = "activeUser"."user_key"
                  AND "activeUser"."active" = $4
                  AND "activeUser"."id" = "activeProfile"."user_id"
                  AND "activeUser"."user_key" = "activeProfile"."profile_key"
              )
              ORDER BY "activeProfile"."id" ASC
          ) "item" ON true
          WHERE ("message"."deleted_at" IS NULL)
          LIMIT 1
        `,
        [true, true, true, true],
      );

      const result = await q;

      assertType<typeof result, { item: { Body: string } | undefined }>();

      expect(result).toEqual({ item: { Body: postData.Body } });
    });

    it('should support chained select using `on` via where exists', async () => {
      await db.message.create({
        ...messageData,
        chat: { create: chatData },
        sender: {
          create: {
            ...userData,
            Active: true,
            profile: { create: { ...profileData, Active: true } },
            posts: { create: [{ ...postData, Active: true }] },
          },
        },
      });

      const q = db.message
        .select({
          item: (q) => q.activeProfile.chain('activeOnePost').select('Body'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json("item".*) "item"
          FROM "message"
          LEFT JOIN LATERAL (
            SELECT "activeOnePost"."body" "Body"
            FROM "post" "activeOnePost"
            WHERE EXISTS (
              SELECT 1
              FROM "profile" "activeProfile"
              WHERE EXISTS (
                  SELECT 1 FROM "user"  "activeSender"
                  WHERE "activeProfile"."active" = $1
                    AND "activeProfile"."user_id" = "activeSender"."id"
                    AND "activeProfile"."profile_key" = "activeSender"."user_key"
                    AND "activeSender"."active" = $2
                    AND "activeSender"."id" = "message"."author_id"
                    AND "activeSender"."user_key" = "message"."message_key"
                ) AND EXISTS (
                  SELECT 1 FROM "user"  "activeUser"
                  WHERE "activeOnePost"."active" = $3
                    AND "activeOnePost"."user_id" = "activeUser"."id"
                    AND "activeOnePost"."title" = "activeUser"."user_key"
                    AND "activeUser"."active" = $4
                    AND "activeUser"."id" = "activeProfile"."user_id"
                    AND "activeUser"."user_key" = "activeProfile"."profile_key"
                )
            )
          ) "item" ON true
          WHERE ("message"."deleted_at" IS NULL)
          LIMIT 1
        `,
        [true, true, true, true],
      );

      const result = await q;

      assertType<typeof result, { item: { Body: string } | undefined }>();

      expect(result).toEqual({ item: { Body: postData.Body } });
    });
  });

  describe('hasMany', () => {
    it('should handle chained query', () => {
      const query = db.user
        .where({ Name: 'name' })
        .chain('messages')
        .limit(1)
        .where({ Text: 'text' });

      expectSql(
        query.toSQL(),
        `
          SELECT ${messageSelectAll} FROM "message" "messages"
          WHERE (
            EXISTS (
              SELECT 1 FROM "user"
              WHERE "user"."name" = $1
                AND "user"."id" = "messages"."author_id"
                AND "user"."user_key" = "messages"."message_key"
            )
            AND "messages"."text" = $2)
            AND ("messages"."deleted_at" IS NULL)
          LIMIT $3
        `,
        ['name', 'text', 1],
      );
    });

    it('should handle chained query using `on`', () => {
      const query = db.user
        .where({ Name: 'name' })
        .chain('activeMessages')
        .where({ Text: 'text' });

      expectSql(
        query.toSQL(),
        `
          SELECT ${messageSelectAll} FROM "message" "activeMessages"
          WHERE ("activeMessages"."active" = $1
            AND EXISTS (
              SELECT 1 FROM "user"
              WHERE "user"."name" = $2
                AND "user"."id" = "activeMessages"."author_id"
                AND "user"."user_key" = "activeMessages"."message_key"
            )
            AND "activeMessages"."text" = $3)
            AND ("activeMessages"."deleted_at" IS NULL)
        `,
        [true, 'name', 'text'],
      );
    });

    it('should handle long chained query', () => {
      const q = db.user
        .where({ Name: 'name' })
        .chain('posts')
        .where({ Body: 'body' })
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
            FROM "post"  "posts"
            WHERE
              EXISTS (
                SELECT 1
                FROM "user"
                WHERE "user"."name" = $1
                  AND "user"."id" = "posts"."user_id"
                  AND "user"."user_key" = "posts"."title"
              )
              AND "posts"."body" = $2
              AND "posts"."id" = "postTags"."post_id"
          )
          AND "postTags"."tag" = $3
      `,
        ['name', 'body', 'tag'],
      );
    });

    it('should handle long chained query using `on`', () => {
      const q = db.user
        .where({ Name: 'name' })
        .chain('activePosts')
        .where({ Body: 'body' })
        .chain('activePostTags')
        .where({ Tag: 'tag' });

      assertType<Awaited<typeof q>, PostTag[]>();

      expectSql(
        q.toSQL(),
        `
        SELECT ${postTagSelectAll}
        FROM "postTag" "activePostTags"
        WHERE "activePostTags"."active" = $1
          AND EXISTS (
            SELECT 1
            FROM "post"  "activePosts"
            WHERE "activePosts"."active" = $2
              AND EXISTS (
                SELECT 1
                FROM "user"
                WHERE "user"."name" = $3
                  AND "user"."id" = "activePosts"."user_id"
                  AND "user"."user_key" = "activePosts"."title"
              )
              AND "activePosts"."body" = $4
              AND "activePosts"."id" = "activePostTags"."post_id"
          )
          AND "activePostTags"."tag" = $5
      `,
        [true, true, 'name', 'body', 'tag'],
      );
    });

    describe('create based on a query', () => {
      it('should have create based on a query', () => {
        const query = db.chat.find(1).chain('messages').create({
          Text: 'text',
        });

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "message"("chat_id", "message_key", "text")
            SELECT "chat"."id_of_chat" "ChatId", "chat"."chat_key" "MessageKey", $1
            FROM "chat"
            WHERE "chat"."id_of_chat" = $2
            LIMIT 1
            RETURNING ${messageSelectAll}
          `,
          ['text', 1],
        );
      });

      it('should have create based on a query', () => {
        const query = db.chat.find(1).chain('activeMessages').create({
          Text: 'text',
        });

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "message"("chat_id", "message_key", "active", "text")
            SELECT "chat"."id_of_chat" "ChatId", "chat"."chat_key" "MessageKey", $1, $2
            FROM "chat"
            WHERE "chat"."id_of_chat" = $3
            LIMIT 1
            RETURNING ${messageSelectAll}
          `,
          [true, 'text', 1],
        );
      });

      it('should throw when the main query returns many records', async () => {
        await expect(
          async () =>
            await db.chat.chain('messages').create({
              Text: 'text',
            }),
        ).rejects.toThrow(
          'Cannot create based on a query which returns multiple records',
        );
      });

      it('should throw when main record is not found', async () => {
        const q = db.chat.find(1).chain('messages').create({
          Text: 'text',
        });

        await expect(q).rejects.toThrow('Record is not found');
      });

      it('should not throw when searching with findOptional', async () => {
        await db.chat.findOptional(1).chain('messages').takeOptional().create({
          Text: 'text',
        });
      });
    });

    it('should have chained delete', () => {
      const query = db.chat
        .where({ Title: 'title' })
        .chain('messages')
        .where({ Text: 'text' })
        .hardDelete();

      expectSql(
        query.toSQL(),
        `
          DELETE FROM "message"  "messages"
          WHERE EXISTS (
              SELECT 1 FROM "chat"
              WHERE "chat"."title" = $1
                AND "chat"."id_of_chat" = "messages"."chat_id"
                AND "chat"."chat_key" = "messages"."message_key"
            )
            AND "messages"."text" = $2
        `,
        ['title', 'text'],
      );
    });

    it('should support chained select', async () => {
      await db.user.create({
        ...userData,
        posts: {
          create: [
            {
              ...postData,
              postTags: {
                create: [
                  {
                    ...postTagData,
                    tag: {
                      create: tagData,
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      const q = db.user
        .select({
          items: (q) =>
            q.posts
              .chain('postTags')
              .order('posts.Id')
              .select('Tag', 'posts.Body'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("items".r, '[]') "items"
          FROM "user"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT "t"."Tag", "t"."Body"
              FROM (
                SELECT
                  "postTags"."tag" "Tag",
                  "posts"."body" "Body",
                  row_number() OVER (PARTITION BY "postTags"."post_id", "postTags"."tag") "r"
                FROM "postTag" "postTags"
                JOIN "post" "posts"
                  ON "posts"."user_id" = "user"."id"
                 AND "posts"."title" = "user"."user_key"
                 AND "posts"."id" = "postTags"."post_id"
                ORDER BY "posts"."id" ASC
              ) "t"
              WHERE (r = 1)
            ) "t"
          ) "items" ON true
          LIMIT 1
        `,
      );

      const result = await q;

      assertType<typeof result, { items: { Tag: string; Body: string }[] }>();

      expect(result).toEqual({
        items: [{ Tag: postTagData.Tag, Body: postData.Body }],
      });
    });

    it('should support chained select via where exists', async () => {
      await db.user.create({
        ...userData,
        posts: {
          create: [
            {
              ...postData,
              postTags: {
                create: [
                  {
                    ...postTagData,
                    tag: {
                      create: tagData,
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      const q = db.user
        .select({
          items: (q) => q.posts.chain('postTags').select('Tag'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("items".r, '[]') "items"
          FROM "user"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT "postTags"."tag" "Tag"
              FROM "postTag" "postTags"
              WHERE EXISTS (
                SELECT 1
                FROM "post" "posts"
                WHERE "posts"."user_id" = "user"."id"
                  AND "posts"."title" = "user"."user_key"
                  AND "posts"."id" = "postTags"."post_id"
              )
            ) "t"
          ) "items" ON true
          LIMIT 1
        `,
      );

      const result = await q;

      assertType<typeof result, { items: { Tag: string }[] }>();

      expect(result).toEqual({
        items: [{ Tag: postTagData.Tag }],
      });
    });

    it('should support chained select respecting `on` conditions', async () => {
      await db.user.create({
        ...userData,
        activePosts: {
          create: [
            {
              ...postData,
              activePostTags: {
                create: [
                  {
                    ...postTagData,
                    tag: {
                      create: tagData,
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      const q = db.user
        .select({
          items: (q) =>
            q.activePosts
              .chain('activePostTags')
              .order('activePosts.Id')
              .select('Tag', 'activePosts.Body'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("items".r, '[]') "items"
          FROM "user"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT "t"."Tag", "t"."Body"
              FROM (
                SELECT
                  "activePostTags"."tag" "Tag",
                  "activePosts"."body" "Body",
                  row_number() OVER (PARTITION BY "activePostTags"."post_id", "activePostTags"."tag") "r"
                FROM "postTag" "activePostTags"
                JOIN "post" "activePosts"
                  ON "activePosts"."active" = $1
                 AND "activePosts"."user_id" = "user"."id"
                 AND "activePosts"."title" = "user"."user_key"
                 AND "activePosts"."id" = "activePostTags"."post_id"
                WHERE "activePostTags"."active" = $2
                ORDER BY "activePosts"."id" ASC
              ) "t"
              WHERE (r = 1)
            ) "t"
          ) "items" ON true
          LIMIT 1
        `,
        [true, true],
      );

      const result = await q;

      assertType<typeof result, { items: { Tag: string; Body: string }[] }>();

      expect(result).toEqual({
        items: [{ Tag: postTagData.Tag, Body: postData.Body }],
      });
    });

    it('should support chained select respecting `on` conditions via where exists', async () => {
      await db.user.create({
        ...userData,
        activePosts: {
          create: [
            {
              ...postData,
              activePostTags: {
                create: [
                  {
                    ...postTagData,
                    tag: {
                      create: tagData,
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      const q = db.user
        .select({
          items: (q) => q.activePosts.chain('activePostTags').select('Tag'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("items".r, '[]') "items"
          FROM "user"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT "activePostTags"."tag" "Tag"
              FROM "postTag" "activePostTags"
              WHERE "activePostTags"."active" = $1
                AND EXISTS (
                  SELECT 1
                  FROM "post" "activePosts"
                  WHERE "activePosts"."active" = $2
                    AND "activePosts"."user_id" = "user"."id"
                    AND "activePosts"."title" = "user"."user_key"
                    AND "activePosts"."id" = "activePostTags"."post_id"
                )
            ) "t"
          ) "items" ON true
          LIMIT 1
        `,
        [true, true],
      );

      const result = await q;

      assertType<typeof result, { items: { Tag: string }[] }>();

      expect(result).toEqual({
        items: [{ Tag: postTagData.Tag }],
      });
    });
  });

  describe('hasMany through hasMany', () => {
    it('should handle chained query', () => {
      const query = db.profile
        .where({ Bio: 'bio' })
        .chain('chats')
        .where({ Title: 'title' });

      expectSql(
        query.toSQL(),
        `
            SELECT ${chatSelectAll} FROM "chat" "chats"
            WHERE EXISTS (
              SELECT 1 FROM "profile"
              WHERE "profile"."bio" = $1
                AND EXISTS (
                  SELECT 1 FROM "user"
                  WHERE EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                        AND "chatUser"."chat_key" = "chats"."chat_key"
                        AND "chatUser"."user_id" = "user"."id"
                        AND "chatUser"."user_key" = "user"."user_key"
                    )
                    AND "user"."id" = "profile"."user_id"
                    AND "user"."user_key" = "profile"."profile_key"
                )
            )
            AND "chats"."title" = $2
          `,
        ['bio', 'title'],
      );
    });

    it('should handle chained query using `on`', () => {
      const query = db.profile
        .where({ Bio: 'bio' })
        .chain('activeChats')
        .where({ Title: 'title' });

      expectSql(
        query.toSQL(),
        `
            SELECT ${chatSelectAll} FROM "chat" "activeChats"
            WHERE EXISTS (
              SELECT 1 FROM "profile"
              WHERE "profile"."bio" = $1
                AND EXISTS (
                  SELECT 1 FROM "user"  "activeUser"
                  WHERE "activeChats"."active" = $2
                    AND EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                        AND "chatUser"."chat_key" = "activeChats"."chat_key"
                        AND "chatUser"."user_id" = "activeUser"."id"
                        AND "chatUser"."user_key" = "activeUser"."user_key"
                    )
                    AND "activeUser"."active" = $3
                    AND "activeUser"."id" = "profile"."user_id"
                    AND "activeUser"."user_key" = "profile"."profile_key"
                )
            )
            AND "activeChats"."title" = $4
          `,
        ['bio', true, true, 'title'],
      );
    });

    it('should handle long chained query', () => {
      const q = db.message
        .where({ Text: 'text' })
        .chain('profiles')
        .where({ Bio: 'bio' })
        .chain('posts')
        .where({ Body: 'body' });

      assertType<Awaited<typeof q>, Post[]>();

      expectSql(
        q.toSQL(),
        `
            SELECT ${postSelectAll}
            FROM "post" "posts"
            WHERE
              EXISTS (
                SELECT 1
                FROM "profile"  "profiles"
                WHERE
                  EXISTS (
                    SELECT 1
                    FROM "message"
                    WHERE ("message"."text" = $1
                      AND EXISTS (
                        SELECT 1
                        FROM "user"  "sender"
                        WHERE "profiles"."user_id" = "sender"."id"
                          AND "profiles"."profile_key" = "sender"."user_key"
                          AND "sender"."id" = "message"."author_id"
                          AND "sender"."user_key" = "message"."message_key"
                      ))
                      AND ("message"."deleted_at" IS NULL)
                  )
                  AND "profiles"."bio" = $2
                  AND EXISTS (
                    SELECT 1
                    FROM "user"
                    WHERE "posts"."user_id" = "user"."id"
                      AND "posts"."title" = "user"."user_key"
                      AND "user"."id" = "profiles"."user_id"
                      AND "user"."user_key" = "profiles"."profile_key"
                  )
              )
              AND "posts"."body" = $3
          `,
        ['text', 'bio', 'body'],
      );
    });

    it('should handle long chained query using `on`', () => {
      const q = db.message
        .where({ Text: 'text' })
        .chain('activeProfiles')
        .where({ Bio: 'bio' })
        .chain('activePosts')
        .where({ Body: 'body' });

      assertType<Awaited<typeof q>, Post[]>();

      expectSql(
        q.toSQL(),
        `
            SELECT ${postSelectAll}
            FROM "post" "activePosts"
            WHERE
              EXISTS (
                SELECT 1
                FROM "profile"  "activeProfiles"
                WHERE
                  EXISTS (
                    SELECT 1
                    FROM "message"
                    WHERE ("message"."text" = $1
                      AND EXISTS (
                        SELECT 1
                        FROM "user"  "activeSender"
                        WHERE "activeProfiles"."active" = $2
                          AND "activeProfiles"."user_id" = "activeSender"."id"
                          AND "activeProfiles"."profile_key" = "activeSender"."user_key"
                          AND "activeSender"."active" = $3
                          AND "activeSender"."id" = "message"."author_id"
                          AND "activeSender"."user_key" = "message"."message_key")
                      )
                        AND ("message"."deleted_at" IS NULL)
                  )
                  AND "activeProfiles"."bio" = $4
                  AND EXISTS (
                    SELECT 1
                    FROM "user"  "activeUser"
                    WHERE "activePosts"."active" = $5
                      AND "activePosts"."user_id" = "activeUser"."id"
                      AND "activePosts"."title" = "activeUser"."user_key"
                      AND "activeUser"."active" = $6
                      AND "activeUser"."id" = "activeProfiles"."user_id"
                      AND "activeUser"."user_key" = "activeProfiles"."profile_key"
                  )
              )
              AND "activePosts"."body" = $7
          `,
        ['text', true, true, 'bio', true, true, 'body'],
      );
    });

    it('should disable create', () => {
      // @ts-expect-error hasMany with through option should not have chained create
      db.profile.chain('chats').create(chatData);
    });

    describe('chained delete', () => {
      it('should have chained delete', () => {
        const query = db.profile
          .where({ Bio: 'bio' })
          .chain('chats')
          .where({ Title: 'title' })
          .delete();

        expectSql(
          query.toSQL(),
          `
              DELETE FROM "chat"  "chats"
              WHERE EXISTS (
                  SELECT 1 FROM "profile"
                  WHERE "profile"."bio" = $1
                    AND EXISTS (
                      SELECT 1 FROM "user"
                      WHERE EXISTS (
                          SELECT 1 FROM "chatUser"
                          WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                            AND "chatUser"."chat_key" = "chats"."chat_key"
                            AND "chatUser"."user_id" = "user"."id"
                            AND "chatUser"."user_key" = "user"."user_key"
                        )
                        AND "user"."id" = "profile"."user_id"
                        AND "user"."user_key" = "profile"."profile_key"
                    )
                )
                AND "chats"."title" = $2
            `,
          ['bio', 'title'],
        );
      });

      it('should have chained delete using `on`', () => {
        const query = db.profile
          .where({ Bio: 'bio' })
          .chain('activeChats')
          .where({ Title: 'title' })
          .delete();

        expectSql(
          query.toSQL(),
          `
              DELETE FROM "chat"  "activeChats"
              WHERE EXISTS (
                  SELECT 1 FROM "profile"
                  WHERE "profile"."bio" = $1
                    AND EXISTS (
                      SELECT 1 FROM "user"  "activeUser"
                      WHERE "activeChats"."active" = $2
                        AND EXISTS (
                          SELECT 1 FROM "chatUser"
                          WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                            AND "chatUser"."chat_key" = "activeChats"."chat_key"
                            AND "chatUser"."user_id" = "activeUser"."id"
                            AND "chatUser"."user_key" = "activeUser"."user_key"
                        )
                        AND "activeUser"."active" = $3
                        AND "activeUser"."id" = "profile"."user_id"
                        AND "activeUser"."user_key" = "profile"."profile_key"
                    )
                )
                AND "activeChats"."title" = $4
            `,
          ['bio', true, true, 'title'],
        );
      });
    });
  });

  describe('hasMany through hasOne', () => {
    it('should handle chained query', () => {
      const query = db.chat
        .where({ Title: 'title' })
        .chain('profiles')
        .where({ Bio: 'bio' });

      expectSql(
        query.toSQL(),
        `
            SELECT ${profileSelectAll} FROM "profile" "profiles"
            WHERE EXISTS (
              SELECT 1 FROM "chat"
              WHERE "chat"."title" = $1
                AND EXISTS (
                  SELECT 1 FROM "user"  "users"
                  WHERE "profiles"."user_id" = "users"."id"
                    AND "profiles"."profile_key" = "users"."user_key"
                    AND EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."user_id" = "users"."id"
                        AND "chatUser"."user_key" = "users"."user_key"
                        AND "chatUser"."chat_id" = "chat"."id_of_chat"
                      AND "chatUser"."chat_key" = "chat"."chat_key"
                    )
                )
            )
            AND "profiles"."bio" = $2
          `,
        ['title', 'bio'],
      );
    });

    it('should handle chained query using `on`', () => {
      const query = db.chat
        .where({ Title: 'title' })
        .chain('activeProfiles')
        .where({ Bio: 'bio' });

      expectSql(
        query.toSQL(),
        `
            SELECT ${profileSelectAll} FROM "profile" "activeProfiles"
            WHERE EXISTS (
              SELECT 1 FROM "chat"
              WHERE "chat"."title" = $1
                AND EXISTS (
                  SELECT 1 FROM "user"  "activeUsers"
                  WHERE "activeProfiles"."active" = $2
                    AND "activeProfiles"."user_id" = "activeUsers"."id"
                    AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                    AND "activeUsers"."active" = $3
                    AND EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."user_id" = "activeUsers"."id"
                        AND "chatUser"."user_key" = "activeUsers"."user_key"
                        AND "chatUser"."chat_id" = "chat"."id_of_chat"
                        AND "chatUser"."chat_key" = "chat"."chat_key"
                    )
                )
            )
            AND "activeProfiles"."bio" = $4
          `,
        ['title', true, true, 'bio'],
      );
    });

    it('should disable create', () => {
      // @ts-expect-error hasMany with through option should not have chained create
      db.chat.chain('profiles').create(chatData);
    });

    it('should have chained delete', () => {
      const query = db.chat
        .where({ Title: 'title' })
        .chain('profiles')
        .where({ Bio: 'bio' })
        .delete();

      expectSql(
        query.toSQL(),
        `
            DELETE FROM "profile"  "profiles"
            WHERE EXISTS (
                SELECT 1 FROM "chat"
                WHERE "chat"."title" = $1
                  AND EXISTS (
                    SELECT 1 FROM "user"  "users"
                    WHERE "profiles"."user_id" = "users"."id"
                      AND "profiles"."profile_key" = "users"."user_key"
                      AND EXISTS (
                        SELECT 1 FROM "chatUser"
                        WHERE "chatUser"."user_id" = "users"."id"
                          AND "chatUser"."user_key" = "users"."user_key"
                          AND "chatUser"."chat_id" = "chat"."id_of_chat"
                        AND "chatUser"."chat_key" = "chat"."chat_key"
                      )
                  )
              )
              AND "profiles"."bio" = $2
          `,
        ['title', 'bio'],
      );
    });

    it('should have chained delete using `on`', () => {
      const query = db.chat
        .where({ Title: 'title' })
        .chain('activeProfiles')
        .where({ Bio: 'bio' })
        .delete();

      expectSql(
        query.toSQL(),
        `
            DELETE FROM "profile"  "activeProfiles"
            WHERE EXISTS (
                SELECT 1 FROM "chat"
                WHERE "chat"."title" = $1
                  AND EXISTS (
                    SELECT 1 FROM "user"  "activeUsers"
                    WHERE "activeProfiles"."active" = $2
                      AND "activeProfiles"."user_id" = "activeUsers"."id"
                      AND "activeProfiles"."profile_key" = "activeUsers"."user_key"
                      AND "activeUsers"."active" = $3
                      AND EXISTS (
                        SELECT 1 FROM "chatUser"
                        WHERE "chatUser"."user_id" = "activeUsers"."id"
                          AND "chatUser"."user_key" = "activeUsers"."user_key"
                          AND "chatUser"."chat_id" = "chat"."id_of_chat"
                        AND "chatUser"."chat_key" = "chat"."chat_key"
                      )
                  )
              )
              AND "activeProfiles"."bio" = $4
          `,
        ['title', true, true, 'bio'],
      );
    });

    it('should support chained select', () => {
      const q = db.message.select({
        items: (q) =>
          q.profiles
            .chain('posts')
            .order('profiles.Id')
            .select('Body', 'profiles.Bio'),
      });

      assertType<
        Awaited<typeof q>,
        { items: { Body: string; Bio: string | null }[] }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("items".r, '[]') "items"
          FROM "message"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT "t"."Body", "t"."Bio"
              FROM (
                SELECT
                  "posts"."body" "Body",
                  "profiles"."bio" "Bio",
                  row_number() OVER (PARTITION BY "posts"."id") "r"
                FROM "post" "posts"
                JOIN "profile" "profiles"
                  ON EXISTS (
                    SELECT 1 FROM "user"  "sender"
                    WHERE "profiles"."user_id" = "sender"."id"
                      AND "profiles"."profile_key" = "sender"."user_key"
                      AND "sender"."id" = "message"."author_id"
                      AND "sender"."user_key" = "message"."message_key"
                  ) AND EXISTS (
                    SELECT 1 FROM "user"
                    WHERE "posts"."user_id" = "user"."id"
                      AND "posts"."title" = "user"."user_key"
                      AND "user"."id" = "profiles"."user_id"
                      AND "user"."user_key" = "profiles"."profile_key"
                  )
                ORDER BY "profiles"."id" ASC
              ) "t"
              WHERE (r = 1)
            ) "t"
          ) "items" ON true
          WHERE ("message"."deleted_at" IS NULL)
          `,
      );
    });

    it('should support chained select', () => {
      const q = db.message.select({
        items: (q) => q.profiles.chain('posts').select('Body'),
      });

      assertType<Awaited<typeof q>, { items: { Body: string }[] }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("items".r, '[]') "items"
          FROM "message"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT "posts"."body" "Body"
              FROM "post" "posts"
              WHERE EXISTS (
                SELECT 1
                FROM "profile" "profiles"
                WHERE EXISTS (
                  SELECT 1 FROM "user"  "sender"
                  WHERE "profiles"."user_id" = "sender"."id"
                    AND "profiles"."profile_key" = "sender"."user_key"
                    AND "sender"."id" = "message"."author_id"
                    AND "sender"."user_key" = "message"."message_key"
                ) AND EXISTS (
                  SELECT 1 FROM "user"
                  WHERE "posts"."user_id" = "user"."id"
                    AND "posts"."title" = "user"."user_key"
                    AND "user"."id" = "profiles"."user_id"
                    AND "user"."user_key" = "profiles"."profile_key"
                )
              )
            ) "t"
          ) "items" ON true
          WHERE ("message"."deleted_at" IS NULL)
        `,
      );
    });

    it('should support chained select respecting `on` conditions', () => {
      const q = db.message.select({
        items: (q) =>
          q.activeProfiles
            .chain('activePosts')
            .order('activeProfiles.Id')
            .select('Body', 'activeProfiles.Bio'),
      });

      assertType<
        Awaited<typeof q>,
        { items: { Body: string; Bio: string | null }[] }[]
      >();

      expectSql(
        q.toSQL(),
        `
            SELECT COALESCE("items".r, '[]') "items"
            FROM "message"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) r
              FROM (
                SELECT "t"."Body", "t"."Bio"
                FROM (
                  SELECT
                    "activePosts"."body" "Body",
                    "activeProfiles"."bio" "Bio",
                    row_number() OVER (PARTITION BY "activePosts"."id") "r"
                  FROM "post" "activePosts"
                  JOIN "profile" "activeProfiles"
                    ON EXISTS (
                      SELECT 1 FROM "user"  "activeSender"
                      WHERE "activeProfiles"."active" = $1
                        AND "activeProfiles"."user_id" = "activeSender"."id"
                        AND "activeProfiles"."profile_key" = "activeSender"."user_key"
                        AND "activeSender"."active" = $2
                        AND "activeSender"."id" = "message"."author_id"
                        AND "activeSender"."user_key" = "message"."message_key"
                    ) AND EXISTS (
                      SELECT 1 FROM "user"  "activeUser"
                      WHERE "activePosts"."active" = $3
                        AND "activePosts"."user_id" = "activeUser"."id"
                        AND "activePosts"."title" = "activeUser"."user_key"
                        AND "activeUser"."active" = $4
                        AND "activeUser"."id" = "activeProfiles"."user_id"
                        AND "activeUser"."user_key" = "activeProfiles"."profile_key"
                    )
                  ORDER BY "activeProfiles"."id" ASC
                ) "t"
                WHERE (r = 1)
              ) "t"
            ) "items" ON true
            WHERE ("message"."deleted_at" IS NULL)
          `,
        [true, true, true, true],
      );
    });

    it('should support chained select respecting `on` conditions via where exists', () => {
      const q = db.message.select({
        items: (q) => q.activeProfiles.chain('activePosts').select('Body'),
      });

      assertType<Awaited<typeof q>, { items: { Body: string }[] }[]>();

      expectSql(
        q.toSQL(),
        `
            SELECT COALESCE("items".r, '[]') "items"
            FROM "message"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) r
              FROM (
                SELECT "activePosts"."body" "Body"
                FROM "post" "activePosts"
                WHERE EXISTS (
                  SELECT 1
                  FROM "profile" "activeProfiles"
                  WHERE EXISTS (
                    SELECT 1 FROM "user"  "activeSender"
                    WHERE "activeProfiles"."active" = $1
                      AND "activeProfiles"."user_id" = "activeSender"."id"
                      AND "activeProfiles"."profile_key" = "activeSender"."user_key"
                      AND "activeSender"."active" = $2
                      AND "activeSender"."id" = "message"."author_id"
                      AND "activeSender"."user_key" = "message"."message_key"
                  ) AND EXISTS (
                    SELECT 1 FROM "user"  "activeUser"
                    WHERE "activePosts"."active" = $3
                      AND "activePosts"."user_id" = "activeUser"."id"
                      AND "activePosts"."title" = "activeUser"."user_key"
                      AND "activeUser"."active" = $4
                      AND "activeUser"."id" = "activeProfiles"."user_id"
                      AND "activeUser"."user_key" = "activeProfiles"."profile_key"
                  )
                )
              ) "t"
            ) "items" ON true
            WHERE ("message"."deleted_at" IS NULL)
          `,
        [true, true, true, true],
      );
    });
  });

  describe('hasAndBelongsToMany', () => {
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

    it('should handle chained query using `on`', () => {
      const query = db.user
        .where({ Name: 'Name' })
        .chain('activeChats')
        .where({ Title: 'title' });

      expectSql(
        query.toSQL(),
        `
          SELECT ${chatSelectAll} FROM "chat" "activeChats"
          WHERE "activeChats"."active" = $1
            AND EXISTS (
              SELECT 1 FROM "user"
                WHERE "user"."name" = $2
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                    AND "chatUser"."chat_key" = "activeChats"."chat_key"
                    AND "chatUser"."user_id" = "user"."id"
                    AND "chatUser"."user_key" = "user"."user_key"
                )
            )
            AND "activeChats"."title" = $3
        `,
        [true, 'Name', 'title'],
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
              FROM "user"  "users"
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

    it('should handle long chained query using `on`', () => {
      const q = db.chat
        .where({ Title: 'title' })
        .chain('activeUsers')
        .where({ Name: 'name' })
        .chain('activePostTags')
        .where({ Tag: 'tag' });

      assertType<Awaited<typeof q>, PostTag[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${postTagSelectAll}
          FROM "postTag" "activePostTags"
          WHERE "activePostTags"."active" = $1
            AND EXISTS (
              SELECT 1
              FROM "user"  "activeUsers"
              WHERE "activeUsers"."active" = $2
                AND EXISTS (
                  SELECT 1
                  FROM "chat"
                  WHERE "chat"."title" = $3
                    AND EXISTS (
                      SELECT 1
                      FROM "chatUser"
                      WHERE "chatUser"."user_id" = "activeUsers"."id"
                        AND "chatUser"."user_key" = "activeUsers"."user_key"
                        AND "chatUser"."chat_id" = "chat"."id_of_chat"
                        AND "chatUser"."chat_key" = "chat"."chat_key"
                    )
                )
                AND "activeUsers"."name" = $4
                AND EXISTS (
                  SELECT 1
                  FROM "post"
                  WHERE "post"."id" = "activePostTags"."post_id"
                    AND "post"."user_id" = "activeUsers"."id"
                    AND "post"."title" = "activeUsers"."user_key"
                )
            )
            AND "activePostTags"."tag" = $5
        `,
        [true, true, 'title', 'name', 'tag'],
      );
    });

    describe('create based on a query', () => {
      it('should create based on find query', async () => {
        const user = await db.user.create(userData);

        const chat = await db.user.find(user.Id).chain('chats').create({
          Title: 'title',
          ChatKey: 'key',
        });

        expect(chat.Title).toBe('title');

        const ids = await db.user.queryRelated('chats', user).pluck('IdOfChat');
        expect(ids).toEqual([chat.IdOfChat]);
      });

      it('should create based on find query using `on`', async () => {
        const user = await db.user.create(userData);

        const chat = await db.user.find(user.Id).chain('activeChats').create({
          Title: 'title',
          ChatKey: 'key',
        });

        expect(chat.Title).toBe('title');
        expect(chat.Active).toBe(true);

        const ids = await db.user
          .queryRelated('activeChats', user)
          .pluck('IdOfChat');
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
          DELETE FROM "chat"  "chats"
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

    it('should support chained delete using `on`', () => {
      const query = db.user
        .where({ Name: 'Name' })
        .chain('activeChats')
        .where({ Title: 'title' })
        .delete();

      expectSql(
        query.toSQL(),
        `
          DELETE FROM "chat"  "activeChats"
          WHERE "activeChats"."active" = $1
            AND EXISTS (
              SELECT 1 FROM "user"
              WHERE "user"."name" = $2
                AND EXISTS (
                  SELECT 1 FROM "chatUser"
                  WHERE "chatUser"."chat_id" = "activeChats"."id_of_chat"
                    AND "chatUser"."chat_key" = "activeChats"."chat_key"
                    AND "chatUser"."user_id" = "user"."id"
                    AND "chatUser"."user_key" = "user"."user_key"
                )
            )
            AND "activeChats"."title" = $3
        `,
        [true, 'Name', 'title'],
      );
    });

    it('should support chained select', () => {
      const q = db.chat.select({
        items: (q) =>
          q.users
            .chain('postTags')
            .order('users.Id')
            .select('Tag', 'users.Name'),
      });

      assertType<
        Awaited<typeof q>,
        { items: { Tag: string; Name: string }[] }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("items".r, '[]') "items"
          FROM "chat"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT "t"."Tag", "t"."Name"
              FROM (
                SELECT
                  "postTags"."tag" "Tag",
                  "users"."name" "Name",
                  row_number() OVER (PARTITION BY "postTags"."post_id", "postTags"."tag") "r"
                FROM "postTag" "postTags"
                JOIN "user" "users"
                  ON EXISTS (
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
                ORDER BY "users"."id" ASC
              ) "t"
              WHERE (r = 1)
            ) "t"
          ) "items" ON true
        `,
      );
    });

    it('should support chained select via where exists', () => {
      const q = db.chat.select({
        items: (q) => q.users.chain('postTags').select('Tag'),
      });

      assertType<Awaited<typeof q>, { items: { Tag: string }[] }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("items".r, '[]') "items"
          FROM "chat"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT "postTags"."tag" "Tag"
              FROM "postTag" "postTags"
              WHERE EXISTS (
                SELECT 1
                FROM "user" "users"
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

    it('should support chained select', () => {
      const q = db.chat.select({
        items: (q) =>
          q.activeUsers
            .chain('activePostTags')
            .order('activeUsers.Id')
            .select('Tag', 'activeUsers.Name'),
      });

      assertType<
        Awaited<typeof q>,
        { items: { Tag: string; Name: string }[] }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("items".r, '[]') "items"
          FROM "chat"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT "t"."Tag", "t"."Name"
              FROM (
                SELECT
                  "activePostTags"."tag" "Tag",
                  "activeUsers"."name" "Name",
                  row_number() OVER (PARTITION BY "activePostTags"."post_id", "activePostTags"."tag") "r"
                FROM "postTag" "activePostTags"
                JOIN "user" "activeUsers"
                  ON "activeUsers"."active" = $1
                    AND EXISTS (
                      SELECT 1 FROM "chatUser"
                      WHERE "chatUser"."user_id" = "activeUsers"."id"
                        AND "chatUser"."user_key" = "activeUsers"."user_key"
                        AND "chatUser"."chat_id" = "chat"."id_of_chat"
                        AND "chatUser"."chat_key" = "chat"."chat_key"
                    ) AND EXISTS (
                      SELECT 1 FROM "post"
                      WHERE "post"."id" = "activePostTags"."post_id"
                        AND "post"."user_id" = "activeUsers"."id"
                        AND "post"."title" = "activeUsers"."user_key"
                    )
                WHERE "activePostTags"."active" = $2
                ORDER BY "activeUsers"."id" ASC
              ) "t"
              WHERE (r = 1)
            ) "t"
          ) "items" ON true
        `,
        [true, true],
      );
    });

    it('should support chained select via where exists', () => {
      const q = db.chat.select({
        items: (q) => q.activeUsers.chain('activePostTags').select('Tag'),
      });

      assertType<Awaited<typeof q>, { items: { Tag: string }[] }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("items".r, '[]') "items"
          FROM "chat"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) r
            FROM (
              SELECT "activePostTags"."tag" "Tag"
              FROM "postTag" "activePostTags"
              WHERE "activePostTags"."active" = $1
                AND EXISTS (
                  SELECT 1
                  FROM "user" "activeUsers"
                  WHERE "activeUsers"."active" = $2
                    AND EXISTS (
                    SELECT 1 FROM "chatUser"
                    WHERE "chatUser"."user_id" = "activeUsers"."id"
                      AND "chatUser"."user_key" = "activeUsers"."user_key"
                      AND "chatUser"."chat_id" = "chat"."id_of_chat"
                      AND "chatUser"."chat_key" = "chat"."chat_key"
                  ) AND EXISTS (
                    SELECT 1 FROM "post"
                    WHERE "post"."id" = "activePostTags"."post_id"
                      AND "post"."user_id" = "activeUsers"."id"
                      AND "post"."title" = "activeUsers"."user_key"
                  )
                )
            ) "t"
          ) "items" ON true
        `,
        [true, true],
      );
    });
  });
});
