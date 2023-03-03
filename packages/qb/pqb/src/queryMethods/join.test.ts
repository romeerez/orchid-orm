import {
  expectQueryNotMutated,
  expectSql,
  Message,
  User,
} from '../test-utils/test-utils';
import { OnQueryBuilder } from './join';
import { testJoin, testWhere } from './where.test';
import { Sql } from '../sql';
import { Query } from '../query';

describe.each`
  method              | sql
  ${'join'}           | ${'JOIN'}
  ${'innerJoin'}      | ${'INNER JOIN'}
  ${'leftJoin'}       | ${'LEFT JOIN'}
  ${'leftOuterJoin'}  | ${'LEFT OUTER JOIN'}
  ${'rightJoin'}      | ${'RIGHT JOIN'}
  ${'rightOuterJoin'} | ${'RIGHT OUTER JOIN'}
  ${'fullOuterJoin'}  | ${'FULL OUTER JOIN'}
`('$method', ({ method, sql }) => {
  testJoin(
    method,
    (target: string, conditions: string) => `
      SELECT "user".* FROM "user"
      ${sql} ${target} ON ${conditions}
    `,
  );
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
        .toSql(),
      expectedSql,
    );

    expectSql(
      q
        .join(Message, (q) =>
          q
            .on('message.authorId', '=', 'user.id')
            .orOn('message.text', '=', 'user.name'),
        )
        .toSql(),
      expectedSql,
    );

    expectQueryNotMutated(q);
  });

  it('should have .onJsonPathEquals method', () => {
    const q = User.all();

    expectSql(
      q
        .join(User.as('otherUser'), (q) =>
          q.onJsonPathEquals('user.data', '$.name', 'otherUser.data', '$.name'),
        )
        .toSql(),
      `
        SELECT "user".* FROM "user"
        JOIN "user" AS "otherUser"
          ON jsonb_path_query_first("user"."data", $1) = jsonb_path_query_first("otherUser"."data", $2)
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
      }).toSql();
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
      }).toSql();
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

      it('should use main table column in .where', () => {
        const q = User.join(Message, (q) => q.where({ 'user.name': 'name' }));

        expectSql(q.toSql(), sql + `"user"."name" = $1`, ['name']);
      });

      it('should use main table column in .whereNot', () => {
        const q = User.join(Message, (q) =>
          q.whereNot({ 'user.name': 'name' }),
        );

        expectSql(q.toSql(), sql + `NOT "user"."name" = $1`, ['name']);
      });

      it('should use main table column in .or', () => {
        const q = User.join(Message, (q) =>
          q.or({ 'user.name': 'name' }, { 'user.age': 20 }),
        );

        expectSql(q.toSql(), sql + `"user"."name" = $1 OR "user"."age" = $2`, [
          'name',
          20,
        ]);
      });

      it('should use main table column in .orNot', () => {
        const q = User.join(Message, (q) =>
          q.orNot({ 'user.name': 'name' }, { 'user.age': 20 }),
        );

        expectSql(
          q.toSql(),
          sql + `NOT "user"."name" = $1 OR NOT "user"."age" = $2`,
          ['name', 20],
        );
      });

      it('should use main table column in .whereIn', () => {
        const q = User.join(Message, (q) => q.whereIn('user.name', ['name']));

        expectSql(q.toSql(), sql + `"user"."name" IN ($1)`, ['name']);
      });

      it('should use main table column in .orWhereIn', () => {
        const q = User.join(Message, (q) =>
          q.where({ 'user.age': 20 }).orWhereIn('user.name', ['name']),
        );

        expectSql(
          q.toSql(),
          sql + `"user"."age" = $1 OR "user"."name" IN ($2)`,
          [20, 'name'],
        );
      });

      it('should use main table column in .whereNotIn', () => {
        const q = User.join(Message, (q) =>
          q.whereNotIn('user.name', ['name']),
        );

        expectSql(q.toSql(), sql + `NOT "user"."name" IN ($1)`, ['name']);
      });

      it('should use main table column in .orWhereNotIn', () => {
        const q = User.join(Message, (q) =>
          q.where({ 'user.age': 20 }).orWhereNotIn('user.name', ['name']),
        );

        expectSql(
          q.toSql(),
          sql + `"user"."age" = $1 OR NOT "user"."name" IN ($2)`,
          [20, 'name'],
        );
      });
    });

    describe('join sub query', () => {
      it('should join a sub query', () => {
        const q = User.join(
          Message.select('id', 'authorId', 'text').as('t'),
          true,
        )
          .where({
            't.id': 1,
          })
          .select({
            messageId: 't.id',
            messageText: 't.text',
          });

        expectSql(
          q.toSql(),
          `
            SELECT "t"."id" AS "messageId", "t"."text" AS "messageText"
            FROM "user"
            JOIN (SELECT "t"."id", "t"."authorId", "t"."text" FROM "message" AS "t") "t" ON true
            WHERE "t"."id" = $1
          `,
          [1],
        );
      });
    });

    const buildSql = (cb: (q: OnQueryBuilder) => OnQueryBuilder): Sql => {
      return Message.join(User, cb).toSql();
    };

    const startSql = `SELECT "message".* FROM "message" JOIN "user" ON`;

    testWhere(
      buildSql as unknown as (cb: (q: Query) => Query) => Sql,
      startSql,
    );
  });
});
