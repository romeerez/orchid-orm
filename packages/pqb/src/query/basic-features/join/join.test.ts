import {
  Chat,
  chatData,
  expectQueryNotMutated,
  Message,
  messageData,
  Snake,
  snakeSelectAllWithTable,
  User,
  userData,
  userTableColumnsSql,
} from '../../../test-utils/pqb.test-utils';
import { testWhere, testWhereExists } from '../where/test-where';
import { testJoin } from './test-join';
import {
  assertType,
  db,
  expectSql,
  ProfileSelectAll,
  ProfileSelectAllWithTable,
  UserData,
  UserSelectAll,
  UserSelectAllWithTable,
  useTestDatabase,
} from 'test-utils';
import { isQueryNone } from '../../extra-features/none/none';

const insertMessage = async () => {
  const userId = await User.get('id').insert(userData);
  const chatId = await Chat.get('idOfChat').insert(chatData);
  await Message.insert({ ...messageData, authorId: userId, chatId });
};

it('should not accept wrong column as join arg', () => {
  // @ts-expect-error wrong message column
  User.join(Message, 'message.wrong', 'user.id');

  // @ts-expect-error wrong user column
  User.join(Message, 'message.id', 'user.wrong');
});

describe('using db', () => {
  useTestDatabase();

  it('should ignore duplicated joins', async () => {
    await insertMessage();

    const q = User.join(Message, 'message.authorId', 'user.id')
      .join(Message, 'message.authorId', 'user.id')
      .select('message.updatedAt');

    expectSql(
      q.toSQL(),
      `
        SELECT "message"."updated_at" "updatedAt"
        FROM "schema"."user"
        JOIN "schema"."message" ON "message"."author_id" = "user"."id"
      `,
    );

    const res = await q;

    expect(res).toEqual([{ updatedAt: expect.any(Date) }]);
  });

  it('should properly reference de-duplicated join value in get', async () => {
    await insertMessage();

    const q = db.user
      .select({
        firstJoinName: (q) => q.messages.count(),
        messagesCount: (q) => q.messages.count(),
      })
      .get('messagesCount');

    expectSql(
      q.toSQL(),
      `
        SELECT "firstJoinName"."messagesCount" FROM "schema"."user"
        LEFT JOIN LATERAL (
          SELECT count(*) "firstJoinName", count(*) "messagesCount"
          FROM "schema"."message" "messages"
          WHERE ("messages"."author_id" = "user"."id" AND "messages"."message_key" = "user"."user_key")
            AND ("messages"."deleted_at" IS NULL)
        ) "firstJoinName" ON true
        LIMIT 1
      `,
    );

    const res = await q;
    expect(res).toBe(0);
  });
});

describe('join', () => {
  testJoin({
    method: 'join',
    joinTo: User,
    pkey: 'user.id',
    joinTarget: Message,
    fkey: 'authorId',
    text: 'text',
    selectFrom: `SELECT ${userTableColumnsSql} FROM "schema"."user"`,
  });
});

describe('join table with named columns', () => {
  testJoin({
    method: 'join',
    joinTo: User,
    pkey: 'user.name',
    joinTarget: Snake,
    fkey: 'tailLength',
    text: 'snakeName',
    selectFrom: `SELECT ${userTableColumnsSql} FROM "schema"."user"`,
  });
});

describe('join to table with named columns', () => {
  testJoin({
    method: 'join',
    joinTo: Snake,
    pkey: 'snake.snakeName',
    joinTarget: User,
    fkey: 'name',
    text: 'name',
    selectFrom: `SELECT ${snakeSelectAllWithTable} FROM "schema"."snake"`,
  });
});

describe.each`
  method         | sql
  ${'join'}      | ${'JOIN'}
  ${'leftJoin'}  | ${'LEFT JOIN'}
  ${'rightJoin'} | ${'RIGHT JOIN'}
  ${'fullJoin'}  | ${'FULL JOIN'}
`('$method', ({ method, sql }) => {
  it('should call _join with proper join type', () => {
    const q = User.clone();
    q.clone = (() => q) as unknown as typeof q.clone;

    const args = ['authorId', 'id'] as const;

    q[method as 'join'](Message, ...args);

    expect(q.q.join).toMatchObject([{ type: sql }]);
  });
});

