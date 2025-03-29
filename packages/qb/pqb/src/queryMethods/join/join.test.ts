import {
  expectQueryNotMutated,
  Message,
  messageTableColumnsSql,
  Profile,
  profileColumnsSql,
  Snake,
  snakeSelectAll,
  snakeSelectAllWithTable,
  User,
  userData,
  userTableColumnsSql,
} from '../../test-utils/test-utils';
import { _join } from './_join';
import { testWhere, testWhereExists } from '../where/testWhere';
import { testJoin } from './testJoin';
import { asMock, assertType, expectSql, useTestDatabase } from 'test-utils';
import { isQueryNone } from '../none';

jest.mock('./_join', () => {
  const { _join } = jest.requireActual('./_join');

  return {
    _join: jest.fn((...args) => _join(...args)),
  };
});

it('should not accept wrong column as join arg', () => {
  // @ts-expect-error wrong message column
  User.join(Message, 'message.wrong', 'user.id');

  // @ts-expect-error wrong user column
  User.join(Message, 'message.id', 'user.wrong');
});

it('should ignore duplicated joins', () => {
  const q = User.join(Message, 'message.id', 'user.id').join(
    Message,
    'message.id',
    'user.id',
  );

  expectSql(
    q.toSQL(),
    `
      SELECT ${userTableColumnsSql} FROM "user"
      JOIN "message" ON "message"."id" = "user"."id"
    `,
  );
});

describe('join', () => {
  testJoin({
    method: 'join',
    joinTo: User,
    pkey: 'user.id',
    joinTarget: Message,
    fkey: 'authorId',
    text: 'text',
    selectFrom: `SELECT ${userTableColumnsSql} FROM "user"`,
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
    selectFrom: `SELECT ${userTableColumnsSql} FROM "user"`,
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
    selectFrom: `SELECT ${snakeSelectAllWithTable} FROM "snake"`,
  });
});

describe.each`
  method         | require  | sql
  ${'join'}      | ${true}  | ${'JOIN'}
  ${'leftJoin'}  | ${false} | ${'LEFT JOIN'}
  ${'rightJoin'} | ${true}  | ${'RIGHT JOIN'}
  ${'fullJoin'}  | ${false} | ${'FULL JOIN'}
`('$method', ({ method, require, sql }) => {
  it('should call _join with proper join type', () => {
    asMock(_join).mockClear();

    const q = User.clone();
    q.clone = (() => q) as unknown as typeof q.clone;

    const args = ['authorId', 'id'] as const;

    q[method as 'join'](Message, ...args);

    expect(_join).toBeCalledWith(q, require, sql, Message, args);
  });
});

