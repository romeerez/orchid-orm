import { expectQueryNotMutated, line, Message, User } from '../test-utils';
import { raw } from '../common';

describe('join', () => {
  it('can accept left column, op and right column', () => {
    const q = User.all();
    expect(q.join(Message, 'authorId', '=', 'id').toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      JOIN "message" ON "message"."authorId" = "user"."id"
    `),
    );
    expect(q.join(Message.as('as'), 'authorId', '=', 'id').toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      JOIN "message" AS "as" ON "as"."authorId" = "user"."id"
    `),
    );
    expectQueryNotMutated(q);
  });

  it('can accept raw sql', () => {
    const q = User.all();
    expect(q.join(Message, raw('"authorId" = "user".id')).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      JOIN "message" ON "authorId" = "user".id
    `),
    );
    expect(
      q.join(Message.as('as'), raw('"authorId" = "user".id')).toSql(),
    ).toBe(
      line(`
      SELECT "user".* FROM "user"
      JOIN "message" AS "as" ON "authorId" = "user".id
    `),
    );
    expectQueryNotMutated(q);
  });

  it('can accept callback to specify custom conditions', () => {
    const q = User.all();
    expect(
      q
        .join(Message, (q) => {
          return q
            .on('message.authorId', '=', 'user.id')
            .onOr('message.text', '=', 'user.name');
        })
        .toSql(),
    ).toBe(
      line(`
        SELECT "user".* FROM "user"
        JOIN "message"
          ON "message"."authorId" = "user"."id"
         AND "message"."text" = "user"."name"
      `),
    );
    expectQueryNotMutated(q);
  });
});