describe('join callback with query builder', () => {
  it('should have .on and .onOr properly working', () => {
    const q = User.all();

    const expectedSql = `
      SELECT ${userTableColumnsSql} FROM "schema"."user"
      JOIN "schema"."message"
        ON "message"."author_id" = "user"."id"
        OR "message"."text" = "user"."name"
    `;

    expectSql(
      q
        .join(Message, (q) =>
          q.on('message.authorId', 'user.id').orOn('message.text', 'user.name'),
        )
        .toSQL(),
      expectedSql,
    );

    expectSql(
      q
        .join(Message, (q) =>
          q
            .on('message.authorId', '=', 'user.id')
            .orOn('message.text', '=', 'user.name'),
        )
        .toSQL(),
      expectedSql,
    );

    expectQueryNotMutated(q);
  });

  it('should have .on and .onOr properly working for named columns', () => {
    const expectedSql = `
      SELECT ${snakeSelectAllWithTable} FROM "schema"."snake"
      JOIN "schema"."user"
        ON "user"."name" = "snake"."snake_name"
        OR "user"."id" = "snake"."tail_length"
    `;

    expectSql(
      Snake.join(User, (q) =>
        q
          .on('user.name', 'snake.snakeName')
          .orOn('user.id', 'snake.tailLength'),
      ).toSQL(),
      expectedSql,
    );

    expectSql(
      Snake.join(User, (q) =>
        q
          .on('user.name', '=', 'snake.snakeName')
          .orOn('user.id', '=', 'snake.tailLength'),
      ).toSQL(),
      expectedSql,
    );
  });

  it('should have .on and .onOr properly working when joining table with named columns', () => {
    const reverseSql = `
      SELECT ${userTableColumnsSql} FROM "schema"."user"
      JOIN "schema"."snake"
        ON "snake"."snake_name" = "user"."name"
        OR "snake"."tail_length" = "user"."id"
    `;

    expectSql(
      User.join(Snake, (q) =>
        q
          .on('snake.snakeName', 'user.name')
          .orOn('snake.tailLength', 'user.id'),
      ).toSQL(),
      reverseSql,
    );

    expectSql(
      User.join(Snake, (q) =>
        q
          .on('snake.snakeName', '=', 'user.name')
          .orOn('snake.tailLength', '=', 'user.id'),
      ).toSQL(),
      reverseSql,
    );
  });

  it('should have .onJsonPathEquals method', () => {
    expectSql(
      User.join(User.as('otherUser'), (q) =>
        q.onJsonPathEquals('otherUser.data', '$.name', 'user.data', '$.name'),
      ).toSQL(),
      `
        SELECT ${userTableColumnsSql} FROM "schema"."user"
        JOIN "schema"."user" "otherUser"
          ON jsonb_path_query_first("otherUser"."data", $1) = jsonb_path_query_first("user"."data", $2)
      `,
      ['$.name', '$.name'],
    );
  });

  it('should have .onJsonPathEquals method working for named columns', () => {
    expectSql(
      Snake.join(Snake.as('otherSnake'), (q) =>
        q.onJsonPathEquals(
          'otherSnake.snakeData',
          '$.name',
          'snake.snakeData',
          '$.name',
        ),
      ).toSQL(),
      `
        SELECT ${snakeSelectAllWithTable} FROM "schema"."snake"
        JOIN "schema"."snake" "otherSnake"
          ON jsonb_path_query_first("otherSnake"."snake_data", $1) = jsonb_path_query_first("snake"."snake_data", $2)
      `,
      ['$.name', '$.name'],
    );
  });

  describe('where methods', () => {
    describe('using main table columns', () => {
      const sql = `SELECT ${userTableColumnsSql} FROM "schema"."user" JOIN "schema"."message" ON `;
      const snakeSql = `SELECT ${snakeSelectAllWithTable} FROM "schema"."snake" JOIN "schema"."user" ON `;

      it('should use main table column in .where', () => {
        const q = User.join(Message, (q) => q.where({ 'user.name': 'name' }));

        expectSql(q.toSQL(), sql + `"user"."name" = $1`, ['name']);
      });

      it('should support named column of main table in .where', () => {
        const q = Snake.join(User, (q) =>
          q.where({ 'snake.snakeName': 'name' }),
        );

        expectSql(q.toSQL(), snakeSql + `"snake"."snake_name" = $1`, ['name']);
      });

      it('should use main table column in .whereNot', () => {
        const q = User.join(Message, (q) =>
          q.whereNot({ 'user.name': 'name' }),
        );

        expectSql(q.toSQL(), sql + `NOT "user"."name" = $1`, ['name']);
      });

      it('should use named main table column in .whereNot', () => {
        const q = Snake.join(User, (q) =>
          q.whereNot({ 'snake.snakeName': 'name' }),
        );

        expectSql(q.toSQL(), snakeSql + `NOT "snake"."snake_name" = $1`, [
          'name',
        ]);
      });

      it('should use main table column in .or', () => {
        const q = User.join(Message, (q) =>
          q.orWhere({ 'user.name': 'name' }, { 'user.age': 20 }),
        );

        expectSql(q.toSQL(), sql + `"user"."name" = $1 OR "user"."age" = $2`, [
          'name',
          20,
        ]);
      });

      it('should use named main table column in .or', () => {
        const q = Snake.join(User, (q) =>
          q.orWhere({ 'snake.snakeName': 'name' }, { 'snake.tailLength': 20 }),
        );

        expectSql(
          q.toSQL(),
          snakeSql + `"snake"."snake_name" = $1 OR "snake"."tail_length" = $2`,
          ['name', 20],
        );
      });

      it('should use main table column in .orWhereNot', () => {
        const q = User.join(Message, (q) =>
          q.orWhereNot({ 'user.name': 'name' }, { 'user.age': 20 }),
        );

        expectSql(
          q.toSQL(),
          sql + `NOT "user"."name" = $1 OR NOT "user"."age" = $2`,
          ['name', 20],
        );
      });

      it('should use named main table column in .orWhereNot', () => {
        const q = Snake.join(User, (q) =>
          q.orWhereNot(
            { 'snake.snakeName': 'name' },
            { 'snake.tailLength': 20 },
          ),
        );

        expectSql(
          q.toSQL(),
          snakeSql +
            `NOT "snake"."snake_name" = $1 OR NOT "snake"."tail_length" = $2`,
          ['name', 20],
        );
      });

      it('should use main table column in .whereIn', () => {
        const q = User.join(Message, (q) => q.whereIn('user.name', ['name']));

        expectSql(q.toSQL(), sql + `"user"."name" IN ($1)`, ['name']);
      });

      it('should use named main table column in .whereIn', () => {
        const q = Snake.join(User, (q) =>
          q.whereIn('snake.snakeName', ['name']),
        );

        expectSql(q.toSQL(), snakeSql + `"snake"."snake_name" IN ($1)`, [
          'name',
        ]);
      });

      it('should use main table column in .orWhereIn', () => {
        const q = User.join(Message, (q) =>
          q.where({ 'user.age': 20 }).orWhereIn('user.name', ['name']),
        );

        expectSql(
          q.toSQL(),
          sql + `"user"."age" = $1 OR "user"."name" IN ($2)`,
          [20, 'name'],
        );
      });

      it('should use named main table column in .orWhereIn', () => {
        const q = Snake.join(User, (q) =>
          q
            .where({ 'snake.tailLength': 20 })
            .orWhereIn('snake.snakeName', ['name']),
        );

        expectSql(
          q.toSQL(),
          snakeSql +
            `"snake"."tail_length" = $1 OR "snake"."snake_name" IN ($2)`,
          [20, 'name'],
        );
      });

      it('should use main table column in .whereNotIn', () => {
        const q = User.join(Message, (q) =>
          q.whereNotIn('user.name', ['name']),
        );

        expectSql(q.toSQL(), sql + `NOT "user"."name" IN ($1)`, ['name']);
      });

      it('should use named main table column in .whereNotIn', () => {
        const q = Snake.join(User, (q) =>
          q.whereNotIn('snake.snakeName', ['name']),
        );

        expectSql(q.toSQL(), snakeSql + `NOT "snake"."snake_name" IN ($1)`, [
          'name',
        ]);
      });

      it('should use main table column in .orWhereNotIn', () => {
        const q = User.join(Message, (q) =>
          q.where({ 'user.age': 20 }).orWhereNotIn('user.name', ['name']),
        );

        expectSql(
          q.toSQL(),
          sql + `"user"."age" = $1 OR NOT "user"."name" IN ($2)`,
          [20, 'name'],
        );
      });

      it('should use named main table column in .orWhereNotIn', () => {
        const q = Snake.join(User, (q) =>
          q
            .where({ 'snake.tailLength': 20 })
            .orWhereNotIn('snake.snakeName', ['name']),
        );

        expectSql(
          q.toSQL(),
          snakeSql +
            `"snake"."tail_length" = $1 OR NOT "snake"."snake_name" IN ($2)`,
          [20, 'name'],
        );
      });
    });

    describe('join sub query', () => {
      it('should join a sub query with named columns', () => {
        const q = db.user
          .join(
            db.profile
              .select('Bio', 'UserId')
              .where({
                Bio: 'bio',
              })
              .as('t'),
            'UserId',
            'Id',
          )
          .where({
            't.UserId': 1,
          })
          .select({
            bio: 't.Bio',
            userId: 't.UserId',
          });

        expectSql(
          q.toSQL(),
          `
            SELECT
              "t"."Bio" "bio",
              "t"."UserId" "userId"
            FROM "schema"."user"
            JOIN
              (
                SELECT
                  "t"."bio" "Bio",
                  "t"."user_id" "UserId"
                FROM "schema"."profile" "t"
                WHERE "t"."bio" = $1
              ) "t"
              ON "t"."UserId" = "user"."id"
            WHERE "t"."UserId" = $2
          `,
          ['bio', 1],
        );
      });
    });

    testWhere(
      (cb) => db.profile.join(db.user, cb as never).toSQL(),
      `SELECT ${ProfileSelectAllWithTable} FROM "schema"."profile" JOIN "schema"."user" ON`,
      {
        model: db.user,
        pkey: 'user.Id',
        nullable: 'Picture',
        text: 'Name',
      },
    );

    testWhereExists({
      joinTo: db.user,
      pkey: 'user.Id',
      joinTarget: db.profile,
      fkey: 'UserId',
      text: 'Bio',
      selectFrom: `SELECT ${UserSelectAll} FROM "schema"."user"`,
    });

    testWhere(
      (cb) => db.user.join(db.profile, cb as never).toSQL(),
      `SELECT ${UserSelectAllWithTable} FROM "schema"."user" JOIN "schema"."profile" ON`,
      {
        model: db.profile,
        pkey: 'profile.UserId',
        nullable: 'Bio',
        text: 'Bio',
      },
    );

    testWhereExists({
      joinTo: db.profile,
      pkey: 'profile.UserId',
      joinTarget: db.user,
      fkey: 'Id',
      text: 'Name',
      selectFrom: `SELECT ${ProfileSelectAll} FROM "schema"."profile"`,
    });
  });

  // for https://github.com/romeerez/orchid-orm/issues/247
  it('should have a proper table type in the callback', () => {
    db.user.join(db.message, (q) => {
      assertType<typeof q.table, 'message'>();
      return q;
    });
  });

  describe('join `none` sub-query', () => {
    it('should handle `none` sub-query', () => {
      const q = db.user.join(db.message.none(), (q) => q);

      expect(isQueryNone(q)).toBe(true);
    });

    it('should handle 1st callback `none`', () => {
      const q = db.user.join(
        () => db.message.none(),
        (q) => q,
      );

      expect(isQueryNone(q)).toBe(true);
    });

    it('should handle 2nd callback `none`', () => {
      const q = db.user.join(db.message, (q) => q.none());

      expect(isQueryNone(q)).toBe(true);
    });
  });

  describe('left join `none` sub-query', () => {
    it('should join with `where false`', () => {
      const q = db.user.leftJoin(db.message.none(), (q) => q);

      expect(isQueryNone(q)).toBe(false);

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAllWithTable}
          FROM "schema"."user"
          LEFT JOIN "schema"."message" ON ((false)) AND ("message"."deleted_at" IS NULL)`,
      );
    });

    it('should join with `where false` for 2nd callback `none`', () => {
      const q = db.user.leftJoin(db.message, (q) => q.none());

      expect(isQueryNone(q)).toBe(false);

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAllWithTable}
          FROM "schema"."user"
          LEFT JOIN "schema"."message" ON (false) AND ("message"."deleted_at" IS NULL)
        `,
      );
    });
  });
});