describe('join callback with query builder', () => {
  it('should have .on and .onOr properly working', () => {
    const q = User.all();

    const expectedSql = `
      SELECT ${userTableColumnsSql} FROM "user"
      JOIN "message"
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
      SELECT ${snakeSelectAllWithTable} FROM "snake"
      JOIN "user"
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
      SELECT ${userTableColumnsSql} FROM "user"
      JOIN "snake"
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
        SELECT ${userTableColumnsSql} FROM "user"
        JOIN "user" "otherUser"
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
        SELECT ${snakeSelectAllWithTable} FROM "snake"
        JOIN "snake" "otherSnake"
          ON jsonb_path_query_first("otherSnake"."snake_data", $1) = jsonb_path_query_first("snake"."snake_data", $2)
      `,
      ['$.name', '$.name'],
    );
  });

  describe('where methods', () => {
    describe('using main table columns', () => {
      const sql = `SELECT ${userTableColumnsSql} FROM "user" JOIN "message" ON `;
      const snakeSql = `SELECT ${snakeSelectAllWithTable} FROM "snake" JOIN "user" ON `;

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
      it('should join a sub query', () => {
        const q = User.join(
          Message.select({
            messageId: 'id',
            userId: 'authorId',
            content: 'text',
          })
            .where({
              text: 'text',
            })
            .as('t'),
          'userId',
          'id',
        )
          .where({
            't.messageId': 1,
          })
          .select({
            messageId: 't.messageId',
            messageText: 't.content',
          });

        expectSql(
          q.toSQL(),
          `
            SELECT
              "t"."messageId",
              "t"."content" "messageText"
            FROM "user"
            JOIN
              (
                SELECT
                  "t"."id" "messageId",
                  "t"."author_id" "userId",
                  "t"."text" "content"
                FROM "message" "t"
                WHERE "t"."text" = $1
              ) "t"
              ON "t"."userId" = "user"."id"
            WHERE "t"."messageId" = $2
          `,
          ['text', 1],
        );
      });

      it('should join a sub query with named columns', () => {
        const q = User.join(
          Snake.select('snakeName', 'tailLength')
            .where({
              snakeName: 'name',
            })
            .as('t'),
          'tailLength',
          'id',
        )
          .where({
            't.tailLength': 1,
          })
          .select({
            name: 't.snakeName',
            length: 't.tailLength',
          });

        expectSql(
          q.toSQL(),
          `
            SELECT
              "t"."snakeName" "name",
              "t"."tailLength" "length"
            FROM "user"
            JOIN
              (
                SELECT
                  "t"."snake_name" "snakeName",
                  "t"."tail_length" "tailLength"
                FROM "snake" "t"
                WHERE "t"."snake_name" = $1
              ) "t"
              ON "t"."tailLength" = "user"."id"
            WHERE "t"."tailLength" = $2
          `,
          ['name', 1],
        );
      });
    });

    testWhere(
      (cb) => Message.join(User, cb as never).toSQL(),
      `SELECT ${messageTableColumnsSql} FROM "message" JOIN "user" ON`,
      {
        model: User,
        pkey: 'user.id',
        nullable: 'picture',
        text: 'name',
      },
    );

    testWhereExists({
      joinTo: User,
      pkey: 'user.id',
      joinTarget: Message,
      fkey: 'authorId',
      text: 'text',
    });

    testWhere(
      (cb) => Snake.join(User, cb as never).toSQL(),
      `SELECT ${snakeSelectAllWithTable} FROM "snake" JOIN "user" ON`,
      {
        model: User,
        pkey: 'user.id',
        nullable: 'picture',
        text: 'name',
      },
    );

    testWhereExists({
      joinTo: User,
      pkey: 'user.id',
      joinTarget: Snake,
      fkey: 'tailLength',
      text: 'snakeName',
    });

    testWhere(
      (cb) => User.join(Snake, cb as never).toSQL(),
      `SELECT ${userTableColumnsSql} FROM "user" JOIN "snake" ON`,
      {
        model: Snake,
        pkey: 'snake.tailLength',
        nullable: 'snakeData',
        text: 'snakeName',
      },
    );

    testWhereExists({
      joinTo: Snake,
      pkey: 'snake.tailLength',
      joinTarget: User,
      fkey: 'id',
      text: 'name',
      selectFrom: `SELECT ${snakeSelectAll} FROM "snake"`,
    });
  });

  // for https://github.com/romeerez/orchid-orm/issues/247
  it('should have a proper table type in the callback', () => {
    User.join(Message, (q) => {
      assertType<typeof q.table, 'message'>();
      return q;
    });
  });

  describe('join `none` sub-query', () => {
    it('should handle `none` sub-query', () => {
      const q = User.join(Message.none(), (q) => q);

      expect(isQueryNone(q)).toBe(true);
    });

    it('should handle 1st callback `none`', () => {
      const q = User.join(
        () => Message.none(),
        (q) => q,
      );

      expect(isQueryNone(q)).toBe(true);
    });

    it('should handle 2nd callback `none`', () => {
      const q = User.join(Message, (q) => q.none());

      expect(isQueryNone(q)).toBe(true);
    });
  });

  describe('left join `none` sub-query', () => {
    it('should join with `where false`', () => {
      const q = User.leftJoin(Message.none(), (q) => q);

      expect(isQueryNone(q)).toBe(false);

      expectSql(
        q.toSQL(),
        `SELECT ${userTableColumnsSql} FROM "user" LEFT JOIN "message" ON (false)`,
      );
    });

    it('should join with `where false` for 2nd callback `none`', () => {
      const q = User.leftJoin(Message, (q) => q.none());

      expect(isQueryNone(q)).toBe(false);

      expectSql(
        q.toSQL(),
        `SELECT ${userTableColumnsSql} FROM "user" LEFT JOIN "message" ON (false)`,
      );
    });
  });
});

