import { expectQueryNotMutated, expectSql, Message, User } from '../test-utils';
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
      });
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
      });
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

    const buildSql = (cb: (q: OnQueryBuilder) => OnQueryBuilder): Sql => {
      return User.join(Message, cb).toSql();
    };

    const startSql = `SELECT "user".* FROM "user" JOIN "message" ON`;

    testWhere(
      buildSql as unknown as (cb: (q: Query) => Query) => Sql,
      startSql,
    );
  });
});