describe('implicit lateral joins', () => {
  useTestDatabase();

  it(`should disallow selecting joined columns that weren't selected inside join`, () => {
    db.user
      .join(db.message, (q) => q.on('AuthorId', 'user.Id').select('Text'))
      .select('message.Text')
      .select(
        // @ts-expect-error the column is not selected inside join
        'message.Id',
      );
  });

  it('should work when joining a table', async () => {
    await insertMessage();

    const q = db.user
      .join(db.message, (q) =>
        q
          .on('message.AuthorId', 'user.Id')
          .where({ Text: messageData.text })
          .limit(5),
      )
      .select('message.updatedAt');

    expectSql(
      q.toSQL(),
      `
        SELECT "message"."updated_at" "updatedAt"
        FROM "schema"."user"
        JOIN LATERAL (
          SELECT "message".*
          FROM "schema"."message"
          WHERE ("message"."author_id" = "user"."id" AND "message"."text" = $1)
            AND ("message"."deleted_at" IS NULL)
          LIMIT $2
        ) "message" ON true
      `,
      [messageData.text, 5],
    );

    const res = await q;

    expect(res).toEqual([{ updatedAt: expect.any(Date) }]);
  });

  it('should work when joining a sub-query', () => {
    const q = db.user
      .join(
        () => db.message.limit(5),
        (q) =>
          q
            .on('message.Id', 'user.Id')
            .where({ Text: 'text' })
            .limit(5)
            .offset(10),
      )
      .select('message.AuthorId');

    expectSql(
      q.toSQL(),
      `
        SELECT "message"."author_id" "AuthorId"
        FROM "schema"."user"
        JOIN LATERAL (
          SELECT "message".*
          FROM "schema"."message"
          WHERE ("message"."id" = "user"."id" AND "message"."text" = $1)
            AND ("message"."deleted_at" IS NULL)
          LIMIT $2
          OFFSET $3
        ) "message" ON true
      `,
      ['text', 5, 10],
    );
  });

  it('should work when joining with statement', () => {
    const q = db.user
      .with('p', db.profile)
      .join('p', (q) => q.on('UserId', 'user.Id').limit(5).offset(10));

    expectSql(
      q.toSQL(),
      `
        WITH "p" AS (SELECT ${ProfileSelectAll} FROM "schema"."profile")
        SELECT ${UserSelectAllWithTable}
        FROM "schema"."user"
        JOIN LATERAL (
          SELECT *
          FROM "p"
          WHERE "p"."UserId" = "user"."id"
          LIMIT $1
          OFFSET $2
        ) "p" ON true
      `,
      [5, 10],
    );
  });

  it('should not resolve column names inside join closure if nothing was selected explicitly', () => {
    const q = db.user
      .join(db.profile, (q) => q.on('profile.UserId', 'user.Id').limit(1))
      .where({
        'profile.Bio': 'bio',
      })
      .select('profile.Bio');

    expectSql(
      q.toSQL(),
      `
        SELECT "profile"."bio" "Bio"
        FROM "schema"."user"
        JOIN LATERAL (
          SELECT "profile".*
          FROM "schema"."profile"
          WHERE "profile"."user_id" = "user"."id"
          LIMIT $1
        ) "profile" ON true
        WHERE "profile"."bio" = $2
      `,
      [1, 'bio'],
    );
  });

  it('should use resolved column names outside of join closure when names are resolved inside', () => {
    const q = db.user
      .join(db.profile, (q) =>
        q.on('profile.UserId', 'user.Id').select('profile.Bio'),
      )
      .where({
        'profile.Bio': 'bio',
      })
      .select('profile.Bio');

    expectSql(
      q.toSQL(),
      `
        SELECT "profile"."Bio"
        FROM "schema"."user"
        JOIN LATERAL (
          SELECT "profile"."bio" "Bio"
          FROM "schema"."profile"
          WHERE "profile"."user_id" = "user"."id"
        ) "profile" ON true
        WHERE "profile"."Bio" = $1
      `,
      ['bio'],
    );
  });
});

