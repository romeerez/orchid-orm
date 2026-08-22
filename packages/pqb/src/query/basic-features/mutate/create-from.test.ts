import {
  assertType,
  ChatData,
  db,
  expectSql,
  MessageColumnsSql,
  sql,
  testDb,
  useTestDatabase,
  Message,
  UserData,
} from 'test-utils';
import { NotFoundError } from 'pqb';

const Message = db.message.includeDeleted();

const TableWithReadOnly = testDb(
  'table',
  (t) => ({
    id: t.identity().primaryKey(),
    key: t.string(),
    value: t.integer().readOnly(),
  }),
  undefined,
  {
    schema: () => 'schema',
  },
);

const RuntimeDefaultTable = testDb(
  'user',
  (t) => ({
    Id: t.serial().primaryKey(),
    Name: t.text().default(() => 'runtime text'),
    Password: t.text(),
  }),
  undefined,
  {
    schema: () => 'schema',
  },
);

describe('createFrom functions', () => {
  useTestDatabase();

  describe('createOneFrom', () => {
    it('should not allow using appReadOnly columns from select', () => {
      const sub = db.chat
        .find(1)
        .select({ key: 'Title', value: 'Chat.IdOfChat' });

      expect(() => TableWithReadOnly.createOneFrom(sub)).toThrow(
        'Trying to insert a readonly column',
      );
    });

    it('should not allow using appReadOnly columns from values', () => {
      const sub = db.chat.find(1).select({ key: 'Title' });

      expect(() =>
        TableWithReadOnly.createOneFrom(sub, {
          // @ts-expect-error value is readOnly
          value: 1,
        }),
      ).toThrow('Trying to insert a readonly column');
    });

    it('should create records without additional data', () => {
      const sub = db.chat.find(1).select({ ChatId: 'IdOfChat' });
      const q = Message.createOneFrom(sub);

      assertType<Awaited<typeof q>, Message>();

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."message" AS "Message"("chat_id")
          SELECT "Chat"."id_of_chat" "ChatId"
          FROM "schema"."chat" "Chat"
          WHERE "Chat"."id_of_chat" = $1
          LIMIT 1
          RETURNING ${MessageColumnsSql}
        `,
        [1],
      );
    });

    it('should a create record from select with additional data', () => {
      const chat = db.chat.find(1).select({ ChatId: 'IdOfChat' });

      const query = Message.createOneFrom(chat, {
        AuthorId: 1,
        Text: () => sql<string>`'text'`,
      });

      assertType<Awaited<typeof query>, Message>();

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "schema"."message" AS "Message"("chat_id", "author_id", "text")
          SELECT "Chat"."id_of_chat" "ChatId", $1, 'text'
          FROM "schema"."chat" "Chat"
          WHERE "Chat"."id_of_chat" = $2
          LIMIT 1
          RETURNING ${MessageColumnsSql}
        `,
        [1, 1],
      );
    });

    it('should throw not found when it should', async () => {
      const user = db.user.find(0).select({ UserId: 'Id' });

      const q = db.profile.createOneFrom(user, {
        Bio: 'one',
        ProfileKey: 'key',
      });

      await expect(q).rejects.toThrow(NotFoundError);
    });

    it('should not throw not found when found', async () => {
      const id = await db.user.get('Id').create(UserData);
      const user = db.user.find(id).select({ UserId: 'Id' });

      const q = db.profile.createOneFrom(user, {
        Bio: 'one',
        ProfileKey: 'key',
      });

      await q;
    });

    it('should add runtime defaults', () => {
      const q = RuntimeDefaultTable.createOneFrom(
        db.user.find(123).select('Password'),
        {
          Id: 456,
        },
      );

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user"("password", "id", "name")
          SELECT "User"."password" "Password", $1, $2
          FROM "schema"."user" "User"
          WHERE "User"."id" = $3
          LIMIT 1
          RETURNING "id" "Id", "name" "Name", "password" "Password"
        `,
        [456, 'runtime text', 123],
      );
    });

    it('should not allow to create from query which returns multiple records', () => {
      expect(() =>
        Message.createOneFrom(
          // @ts-expect-error creating from multiple records is not allowed
          db.chat.where({ IdOfChat: { in: [1, 2] } }).select({ ChatId: 'id' }),
          {
            AuthorId: 1,
            Text: 'text',
          },
        ),
      ).toThrow(
        'Cannot create based on a query which returns multiple records',
      );
    });

    it('should support appending select', async () => {
      const user = await db.user.create(UserData);

      const sub = db.user.find(user.Id).select('Name');

      const result = await db.user
        .createOneFrom(sub, {
          Password: 'password',
          UserKey: 'key',
        })
        .select('Name');

      assertType<typeof result, { Name: string }>();

      expect(result).toEqual({ Name: UserData.Name });
    });

    it('should a create record from select with additional value returned from an insert sub query', () => {
      const chat = db.chat.find(1).select({ ChatId: 'IdOfChat' });

      const query = Message.createOneFrom(chat, {
        AuthorId: () => db.user.create(UserData).get('Id'),
        Text: () => sql<string>`'text'`,
      });

      assertType<Awaited<typeof query>, Message>();

      expectSql(
        query.toSQL(),
        `
          WITH "q" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at")
            VALUES ($1, $2, $3, $4, $5)
            RETURNING "User"."id" "Id"
          )
          INSERT INTO "schema"."message" AS "Message"("chat_id", "author_id", "text")
          SELECT "Chat"."id_of_chat" "ChatId", (SELECT "q"."Id" FROM "q"), 'text'
          FROM "schema"."chat" "Chat"
          WHERE "Chat"."id_of_chat" = $6
          LIMIT 1
          RETURNING ${MessageColumnsSql}
        `,
        [...Object.values(UserData), 1],
      );
    });

    it('should create from select using values from CTE', async () => {
      const idOfChat = await db.chat.create(ChatData).get('IdOfChat');

      const q = Message.with('user', () =>
        db.user.create(UserData).select('Id', 'Name'),
      )
        .createOneFrom(db.chat.find(idOfChat).select({ ChatId: 'IdOfChat' }), {
          AuthorId: (q) => q.from('user').get('Id'),
          Text: (q) => q.from('user').get('Name'),
        })
        .select('ChatId', 'AuthorId', 'Text');

      expectSql(
        q.toSQL(),
        `
          WITH "user" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at")
            VALUES ($1, $2, $3, $4, $5)
            RETURNING "User"."id" "Id", "User"."name" "Name"
          )
          INSERT INTO "schema"."message" AS "Message"("chat_id", "author_id", "text")
          SELECT "Chat"."id_of_chat" "ChatId", (SELECT "user"."Id" FROM "user" LIMIT 1), (SELECT "user"."Name" FROM "user" LIMIT 1)
          FROM "schema"."chat" "Chat"
          WHERE "Chat"."id_of_chat" = $6
          LIMIT 1
          RETURNING "Message"."chat_id" "ChatId", "Message"."author_id" "AuthorId", "Message"."text" "Text"
        `,
        [...Object.values(UserData), idOfChat],
      );

      const res = await q;

      expect(res).toEqual({
        ChatId: idOfChat,
        AuthorId: expect.any(Number),
        Text: UserData.Name,
      });
    });
  });

  describe('insertOneFrom', () => {
    it('should return inserted row count by default', async () => {
      const authorId = await db.user.get('Id').create(UserData);
      const chatId = await db.chat.get('IdOfChat').create(ChatData);
      const chat = db.chat.find(chatId).select({ ChatId: 'IdOfChat' });

      const q = Message.insertOneFrom(chat, {
        AuthorId: authorId,
        Text: 'text',
      });

      const result = await q;

      assertType<Awaited<typeof q>, number>();

      expect(result).toBe(1);
    });

    it('should override selecting multiple with selecting one', async () => {
      const authorId = await db.user.get('Id').create(UserData);
      const chatId = await db.chat.get('IdOfChat').create(ChatData);
      const chat = db.chat.find(chatId).select({ ChatId: 'IdOfChat' });

      const q = Message.select('Text').insertOneFrom(chat, {
        AuthorId: authorId,
        Text: 'text',
      });

      const result = await q;

      assertType<Awaited<typeof q>, { Text: string }>();

      expect(result).toEqual({ Text: 'text' });
    });

    it('should override selecting pluck with selecting value', async () => {
      const authorId = await db.user.get('Id').create(UserData);
      const chatId = await db.chat.get('IdOfChat').create(ChatData);
      const chat = db.chat.find(chatId).select({ ChatId: 'IdOfChat' });

      const q = Message.pluck('Text').insertOneFrom(chat, {
        AuthorId: authorId,
        Text: 'text',
      });

      const result = await q;

      assertType<Awaited<typeof q>, string>();

      expect(result).toBe('text');
    });
  });

  describe('createManyFrom', () => {
    it('should not allow using appReadOnly columns from select', () => {
      const sub = db.chat
        .find(1)
        .select({ key: 'Title', value: 'Chat.IdOfChat' });

      expect(() => TableWithReadOnly.createManyFrom(sub, [])).toThrow(
        'Trying to insert a readonly column',
      );
    });

    it('should not allow using appReadOnly columns from values', () => {
      const sub = db.chat.find(1).select({ key: 'Title' });

      expect(() =>
        TableWithReadOnly.createManyFrom(sub, [
          {
            // @ts-expect-error value is readOnly
            value: 1,
          },
        ]),
      ).toThrow('Trying to insert a readonly column');
    });

    it('should a create record from select with provided data', async () => {
      const chat = db.chat.find(1).select({ ChatId: 'IdOfChat' });

      const query = Message.select('Text').createManyFrom(chat, [
        {
          AuthorId: 1,
          Text: () => sql<string>`'text 1'`,
        },
        {
          AuthorId: 2,
          Text: () => sql<string>`'text 2'`,
        },
      ]);

      assertType<Awaited<typeof query>, { Text: string }[]>();

      expectSql(
        query.toSQL(),
        `
          WITH "q" AS (
            SELECT "Chat"."id_of_chat" "ChatId"
            FROM "schema"."chat" "Chat"
            WHERE "Chat"."id_of_chat" = $1
            LIMIT 1
          ), q2 AS (
            INSERT INTO "schema"."message" AS "Message"("chat_id", "author_id", "text")
            SELECT "q"."ChatId", v."author_id"::int4, v."text"::text
            FROM "q", (VALUES ($2, 'text 1'), ($3, 'text 2')) v("author_id", "text")
            RETURNING "Message"."text" "Text"
          )
          SELECT *, NULL FROM q2
          UNION ALL SELECT NULL, json_build_object('q', (SELECT json_agg(row_to_json("q".*)) FROM "q"))
        `,
        [1, 1, 2],
      );
    });

    it('should throw not found when it should', async () => {
      const user = db.user.find(0).select({ UserId: 'Id' });

      const q = db.profile.createManyFrom(user, [
        {
          Bio: 'one',
          ProfileKey: 'key',
        },
        {
          Bio: 'two',
          ProfileKey: 'key2',
        },
      ]);

      await expect(q).rejects.toThrow(NotFoundError);
    });

    it('should not throw not found when found', async () => {
      const id = await db.user.get('Id').create(UserData);
      const user = db.user.find(id).select({ UserId: 'Id' });

      const q = db.profile.createManyFrom(user, [
        {
          Bio: 'one',
          ProfileKey: 'key',
        },
        {
          Bio: 'two',
          ProfileKey: 'key2',
        },
      ]);

      await q;
    });

    it('should add runtime defaults', () => {
      const q = RuntimeDefaultTable.select('Name').createManyFrom(
        db.user.find(123).select('Password'),
        [
          {
            Id: 456,
          },
          {
            Id: 789,
          },
        ],
      );

      expectSql(
        q.toSQL(),
        `
          WITH "q" AS (
            SELECT "User"."password" "Password"
            FROM "schema"."user" "User"
            WHERE "User"."id" = $1
            LIMIT 1
          ), q2 AS (
            INSERT INTO "schema"."user"("password", "id", "name")
            SELECT "q"."Password", v."id"::int4, v."name"::text
            FROM "q", (VALUES ($2, $3), ($4, $5)) v("id", "name")
            RETURNING "user"."name" "Name"
          )
          SELECT *, NULL FROM q2
          UNION ALL
          SELECT NULL, json_build_object('q', (SELECT json_agg(row_to_json("q".*)) FROM "q"))
        `,
        [123, 456, 'runtime text', 789, 'runtime text'],
      );
    });

    it('should not allow to create from query which returns multiple records', () => {
      expect(() =>
        Message.createManyFrom(
          // @ts-expect-error creating from multiple records is not allowed
          db.chat.where({ IdOfChat: { in: [1, 2] } }).select({ ChatId: 'id' }),
          [
            {
              AuthorId: 1,
              Text: 'text',
            },
            {
              AuthorId: 2,
              Text: 'text',
            },
          ],
        ),
      ).toThrow(
        'Cannot create based on a query which returns multiple records',
      );
    });

    it('should support appending select', async () => {
      const user = await db.user.create(UserData);

      const sub = db.user.find(user.Id).select('Name');

      const q = db.user
        .createManyFrom(sub, [
          { Password: 'one', UserKey: 'key' },
          { Password: 'two', UserKey: 'key' },
        ])
        .select('Name');

      expectSql(
        q.toSQL(),
        `
          WITH "q" AS (
            SELECT "User"."name" "Name"
            FROM "schema"."user" "User"
            WHERE "User"."id" = $1
            LIMIT 1
          ), q2 AS (
            INSERT INTO "schema"."user" AS "User"("name", "password", "user_key")
            SELECT "q"."Name", v."password"::text, v."user_key"::text
            FROM "q", (VALUES ($2, $3), ($4, $5)) v("password", "user_key")
            RETURNING "User"."name" "Name"
          )
          SELECT *, NULL FROM q2
          UNION ALL
          SELECT NULL, json_build_object('q', (SELECT json_agg(row_to_json("q".*)) FROM "q"))
        `,
        [user.Id, 'one', 'key', 'two', 'key'],
      );

      const result = await q;

      assertType<typeof result, { Name: string }[]>();

      expect(result).toEqual([
        { Name: UserData.Name },
        { Name: UserData.Name },
      ]);
    });

    it('should a create record from select with additional value returned from an insert sub query', () => {
      const chat = db.chat.find(1).select({ ChatId: 'IdOfChat' });

      const query = Message.select('Text').createManyFrom(chat, [
        {
          AuthorId: () => db.user.create(UserData).get('Id'),
          Text: () => sql<string>`'text 1'`,
        },
        {
          AuthorId: () => db.user.create(UserData).get('Id'),
          Text: () => sql<string>`'text 2'`,
        },
      ]);

      assertType<Awaited<typeof query>, { Text: string }[]>();

      expectSql(
        query.toSQL(),
        `
          WITH "q" AS (
            SELECT "Chat"."id_of_chat" "ChatId"
            FROM "schema"."chat" "Chat"
            WHERE "Chat"."id_of_chat" = $1
            LIMIT 1
          ), "q2" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at")
            VALUES ($2, $3, $4, $5, $6)
            RETURNING "User"."id" "Id"
          ), "q3" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at")
            VALUES ($7, $8, $9, $10, $11)
            RETURNING "User"."id" "Id"
          ), q4 AS (
            INSERT INTO "schema"."message" AS "Message"("chat_id", "author_id", "text")
            SELECT
              "q"."ChatId",
              v."author_id"::int4,
              v."text"::text
            FROM "q", (VALUES ((SELECT "q2"."Id" FROM "q2"), 'text 1'), ((SELECT "q3"."Id" FROM "q3"), 'text 2')) v("author_id", "text")
            RETURNING "Message"."text" "Text"
          )
          SELECT *, NULL FROM q4
          UNION ALL
          SELECT NULL, json_build_object('q', (SELECT json_agg(row_to_json("q".*)) FROM "q"))
        `,
        [1, ...Object.values(UserData), ...Object.values(UserData)],
      );
    });

    it('should create from select using values from CTE', async () => {
      const idOfChat = await db.chat.create(ChatData).get('IdOfChat');

      const q = Message.with('user', () =>
        db.user.create(UserData).select('Id', 'Name'),
      )
        .createManyFrom(db.chat.find(idOfChat).select({ ChatId: 'IdOfChat' }), [
          {
            AuthorId: (q) => q.from('user').get('Id'),
            Text: (q) => q.from('user').get('Name'),
          },
          {
            AuthorId: (q) => q.from('user').get('Id'),
            Text: (q) => q.from('user').get('Name'),
          },
        ])
        .select('ChatId', 'AuthorId', 'Text');

      expectSql(
        q.toSQL(),
        `
          WITH "user" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at")
            VALUES ($1, $2, $3, $4, $5)
            RETURNING "User"."id" "Id", "User"."name" "Name"
          ), "q" AS (
            SELECT "Chat"."id_of_chat" "ChatId"
            FROM "schema"."chat" "Chat"
            WHERE "Chat"."id_of_chat" = $6
            LIMIT 1
          ), q2 AS (
            INSERT INTO "schema"."message" AS "Message"("chat_id", "author_id", "text")
            SELECT "q"."ChatId", v."author_id"::int4, v."text"::text
            FROM "q", (VALUES
              ((SELECT "user"."Id" FROM "user" LIMIT 1), (SELECT "user"."Name" FROM "user" LIMIT 1)),
              ((SELECT "user"."Id" FROM "user" LIMIT 1), (SELECT "user"."Name" FROM "user" LIMIT 1))
            ) v("author_id", "text")
            RETURNING "Message"."chat_id" "ChatId", "Message"."author_id" "AuthorId", "Message"."text" "Text"
          )
          SELECT *, NULL FROM q2
          UNION ALL
          SELECT NULL, NULL, NULL, json_build_object('q', (SELECT json_agg(row_to_json("q".*)) FROM "q"))
        `,
        [...Object.values(UserData), idOfChat],
      );

      const res = await q;

      expect(res).toEqual([
        {
          ChatId: idOfChat,
          AuthorId: expect.any(Number),
          Text: UserData.Name,
        },
        {
          ChatId: idOfChat,
          AuthorId: expect.any(Number),
          Text: UserData.Name,
        },
      ]);
    });
  });

  describe('insertManyFrom', () => {
    it('should return inserted row count by default', async () => {
      const authorId = await db.user.get('Id').create(UserData);
      const chatId = await db.chat.get('IdOfChat').create(ChatData);
      const chat = db.chat.find(chatId).select({ ChatId: 'IdOfChat' });

      const q = Message.insertManyFrom(chat, [
        { AuthorId: authorId, Text: 'text' },
        { AuthorId: authorId, Text: 'text' },
      ]);

      const result = await q;

      assertType<Awaited<typeof q>, number>();

      expect(result).toBe(2);
    });

    it('should override selecting multiple with selecting one', async () => {
      const authorId = await db.user.get('Id').create(UserData);
      const chatId = await db.chat.get('IdOfChat').create(ChatData);
      const chat = db.chat.find(chatId).select({ ChatId: 'IdOfChat' });

      const q = Message.select('Text').insertManyFrom(chat, [
        {
          AuthorId: authorId,
          Text: 'text',
        },
        {
          AuthorId: authorId,
          Text: 'text',
        },
      ]);

      const result = await q;

      assertType<Awaited<typeof q>, { Text: string }[]>();

      expect(result).toEqual([{ Text: 'text' }, { Text: 'text' }]);
    });

    it('should override selecting pluck with selecting value', async () => {
      const authorId = await db.user.get('Id').create(UserData);
      const chatId = await db.chat.get('IdOfChat').create(ChatData);
      const chat = db.chat.find(chatId).select({ ChatId: 'IdOfChat' });

      const q = Message.pluck('Text').insertManyFrom(chat, [
        {
          AuthorId: authorId,
          Text: 'text',
        },
        {
          AuthorId: authorId,
          Text: 'text',
        },
      ]);

      const result = await q;

      assertType<Awaited<typeof q>, string[]>();

      expect(result).toEqual(['text', 'text']);
    });
  });

  describe('createForEachFrom', () => {
    it('should not allow using appReadOnly columns from select', () => {
      const sub = db.chat.where({ Title: 'Title' }).select({
        key: 'Title',
        value: 'Chat.IdOfChat',
      });

      expect(() => TableWithReadOnly.createForEachFrom(sub)).toThrow(
        'Trying to insert a readonly column',
      );
    });

    it('should create records from select', () => {
      const sub = db.chat
        .where({ Title: 'Title' })
        .select({ ChatId: 'IdOfChat' });
      const query = Message.createForEachFrom(sub);

      assertType<Awaited<typeof query>, Message[]>();

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "schema"."message" AS "Message"("chat_id")
          SELECT "Chat"."id_of_chat" "ChatId"
          FROM "schema"."chat" "Chat"
          WHERE "Chat"."title" = $1
          RETURNING ${MessageColumnsSql}
        `,
        ['Title'],
      );
    });

    it('should support appending select', async () => {
      const user = await db.user.create(UserData);

      const sub = db.user.where({ Id: user.Id }).select('Name', 'Password');

      const result = await db.user.createForEachFrom(sub).select('Name');

      assertType<typeof result, { Name: string }[]>();

      expect(result).toEqual([{ Name: UserData.Name }]);
    });
  });

  describe('insertForEachFrom', () => {
    it('should return inserted row count by default', async () => {
      const chatId = await db.chat.get('IdOfChat').create(ChatData);

      const sub = db.chat.find(chatId).select({
        ChatId: 'IdOfChat',
        Text: () => sql.val('Title'),
      });
      const q = Message.insertForEachFrom(sub);

      const result = await q;

      assertType<Awaited<typeof q>, number>();

      expect(result).toBe(1);
    });

    it('should override selecting single with selecting multiple', async () => {
      const chatId = await db.chat.get('IdOfChat').create(ChatData);

      const sub = db.chat.find(chatId).select({
        ChatId: 'IdOfChat',
        Text: 'Title',
      });

      const q = Message.take().select('Text').insertForEachFrom(sub);

      const result = await q;

      assertType<Awaited<typeof q>, { Text: string }[]>();

      expect(result).toEqual([{ Text: 'title' }]);
    });

    it('should override selecting value with selecting pluck', async () => {
      const chatId = await db.chat.get('IdOfChat').create(ChatData);

      const sub = db.chat.find(chatId).select({
        ChatId: 'IdOfChat',
        Text: 'Title',
      });

      const q = Message.get('Text').insertForEachFrom(sub);

      const result = await q;

      assertType<Awaited<typeof q>, string[]>();

      expect(result).toEqual(['title']);
    });
  });
});
