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

describe('whereIn', () => {
  it('should handle (column, array)', () => {
    const q = User.all();

    const query = q.whereIn('id', [1, 2, 3]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" IN ($1, $2, $3)
      `,
      [1, 2, 3],
    );

    expectQueryNotMutated(q);
  });

  it('should handle object of columns and arrays', () => {
    const q = User.all();

    const query = q.whereIn({ id: [1, 2, 3], name: ['a', 'b', 'c'] });
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" IN ($1, $2, $3)
          AND "user"."name" IN ($4, $5, $6)
      `,
      [1, 2, 3, 'a', 'b', 'c'],
    );

    expectQueryNotMutated(q);
  });

  it('should handle raw query', () => {
    const q = User.all();

    expectSql(
      q.whereIn('id', raw('(1, 2, 3)')).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" IN (1, 2, 3)
      `,
    );

    expectSql(
      q.whereIn({ id: raw('(1, 2, 3)'), name: raw(`('a', 'b', 'c')`) }).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" IN (1, 2, 3)
          AND "user"."name" IN ('a', 'b', 'c')
      `,
    );

    expectQueryNotMutated(q);
  });

  it('should handle sub query', () => {
    const q = User.all();

    expectSql(
      q.whereIn('id', User.select('id')).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" IN (SELECT "user"."id" FROM "user")
      `,
    );

    expectSql(
      q.whereIn({ id: User.select('id'), name: User.select('name') }).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" IN (SELECT "user"."id" FROM "user")
          AND "user"."name" IN (SELECT "user"."name" FROM "user")
      `,
    );

    expectQueryNotMutated(q);
  });

  describe('tuple', () => {
    it('should handle values', () => {
      const q = User.all();

      const query = q.whereIn(
        ['id', 'name'],
        [
          [1, 'a'],
          [2, 'b'],
        ],
      );
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE ("user"."id", "user"."name") IN (($1, $2), ($3, $4))
        `,
        [1, 'a', 2, 'b'],
      );

      expectQueryNotMutated(q);
    });

    it('should handle raw query', () => {
      const q = User.all();

      const query = q.whereIn(['id', 'name'], raw(`((1, 'a'), (2, 'b'))`));
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE ("user"."id", "user"."name") IN ((1, 'a'), (2, 'b'))
        `,
      );

      expectQueryNotMutated(q);
    });

    it('should handle sub query', () => {
      const q = User.all();

      const query = q.whereIn(['id', 'name'], User.select('id', 'name'));
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE ("user"."id", "user"."name")
             IN (SELECT "user"."id", "user"."name" FROM "user")
        `,
      );

      expectQueryNotMutated(q);
    });
  });
});

describe('orWhereIn', () => {
  it('should handle (column, array)', () => {
    const q = User.all();

    const query = q.where({ id: 1 }).orWhereIn('id', [1, 2, 3]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR "user"."id" IN ($2, $3, $4)
      `,
      [1, 1, 2, 3],
    );

    expectQueryNotMutated(q);
  });

  it('should handle object of columns and arrays', () => {
    const q = User.all();

    const query = q
      .where({ id: 1 })
      .orWhereIn({ id: [1, 2, 3], name: ['a', 'b', 'c'] });
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1
          OR "user"."id" IN ($2, $3, $4) AND "user"."name" IN ($5, $6, $7)
      `,
      [1, 1, 2, 3, 'a', 'b', 'c'],
    );

    expectQueryNotMutated(q);
  });

  it('should handle raw query', () => {
    const q = User.all();

    expectSql(
      q.where({ id: 1 }).orWhereIn('id', raw('(1, 2, 3)')).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR "user"."id" IN (1, 2, 3)
      `,
      [1],
    );

    expectSql(
      q
        .where({ id: 1 })
        .orWhereIn({ id: raw('(1, 2, 3)'), name: raw(`('a', 'b', 'c')`) })
        .toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1
           OR "user"."id" IN (1, 2, 3)
          AND "user"."name" IN ('a', 'b', 'c')
      `,
      [1],
    );

    expectQueryNotMutated(q);
  });

  it('should handle sub query', () => {
    const q = User.all();

    expectSql(
      q.where({ id: 1 }).orWhereIn('id', User.select('id')).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1
           OR "user"."id" IN (SELECT "user"."id" FROM "user")
      `,
      [1],
    );

    expectSql(
      q
        .where({ id: 1 })
        .orWhereIn({ id: User.select('id'), name: User.select('name') })
        .toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1
           OR "user"."id" IN (SELECT "user"."id" FROM "user")
          AND "user"."name" IN (SELECT "user"."name" FROM "user")
      `,
      [1],
    );

    expectQueryNotMutated(q);
  });

  describe('tuple', () => {
    it('should handle values', () => {
      const q = User.all();

      const query = q.where({ id: 1 }).orWhereIn(
        ['id', 'name'],
        [
          [1, 'a'],
          [2, 'b'],
        ],
      );
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1
             OR ("user"."id", "user"."name") IN (($2, $3), ($4, $5))
        `,
        [1, 1, 'a', 2, 'b'],
      );

      expectQueryNotMutated(q);
    });

    it('should handle raw query', () => {
      const q = User.all();

      const query = q
        .where({ id: 1 })
        .orWhereIn(['id', 'name'], raw(`((1, 'a'), (2, 'b'))`));
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1
             OR ("user"."id", "user"."name") IN ((1, 'a'), (2, 'b'))
        `,
        [1],
      );

      expectQueryNotMutated(q);
    });

    it('should handle sub query', () => {
      const q = User.all();

      const query = q
        .where({ id: 1 })
        .orWhereIn(['id', 'name'], User.select('id', 'name'));
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1
             OR ("user"."id", "user"."name")
             IN (SELECT "user"."id", "user"."name" FROM "user")
        `,
        [1],
      );

      expectQueryNotMutated(q);
    });
  });
});

