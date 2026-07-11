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
import { quoteTableWithSchemaAndAlias } from '../../sql/sql';

const quotedUser = quoteTableWithSchemaAndAlias(User);
const quotedMessage = quoteTableWithSchemaAndAlias(Message);
const quotedSnake = quoteTableWithSchemaAndAlias(Snake);
const quotedProfile = quoteTableWithSchemaAndAlias(db.profile);

const insertMessage = async () => {
  const userId = await User.get('id').insert(userData);
  const chatId = await Chat.get('idOfChat').insert(chatData);
  await Message.insert({ ...messageData, authorId: userId, chatId });
};

it('should not accept wrong column as join arg', () => {
  // @ts-expect-error wrong message column
  User.join(Message, 'Message.wrong', 'User.id');

  // @ts-expect-error wrong user column
  User.join(Message, 'Message.id', 'User.wrong');
});

describe('using db', () => {
  useTestDatabase();

  it('should ignore duplicated joins', async () => {
    await insertMessage();

    const q = User.join(Message, 'Message.authorId', 'User.id')
      .join(Message, 'Message.authorId', 'User.id')
      .select('Message.updatedAt');

    expectSql(
      q.toSQL(),
      `
        SELECT "Message"."updated_at" "updatedAt"
        FROM ${quotedUser}
        JOIN ${quotedMessage} ON "Message"."author_id" = "User"."id"
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
        SELECT "firstJoinName"."messagesCount" FROM ${quotedUser}
        LEFT JOIN LATERAL (
          SELECT count(*) "firstJoinName", count(*) "messagesCount"
          FROM "schema"."message" "messages"
          WHERE ("messages"."author_id" = "User"."id" AND "messages"."message_key" = "User"."user_key")
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
    pkey: 'User.id',
    joinTarget: Message,
    fkey: 'authorId',
    text: 'text',
    selectFrom: `SELECT ${userTableColumnsSql} FROM ${quotedUser}`,
  });
});

describe('join table with named columns', () => {
  testJoin({
    method: 'join',
    joinTo: User,
    pkey: 'User.name',
    joinTarget: Snake,
    fkey: 'tailLength',
    text: 'snakeName',
    selectFrom: `SELECT ${userTableColumnsSql} FROM ${quotedUser}`,
  });
});

describe('join to table with named columns', () => {
  testJoin({
    method: 'join',
    joinTo: Snake,
    pkey: 'Snake.snakeName',
    joinTarget: User,
    fkey: 'name',
    text: 'name',
    selectFrom: `SELECT ${snakeSelectAllWithTable} FROM ${quotedSnake}`,
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
      SELECT ${userTableColumnsSql} FROM ${quotedUser}
      JOIN ${quotedMessage}
        ON "Message"."author_id" = "User"."id"
        OR "Message"."text" = "User"."name"
    `;

    expectSql(
      q
        .join(Message, (q) =>
          q.on('Message.authorId', 'User.id').orOn('Message.text', 'User.name'),
        )
        .toSQL(),
      expectedSql,
    );

    expectSql(
      q
        .join(Message, (q) =>
          q
            .on('Message.authorId', '=', 'User.id')
            .orOn('Message.text', '=', 'User.name'),
        )
        .toSQL(),
      expectedSql,
    );

    expectQueryNotMutated(q);
  });

  it('should have .on and .onOr properly working for named columns', () => {
    const expectedSql = `
      SELECT ${snakeSelectAllWithTable} FROM ${quotedSnake}
      JOIN ${quotedUser}
        ON "User"."name" = "Snake"."snake_name"
        OR "User"."id" = "Snake"."tail_length"
    `;

    expectSql(
      Snake.join(User, (q) =>
        q
          .on('User.name', 'Snake.snakeName')
          .orOn('User.id', 'Snake.tailLength'),
      ).toSQL(),
      expectedSql,
    );

    expectSql(
      Snake.join(User, (q) =>
        q
          .on('User.name', '=', 'Snake.snakeName')
          .orOn('User.id', '=', 'Snake.tailLength'),
      ).toSQL(),
      expectedSql,
    );
  });

  it('should have .on and .onOr properly working when joining table with named columns', () => {
    const reverseSql = `
      SELECT ${userTableColumnsSql} FROM ${quotedUser}
      JOIN ${quotedSnake}
        ON "Snake"."snake_name" = "User"."name"
        OR "Snake"."tail_length" = "User"."id"
    `;

    expectSql(
      User.join(Snake, (q) =>
        q
          .on('Snake.snakeName', 'User.name')
          .orOn('Snake.tailLength', 'User.id'),
      ).toSQL(),
      reverseSql,
    );

    expectSql(
      User.join(Snake, (q) =>
        q
          .on('Snake.snakeName', '=', 'User.name')
          .orOn('Snake.tailLength', '=', 'User.id'),
      ).toSQL(),
      reverseSql,
    );
  });

  it('should have .onJsonPathEquals method', () => {
    expectSql(
      User.join(User.as('otherUser'), (q) =>
        q.onJsonPathEquals('otherUser.data', '$.name', 'User.data', '$.name'),
      ).toSQL(),
      `
        SELECT ${userTableColumnsSql} FROM ${quotedUser}
        JOIN "schema"."user" "otherUser"
          ON jsonb_path_query_first("otherUser"."data", $1) = jsonb_path_query_first("User"."data", $2)
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
          'Snake.snakeData',
          '$.name',
        ),
      ).toSQL(),
      `
        SELECT ${snakeSelectAllWithTable} FROM ${quotedSnake}
        JOIN "schema"."snake" "otherSnake"
          ON jsonb_path_query_first("otherSnake"."snake_data", $1) = jsonb_path_query_first("Snake"."snake_data", $2)
      `,
      ['$.name', '$.name'],
    );
  });

  describe('where methods', () => {
    describe('using main table columns', () => {
      const sql = `SELECT ${userTableColumnsSql} FROM ${quotedUser} JOIN ${quotedMessage} ON `;
      const snakeSql = `SELECT ${snakeSelectAllWithTable} FROM ${quotedSnake} JOIN ${quotedUser} ON `;

      it('should use main table column in .where', () => {
        const q = User.join(Message, (q) => q.where({ 'User.name': 'name' }));

        expectSql(q.toSQL(), sql + `"User"."name" = $1`, ['name']);
      });

      it('should support named column of main table in .where', () => {
        const q = Snake.join(User, (q) =>
          q.where({ 'Snake.snakeName': 'name' }),
        );

        expectSql(q.toSQL(), snakeSql + `"Snake"."snake_name" = $1`, ['name']);
      });

      it('should use main table column in .whereNot', () => {
        const q = User.join(Message, (q) =>
          q.whereNot({ 'User.name': 'name' }),
        );

        expectSql(q.toSQL(), sql + `NOT "User"."name" = $1`, ['name']);
      });

      it('should use named main table column in .whereNot', () => {
        const q = Snake.join(User, (q) =>
          q.whereNot({ 'Snake.snakeName': 'name' }),
        );

        expectSql(q.toSQL(), snakeSql + `NOT "Snake"."snake_name" = $1`, [
          'name',
        ]);
      });

      it('should use main table column in .or', () => {
        const q = User.join(Message, (q) =>
          q.orWhere({ 'User.name': 'name' }, { 'User.age': 20 }),
        );

        expectSql(q.toSQL(), sql + `"User"."name" = $1 OR "User"."age" = $2`, [
          'name',
          20,
        ]);
      });

      it('should use named main table column in .or', () => {
        const q = Snake.join(User, (q) =>
          q.orWhere({ 'Snake.snakeName': 'name' }, { 'Snake.tailLength': 20 }),
        );

        expectSql(
          q.toSQL(),
          snakeSql + `"Snake"."snake_name" = $1 OR "Snake"."tail_length" = $2`,
          ['name', 20],
        );
      });

      it('should use main table column in .orWhereNot', () => {
        const q = User.join(Message, (q) =>
          q.orWhereNot({ 'User.name': 'name' }, { 'User.age': 20 }),
        );

        expectSql(
          q.toSQL(),
          sql + `NOT "User"."name" = $1 OR NOT "User"."age" = $2`,
          ['name', 20],
        );
      });

      it('should use named main table column in .orWhereNot', () => {
        const q = Snake.join(User, (q) =>
          q.orWhereNot(
            { 'Snake.snakeName': 'name' },
            { 'Snake.tailLength': 20 },
          ),
        );

        expectSql(
          q.toSQL(),
          snakeSql +
            `NOT "Snake"."snake_name" = $1 OR NOT "Snake"."tail_length" = $2`,
          ['name', 20],
        );
      });

      it('should use main table column in .whereIn', () => {
        const q = User.join(Message, (q) => q.whereIn('User.name', ['name']));

        expectSql(q.toSQL(), sql + `"User"."name" IN ($1)`, ['name']);
      });

      it('should use named main table column in .whereIn', () => {
        const q = Snake.join(User, (q) =>
          q.whereIn('Snake.snakeName', ['name']),
        );

        expectSql(q.toSQL(), snakeSql + `"Snake"."snake_name" IN ($1)`, [
          'name',
        ]);
      });

      it('should use main table column in .orWhereIn', () => {
        const q = User.join(Message, (q) =>
          q.where({ 'User.age': 20 }).orWhereIn('User.name', ['name']),
        );

        expectSql(
          q.toSQL(),
          sql + `"User"."age" = $1 OR "User"."name" IN ($2)`,
          [20, 'name'],
        );
      });

      it('should use named main table column in .orWhereIn', () => {
        const q = Snake.join(User, (q) =>
          q
            .where({ 'Snake.tailLength': 20 })
            .orWhereIn('Snake.snakeName', ['name']),
        );

        expectSql(
          q.toSQL(),
          snakeSql +
            `"Snake"."tail_length" = $1 OR "Snake"."snake_name" IN ($2)`,
          [20, 'name'],
        );
      });

      it('should use main table column in .whereNotIn', () => {
        const q = User.join(Message, (q) =>
          q.whereNotIn('User.name', ['name']),
        );

        expectSql(q.toSQL(), sql + `NOT "User"."name" IN ($1)`, ['name']);
      });

      it('should use named main table column in .whereNotIn', () => {
        const q = Snake.join(User, (q) =>
          q.whereNotIn('Snake.snakeName', ['name']),
        );

        expectSql(q.toSQL(), snakeSql + `NOT "Snake"."snake_name" IN ($1)`, [
          'name',
        ]);
      });

      it('should use main table column in .orWhereNotIn', () => {
        const q = User.join(Message, (q) =>
          q.where({ 'User.age': 20 }).orWhereNotIn('User.name', ['name']),
        );

        expectSql(
          q.toSQL(),
          sql + `"User"."age" = $1 OR NOT "User"."name" IN ($2)`,
          [20, 'name'],
        );
      });

      it('should use named main table column in .orWhereNotIn', () => {
        const q = Snake.join(User, (q) =>
          q
            .where({ 'Snake.tailLength': 20 })
            .orWhereNotIn('Snake.snakeName', ['name']),
        );

        expectSql(
          q.toSQL(),
          snakeSql +
            `"Snake"."tail_length" = $1 OR NOT "Snake"."snake_name" IN ($2)`,
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
            FROM ${quotedUser}
            JOIN
              (
                SELECT
                  "t"."bio" "Bio",
                  "t"."user_id" "UserId"
                FROM "schema"."profile" "t"
                WHERE "t"."bio" = $1
              ) "t"
              ON "t"."UserId" = "User"."id"
            WHERE "t"."UserId" = $2
          `,
          ['bio', 1],
        );
      });
    });

    testWhere(
      (cb) => db.profile.join(db.user, cb as never).toSQL(),
      `SELECT ${ProfileSelectAllWithTable} FROM ${quotedProfile} JOIN ${quotedUser} ON`,
      {
        model: db.user,
        pkey: 'User.Id',
        nullable: 'Picture',
        text: 'Name',
      },
    );

    testWhereExists({
      joinTo: db.user,
      pkey: 'User.Id',
      joinTarget: db.profile,
      fkey: 'UserId',
      text: 'Bio',
      selectFrom: `SELECT ${UserSelectAll} FROM ${quotedUser}`,
    });

    testWhere(
      (cb) => db.user.join(db.profile, cb as never).toSQL(),
      `SELECT ${UserSelectAllWithTable} FROM ${quotedUser} JOIN ${quotedProfile} ON`,
      {
        model: db.profile,
        pkey: 'Profile.UserId',
        nullable: 'Bio',
        text: 'Bio',
      },
    );

    testWhereExists({
      joinTo: db.profile,
      pkey: 'Profile.UserId',
      joinTarget: db.user,
      fkey: 'Id',
      text: 'Name',
      selectFrom: `SELECT ${ProfileSelectAll} FROM ${quotedProfile}`,
    });
  });

  // for https://github.com/romeerez/orchid-orm/issues/247
  it('should have a proper table type in the callback', () => {
    db.user.join(db.message, (q) => {
      assertType<typeof q.table, 'Message'>();
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
          FROM ${quotedUser}
          LEFT JOIN ${quotedMessage} ON ((false)) AND ("Message"."deleted_at" IS NULL)`,
      );
    });

    it('should join with `where false` for 2nd callback `none`', () => {
      const q = db.user.leftJoin(db.message, (q) => q.none());

      expect(isQueryNone(q)).toBe(false);

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAllWithTable}
          FROM ${quotedUser}
          LEFT JOIN ${quotedMessage} ON (false) AND ("Message"."deleted_at" IS NULL)
        `,
      );
    });
  });
});