describe('implicit lateral joins', () => {
  it(`should disallow selecting joined columns that weren't selected inside join`, () => {
    User.join(Message, (q) => q.on('authorId', 'user.id').select('text'))
      .select('message.text')
      .select(
        // @ts-expect-error the column is not selected inside join
        'message.id',
      );
  });

  it('should work when joining a table', () => {
    const q = User.join(Message, (q) =>
      q.on('message.id', 'user.id').where({ text: 'text' }).limit(5).offset(10),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT ${userTableColumnsSql}
        FROM "user"
        JOIN LATERAL (
          SELECT "message".*
          FROM "message"
          WHERE "message"."id" = "user"."id" AND "message"."text" = $1
          LIMIT $2
          OFFSET $3
        ) "message" ON true
      `,
      ['text', 5, 10],
    );
  });

  it('should work when joining a sub-query', () => {
    const q = User.join(
      () => Message.limit(5),
      (q) =>
        q
          .on('message.id', 'user.id')
          .where({ text: 'text' })
          .limit(5)
          .offset(10),
    ).select('message.authorId');

    expectSql(
      q.toSQL(),
      `
        SELECT "message"."author_id" "authorId"
        FROM "user"
        JOIN LATERAL (
          SELECT "message".*
          FROM "message"
          WHERE "message"."id" = "user"."id" AND "message"."text" = $1
          LIMIT $2
          OFFSET $3
        ) "message" ON true
      `,
      ['text', 5, 10],
    );
  });

  it('should work when joining with statement', () => {
    const q = User.with('p', Profile).join('p', (q) =>
      q.on('userId', 'user.id').limit(5).offset(10),
    );

    expectSql(
      q.toSQL(),
      `
        WITH "p" AS (SELECT ${profileColumnsSql} FROM "profile")
        SELECT ${userTableColumnsSql}
        FROM "user"
        JOIN LATERAL (
          SELECT *
          FROM "p"
          WHERE "p"."userId" = "user"."id"
          LIMIT $1
          OFFSET $2
        ) "p" ON true
      `,
      [5, 10],
    );
  });

  it('should not resolve column names inside join closure if nothing was selected explicitly', () => {
    const q = User.join(Snake, (q) => q.on('snake.snakeId', 'user.id').limit(1))
      .where({
        'snake.snakeName': 'name',
      })
      .select('snake.snakeName');

    expectSql(
      q.toSQL(),
      `
        SELECT "snake"."snake_name" "snakeName"
        FROM "user"
        JOIN LATERAL (
          SELECT "snake".*
          FROM "snake"
          WHERE "snake"."snake_id" = "user"."id"
          LIMIT $1
        ) "snake" ON true
        WHERE "snake"."snake_name" = $2
      `,
      [1, 'name'],
    );
  });

  it('should use resolved column names outside of join closure when names are resolved inside', () => {
    const q = User.join(Snake, (q) =>
      q.on('snake.snakeId', 'user.id').select('snake.snakeName'),
    )
      .where({
        'snake.snakeName': 'name',
      })
      .select('snake.snakeName');

    expectSql(
      q.toSQL(),
      `
        SELECT "snake"."snakeName"
        FROM "user"
        JOIN LATERAL (
          SELECT "snake"."snake_name" "snakeName"
          FROM "snake"
          WHERE "snake"."snake_id" = "user"."id"
        ) "snake" ON true
        WHERE "snake"."snakeName" = $1
      `,
      ['name'],
    );
  });
});

describe('joinData', () => {
  useTestDatabase();

  it('should join a on-the-fly constructed table containing user-provided data', async () => {
    const userId = await User.get('id').insert(userData);

    const now = new Date();

    const q = User.joinData(
      'data',
      (t) => ({
        foo: t.integer().name('f'),
        bar: t.timestamp().asDate().name('b').nullable(),
      }),
      [{ foo: 1, bar: now.getTime() }, { foo: 2 }],
    )
      .where({ 'data.foo': { gte: 1 } })
      .select('id', 'data.foo', 'data.bar');

    const result = await q;

    assertType<
      typeof result,
      { id: number; foo: number; bar: Date | null }[]
    >();

    expect(result).toEqual([
      { id: userId, foo: 1, bar: now },
      { id: userId, foo: 2, bar: null },
    ]);

    expectSql(
      q.toSQL(),
      `
        SELECT "user"."id", "data"."f" "foo", "data"."b" "bar"
        FROM "user"
        JOIN (VALUES ($1::int4, $2::timestamptz), ($3::int4, $4::timestamptz)) "data"("f", "b") ON true
        WHERE "data"."f" >= $5
      `,
      [1, now, 2, null, 1],
    );
  });
});