describe('whereNotIn', () => {
  it('should handle (column, array)', () => {
    const q = User.all();

    const query = q.whereNotIn('id', [1, 2, 3]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" NOT IN ($1, $2, $3)
      `,
      [1, 2, 3],
    );

    expectQueryNotMutated(q);
  });

  it('should handle object of columns and arrays', () => {
    const q = User.all();

    const query = q.whereNotIn({ id: [1, 2, 3], name: ['a', 'b', 'c'] });
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" NOT IN ($1, $2, $3)
          AND "user"."name" NOT IN ($4, $5, $6)
      `,
      [1, 2, 3, 'a', 'b', 'c'],
    );

    expectQueryNotMutated(q);
  });

  it('should handle raw query', () => {
    const q = User.all();

    expectSql(
      q.whereNotIn('id', raw('(1, 2, 3)')).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" NOT IN (1, 2, 3)
      `,
    );

    expectSql(
      q
        .whereNotIn({ id: raw('(1, 2, 3)'), name: raw(`('a', 'b', 'c')`) })
        .toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" NOT IN (1, 2, 3)
          AND "user"."name" NOT IN ('a', 'b', 'c')
      `,
    );

    expectQueryNotMutated(q);
  });

  it('should handle sub query', () => {
    const q = User.all();

    expectSql(
      q.whereNotIn('id', User.select('id')).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" NOT IN (SELECT "user"."id" FROM "user")
      `,
    );

    expectSql(
      q
        .whereNotIn({ id: User.select('id'), name: User.select('name') })
        .toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" NOT IN (SELECT "user"."id" FROM "user")
          AND "user"."name" NOT IN (SELECT "user"."name" FROM "user")
      `,
    );

    expectQueryNotMutated(q);
  });

  describe('tuple', () => {
    it('should handle values', () => {
      const q = User.all();

      const query = q.whereNotIn(
        ['id', 'name'],
        [
          [1, 'a'],
          [2, 'b'],
        ],
      );
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE ("user"."id", "user"."name") NOT IN (($1, $2), ($3, $4))
        `,
        [1, 'a', 2, 'b'],
      );

      expectQueryNotMutated(q);
    });

    it('should handle raw query', () => {
      const q = User.all();

      const query = q.whereNotIn(['id', 'name'], raw(`((1, 'a'), (2, 'b'))`));
      expectSql(
        query.toSql(),
        `
        SELECT "user".* FROM "user"
        WHERE ("user"."id", "user"."name") NOT IN ((1, 'a'), (2, 'b'))
      `,
      );

      expectQueryNotMutated(q);
    });

    it('should handle sub query', () => {
      const q = User.all();

      const query = q.whereNotIn(['id', 'name'], User.select('id', 'name'));
      expectSql(
        query.toSql(),
        `
        SELECT "user".* FROM "user"
        WHERE ("user"."id", "user"."name")
           NOT IN (SELECT "user"."id", "user"."name" FROM "user")
      `,
      );

      expectQueryNotMutated(q);
    });
  });
});

describe('orWhereNotIn', () => {
  it('should handle (column, array)', () => {
    const q = User.all();

    const query = q.where({ id: 1 }).orWhereNotIn('id', [1, 2, 3]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR "user"."id" NOT IN ($2, $3, $4)
      `,
      [1, 1, 2, 3],
    );

    expectQueryNotMutated(q);
  });

  it('should handle object of columns and arrays', () => {
    const q = User.all();

    const query = q
      .where({ id: 1 })
      .orWhereNotIn({ id: [1, 2, 3], name: ['a', 'b', 'c'] });
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1
          OR "user"."id" NOT IN ($2, $3, $4) AND "user"."name" NOT IN ($5, $6, $7)
      `,
      [1, 1, 2, 3, 'a', 'b', 'c'],
    );

    expectQueryNotMutated(q);
  });

  it('should handle raw query', () => {
    const q = User.all();

    expectSql(
      q.where({ id: 1 }).orWhereNotIn('id', raw('(1, 2, 3)')).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR "user"."id" NOT IN (1, 2, 3)
      `,
      [1],
    );

    expectSql(
      q
        .where({ id: 1 })
        .orWhereNotIn({ id: raw('(1, 2, 3)'), name: raw(`('a', 'b', 'c')`) })
        .toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1
           OR "user"."id" NOT IN (1, 2, 3)
          AND "user"."name" NOT IN ('a', 'b', 'c')
      `,
      [1],
    );

    expectQueryNotMutated(q);
  });

  it('should handle sub query', () => {
    const q = User.all();

    expectSql(
      q.where({ id: 1 }).orWhereNotIn('id', User.select('id')).toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1
           OR "user"."id" NOT IN (SELECT "user"."id" FROM "user")
      `,
      [1],
    );

    expectSql(
      q
        .where({ id: 1 })
        .orWhereNotIn({ id: User.select('id'), name: User.select('name') })
        .toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1
           OR "user"."id" NOT IN (SELECT "user"."id" FROM "user")
          AND "user"."name" NOT IN (SELECT "user"."name" FROM "user")
      `,
      [1],
    );

    expectQueryNotMutated(q);
  });

  describe('tuple', () => {
    it('should handle values', () => {
      const q = User.all();

      const query = q.where({ id: 1 }).orWhereNotIn(
        ['id', 'name'],
        [
          [1, 'a'],
          [2, 'b'],
        ],
      );
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1
             OR ("user"."id", "user"."name") NOT IN (($2, $3), ($4, $5))
        `,
        [1, 1, 'a', 2, 'b'],
      );

      expectQueryNotMutated(q);
    });

    it('should handle raw query', () => {
      const q = User.all();

      const query = q
        .where({ id: 1 })
        .orWhereNotIn(['id', 'name'], raw(`((1, 'a'), (2, 'b'))`));
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1
             OR ("user"."id", "user"."name") NOT IN ((1, 'a'), (2, 'b'))
        `,
        [1],
      );

      expectQueryNotMutated(q);
    });

    it('should handle sub query', () => {
      const q = User.all();

      const query = q
        .where({ id: 1 })
        .orWhereNotIn(['id', 'name'], User.select('id', 'name'));
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1
             OR ("user"."id", "user"."name")
             NOT IN (SELECT "user"."id", "user"."name" FROM "user")
        `,
        [1],
      );

      expectQueryNotMutated(q);
    });
  });
});

