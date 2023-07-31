import {
  expectQueryNotMutated,
  Message,
  Snake,
  snakeSelectAll,
  snakeSelectAllWithTable,
  User,
} from '../../test-utils/test-utils';
import { OnQueryBuilder } from './join';
import { _join } from './_join';
import { testWhere, testWhereExists } from '../where/testWhere';
import { testJoin } from './testJoin';
import { asMock, expectSql } from 'test-utils';

jest.mock('./_join', () => {
  const { _join } = jest.requireActual('./_join');

  return {
    _join: jest.fn((...args) => _join(...args)),
  };
});

it('should not accept wrong column as join arg', () => {
  User.join(Message, 'message.id', 'user.id');
});

describe('join', () => {
  testJoin({
    method: 'join',
    joinTo: User,
    pkey: 'id',
    joinTarget: Message,
    fkey: 'authorId',
    text: 'text',
    selectFrom: `SELECT "user".* FROM "user"`,
  });
});

describe('join table with named columns', () => {
  testJoin({
    method: 'join',
    joinTo: User,
    pkey: 'name',
    joinTarget: Snake,
    fkey: 'tailLength',
    text: 'snakeName',
    selectFrom: `SELECT "user".* FROM "user"`,
  });
});

describe('join to table with named columns', () => {
  testJoin({
    method: 'join',
    joinTo: Snake,
    pkey: 'snakeName',
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

    const args = [Message, 'authorId', 'id'] as const;

    q[method as 'join'](...args);

    expect(_join).toBeCalledWith(q, require, sql, args);
  });
});

describe('join callback with query builder', () => {
  it('should have .on and .onOr properly working', () => {
    const q = User.all();

    const expectedSql = `
      SELECT "user".* FROM "user"
      JOIN "message"
        ON "message"."authorId" = "user"."id"
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
      SELECT "user".* FROM "user"
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
        q.onJsonPathEquals('user.data', '$.name', 'otherUser.data', '$.name'),
      ).toSQL(),
      `
        SELECT "user".* FROM "user"
        JOIN "user" AS "otherUser"
          ON jsonb_path_query_first("user"."data", $1) = jsonb_path_query_first("otherUser"."data", $2)
      `,
      ['$.name', '$.name'],
    );
  });

  it('should have .onJsonPathEquals method working for named columns', () => {
    expectSql(
      Snake.join(Snake.as('otherSnake'), (q) =>
        q.onJsonPathEquals(
          'snake.snakeData',
          '$.name',
          'otherSnake.snakeData',
          '$.name',
        ),
      ).toSQL(),
      `
        SELECT ${snakeSelectAllWithTable} FROM "snake"
        JOIN "snake" AS "otherSnake"
          ON jsonb_path_query_first("snake"."snake_data", $1) = jsonb_path_query_first("otherSnake"."snake_data", $2)
      `,
      ['$.name', '$.name'],
    );
  });

  describe('where methods', () => {
    describe('and', () => {
      let query: OnQueryBuilder;
      let where: OnQueryBuilder['where'];
      let _where: OnQueryBuilder['_where'];
      User.join(Message, (q) => {
        query = q;
        where = q.where;
        _where = q._where;
        return q;
      }).toSQL();
      beforeEach(() => {
        query.where = jest.fn();
        query._where = jest.fn();
      });
      afterAll(() => {
        query.where = where;
        query._where = _where;
      });

      it('is alias for where', () => {
        query.and({});
        expect(query.where).toBeCalled();
      });

      it('has modifier', () => {
        query._and({});
        expect(query._where).toBeCalled();
      });
    });

    describe('andNot', () => {
      let query: OnQueryBuilder;
      let whereNot: OnQueryBuilder['whereNot'];
      let _whereNot: OnQueryBuilder['_whereNot'];
      User.join(Message, (q) => {
        query = q;
        whereNot = q.whereNot;
        _whereNot = q._whereNot;
        return q;
      }).toSQL();
      beforeEach(() => {
        query.whereNot = jest.fn();
        query._whereNot = jest.fn();
      });
      afterAll(() => {
        query.whereNot = whereNot;
        query._whereNot = _whereNot;
      });

      it('is alias for where', () => {
        query.andNot({});
        expect(query.whereNot).toBeCalled();
      });

      it('has modifier', () => {
        query._andNot({});
        expect(query._whereNot).toBeCalled();
      });
    });

    describe('using main table columns', () => {
      const sql = `SELECT "user".* FROM "user" JOIN "message" ON `;
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
          q.or({ 'user.name': 'name' }, { 'user.age': 20 }),
        );

        expectSql(q.toSQL(), sql + `"user"."name" = $1 OR "user"."age" = $2`, [
          'name',
          20,
        ]);
      });

      it('should use named main table column in .or', () => {
        const q = Snake.join(User, (q) =>
          q.or({ 'snake.snakeName': 'name' }, { 'snake.tailLength': 20 }),
        );

        expectSql(
          q.toSQL(),
          snakeSql + `"snake"."snake_name" = $1 OR "snake"."tail_length" = $2`,
          ['name', 20],
        );
      });

      it('should use main table column in .orNot', () => {
        const q = User.join(Message, (q) =>
          q.orNot({ 'user.name': 'name' }, { 'user.age': 20 }),
        );

        expectSql(
          q.toSQL(),
          sql + `NOT "user"."name" = $1 OR NOT "user"."age" = $2`,
          ['name', 20],
        );
      });

      it('should use named main table column in .orNot', () => {
        const q = Snake.join(User, (q) =>
          q.orNot({ 'snake.snakeName': 'name' }, { 'snake.tailLength': 20 }),
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
              "t"."messageId" AS "messageId",
              "t"."content" AS "messageText"
            FROM "user"
            JOIN
              (
                SELECT
                  "t"."id" AS "messageId",
                  "t"."authorId" AS "userId",
                  "t"."text" AS "content"
                FROM "message" AS "t"
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
              "t"."snakeName" AS "name",
              "t"."tailLength" AS "length"
            FROM "user"
            JOIN
              (
                SELECT
                  "t"."snake_name" AS "snakeName",
                  "t"."tail_length" AS "tailLength"
                FROM "snake" AS "t"
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
      `SELECT "message".* FROM "message" JOIN "user" ON`,
      {
        model: User,
        pkey: 'id',
        nullable: 'picture',
        text: 'name',
      },
    );

    testWhereExists({
      joinTo: User,
      pkey: 'id',
      joinTarget: Message,
      fkey: 'authorId',
      text: 'text',
    });

    testWhere(
      (cb) => Snake.join(User, cb as never).toSQL(),
      `SELECT ${snakeSelectAllWithTable} FROM "snake" JOIN "user" ON`,
      {
        model: User,
        pkey: 'id',
        nullable: 'picture',
        text: 'name',
      },
    );

    testWhereExists({
      joinTo: User,
      pkey: 'id',
      joinTarget: Snake,
      fkey: 'tailLength',
      text: 'snakeName',
    });

    testWhere(
      (cb) => User.join(Snake, cb as never).toSQL(),
      `SELECT "user".* FROM "user" JOIN "snake" ON`,
      {
        model: Snake,
        pkey: 'tailLength',
        nullable: 'snakeData',
        text: 'snakeName',
      },
    );

    testWhereExists({
      joinTo: Snake,
      pkey: 'tailLength',
      joinTarget: User,
      fkey: 'id',
      text: 'name',
      selectFrom: `SELECT ${snakeSelectAll} FROM "snake"`,
    });
  });
});
