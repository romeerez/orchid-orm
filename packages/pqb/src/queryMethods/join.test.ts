import { expectQueryNotMutated, line, Message, User } from '../test-utils';
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
    expect(q[join](Message, 'authorId', 'id').toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        ${sql} "message" ON "message"."authorId" = "user"."id"
      `),
    );
    expect(q[join](Message.as('as'), 'authorId', 'id').toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        ${sql} "message" AS "as" ON "as"."authorId" = "user"."id"
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept left column, op and right column', () => {
    const q = User.all();
    expect(q[join](Message, 'authorId', '=', 'id').toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        ${sql} "message" ON "message"."authorId" = "user"."id"
      `),
    );
    expect(q[join](Message.as('as'), 'authorId', '=', 'id').toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        ${sql} "message" AS "as" ON "as"."authorId" = "user"."id"
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw and raw', () => {
    const q = User.all();
    expect(
      q[join](Message, raw('"message"."authorId"'), raw('"user"."id"')).toSql(),
    ).toBe(
      line(`
        SELECT "user".* FROM "user"
        ${sql} "message" ON "message"."authorId" = "user"."id"
      `),
    );
    expect(
      q[join](
        Message.as('as'),
        raw('"as"."authorId"'),
        raw('"user"."id"'),
      ).toSql(),
    ).toBe(
      line(`
        SELECT "user".* FROM "user"
        ${sql} "message" AS "as" ON "as"."authorId" = "user"."id"
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw, op and raw', () => {
    const q = User.all();
    expect(
      q[join](
        Message,
        raw('"message"."authorId"'),
        '=',
        raw('"user"."id"'),
      ).toSql(),
    ).toBe(
      line(`
        SELECT "user".* FROM "user"
        ${sql} "message" ON "message"."authorId" = "user"."id"
      `),
    );
    expect(
      q[join](
        Message.as('as'),
        raw('"as"."authorId"'),
        '=',
        raw('"user"."id"'),
      ).toSql(),
    ).toBe(
      line(`
        SELECT "user".* FROM "user"
        ${sql} "message" AS "as" ON "as"."authorId" = "user"."id"
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept object of columns', () => {
    const q = User.all();
    expect(q[join](Message, { authorId: 'id' }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        ${sql} "message" ON "message"."authorId" = "user"."id"
      `),
    );
    expect(q[join](Message.as('as'), { authorId: 'id' }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        ${sql} "message" AS "as" ON "as"."authorId" = "user"."id"
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept object of columns with raw value', () => {
    const q = User.all();
    expect(q[join](Message, { authorId: raw('"user"."id"') }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        ${sql} "message" ON "message"."authorId" = "user"."id"
      `),
    );
    expect(
      q[join](Message.as('as'), { authorId: raw('"user"."id"') }).toSql(),
    ).toBe(
      line(`
        SELECT "user".* FROM "user"
        ${sql} "message" AS "as" ON "as"."authorId" = "user"."id"
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw sql', () => {
    const q = User.all();
    expect(q[join](Message, raw('"authorId" = "user".id')).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      ${sql} "message" ON "authorId" = "user".id
    `),
    );
    expect(
      q[join](Message.as('as'), raw('"authorId" = "user".id')).toSql(),
    ).toBe(
      line(`
      SELECT "user".* FROM "user"
      ${sql} "message" AS "as" ON "authorId" = "user".id
    `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept callback to specify custom conditions', () => {
    const q = User.all();

    const expectedSql = line(`
      SELECT "user".* FROM "user"
      ${sql} "message"
        ON "message"."authorId" = "user"."id"
       AND "message"."text" = "user"."name"
    `);

    expect(
      q[join](Message, (q) =>
        q.on('message.authorId', 'user.id').onOr('message.text', 'user.name'),
      ).toSql(),
    ).toBe(expectedSql);

    expect(
      q[join](Message, (q) =>
        q
          .on('message.authorId', '=', 'user.id')
          .onOr('message.text', '=', 'user.name'),
      ).toSql(),
    ).toBe(expectedSql);

    expectQueryNotMutated(q);
  });
});