describe('whereNull', () => {
  it('should add where null condition', () => {
    const q = User.all();

    const query = q.whereNull('id');
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" IS NULL
      `,
    );

    expectQueryNotMutated(q);
  });
});

describe('orWhereNull', () => {
  it('should add where null condition', () => {
    const q = User.all();

    const query = q.where({ id: 1 }).orWhereNull('id');
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR "user"."id" IS NULL
      `,
      [1],
    );

    expectQueryNotMutated(q);
  });
});

describe('whereNotNull', () => {
  it('should add where null condition', () => {
    const q = User.all();

    const query = q.whereNotNull('id');
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" IS NULL
      `,
    );

    expectQueryNotMutated(q);
  });
});

describe('orWhereNotNull', () => {
  it('should add where null condition', () => {
    const q = User.all();

    const query = q.where({ id: 1 }).orWhereNotNull('id');
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR NOT "user"."id" IS NULL
      `,
      [1],
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

describe('whereBetween', () => {
  it('should handle values', () => {
    const q = User.all();

    const query = q.whereBetween('id', [1, 10]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" BETWEEN $1 AND $2
      `,
      [1, 10],
    );

    expectQueryNotMutated(q);
  });

  it('should handle sub query', () => {
    const q = User.all();

    const query = q.whereBetween('id', [
      User.select('id').take(),
      User.select('id').take(),
    ]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id"
        BETWEEN (SELECT "user"."id" FROM "user" LIMIT $1)
            AND (SELECT "user"."id" FROM "user" LIMIT $2)
      `,
      [1, 1],
    );

    expectQueryNotMutated(q);
  });

  it('should handle raw query', () => {
    const q = User.all();

    const query = q.whereBetween('id', [raw('1'), raw('10')]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" BETWEEN 1 AND 10
      `,
    );

    expectQueryNotMutated(q);
  });
});

describe('orWhereBetween', () => {
  it('should handle values', () => {
    const q = User.all();

    const query = q.where({ id: 1 }).orWhereBetween('id', [1, 10]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR "user"."id" BETWEEN $2 AND $3
      `,
      [1, 1, 10],
    );

    expectQueryNotMutated(q);
  });

  it('should handle sub query', () => {
    const q = User.all();

    const query = q
      .where({ id: 1 })
      .orWhereBetween('id', [
        User.select('id').take(),
        User.select('id').take(),
      ]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR "user"."id"
        BETWEEN (SELECT "user"."id" FROM "user" LIMIT $2)
            AND (SELECT "user"."id" FROM "user" LIMIT $3)
      `,
      [1, 1, 1],
    );

    expectQueryNotMutated(q);
  });

  it('should handle raw query', () => {
    const q = User.all();

    const query = q
      .where({ id: 1 })
      .orWhereBetween('id', [raw('1'), raw('10')]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR "user"."id" BETWEEN 1 AND 10
      `,
      [1],
    );

    expectQueryNotMutated(q);
  });
});

describe('whereNotBetween', () => {
  it('should handle values', () => {
    const q = User.all();

    const query = q.whereNotBetween('id', [1, 10]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" BETWEEN $1 AND $2
      `,
      [1, 10],
    );

    expectQueryNotMutated(q);
  });

  it('should handle sub query', () => {
    const q = User.all();

    const query = q.whereNotBetween('id', [
      User.select('id').take(),
      User.select('id').take(),
    ]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id"
        BETWEEN (SELECT "user"."id" FROM "user" LIMIT $1)
           AND (SELECT "user"."id" FROM "user" LIMIT $2)
      `,
      [1, 1],
    );

    expectQueryNotMutated(q);
  });

  it('should handle raw query', () => {
    const q = User.all();

    const query = q.whereNotBetween('id', [raw('1'), raw('10')]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE NOT "user"."id" BETWEEN 1 AND 10
      `,
    );

    expectQueryNotMutated(q);
  });
});

describe('orWhereNotBetween', () => {
  it('should handle values', () => {
    const q = User.all();

    const query = q.where({ id: 1 }).orWhereNotBetween('id', [1, 10]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR NOT "user"."id" BETWEEN $2 AND $3
      `,
      [1, 1, 10],
    );

    expectQueryNotMutated(q);
  });

  it('should handle sub query', () => {
    const q = User.all();

    const query = q
      .where({ id: 1 })
      .orWhereNotBetween('id', [
        User.select('id').take(),
        User.select('id').take(),
      ]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR NOT "user"."id"
        BETWEEN (SELECT "user"."id" FROM "user" LIMIT $2)
            AND (SELECT "user"."id" FROM "user" LIMIT $3)
      `,
      [1, 1, 1],
    );

    expectQueryNotMutated(q);
  });

  it('should handle raw query', () => {
    const q = User.all();

    const query = q
      .where({ id: 1 })
      .orWhereNotBetween('id', [raw('1'), raw('10')]);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1 OR NOT "user"."id" BETWEEN 1 AND 10
      `,
      [1],
    );

    expectQueryNotMutated(q);
  });
});

describe.each`
  method                     | sql
  ${'contains'}              | ${'LIKE'}
  ${'containsInsensitive'}   | ${'ILIKE'}
  ${'startsWith'}            | ${'LIKE'}
  ${'startsWithInsensitive'} | ${'ILIKE'}
  ${'endsWith'}              | ${'LIKE'}
  ${'endsWithInsensitive'}   | ${'ILIKE'}
`('$method', ({ method, sql }) => {
  const whereMethod = `where${method[0].toUpperCase()}${method.slice(
    1,
  )}` as 'whereContains';

  const prepend =
    method.startsWith('contains') || method.startsWith('ends') ? "'%' || " : '';
  const append =
    method.startsWith('contains') || method.startsWith('starts')
      ? " || '%'"
      : '';

  describe(whereMethod, () => {
    it('should handle value', () => {
      const q = User.all();

      const query = q[whereMethod]('name', 'ko');
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."name" ${sql} ${prepend}$1${append}
        `,
        ['ko'],
      );

      expectQueryNotMutated(q);
    });

    it('should handle sub query', () => {
      const q = User.all();

      const query = q[whereMethod]('name', User.select('name').take());
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."name" ${sql} ${prepend}(SELECT "user"."name" FROM "user" LIMIT $1)${append}
        `,
        [1],
      );

      expectQueryNotMutated(q);
    });

    it('should handle raw query', () => {
      const q = User.all();

      const query = q[whereMethod]('name', raw("'ko'"));
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."name" ${sql} ${prepend}'ko'${append}
        `,
      );

      expectQueryNotMutated(q);
    });
  });

  const orWhereMethod = `orWhere${method[0].toUpperCase()}${method.slice(
    1,
  )}` as 'orWhereContains';

  describe(orWhereMethod, () => {
    it('should handle value', () => {
      const q = User.all();

      const query = q.where({ id: 1 })[orWhereMethod]('name', 'ko');
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1 OR "user"."name" ${sql} ${prepend}$2${append}
        `,
        [1, 'ko'],
      );

      expectQueryNotMutated(q);
    });

    it('should handle sub query', () => {
      const q = User.all();

      const query = q
        .where({ id: 1 })
        [orWhereMethod]('name', User.select('name').take());
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1 OR "user"."name" ${sql} ${prepend}(SELECT "user"."name" FROM "user" LIMIT $2)${append}
        `,
        [1, 1],
      );

      expectQueryNotMutated(q);
    });

    it('should handle raw query', () => {
      const q = User.all();

      const query = q.where({ id: 1 })[orWhereMethod]('name', raw("'ko'"));
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1 OR "user"."name" ${sql} ${prepend}'ko'${append}
        `,
        [1],
      );

      expectQueryNotMutated(q);
    });
  });

  const whereNotMethod = `whereNot${method[0].toUpperCase()}${method.slice(
    1,
  )}` as 'orWhereContains';

  describe(whereNotMethod, () => {
    it('should handle value', () => {
      const q = User.all();

      const query = q[whereNotMethod]('name', 'ko');
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE NOT "user"."name" ${sql} ${prepend}$1${append}
        `,
        ['ko'],
      );

      expectQueryNotMutated(q);
    });

    it('should handle sub query', () => {
      const q = User.all();

      const query = q[whereNotMethod]('name', User.select('name').take());
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE NOT "user"."name" ${sql} ${prepend}(SELECT "user"."name" FROM "user" LIMIT $1)${append}
        `,
        [1],
      );

      expectQueryNotMutated(q);
    });

    it('should handle raw query', () => {
      const q = User.all();

      const query = q[whereNotMethod]('name', raw("'ko'"));
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE NOT "user"."name" ${sql} ${prepend}'ko'${append}
        `,
      );

      expectQueryNotMutated(q);
    });
  });

  const orWhereNotMethod = `orWhereNot${method[0].toUpperCase()}${method.slice(
    1,
  )}` as 'orWhereNotContains';

  describe(orWhereNotMethod, () => {
    it('should handle value', () => {
      const q = User.all();

      const query = q.where({ id: 1 })[orWhereNotMethod]('name', 'ko');
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1 OR NOT "user"."name" ${sql} ${prepend}$2${append}
        `,
        [1, 'ko'],
      );

      expectQueryNotMutated(q);
    });

    it('should handle sub query', () => {
      const q = User.all();

      const query = q
        .where({ id: 1 })
        [orWhereNotMethod]('name', User.select('name').take());
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1 OR NOT "user"."name" ${sql} ${prepend}(SELECT "user"."name" FROM "user" LIMIT $2)${append}
        `,
        [1, 1],
      );

      expectQueryNotMutated(q);
    });

    it('should handle raw query', () => {
      const q = User.all();

      const query = q.where({ id: 1 })[orWhereNotMethod]('name', raw("'ko'"));
      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1 OR NOT "user"."name" ${sql} ${prepend}'ko'${append}
        `,
        [1],
      );

      expectQueryNotMutated(q);
    });
  });
});

