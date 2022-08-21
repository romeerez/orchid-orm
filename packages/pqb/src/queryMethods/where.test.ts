import { expectQueryNotMutated, expectSql, User } from '../test-utils';
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
    expectSql(
      q.where({ id: 1, 'user.picture': null }).toSql(),
      `
        SELECT "user".* FROM "user" WHERE "user"."id" = $1 AND "user"."picture" IS NULL
      `,
      [1],
    );
    expectQueryNotMutated(q);
  });

  it('should accept sub query', () => {
    const q = User.all();
    expectSql(
      q.where({ id: 1 }, q.where({ id: 2 }).or({ id: 3, name: 'n' })).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 AND (
          "user"."id" = $2 OR "user"."id" = $3 AND "user"."name" = $4
        )
      `,
      [1, 2, 3, 'n'],
    );
    expectQueryNotMutated(q);
  });

  it('should handle condition with operator', () => {
    const q = User.all();
    expectSql(
      q.where({ age: { gt: 20 } }).toSql(),
      `
        SELECT "user".* FROM "user" WHERE "user"."age" > $1
      `,
      [20],
    );
    expectQueryNotMutated(q);
  });

  it('should handle condition with operator and sub query', () => {
    const q = User.all();
    expectSql(
      q.where({ id: { in: User.select('id') } }).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" IN (SELECT "user"."id" FROM "user")
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should handle condition with operator and raw', () => {
    const q = User.all();
    expectSql(
      q.where({ id: { in: raw('(1, 2, 3)') } }).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" IN (1, 2, 3)
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw sql', () => {
    const q = User.all();
    expectSql(
      q.where({ id: raw('1 + 2') }).toSql(),
      `
        SELECT "user".* FROM "user" WHERE "user"."id" = 1 + 2
      `,
    );
    expectQueryNotMutated(q);
  });
});

describe('findBy', () => {
  it('like where but with take', () => {
    const q = User.all();
    expectSql(
      q.findBy({ name: 's' }).toSql(),
      `SELECT "user".* FROM "user" WHERE "user"."name" = $1 LIMIT $2`,
      ['s', 1],
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw', () => {
    const q = User.all();
    expectSql(
      q.findBy({ name: raw(`'string'`) }).toSql(),
      `SELECT "user".* FROM "user" WHERE "user"."name" = 'string' LIMIT $1`,
      [1],
    );
    expectQueryNotMutated(q);
  });
});

describe('whereNot', () => {
  it('should handle null value', () => {
    const q = User.all();
    expectSql(
      q.whereNot({ id: 1, picture: null }).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" = $1
          AND NOT "user"."picture" IS NULL
      `,
      [1],
    );
    expectQueryNotMutated(q);
  });

  it('should accept sub query', () => {
    const q = User.all();
    expectSql(
      q
        .whereNot({ id: 1 }, q.where({ id: 2 }).or({ id: 3, name: 'n' }))
        .toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" = $1 AND NOT (
          "user"."id" = $2 OR "user"."id" = $3 AND "user"."name" = $4
        )
      `,
      [1, 2, 3, 'n'],
    );
    expectQueryNotMutated(q);
  });

  it('should handle condition with operator', () => {
    const q = User.all();
    expectSql(
      q.whereNot({ age: { gt: 20 } }).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT "user"."age" > $1
      `,
      [20],
    );
    expectQueryNotMutated(q);
  });

  it('should handle condition with operator and sub query', () => {
    const q = User.all();
    expectSql(
      q.whereNot({ id: { in: User.select('id') } }).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" IN (SELECT "user"."id" FROM "user")
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should handle condition with operator and raw', () => {
    const q = User.all();
    expectSql(
      q.whereNot({ id: { in: raw('(1, 2, 3)') } }).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" IN (1, 2, 3)
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw sql', () => {
    const q = User.all();
    expectSql(
      q.whereNot({ id: raw('1 + 2') }).toSql(),
      `
        SELECT "user".* FROM "user" WHERE NOT "user"."id" = 1 + 2
      `,
    );
    expectQueryNotMutated(q);
  });
});

