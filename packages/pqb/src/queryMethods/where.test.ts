import { expectQueryNotMutated, line, Message, User } from '../test-utils';
import { raw } from '../common';

describe('and', () => {
  const [where, _where] = [User.where, User._where];
  beforeEach(() => {
    User.where = jest.fn();
    User._where = jest.fn();
  });
  afterAll(() => {
    User.where = where;
    User._where = _where;
  });

  it('is alias for where', () => {
    User.and({});
    expect(User.where).toBeCalled();
  });

  it('has modifier', () => {
    User._and({});
    expect(User._where).toBeCalled();
  });
});

describe('andNot', () => {
  const [whereNot, _whereNot] = [User.whereNot, User._whereNot];
  beforeEach(() => {
    User.whereNot = jest.fn();
    User._whereNot = jest.fn();
  });
  afterAll(() => {
    User.whereNot = whereNot;
    User._whereNot = _whereNot;
  });

  it('is alias for where', () => {
    User.andNot({});
    expect(User.whereNot).toBeCalled();
  });

  it('has modifier', () => {
    User._andNot({});
    expect(User._whereNot).toBeCalled();
  });
});

describe('where', () => {
  it('should handle null value', () => {
    const q = User.all();
    expect(q.where({ id: 1, picture: null }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user" WHERE "user"."id" = 1 AND "user"."picture" IS NULL
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept sub query', () => {
    const q = User.all();
    expect(
      q.where({ id: 1 }, q.where({ id: 2 }).or({ id: 3, name: 'n' })).toSql(),
    ).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" = 1 AND (
          "user"."id" = 2 OR "user"."id" = 3 AND "user"."name" = 'n'
        )
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should handle { on: [leftColumn, operator, rightColumn] }', () => {
    const q = User.all();
    expect(
      q
        .join(Message, 'authorId', '=', 'id')
        .where({ on: ['id', '=', 'message.authorId'] })
        .toSql(),
    ).toBe(
      line(`
        SELECT "user".*
        FROM "user"
        JOIN "message" ON "message"."authorId" = "user"."id"
        WHERE "user"."id" = "message"."authorId"
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should handle condition with operator', () => {
    const q = User.all();
    expect(q.where({ age: { gt: 20 } }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user" WHERE "user"."age" > 20
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should handle condition with operator and sub query', () => {
    const q = User.all();
    expect(q.where({ id: { in: User.select('id') } }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" IN (SELECT "user"."id" FROM "user")
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should handle condition with operator and raw', () => {
    const q = User.all();
    expect(q.where({ id: { in: raw('(1, 2, 3)') } }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" IN (1, 2, 3)
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw sql', () => {
    const q = User.all();
    expect(q.where({ id: raw('1 + 2') }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user" WHERE "user"."id" = 1 + 2
      `),
    );
    expectQueryNotMutated(q);
  });
});

describe('whereNot', () => {
  it('should handle null value', () => {
    const q = User.all();
    expect(q.whereNot({ id: 1, picture: null }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" = 1
          AND NOT "user"."picture" IS NULL
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept sub query', () => {
    const q = User.all();
    expect(
      q
        .whereNot({ id: 1 }, q.where({ id: 2 }).or({ id: 3, name: 'n' }))
        .toSql(),
    ).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" = 1 AND NOT (
          "user"."id" = 2 OR "user"."id" = 3 AND "user"."name" = 'n'
        )
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should handle { on: [leftColumn, operator, rightColumn] }', () => {
    const q = User.all();
    expect(
      q
        .join(Message, 'authorId', '=', 'id')
        .whereNot({ on: ['id', '=', 'message.authorId'] })
        .toSql(),
    ).toBe(
      line(`
        SELECT "user".*
        FROM "user"
        JOIN "message" ON "message"."authorId" = "user"."id"
        WHERE NOT "user"."id" = "message"."authorId"
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should handle condition with operator', () => {
    const q = User.all();
    expect(q.whereNot({ age: { gt: 20 } }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE NOT "user"."age" > 20
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should handle condition with operator and sub query', () => {
    const q = User.all();
    expect(q.whereNot({ id: { in: User.select('id') } }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" IN (SELECT "user"."id" FROM "user")
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should handle condition with operator and raw', () => {
    const q = User.all();
    expect(q.whereNot({ id: { in: raw('(1, 2, 3)') } }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" IN (1, 2, 3)
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw sql', () => {
    const q = User.all();
    expect(q.whereNot({ id: raw('1 + 2') }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user" WHERE NOT "user"."id" = 1 + 2
      `),
    );
    expectQueryNotMutated(q);
  });
});

describe('or', () => {
  it('should join conditions with or', () => {
    const q = User.all();
    expect(q.or({ id: 1 }, { name: 'ko' }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" = 1 OR "user"."name" = 'ko'
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should handle sub queries', () => {
    const q = User.all();
    expect(
      q.or({ id: 1 }, User.where({ id: 2 }).and({ name: 'n' })).toSql(),
    ).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" = 1 OR ("user"."id" = 2 AND "user"."name" = 'n')
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw sql', () => {
    const q = User.all();
    expect(q.or({ id: raw('1 + 2') }, { name: raw('2 + 3') }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" = 1 + 2 OR "user"."name" = 2 + 3
      `),
    );
    expectQueryNotMutated(q);
  });
});

describe('orNot', () => {
  it('should join conditions with or', () => {
    const q = User.all();
    expect(q.orNot({ id: 1 }, { name: 'ko' }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" = 1 OR NOT "user"."name" = 'ko'
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should handle sub queries', () => {
    const q = User.all();
    expect(
      q.orNot({ id: 1 }, User.where({ id: 2 }).and({ name: 'n' })).toSql(),
    ).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" = 1 OR NOT ("user"."id" = 2 AND "user"."name" = 'n')
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw sql', () => {
    const q = User.all();
    expect(q.orNot({ id: raw('1 + 2') }, { name: raw('2 + 3') }).toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" = 1 + 2 OR NOT "user"."name" = 2 + 3
      `),
    );
    expectQueryNotMutated(q);
  });
});

describe('whereIn', () => {
  it('should handle (column, array)', () => {
    const q = User.all();

    const query = q.whereIn('id', [1, 2, 3]);
    expect(query.toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" IN (1, 2, 3)
      `),
    );

    expectQueryNotMutated(q);
  });

  it('should handle object of columns and arrays', () => {
    const q = User.all();

    const query = q.whereIn({ id: [1, 2, 3], name: ['a', 'b', 'c'] });
    expect(query.toSql()).toBe(
      line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" IN (1, 2, 3)
          AND "user"."name" IN ('a', 'b', 'c')
      `),
    );

    expectQueryNotMutated(q);
  });
});
