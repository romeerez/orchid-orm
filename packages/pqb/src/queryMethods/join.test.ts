import { expectQueryNotMutated, expectSql, Message, User } from '../test-utils';
import { raw } from '../common';
import { OnQueryBuilder } from './join';

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
  const join = method as 'join';

  it('should accept left column and right column', () => {
    const q = User.all();
    expectSql(
      q[join](Message, 'authorId', 'id').toSql(),
      `
        SELECT "user".* FROM "user"
        ${sql} "message" ON "message"."authorId" = "user"."id"
      `,
    );
    expectSql(
      q[join](Message.as('as'), 'authorId', 'id').toSql(),
      `
        SELECT "user".* FROM "user"
        ${sql} "message" AS "as" ON "as"."authorId" = "user"."id"
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should accept left column, op and right column', () => {
    const q = User.all();
    expectSql(
      q[join](Message, 'authorId', '=', 'id').toSql(),
      `
        SELECT "user".* FROM "user"
        ${sql} "message" ON "message"."authorId" = "user"."id"
      `,
    );
    expectSql(
      q[join](Message.as('as'), 'authorId', '=', 'id').toSql(),
      `
        SELECT "user".* FROM "user"
        ${sql} "message" AS "as" ON "as"."authorId" = "user"."id"
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw and raw', () => {
    const q = User.all();
    expectSql(
      q[join](Message, raw('"message"."authorId"'), raw('"user"."id"')).toSql(),
      `
        SELECT "user".* FROM "user"
        ${sql} "message" ON "message"."authorId" = "user"."id"
      `,
    );
    expectSql(
      q[join](
        Message.as('as'),
        raw('"as"."authorId"'),
        raw('"user"."id"'),
      ).toSql(),
      `
        SELECT "user".* FROM "user"
        ${sql} "message" AS "as" ON "as"."authorId" = "user"."id"
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw, op and raw', () => {
    const q = User.all();
    expectSql(
      q[join](
        Message,
        raw('"message"."authorId"'),
        '=',
        raw('"user"."id"'),
      ).toSql(),
      `
        SELECT "user".* FROM "user"
        ${sql} "message" ON "message"."authorId" = "user"."id"
      `,
    );
    expectSql(
      q[join](
        Message.as('as'),
        raw('"as"."authorId"'),
        '=',
        raw('"user"."id"'),
      ).toSql(),
      `
        SELECT "user".* FROM "user"
        ${sql} "message" AS "as" ON "as"."authorId" = "user"."id"
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should accept object of columns', () => {
    const q = User.all();
    expectSql(
      q[join](Message, { authorId: 'id' }).toSql(),
      `
        SELECT "user".* FROM "user"
        ${sql} "message" ON "message"."authorId" = "user"."id"
      `,
    );
    expectSql(
      q[join](Message.as('as'), { authorId: 'id' }).toSql(),
      `
        SELECT "user".* FROM "user"
        ${sql} "message" AS "as" ON "as"."authorId" = "user"."id"
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should accept object of columns with raw value', () => {
    const q = User.all();
    expectSql(
      q[join](Message, { authorId: raw('"user"."id"') }).toSql(),
      `
        SELECT "user".* FROM "user"
        ${sql} "message" ON "message"."authorId" = "user"."id"
      `,
    );
    expectSql(
      q[join](Message.as('as'), { authorId: raw('"user"."id"') }).toSql(),
      `
        SELECT "user".* FROM "user"
        ${sql} "message" AS "as" ON "as"."authorId" = "user"."id"
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw sql', () => {
    const q = User.all();
    expectSql(
      q[join](Message, raw('"authorId" = "user".id')).toSql(),
      `
      SELECT "user".* FROM "user"
      ${sql} "message" ON "authorId" = "user".id
    `,
    );
    expectSql(
      q[join](Message.as('as'), raw('"authorId" = "user".id')).toSql(),
      `
      SELECT "user".* FROM "user"
      ${sql} "message" AS "as" ON "authorId" = "user".id
    `,
    );
    expectQueryNotMutated(q);
  });

  it('should accept callback to specify custom conditions', () => {});
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

    const buildSql = (cb: (q: OnQueryBuilder) => OnQueryBuilder) => {
      return User.join(Message, cb).toSql();
    };

    const startSql = `SELECT "user".* FROM "user" JOIN "message" ON`;

    describe('where', () => {
      it('should handle null value', () => {
        expectSql(
          buildSql((q) => q.where({ id: 1, 'user.picture': null })),
          `
            ${startSql} "user"."id" = $1 AND "user"."picture" IS NULL
          `,
          [1],
        );
      });

      it('should accept sub query', () => {
        expectSql(
          buildSql((q) =>
            q.where({ id: 1 }, q.where({ id: 2 }).or({ id: 3, name: 'n' })),
          ),
          `
            ${startSql} "user"."id" = $1 AND (
              "user"."id" = $2 OR "user"."id" = $3 AND "user"."name" = $4
            )
          `,
          [1, 2, 3, 'n'],
        );
      });

      it('should handle condition with operator', () => {
        expectSql(
          buildSql((q) => q.where({ age: { gt: 20 } })),
          `
            ${startSql} "user"."age" > $1
          `,
          [20],
        );
      });

      it('should handle condition with operator and sub query', () => {
        expectSql(
          buildSql((q) => q.where({ id: { in: User.select('id') } })),
          `
            ${startSql}
            "user"."id" IN (SELECT "user"."id" FROM "user")
          `,
        );
      });

      it('should handle condition with operator and raw', () => {
        expectSql(
          buildSql((q) => q.where({ id: { in: raw('(1, 2, 3)') } })),
          `
            ${startSql}
            "user"."id" IN (1, 2, 3)
          `,
        );
      });

      it('should accept raw sql', () => {
        expectSql(
          buildSql((q) => q.where({ id: raw('1 + 2') })),
          `
            ${startSql} "user"."id" = 1 + 2
          `,
        );
      });
    });

    describe('whereNot', () => {
      it('should handle null value', () => {
        expectSql(
          buildSql((q) => q.whereNot({ id: 1, picture: null })),
          `
            ${startSql}
            NOT "user"."id" = $1
              AND NOT "user"."picture" IS NULL
          `,
          [1],
        );
      });

      it('should accept sub query', () => {
        expectSql(
          buildSql((q) =>
            q.whereNot({ id: 1 }, q.where({ id: 2 }).or({ id: 3, name: 'n' })),
          ),
          `
            ${startSql}
            NOT "user"."id" = $1 AND NOT (
              "user"."id" = $2 OR "user"."id" = $3 AND "user"."name" = $4
            )
          `,
          [1, 2, 3, 'n'],
        );
      });

      it('should handle condition with operator', () => {
        expectSql(
          buildSql((q) => q.whereNot({ age: { gt: 20 } })),
          `
            ${startSql}
            NOT "user"."age" > $1
          `,
          [20],
        );
      });

      it('should handle condition with operator and sub query', () => {
        expectSql(
          buildSql((q) => q.whereNot({ id: { in: User.select('id') } })),
          `
            ${startSql}
            NOT "user"."id" IN (SELECT "user"."id" FROM "user")
          `,
        );
      });

      it('should handle condition with operator and raw', () => {
        expectSql(
          buildSql((q) => q.whereNot({ id: { in: raw('(1, 2, 3)') } })),
          `
            ${startSql}
            NOT "user"."id" IN (1, 2, 3)
          `,
        );
      });

      it('should accept raw sql', () => {
        expectSql(
          buildSql((q) => q.whereNot({ id: raw('1 + 2') })),
          `
            ${startSql} NOT "user"."id" = 1 + 2
          `,
        );
      });
    });

    describe('or', () => {
      it('should join conditions with or', () => {
        expectSql(
          buildSql((q) => q.or({ id: 1 }, { name: 'ko' })),
          `
            ${startSql}
            "user"."id" = $1 OR "user"."name" = $2
          `,
          [1, 'ko'],
        );
      });

      it('should handle sub queries', () => {
        expectSql(
          buildSql((q) =>
            q.or({ id: 1 }, User.where({ id: 2 }).and({ name: 'n' })),
          ),
          `
            ${startSql}
            "user"."id" = $1 OR ("user"."id" = $2 AND "user"."name" = $3)
          `,
          [1, 2, 'n'],
        );
      });

      it('should accept raw sql', () => {
        expectSql(
          buildSql((q) => q.or({ id: raw('1 + 2') }, { name: raw('2 + 3') })),
          `
            ${startSql}
            "user"."id" = 1 + 2 OR "user"."name" = 2 + 3
          `,
        );
      });
    });

    describe('orNot', () => {
      it('should join conditions with or', () => {
        expectSql(
          buildSql((q) => q.orNot({ id: 1 }, { name: 'ko' })),
          `
            ${startSql}
            NOT "user"."id" = $1 OR NOT "user"."name" = $2
          `,
          [1, 'ko'],
        );
      });

      it('should handle sub queries', () => {
        expectSql(
          buildSql((q) =>
            q.orNot({ id: 1 }, User.where({ id: 2 }).and({ name: 'n' })),
          ),
          `
            ${startSql}
            NOT "user"."id" = $1 OR NOT ("user"."id" = $2 AND "user"."name" = $3)
          `,
          [1, 2, 'n'],
        );
      });

      it('should accept raw sql', () => {
        expectSql(
          buildSql((q) =>
            q.orNot({ id: raw('1 + 2') }, { name: raw('2 + 3') }),
          ),
          `
            ${startSql}
            NOT "user"."id" = 1 + 2 OR NOT "user"."name" = 2 + 3
          `,
        );
      });
    });

    describe('whereExists', () => {
      it('should handle sub query', () => {
        expectSql(
          buildSql((q) => q.whereExists(User.all())),
          `
            ${startSql}
            EXISTS (SELECT 1 FROM "user" LIMIT $1)
          `,
          [1],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          buildSql((q) => q.whereExists(raw(`SELECT 1 FROM "user"`))),
          `
            ${startSql}
            EXISTS (SELECT 1 FROM "user")
          `,
        );
      });
    });

    describe('orWhereExists', () => {
      it('should handle sub query', () => {
        expectSql(
          buildSql((q) => q.where({ id: 1 }).orWhereExists(User.all())),
          `
            ${startSql}
            "user"."id" = $1 OR EXISTS (SELECT 1 FROM "user" LIMIT $2)
          `,
          [1, 1],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          buildSql((q) =>
            q.where({ id: 1 }).orWhereExists(raw(`SELECT 1 FROM "user"`)),
          ),
          `
            ${startSql}
            "user"."id" = $1 OR EXISTS (SELECT 1 FROM "user")
          `,
          [1],
        );
      });
    });

    describe('whereNotExists', () => {
      it('should handle sub query', () => {
        expectSql(
          buildSql((q) => q.whereNotExists(User.all())),
          `
            ${startSql}
            NOT EXISTS (SELECT 1 FROM "user" LIMIT $1)
          `,
          [1],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          buildSql((q) => q.whereNotExists(raw(`SELECT 1 FROM "user"`))),
          `
            ${startSql}
            NOT EXISTS (SELECT 1 FROM "user")
          `,
        );
      });
    });

    describe('orWhereNotExists', () => {
      it('should handle sub query', () => {
        expectSql(
          buildSql((q) => q.where({ id: 1 }).orWhereNotExists(User.all())),
          `
            ${startSql}
            "user"."id" = $1 OR NOT EXISTS (SELECT 1 FROM "user" LIMIT $2)
          `,
          [1, 1],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          buildSql((q) =>
            q.where({ id: 1 }).orWhereNotExists(raw(`SELECT 1 FROM "user"`)),
          ),
          `
            ${startSql}
            "user"."id" = $1 OR NOT EXISTS (SELECT 1 FROM "user")
          `,
          [1],
        );
      });
    });
  });
});
