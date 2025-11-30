import {
  Chat,
  chatData,
  Message,
  messageColumnsSql,
  MessageRecord,
  Snake,
  SnakeRecord,
  snakeSelectAll,
  User,
  userData,
} from '../../test-utils/test-utils';
import {
  assertType,
  expectSql,
  sql,
  testDb,
  useTestDatabase,
} from 'test-utils';

const TableWithReadOnly = testDb('table', (t) => ({
  id: t.identity().primaryKey(),
  key: t.string(),
  value: t.integer().readOnly(),
}));

const RuntimeDefaultTable = testDb('user', (t) => ({
  id: t.serial().primaryKey(),
  name: t.text().default(() => 'runtime text'),
  password: t.text(),
}));

describe('createFrom functions', () => {
  useTestDatabase();

  describe('createOneFrom', () => {
    it('should not allow using appReadOnly columns from select', () => {
      const sub = Chat.find(1).select({ key: 'title', value: 'chat.idOfChat' });

      expect(() => TableWithReadOnly.createOneFrom(sub)).toThrow(
        'Trying to insert a readonly column',
      );
    });

    it('should not allow using appReadOnly columns from values', () => {
      const sub = Chat.find(1).select({ key: 'title' });

      expect(() =>
        TableWithReadOnly.createOneFrom(sub, {
          // @ts-expect-error value is readOnly
          value: 1,
        }),
      ).toThrow('Trying to insert a readonly column');
    });

    it('should create records without additional data', () => {
      const sub = Chat.find(1).select({ chatId: 'idOfChat' });
      const q = Message.createOneFrom(sub);

      assertType<Awaited<typeof q>, MessageRecord>();

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "message"("chat_id")
          SELECT "chat"."id_of_chat" "chatId"
          FROM "chat"
          WHERE "chat"."id_of_chat" = $1
          LIMIT 1
          RETURNING ${messageColumnsSql}
        `,
        [1],
      );
    });

    it('should a create record from select with additional data', () => {
      const chat = Chat.find(1).select({ chatId: 'idOfChat' });

      const query = Message.createOneFrom(chat, {
        authorId: 1,
        text: () => sql`'text'`,
      });

      assertType<Awaited<typeof query>, MessageRecord>();

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "message"("chat_id", "author_id", "text")
          SELECT "chat"."id_of_chat" "chatId", $1, 'text'
          FROM "chat"
          WHERE "chat"."id_of_chat" = $2
          LIMIT 1
          RETURNING ${messageColumnsSql}
        `,
        [1, 1],
      );
    });

    it('should a create record from select with named columns', () => {
      const user = User.find(1).select({ snakeName: 'name' });

      const query = Snake.createOneFrom(user, {
        tailLength: 5,
      });

      assertType<Awaited<typeof query>, SnakeRecord>();

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "snake"("snake_name", "tail_length")
          SELECT "user"."name" "snakeName", $1
          FROM "user"
          WHERE "user"."id" = $2
          LIMIT 1
          RETURNING ${snakeSelectAll}
        `,
        [5, 1],
      );
    });

    it('should add runtime defaults', () => {
      const q = RuntimeDefaultTable.createOneFrom(
        User.find(123).select('password'),
        {
          id: 456,
        },
      );

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("password", "id", "name")
          SELECT "user"."password", $1, $2
          FROM "user"
          WHERE "user"."id" = $3
          LIMIT 1
          RETURNING *
        `,
        [456, 'runtime text', 123],
      );
    });

    it('should not allow to create from query which returns multiple records', () => {
      expect(() =>
        Message.createOneFrom(
          // @ts-expect-error creating from multiple records is not allowed
          Chat.where({ id: { in: [1, 2] } }).select({ chatId: 'id' }),
          {
            authorId: 1,
            text: 'text',
          },
        ),
      ).toThrow(
        'Cannot create based on a query which returns multiple records',
      );
    });

    it('should support appending select', async () => {
      const user = await User.create(userData);

      const sub = User.find(user.id).select('name');

      const result = await User.createOneFrom(sub, {
        password: 'password',
      }).select('name');

      assertType<typeof result, { name: string }>();

      expect(result).toEqual({ name: userData.name });
    });

    it('should a create record from select with additional value returned from an insert sub query', () => {
      const chat = Chat.find(1).select({ chatId: 'idOfChat' });

      const query = Message.createOneFrom(chat, {
        authorId: () => User.create(userData).get('id'),
        text: () => sql`'text'`,
      });

      assertType<Awaited<typeof query>, MessageRecord>();

      expectSql(
        query.toSQL(),
        `
          WITH "q" AS (
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            RETURNING "user"."id"
          )
          INSERT INTO "message"("chat_id", "author_id", "text")
          SELECT "chat"."id_of_chat" "chatId", (SELECT "q"."id" FROM "q"), 'text'
          FROM "chat"
          WHERE "chat"."id_of_chat" = $3
          LIMIT 1
          RETURNING ${messageColumnsSql}
        `,
        ['name', 'password', 1],
      );
    });

    it('should create from select using values from CTE', async () => {
      const idOfChat = await Chat.create(chatData).get('idOfChat');

      const q = Message.with('user', () =>
        User.create(userData).select('id', 'name'),
      )
        .createOneFrom(Chat.find(idOfChat).select({ chatId: 'idOfChat' }), {
          authorId: (q) => q.from('user').get('id'),
          text: (q) => q.from('user').get('name'),
        })
        .select('chatId', 'authorId', 'text');

      expectSql(
        q.toSQL(),
        `
          WITH "user" AS (
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            RETURNING "user"."id", "user"."name"
          )
          INSERT INTO "message"("chat_id", "author_id", "text")
          SELECT "chat"."id_of_chat" "chatId", (SELECT "user"."id" FROM "user" LIMIT 1), (SELECT "user"."name" FROM "user" LIMIT 1)
          FROM "chat"
          WHERE "chat"."id_of_chat" = $3
          LIMIT 1
          RETURNING "message"."chat_id" "chatId", "message"."author_id" "authorId", "message"."text"
        `,
        [userData.name, userData.password, idOfChat],
      );

      const res = await q;

      expect(res).toEqual({
        chatId: idOfChat,
        authorId: expect.any(Number),
        text: userData.name,
      });
    });
  });

  describe('insertOneFrom', () => {
    it('should return inserted row count by default', async () => {
      const authorId = await User.get('id').create(userData);
      const chatId = await Chat.get('idOfChat').create(chatData);
      const chat = Chat.find(chatId).select({ chatId: 'idOfChat' });

      const q = Message.insertOneFrom(chat, { authorId, text: 'text' });

      const result = await q;

      assertType<Awaited<typeof q>, number>();

      expect(result).toBe(1);
    });

    it('should override selecting multiple with selecting one', async () => {
      const authorId = await User.get('id').create(userData);
      const chatId = await Chat.get('idOfChat').create(chatData);
      const chat = Chat.find(chatId).select({ chatId: 'idOfChat' });

      const q = Message.select('text').insertOneFrom(chat, {
        authorId,
        text: 'text',
      });

      const result = await q;

      assertType<Awaited<typeof q>, { text: string }>();

      expect(result).toEqual({ text: 'text' });
    });

    it('should override selecting pluck with selecting value', async () => {
      const authorId = await User.get('id').create(userData);
      const chatId = await Chat.get('idOfChat').create(chatData);
      const chat = Chat.find(chatId).select({ chatId: 'idOfChat' });

      const q = Message.pluck('text').insertOneFrom(chat, {
        authorId,
        text: 'text',
      });

      const result = await q;

      assertType<Awaited<typeof q>, string>();

      expect(result).toBe('text');
    });
  });

  describe('createManyFrom', () => {
    it('should not allow using appReadOnly columns from select', () => {
      const sub = Chat.find(1).select({ key: 'title', value: 'chat.idOfChat' });

      expect(() => TableWithReadOnly.createManyFrom(sub, [])).toThrow(
        'Trying to insert a readonly column',
      );
    });

    it('should not allow using appReadOnly columns from values', () => {
      const sub = Chat.find(1).select({ key: 'title' });

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
      const chat = Chat.find(1).select({ chatId: 'idOfChat' });

      const query = Message.createManyFrom(chat, [
        {
          authorId: 1,
          text: () => sql`'text 1'`,
        },
        {
          authorId: 2,
          text: () => sql`'text 2'`,
        },
      ]);

      assertType<Awaited<typeof query>, MessageRecord[]>();

      expectSql(
        query.toSQL(),
        `
          WITH "chat" AS (
            SELECT "chat"."id_of_chat" "chatId"
            FROM "chat"
            WHERE "chat"."id_of_chat" = $1
            LIMIT 1
          )
          INSERT INTO "message"("chat_id", "author_id", "text")
          SELECT "chat"."chatId", v."author_id"::int4, v."text"::text
          FROM "chat", (VALUES ($2, 'text 1'), ($3, 'text 2')) v("author_id", "text")
          RETURNING ${messageColumnsSql}
        `,
        [1, 1, 2],
      );
    });

    it('should a create record from select with named columns', () => {
      const user = User.find(1).select({ snakeName: 'name' });

      const query = Snake.createManyFrom(user, [
        {
          tailLength: 5,
        },
        {
          tailLength: 6,
        },
      ]);

      assertType<Awaited<typeof query>, SnakeRecord[]>();

      expectSql(
        query.toSQL(),
        `
          WITH "user" AS (
            SELECT "user"."name" "snakeName"
            FROM "user"
            WHERE "user"."id" = $1
            LIMIT 1
          )
          INSERT INTO "snake"("snake_name", "tail_length")
          SELECT "user"."snakeName", v."tail_length"::int4
          FROM "user", (VALUES ($2), ($3)) v("tail_length")
          RETURNING ${snakeSelectAll}
        `,
        [1, 5, 6],
      );
    });

    it('should add runtime defaults', () => {
      const q = RuntimeDefaultTable.createManyFrom(
        User.find(123).select('password'),
        [
          {
            id: 456,
          },
          {
            id: 789,
          },
        ],
      );

      expectSql(
        q.toSQL(),
        `
          WITH "user" AS (
            SELECT "user"."password"
            FROM "user"
            WHERE "user"."id" = $1
            LIMIT 1
          )
          INSERT INTO "user"("password", "id", "name")
          SELECT "user"."password", v."id"::int4, v."name"::text
          FROM "user", (VALUES ($2, $3), ($4, $5)) v("id", "name")
          RETURNING *
        `,
        [123, 456, 'runtime text', 789, 'runtime text'],
      );
    });

    it('should not allow to create from query which returns multiple records', () => {
      expect(() =>
        Message.createManyFrom(
          // @ts-expect-error creating from multiple records is not allowed
          Chat.where({ id: { in: [1, 2] } }).select({ chatId: 'id' }),
          [
            {
              authorId: 1,
              text: 'text',
            },
            {
              authorId: 2,
              text: 'text',
            },
          ],
        ),
      ).toThrow(
        'Cannot create based on a query which returns multiple records',
      );
    });

    it('should support appending select', async () => {
      const user = await User.create(userData);

      const sub = User.find(user.id).select('name');

      const q = User.createManyFrom(sub, [
        { password: 'one' },
        { password: 'two' },
      ]).select('name');

      expectSql(
        q.toSQL(),
        `
          WITH "user" AS (
            SELECT "user"."name"
            FROM "user"
            WHERE "user"."id" = $1
            LIMIT 1
          )
          INSERT INTO "user"("name", "password")
          SELECT "user"."name", v."password"::text
          FROM "user", (VALUES ($2), ($3)) v("password")
          RETURNING "user"."name"
        `,
        [user.id, 'one', 'two'],
      );

      const result = await q;

      assertType<typeof result, { name: string }[]>();

      expect(result).toEqual([
        { name: userData.name },
        { name: userData.name },
      ]);
    });

    it('should a create record from select with additional value returned from an insert sub query', () => {
      const chat = Chat.find(1).select({ chatId: 'idOfChat' });

      const query = Message.createManyFrom(chat, [
        {
          authorId: () => User.create(userData).get('id'),
          text: () => sql`'text 1'`,
        },
        {
          authorId: () => User.create(userData).get('id'),
          text: () => sql`'text 2'`,
        },
      ]);

      assertType<Awaited<typeof query>, MessageRecord[]>();

      expectSql(
        query.toSQL(),
        `
          WITH "chat" AS (
            SELECT "chat"."id_of_chat" "chatId"
            FROM "chat"
            WHERE "chat"."id_of_chat" = $1
            LIMIT 1
          ), "q" AS (
            INSERT INTO "user"("name", "password")
            VALUES ($2, $3)
            RETURNING "user"."id"
          ), "q2" AS (
            INSERT INTO "user"("name", "password")
            VALUES ($4, $5)
            RETURNING "user"."id"
          )
          INSERT INTO "message"("chat_id", "author_id", "text")
          SELECT
            "chat"."chatId",
            v."author_id"::int4,
            v."text"::text
          FROM "chat", (VALUES ((SELECT "q"."id" FROM "q"), 'text 1'), ((SELECT "q2"."id" FROM "q2"), 'text 2')) v("author_id", "text")
          RETURNING ${messageColumnsSql}
        `,
        [1, 'name', 'password', 'name', 'password'],
      );
    });

    it('should create from select using values from CTE', async () => {
      const idOfChat = await Chat.create(chatData).get('idOfChat');

      const q = Message.with('user', () =>
        User.create(userData).select('id', 'name'),
      )
        .createManyFrom(Chat.find(idOfChat).select({ chatId: 'idOfChat' }), [
          {
            authorId: (q) => q.from('user').get('id'),
            text: (q) => q.from('user').get('name'),
          },
          {
            authorId: (q) => q.from('user').get('id'),
            text: (q) => q.from('user').get('name'),
          },
        ])
        .select('chatId', 'authorId', 'text');

      expectSql(
        q.toSQL(),
        `
          WITH "chat" AS (
            SELECT "chat"."id_of_chat" "chatId"
            FROM "chat"
            WHERE "chat"."id_of_chat" = $3
            LIMIT 1
          ), "user" AS (
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            RETURNING "user"."id", "user"."name"
          )
          INSERT INTO "message"("chat_id", "author_id", "text")
          SELECT "chat"."chatId", v."author_id"::int4, v."text"::text
          FROM "chat", (VALUES
            ((SELECT "user"."id" FROM "user" LIMIT 1), (SELECT "user"."name" FROM "user" LIMIT 1)),
            ((SELECT "user"."id" FROM "user" LIMIT 1), (SELECT "user"."name" FROM "user" LIMIT 1))
          ) v("author_id", "text")
          RETURNING "message"."chat_id" "chatId", "message"."author_id" "authorId", "message"."text"
        `,
        [userData.name, userData.password, idOfChat],
      );

      const res = await q;

      expect(res).toEqual([
        {
          chatId: idOfChat,
          authorId: expect.any(Number),
          text: userData.name,
        },
        {
          chatId: idOfChat,
          authorId: expect.any(Number),
          text: userData.name,
        },
      ]);
    });
  });

  describe('insertManyFrom', () => {
    it('should return inserted row count by default', async () => {
      const authorId = await User.get('id').create(userData);
      const chatId = await Chat.get('idOfChat').create(chatData);
      const chat = Chat.find(chatId).select({ chatId: 'idOfChat' });

      const q = Message.insertManyFrom(chat, [
        { authorId, text: 'text' },
        { authorId, text: 'text' },
      ]);

      const result = await q;

      assertType<Awaited<typeof q>, number>();

      expect(result).toBe(2);
    });

    it('should override selecting multiple with selecting one', async () => {
      const authorId = await User.get('id').create(userData);
      const chatId = await Chat.get('idOfChat').create(chatData);
      const chat = Chat.find(chatId).select({ chatId: 'idOfChat' });

      const q = Message.select('text').insertManyFrom(chat, [
        {
          authorId,
          text: 'text',
        },
        {
          authorId,
          text: 'text',
        },
      ]);

      const result = await q;

      assertType<Awaited<typeof q>, { text: string }[]>();

      expect(result).toEqual([{ text: 'text' }, { text: 'text' }]);
    });

    it('should override selecting pluck with selecting value', async () => {
      const authorId = await User.get('id').create(userData);
      const chatId = await Chat.get('idOfChat').create(chatData);
      const chat = Chat.find(chatId).select({ chatId: 'idOfChat' });

      const q = Message.pluck('text').insertManyFrom(chat, [
        {
          authorId,
          text: 'text',
        },
        {
          authorId,
          text: 'text',
        },
      ]);

      const result = await q;

      assertType<Awaited<typeof q>, string[]>();

      expect(result).toEqual(['text', 'text']);
    });
  });

  describe('createForEachFrom', () => {
    it('should not allow using appReadOnly columns from select', () => {
      const sub = Chat.where({ title: 'title' }).select({
        key: 'title',
        value: 'chat.idOfChat',
      });

      expect(() => TableWithReadOnly.createForEachFrom(sub)).toThrow(
        'Trying to insert a readonly column',
      );
    });

    it('should create records from select', () => {
      const sub = Chat.where({ title: 'title' }).select({ chatId: 'idOfChat' });
      const query = Message.createForEachFrom(sub);

      assertType<Awaited<typeof query>, MessageRecord[]>();

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "message"("chat_id")
          SELECT "chat"."id_of_chat" "chatId"
          FROM "chat"
          WHERE "chat"."title" = $1
          RETURNING ${messageColumnsSql}
        `,
        ['title'],
      );
    });

    it('should a create record from select with named columns', () => {
      const sub = User.where({ name: 'name' }).select({ snakeName: 'name' });
      const query = Snake.createForEachFrom(sub);

      assertType<Awaited<typeof query>, SnakeRecord[]>();

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "snake"("snake_name")
          SELECT "user"."name" "snakeName"
          FROM "user"
          WHERE "user"."name" = $1
          RETURNING ${snakeSelectAll}
        `,
        ['name'],
      );
    });

    it('should support appending select', async () => {
      const user = await User.create(userData);

      const sub = User.where({ id: user.id }).select('name', 'password');

      const result = await User.createForEachFrom(sub).select('name');

      assertType<typeof result, { name: string }[]>();

      expect(result).toEqual([{ name: userData.name }]);
    });
  });

  describe('insertForEachFrom', () => {
    it('should return inserted row count by default', async () => {
      const chatId = await Chat.get('idOfChat').create(chatData);

      const sub = Chat.find(chatId).select({
        chatId: 'idOfChat',
        text: (q) => q.val('title'),
      });
      const q = Message.insertForEachFrom(sub);

      const result = await q;

      assertType<Awaited<typeof q>, number>();

      expect(result).toBe(1);
    });

    it('should override selecting single with selecting multiple', async () => {
      const chatId = await Chat.get('idOfChat').create(chatData);

      const sub = Chat.find(chatId).select({
        chatId: 'idOfChat',
        text: 'title',
      });

      const q = Message.take().select('text').insertForEachFrom(sub);

      const result = await q;

      assertType<Awaited<typeof q>, { text: string }[]>();

      expect(result).toEqual([{ text: 'title' }]);
    });

    it('should override selecting value with selecting pluck', async () => {
      const chatId = await Chat.get('idOfChat').create(chatData);

      const sub = Chat.find(chatId).select({
        chatId: 'idOfChat',
        text: 'title',
      });

      const q = Message.get('text').insertForEachFrom(sub);

      const result = await q;

      assertType<Awaited<typeof q>, string[]>();

      expect(result).toEqual(['title']);
    });
  });
});