describe('whereJsonPath', () => {
  it('should handle value', () => {
    const q = User.all();

    const query = q.whereJsonPath('data', ['$.name', '=', 'name']);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE jsonb_path_query_first("user"."data", '$.name') #>> '{}' = $1
      `,
      ['name'],
    );

    expectQueryNotMutated(q);
  });

  it('should handle sub query', () => {
    expectSql(
      User.whereJsonPath('data', [
        '$.name',
        '=',
        User.select('name').take(),
      ]).toSql(),
      `
          SELECT "user".* FROM "user"
          WHERE jsonb_path_query_first("user"."data", '$.name') #>> '{}' = (
            SELECT "user"."name" FROM "user" LIMIT $1
          )
        `,
      [1],
    );
  });

  it('should handle raw query', () => {
    expectSql(
      User.whereJsonPath('data', ['$.name', '=', raw("'name'")]).toSql(),
      `
          SELECT "user".* FROM "user"
          WHERE jsonb_path_query_first("user"."data", '$.name') #>> '{}' = 'name'
        `,
    );
  });
});

describe('orWhereJsonPath', () => {
  it('should handle value', () => {
    const q = User.all();

    const query = q
      .where({ id: 1 })
      .orWhereJsonPath('data', ['$.name', '=', 'name']);
    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1
           OR jsonb_path_query_first("user"."data", '$.name') #>> '{}' = $2
      `,
      [1, 'name'],
    );

    expectQueryNotMutated(q);
  });

  it('should handle sub query', () => {
    expectSql(
      User.where({ id: 1 })
        .orWhereJsonPath('data', ['$.name', '=', User.select('name').take()])
        .toSql(),
      `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1
             OR jsonb_path_query_first("user"."data", '$.name') #>> '{}' = (
              SELECT "user"."name" FROM "user" LIMIT $2
            )
        `,
      [1, 1],
    );
  });

  it('should handle raw query', () => {
    expectSql(
      User.where({ id: 1 })
        .orWhereJsonPath('data', ['$.name', '=', raw("'name'")])
        .toSql(),
      `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1
             OR jsonb_path_query_first("user"."data", '$.name') #>> '{}' = 'name'
        `,
      [1],
    );
  });
});

