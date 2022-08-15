import { expectQueryNotMutated, expectSql, Message, User } from '../test-utils';
import { raw } from '../common';

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

test('on, .orOn', () => {
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

describe.each`
  method         | sql         | or
  ${'onIn'}      | ${'IN'}     | ${false}
  ${'orOnIn'}    | ${'IN'}     | ${true}
  ${'onNotIn'}   | ${'NOT IN'} | ${false}
  ${'orOnNotIn'} | ${'NOT IN'} | ${true}
`('$method', ({ method, sql, or }) => {
  const onMethod = method as 'onIn';
  const orSql = or ? `"message"."authorId" = "user"."id" OR ` : '';

  it('should handle values', () => {
    const q = User.all();

    const query = q.join(Message, (q) =>
      (or ? q.on('authorId', 'id') : q)[onMethod](
        ['id', 'text'],
        [
          [1, 'a'],
          [2, 'b'],
        ],
      ),
    );
    expectSql(
      query.toSql(),
      `
      SELECT "user".* FROM "user"
      JOIN "message"
        ON ${orSql}("message"."id", "message"."text") ${sql} (($1, $2), ($3, $4))
      `,
      [1, 'a', 2, 'b'],
    );

    expectQueryNotMutated(q);
  });
});

describe.each`
  method           | not      | or
  ${'onNull'}      | ${false} | ${false}
  ${'orOnNull'}    | ${false} | ${true}
  ${'onNotNull'}   | ${true}  | ${false}
  ${'orOnNotNull'} | ${true}  | ${true}
`('$method', ({ method, not, or }) => {
  const onMethod = method as 'onNull';
  const orSql = or ? `"message"."authorId" = "user"."id" OR ` : '';
  const notSql = not ? 'NOT ' : '';

  it('should handle values', () => {
    const q = User.all();

    const query = q.join(Message, (q) =>
      (or ? q.on('authorId', 'id') : q)[onMethod]('text'),
    );
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        JOIN "message" ON ${orSql}${notSql}"message"."text" IS NULL
      `,
    );

    expectQueryNotMutated(q);
  });
});

describe.each`
  method             | not      | or
  ${'onExists'}      | ${false} | ${false}
  ${'orOnExists'}    | ${false} | ${true}
  ${'onNotExists'}   | ${true}  | ${false}
  ${'orOnNotExists'} | ${true}  | ${true}
`('$method', ({ method, not, or }) => {
  const onMethod = method as 'onExists';
  const orSql = or ? `"message"."authorId" = "user"."id" OR ` : '';
  const notSql = not ? 'NOT ' : '';

  it('should handle values', () => {
    const q = User.all();

    const query = q.join(Message, (q) =>
      (or ? q.on('authorId', 'id') : q)[onMethod](User),
    );
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        JOIN "message" ON ${orSql}${notSql}EXISTS (SELECT 1 FROM "user" LIMIT $1)
      `,
      [1],
    );

    expectQueryNotMutated(q);
  });
});

describe.each`
  method              | not      | or
  ${'onBetween'}      | ${false} | ${false}
  ${'orOnBetween'}    | ${false} | ${true}
  ${'onNotBetween'}   | ${true}  | ${false}
  ${'orOnNotBetween'} | ${true}  | ${true}
`('$method', ({ method, not, or }) => {
  const onMethod = method as 'onBetween';
  const orSql = or ? `"message"."authorId" = "user"."id" OR ` : '';
  const notSql = not ? 'NOT ' : '';

  it('should handle values', () => {
    const q = User.all();

    const query = q.join(Message, (q) =>
      (or ? q.on('authorId', 'id') : q)[onMethod]('id', [1, 10]),
    );
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        JOIN "message" ON ${orSql}${notSql}"message"."id" BETWEEN $1 AND $2
      `,
      [1, 10],
    );

    expectQueryNotMutated(q);
  });
});

describe.each`
  method                     | not      | or
  ${'onJsonPathEquals'}      | ${false} | ${false}
  ${'orOnJsonPathEquals'}    | ${false} | ${true}
  ${'onNotJsonPathEquals'}   | ${true}  | ${false}
  ${'orOnNotJsonPathEquals'} | ${true}  | ${true}
`('$method', ({ method, not, or }) => {
  const onMethod = method as 'onJsonPathEquals';
  const orSql = or ? `"message"."authorId" = "user"."id" OR ` : '';
  const notSql = not ? 'NOT ' : '';

  it('should handle values', () => {
    const q = User.all();

    const query = q.join(Message, (q) =>
      (or ? q.on('authorId', 'id') : q)[onMethod](
        'meta',
        '$.leftKey',
        'data',
        '$.rightKey',
      ),
    );
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        JOIN "message" ON ${orSql}${notSql}
          jsonb_path_query_first("message"."meta", $1) = 
          jsonb_path_query_first("user"."data", $2)
      `,
      ['$.leftKey', '$.rightKey'],
    );

    expectQueryNotMutated(q);
  });
});