describe('implicit lateral joins', () => {
  useTestDatabase();

  it(`should disallow selecting joined columns that weren't selected inside join`, () => {
    db.user
      .join(db.message, (q) => q.on('AuthorId', 'User.Id').select('Text'))
      .select('Message.Text')
      .select(
        // @ts-expect-error the column is not selected inside join
        'Message.Id',
      );
  });

  it('should work when joining a table', async () => {
    await insertMessage();

    const q = db.user
      .join(db.message, (q) =>
        q
          .on('Message.AuthorId', 'User.Id')
          .where({ Text: messageData.text })
          .limit(5),
      )
      .select('Message.updatedAt');

    expectSql(
      q.toSQL(),
      `
        SELECT "Message"."updated_at" "updatedAt"
        FROM ${quotedUser}
        JOIN LATERAL (
          SELECT "Message".*
          FROM ${quotedMessage}
          WHERE ("Message"."author_id" = "User"."id" AND "Message"."text" = $1)
            AND ("Message"."deleted_at" IS NULL)
          LIMIT $2
        ) "Message" ON true
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
            .on('Message.Id', 'User.Id')
            .where({ Text: 'text' })
            .limit(5)
            .offset(10),
      )
      .select('Message.AuthorId');

    expectSql(
      q.toSQL(),
      `
        SELECT "Message"."author_id" "AuthorId"
        FROM ${quotedUser}
        JOIN LATERAL (
          SELECT "Message".*
          FROM ${quotedMessage}
          WHERE ("Message"."id" = "User"."id" AND "Message"."text" = $1)
            AND ("Message"."deleted_at" IS NULL)
          LIMIT $2
          OFFSET $3
        ) "Message" ON true
      `,
      ['text', 5, 10],
    );
  });

  it('should work when joining with statement', () => {
    const q = db.user
      .with('p', db.profile)
      .join('p', (q) => q.on('UserId', 'User.Id').limit(5).offset(10));

    expectSql(
      q.toSQL(),
      `
        WITH "p" AS (SELECT ${ProfileSelectAll} FROM ${quotedProfile})
        SELECT ${UserSelectAllWithTable}
        FROM ${quotedUser}
        JOIN LATERAL (
          SELECT *
          FROM "p"
          WHERE "p"."UserId" = "User"."id"
          LIMIT $1
          OFFSET $2
        ) "p" ON true
      `,
      [5, 10],
    );
  });

  it('should not resolve column names inside join closure if nothing was selected explicitly', () => {
    const q = db.user
      .join(db.profile, (q) => q.on('Profile.UserId', 'User.Id').limit(1))
      .where({
        'Profile.Bio': 'bio',
      })
      .select('Profile.Bio');

    expectSql(
      q.toSQL(),
      `
        SELECT "Profile"."bio" "Bio"
        FROM ${quotedUser}
        JOIN LATERAL (
          SELECT "Profile".*
          FROM ${quotedProfile}
          WHERE "Profile"."user_id" = "User"."id"
          LIMIT $1
        ) "Profile" ON true
        WHERE "Profile"."bio" = $2
      `,
      [1, 'bio'],
    );
  });

  it('should use resolved column names outside of join closure when names are resolved inside', () => {
    const q = db.user
      .join(db.profile, (q) =>
        q.on('Profile.UserId', 'User.Id').select('Profile.Bio'),
      )
      .where({
        'Profile.Bio': 'bio',
      })
      .select('Profile.Bio');

    expectSql(
      q.toSQL(),
      `
        SELECT "Profile"."Bio"
        FROM ${quotedUser}
        JOIN LATERAL (
          SELECT "Profile"."bio" "Bio"
          FROM ${quotedProfile}
          WHERE "Profile"."user_id" = "User"."id"
        ) "Profile" ON true
        WHERE "Profile"."Bio" = $1
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
        SELECT "User"."id" "Id", "data"."f" "foo", "data"."b" "bar"
        FROM ${quotedUser}
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
        FROM ${quotedUser}
        JOIN "schema"."message" "m"
          ON (
            "m"."author_id" = "User"."id"
            AND "m"."message_key" = "User"."user_key"
          ) AND ("m"."deleted_at" IS NULL)
        JOIN "schema"."chat"
          ON "chat"."id_of_chat" = "m"."chat_id"
         AND "chat"."chat_key" = "m"."message_key"
      `,
    );
  });

  it('should work for a 1st arg query object', () => {
    const q = db.user
      .join(db.message, 'Message.AuthorId', 'User.Id')
      .join('Message.chat')
      .select('chat.IdOfChat');

    assertType<Awaited<typeof q>, { IdOfChat: number }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "chat"."id_of_chat" "IdOfChat"
        FROM ${quotedUser}
        JOIN ${quotedMessage}
          ON "Message"."author_id" = "User"."id"
         AND ("Message"."deleted_at" IS NULL)
        JOIN "schema"."chat"
          ON "chat"."id_of_chat" = "Message"."chat_id"
         AND "chat"."chat_key" = "Message"."message_key"
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
        FROM ${quotedUser}
        JOIN "schema"."message" "messages"
          ON (
            "messages"."author_id" = "User"."id"
            AND "messages"."message_key" = "User"."user_key"
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
        FROM ${quotedUser}
        JOIN "schema"."message" "messages"
          ON (
            "messages"."author_id" = "User"."id"
            AND "messages"."message_key" = "User"."user_key"
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
        FROM ${quotedUser}
        JOIN "schema"."message" "messages"
          ON (
            "messages"."author_id" = "User"."id"
            AND "messages"."message_key" = "User"."user_key"
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
        SELECT "User"."id" "Id", "chat"."id_of_chat" "IdOfChat"
        FROM ${quotedUser}
        RIGHT JOIN "schema"."message" "messages"
          ON (
            "messages"."author_id" = "User"."id"
            AND "messages"."message_key" = "User"."user_key"
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
        SELECT "User"."id" "Id", "chat"."id_of_chat" "IdOfChat"
        FROM ${quotedUser}
        LEFT JOIN "schema"."message" "messages"
          ON (
            "messages"."author_id" = "User"."id"
            AND "messages"."message_key" = "User"."user_key"
          ) AND ("messages"."deleted_at" IS NULL)
        LEFT JOIN "schema"."chat"
          ON "chat"."id_of_chat" = "messages"."chat_id"
         AND "chat"."chat_key" = "messages"."message_key"
      `,
    );
  });
});