describe.each`
  method              | sql
  ${'jsonSupersetOf'} | ${'@>'}
  ${'jsonSubsetOf'}   | ${'<@'}
`('$method', ({ method, sql }) => {
  const whereMethod = `where${method[0].toUpperCase()}${method.slice(
    1,
  )}` as 'whereJsonSupersetOf';

  describe(whereMethod, () => {
    it('should handle value', () => {
      expectSql(
        User[whereMethod]('data', { a: 'b' }).toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."data" ${sql} $1
        `,
        [{ a: 'b' }],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User[whereMethod]('data', User.select('data').take()).toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."data" ${sql} (SELECT "user"."data" FROM "user" LIMIT $1)
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User[whereMethod]('data', raw(`'{"a":"b"}'`)).toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."data" ${sql} '{"a":"b"}'
        `,
      );
    });
  });

  const orWhereMethod = `orWhere${method[0].toUpperCase()}${method.slice(
    1,
  )}` as 'orWhereJsonSupersetOf';

  describe(orWhereMethod, () => {
    it('should handle value', () => {
      expectSql(
        User.where({ id: 1 })[orWhereMethod]('data', { a: 'b' }).toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1 OR "user"."data" ${sql} $2
        `,
        [1, { a: 'b' }],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: 1 })
          [orWhereMethod]('data', User.select('data').take())
          .toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1
             OR "user"."data" ${sql} (SELECT "user"."data" FROM "user" LIMIT $2)
        `,
        [1, 1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: 1 })
          [orWhereMethod]('data', raw(`'{"a":"b"}'`))
          .toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1 OR "user"."data" ${sql} '{"a":"b"}'
        `,
        [1],
      );
    });
  });

  const whereNotMethod = `whereNot${method[0].toUpperCase()}${method.slice(
    1,
  )}` as 'whereNotJsonSupersetOf';

  describe(whereNotMethod, () => {
    it('should handle value', () => {
      expectSql(
        User[whereNotMethod]('data', { a: 'b' }).toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE NOT "user"."data" ${sql} $1
        `,
        [{ a: 'b' }],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User[whereNotMethod]('data', User.select('data').take()).toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE NOT "user"."data" ${sql} (SELECT "user"."data" FROM "user" LIMIT $1)
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User[whereNotMethod]('data', raw(`'{"a":"b"}'`)).toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE NOT "user"."data" ${sql} '{"a":"b"}'
        `,
      );
    });
  });

  const orWhereNotMethod = `orWhereNot${method[0].toUpperCase()}${method.slice(
    1,
  )}` as 'orWhereNotJsonSupersetOf';

  describe(orWhereNotMethod, () => {
    it('should handle value', () => {
      expectSql(
        User.where({ id: 1 })[orWhereNotMethod]('data', { a: 'b' }).toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1 OR NOT "user"."data" ${sql} $2
        `,
        [1, { a: 'b' }],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: 1 })
          [orWhereNotMethod]('data', User.select('data').take())
          .toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1
             OR NOT "user"."data" ${sql} (SELECT "user"."data" FROM "user" LIMIT $2)
        `,
        [1, 1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: 1 })
          [orWhereNotMethod]('data', raw(`'{"a":"b"}'`))
          .toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1 OR NOT "user"."data" ${sql} '{"a":"b"}'
        `,
        [1],
      );
    });
  });
});