describe('or', () => {
  it('should join conditions with or', () => {
    const q = User.all();
    expectSql(
      q.or({ id: 1 }, { name: 'ko' }).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR "user"."name" = $2
      `,
      [1, 'ko'],
    );
    expectQueryNotMutated(q);
  });

  it('should handle sub queries', () => {
    const q = User.all();
    expectSql(
      q.or({ id: 1 }, User.where({ id: 2 }).and({ name: 'n' })).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR ("user"."id" = $2 AND "user"."name" = $3)
      `,
      [1, 2, 'n'],
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw sql', () => {
    const q = User.all();
    expectSql(
      q.or({ id: raw('1 + 2') }, { name: raw('2 + 3') }).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = 1 + 2 OR "user"."name" = 2 + 3
      `,
    );
    expectQueryNotMutated(q);
  });
});

describe('orNot', () => {
  it('should join conditions with or', () => {
    const q = User.all();
    expectSql(
      q.orNot({ id: 1 }, { name: 'ko' }).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" = $1 OR NOT "user"."name" = $2
      `,
      [1, 'ko'],
    );
    expectQueryNotMutated(q);
  });

  it('should handle sub queries', () => {
    const q = User.all();
    expectSql(
      q.orNot({ id: 1 }, User.where({ id: 2 }).and({ name: 'n' })).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" = $1 OR NOT ("user"."id" = $2 AND "user"."name" = $3)
      `,
      [1, 2, 'n'],
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw sql', () => {
    const q = User.all();
    expectSql(
      q.orNot({ id: raw('1 + 2') }, { name: raw('2 + 3') }).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" = 1 + 2 OR NOT "user"."name" = 2 + 3
      `,
    );
    expectQueryNotMutated(q);
  });
});

describe('whereExists', () => {
  it('should handle sub query', () => {
    const q = User.all();

    const query = q.whereExists(User.all());
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE EXISTS (SELECT 1 FROM "user" LIMIT $1)
      `,
      [1],
    );

    expectQueryNotMutated(q);
  });

  it('should handle raw query', () => {
    const q = User.all();

    const query = q.whereExists(raw(`SELECT 1 FROM "user"`));
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE EXISTS (SELECT 1 FROM "user")
      `,
    );

    expectQueryNotMutated(q);
  });
});

describe('orWhereExists', () => {
  it('should handle sub query', () => {
    const q = User.all();

    const query = q.where({ id: 1 }).orWhereExists(User.all());
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR EXISTS (SELECT 1 FROM "user" LIMIT $2)
      `,
      [1, 1],
    );

    expectQueryNotMutated(q);
  });

  it('should handle raw query', () => {
    const q = User.all();

    const query = q.where({ id: 1 }).orWhereExists(raw(`SELECT 1 FROM "user"`));
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR EXISTS (SELECT 1 FROM "user")
      `,
      [1],
    );

    expectQueryNotMutated(q);
  });
});

describe('whereNotExists', () => {
  it('should handle sub query', () => {
    const q = User.all();

    const query = q.whereNotExists(User.all());
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT EXISTS (SELECT 1 FROM "user" LIMIT $1)
      `,
      [1],
    );

    expectQueryNotMutated(q);
  });

  it('should handle raw query', () => {
    const q = User.all();

    const query = q.whereNotExists(raw(`SELECT 1 FROM "user"`));
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT EXISTS (SELECT 1 FROM "user")
      `,
    );

    expectQueryNotMutated(q);
  });
});

describe('orWhereNotExists', () => {
  it('should handle sub query', () => {
    const q = User.all();

    const query = q.where({ id: 1 }).orWhereNotExists(User.all());
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR NOT EXISTS (SELECT 1 FROM "user" LIMIT $2)
      `,
      [1, 1],
    );

    expectQueryNotMutated(q);
  });

  it('should handle raw query', () => {
    const q = User.all();

    const query = q
      .where({ id: 1 })
      .orWhereNotExists(raw(`SELECT 1 FROM "user"`));
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR NOT EXISTS (SELECT 1 FROM "user")
      `,
      [1],
    );

    expectQueryNotMutated(q);
  });
});