describe('joinData', () => {
  useTestDatabase();

  it('should join a on-the-fly constructed table containing user-provided data', async () => {
    const userId = await db.user.get('Id').insert(UserData);

    const now = new Date();

    const q = db.user
      .joinData(
        'data',
        (t) => ({
          foo: t.integer().name('f'),
          bar: t.timestamp().asDate().name('b').nullable(),
        }),
        [{ foo: 1, bar: now.getTime() }, { foo: 2 }],
      )
      .where({ 'data.foo': { gte: 1 } })
      .select('Id', 'data.foo', 'data.bar');

    const result = await q;

    assertType<
      typeof result,
      { Id: number; foo: number; bar: Date | null }[]
    >();

    expect(result).toEqual([
      { Id: userId, foo: 1, bar: now },
      { Id: userId, foo: 2, bar: null },
    ]);

    expectSql(
      q.toSQL(),
      `
        SELECT "user"."id" "Id", "data"."f" "foo", "data"."b" "bar"
        FROM "schema"."user"
        JOIN (VALUES ($1::int4, $2::timestamptz), ($3::int4, $4::timestamptz)) "data"("f", "b") ON true
        WHERE "data"."f" >= $5
      `,
      [1, now, 2, null, 1],
    );
  });
});

describe('adding relations of relations to the context', () => {
  it('should work for a 2st arg callback', () => {
    const q = db.user
      .join('messages', (q) => q.as('m'))
      .join('m.chat')
      .select('chat.IdOfChat');

    assertType<Awaited<typeof q>, { IdOfChat: number }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "chat"."id_of_chat" "IdOfChat"
        FROM "schema"."user"
        JOIN "schema"."message" "m"
          ON (
            "m"."author_id" = "user"."id"
            AND "m"."message_key" = "user"."user_key"
          ) AND ("m"."deleted_at" IS NULL)
        JOIN "schema"."chat"
          ON "chat"."id_of_chat" = "m"."chat_id"
         AND "chat"."chat_key" = "m"."message_key"
      `,
    );
  });

  it('should work for a 1st arg query object', () => {
    const q = db.user
      .join(db.message, 'message.AuthorId', 'user.Id')
      .join('message.chat')
      .select('chat.IdOfChat');

    assertType<Awaited<typeof q>, { IdOfChat: number }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "chat"."id_of_chat" "IdOfChat"
        FROM "schema"."user"
        JOIN "schema"."message"
          ON "message"."author_id" = "user"."id"
         AND ("message"."deleted_at" IS NULL)
        JOIN "schema"."chat"
          ON "chat"."id_of_chat" = "message"."chat_id"
         AND "chat"."chat_key" = "message"."message_key"
      `,
    );
  });

  it('should work for a 1st arg relation name', () => {
    const q = db.user
      .join('messages')
      .join('messages.chat')
      .select('chat.IdOfChat');

    assertType<Awaited<typeof q>, { IdOfChat: number }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "chat"."id_of_chat" "IdOfChat"
        FROM "schema"."user"
        JOIN "schema"."message" "messages"
          ON (
            "messages"."author_id" = "user"."id"
            AND "messages"."message_key" = "user"."user_key"
          ) AND ("messages"."deleted_at" IS NULL)
        JOIN "schema"."chat"
          ON "chat"."id_of_chat" = "messages"."chat_id"
         AND "chat"."chat_key" = "messages"."message_key"
      `,
    );
  });

  it('should work for a 1st arg function returning a query', () => {
    const q = db.user
      .join((q) => q.messages)
      .join('messages.chat')
      .select('chat.IdOfChat');

    assertType<Awaited<typeof q>, { IdOfChat: number }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "chat"."id_of_chat" "IdOfChat"
        FROM "schema"."user"
        JOIN "schema"."message" "messages"
          ON (
            "messages"."author_id" = "user"."id"
            AND "messages"."message_key" = "user"."user_key"
          ) AND ("messages"."deleted_at" IS NULL)
        JOIN "schema"."chat"
          ON "chat"."id_of_chat" = "messages"."chat_id"
         AND "chat"."chat_key" = "messages"."message_key"
      `,
    );
  });

  it('should work for a 1st arg function returning a query', () => {
    const q = db.user
      .join((q) => q.messages)
      .join('messages.chat')
      .select('chat.IdOfChat');

    assertType<Awaited<typeof q>, { IdOfChat: number }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "chat"."id_of_chat" "IdOfChat"
        FROM "schema"."user"
        JOIN "schema"."message" "messages"
          ON (
            "messages"."author_id" = "user"."id"
            AND "messages"."message_key" = "user"."user_key"
          ) AND ("messages"."deleted_at" IS NULL)
        JOIN "schema"."chat"
          ON "chat"."id_of_chat" = "messages"."chat_id"
         AND "chat"."chat_key" = "messages"."message_key"
      `,
    );
  });

  it('should work in rightJoin when the main table data becomes optional', () => {
    const q = db.user
      .rightJoin('messages')
      .rightJoin('messages.chat')
      .select('Id', 'chat.IdOfChat');

    assertType<Awaited<typeof q>, { Id: number | null; IdOfChat: number }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "user"."id" "Id", "chat"."id_of_chat" "IdOfChat"
        FROM "schema"."user"
        RIGHT JOIN "schema"."message" "messages"
          ON (
            "messages"."author_id" = "user"."id"
            AND "messages"."message_key" = "user"."user_key"
          ) AND ("messages"."deleted_at" IS NULL)
        RIGHT JOIN "schema"."chat"
          ON "chat"."id_of_chat" = "messages"."chat_id"
         AND "chat"."chat_key" = "messages"."message_key"
      `,
    );
  });

  it('should work in leftJoin when the joined table data becomes optional', () => {
    const q = db.user
      .leftJoin('messages')
      .leftJoin('messages.chat')
      .select('Id', 'chat.IdOfChat');

    assertType<Awaited<typeof q>, { Id: number; IdOfChat: number | null }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "user"."id" "Id", "chat"."id_of_chat" "IdOfChat"
        FROM "schema"."user"
        LEFT JOIN "schema"."message" "messages"
          ON (
            "messages"."author_id" = "user"."id"
            AND "messages"."message_key" = "user"."user_key"
          ) AND ("messages"."deleted_at" IS NULL)
        LEFT JOIN "schema"."chat"
          ON "chat"."id_of_chat" = "messages"."chat_id"
         AND "chat"."chat_key" = "messages"."message_key"
      `,
    );
  });
});
