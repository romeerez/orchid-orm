import { expectSql, User } from '../test-utils';
import { raw } from '../common';
import { Sql } from '../sql';
import { Query } from '../query';

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

export const testWhere = (
  buildSql: (cb: (q: Query) => Query) => Sql,
  startSql: string,
) => {
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
            NOT "user"."id" = $1 AND NOT "user"."picture" IS NULL
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

    it('should handle sub query builder', () => {
      expectSql(
        buildSql((q) =>
          q.whereNot((q) => q.whereIn('id', [1, 2, 3]).whereExists(User.all())),
        ),
        `
          ${startSql}
          NOT "user"."id" IN ($1, $2, $3)
          AND NOT EXISTS (SELECT 1 FROM "user" LIMIT $4)
        `,
        [1, 2, 3, 1],
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
        buildSql((q) => q.orNot({ id: raw('1 + 2') }, { name: raw('2 + 3') })),
        `
            ${startSql}
            NOT "user"."id" = 1 + 2 OR NOT "user"."name" = 2 + 3
          `,
      );
    });
  });

  describe('whereIn', () => {
    it('should handle (column, array)', () => {
      expectSql(
        buildSql((q) => q.whereIn('id', [1, 2, 3])),
        `
            ${startSql}
            "user"."id" IN ($1, $2, $3)
          `,
        [1, 2, 3],
      );
    });

    it('should handle object of columns and arrays', () => {
      expectSql(
        buildSql((q) => q.whereIn({ id: [1, 2, 3], name: ['a', 'b', 'c'] })),
        `
            ${startSql}
            "user"."id" IN ($1, $2, $3)
              AND "user"."name" IN ($4, $5, $6)
          `,
        [1, 2, 3, 'a', 'b', 'c'],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        buildSql((q) => q.whereIn('id', raw('(1, 2, 3)'))),
        `
            ${startSql}
            "user"."id" IN (1, 2, 3)
          `,
      );

      expectSql(
        buildSql((q) =>
          q.whereIn({ id: raw('(1, 2, 3)'), name: raw(`('a', 'b', 'c')`) }),
        ),
        `
            ${startSql}
            "user"."id" IN (1, 2, 3)
              AND "user"."name" IN ('a', 'b', 'c')
          `,
      );
    });

    it('should handle sub query', () => {
      expectSql(
        buildSql((q) => q.whereIn('id', User.select('id'))),
        `
            ${startSql}
            "user"."id" IN (SELECT "user"."id" FROM "user")
          `,
      );

      expectSql(
        buildSql((q) =>
          q.whereIn({ id: User.select('id'), name: User.select('name') }),
        ),
        `
            ${startSql}
            "user"."id" IN (SELECT "user"."id" FROM "user")
              AND "user"."name" IN (SELECT "user"."name" FROM "user")
          `,
      );
    });

    describe('tuple', () => {
      it('should handle values', () => {
        expectSql(
          buildSql((q) =>
            q.whereIn(
              ['id', 'name'],
              [
                [1, 'a'],
                [2, 'b'],
              ],
            ),
          ),
          `
              ${startSql}
              ("user"."id", "user"."name") IN (($1, $2), ($3, $4))
            `,
          [1, 'a', 2, 'b'],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          buildSql((q) =>
            q.whereIn(['id', 'name'], raw(`((1, 'a'), (2, 'b'))`)),
          ),
          `
              ${startSql}
              ("user"."id", "user"."name") IN ((1, 'a'), (2, 'b'))
            `,
        );
      });

      it('should handle sub query', () => {
        expectSql(
          buildSql((q) => q.whereIn(['id', 'name'], User.select('id', 'name'))),
          `
              ${startSql}
              ("user"."id", "user"."name")
                 IN (SELECT "user"."id", "user"."name" FROM "user")
            `,
        );
      });
    });
  });

  describe('orWhereIn', () => {
    it('should handle (column, array)', () => {
      expectSql(
        buildSql((q) => q.where({ id: 1 }).orWhereIn('id', [1, 2, 3])),
        `
            ${startSql}
            "user"."id" = $1 OR "user"."id" IN ($2, $3, $4)
          `,
        [1, 1, 2, 3],
      );
    });

    it('should handle object of columns and arrays', () => {
      expectSql(
        buildSql((q) =>
          q
            .where({ id: 1 })
            .orWhereIn({ id: [1, 2, 3], name: ['a', 'b', 'c'] }),
        ),
        `
            ${startSql}
            "user"."id" = $1
              OR "user"."id" IN ($2, $3, $4) AND "user"."name" IN ($5, $6, $7)
          `,
        [1, 1, 2, 3, 'a', 'b', 'c'],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        buildSql((q) => q.where({ id: 1 }).orWhereIn('id', raw('(1, 2, 3)'))),
        `
            ${startSql}
            "user"."id" = $1 OR "user"."id" IN (1, 2, 3)
          `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({ id: 1 }).orWhereIn({
            id: raw('(1, 2, 3)'),
            name: raw(`('a', 'b', 'c')`),
          }),
        ),
        `
            ${startSql}
            "user"."id" = $1
               OR "user"."id" IN (1, 2, 3)
              AND "user"."name" IN ('a', 'b', 'c')
          `,
        [1],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        buildSql((q) => q.where({ id: 1 }).orWhereIn('id', User.select('id'))),
        `
            ${startSql}
            "user"."id" = $1
               OR "user"."id" IN (SELECT "user"."id" FROM "user")
          `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q
            .where({ id: 1 })
            .orWhereIn({ id: User.select('id'), name: User.select('name') }),
        ),
        `
            ${startSql}
            "user"."id" = $1
               OR "user"."id" IN (SELECT "user"."id" FROM "user")
              AND "user"."name" IN (SELECT "user"."name" FROM "user")
          `,
        [1],
      );
    });

    describe('tuple', () => {
      it('should handle values', () => {
        expectSql(
          buildSql((q) =>
            q.where({ id: 1 }).orWhereIn(
              ['id', 'name'],
              [
                [1, 'a'],
                [2, 'b'],
              ],
            ),
          ),
          `
              ${startSql}
              "user"."id" = $1
                 OR ("user"."id", "user"."name") IN (($2, $3), ($4, $5))
            `,
          [1, 1, 'a', 2, 'b'],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          buildSql((q) =>
            q
              .where({ id: 1 })
              .orWhereIn(['id', 'name'], raw(`((1, 'a'), (2, 'b'))`)),
          ),
          `
              ${startSql}
              "user"."id" = $1
                 OR ("user"."id", "user"."name") IN ((1, 'a'), (2, 'b'))
            `,
          [1],
        );
      });

      it('should handle sub query', () => {
        expectSql(
          buildSql((q) =>
            q
              .where({ id: 1 })
              .orWhereIn(['id', 'name'], User.select('id', 'name')),
          ),
          `
              ${startSql}
              "user"."id" = $1
                 OR ("user"."id", "user"."name")
                 IN (SELECT "user"."id", "user"."name" FROM "user")
            `,
          [1],
        );
      });
    });
  });

  describe('whereNotIn', () => {
    it('should handle (column, array)', () => {
      expectSql(
        buildSql((q) => q.whereNotIn('id', [1, 2, 3])),
        `
            ${startSql}
            "user"."id" NOT IN ($1, $2, $3)
          `,
        [1, 2, 3],
      );
    });

    it('should handle object of columns and arrays', () => {
      expectSql(
        buildSql((q) => q.whereNotIn({ id: [1, 2, 3], name: ['a', 'b', 'c'] })),
        `
            ${startSql}
            "user"."id" NOT IN ($1, $2, $3)
              AND "user"."name" NOT IN ($4, $5, $6)
          `,
        [1, 2, 3, 'a', 'b', 'c'],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        buildSql((q) => q.whereNotIn('id', raw('(1, 2, 3)'))),
        `
            ${startSql}
            "user"."id" NOT IN (1, 2, 3)
          `,
      );

      expectSql(
        buildSql((q) =>
          q.whereNotIn({
            id: raw('(1, 2, 3)'),
            name: raw(`('a', 'b', 'c')`),
          }),
        ),
        `
            ${startSql}
            "user"."id" NOT IN (1, 2, 3)
              AND "user"."name" NOT IN ('a', 'b', 'c')
          `,
      );
    });

    it('should handle sub query', () => {
      expectSql(
        buildSql((q) => q.whereNotIn('id', User.select('id'))),
        `
            ${startSql}
            "user"."id" NOT IN (SELECT "user"."id" FROM "user")
          `,
      );

      expectSql(
        buildSql((q) =>
          q.whereNotIn({ id: User.select('id'), name: User.select('name') }),
        ),
        `
            ${startSql}
            "user"."id" NOT IN (SELECT "user"."id" FROM "user")
              AND "user"."name" NOT IN (SELECT "user"."name" FROM "user")
          `,
      );
    });

    describe('tuple', () => {
      it('should handle values', () => {
        expectSql(
          buildSql((q) =>
            q.whereNotIn(
              ['id', 'name'],
              [
                [1, 'a'],
                [2, 'b'],
              ],
            ),
          ),
          `
              ${startSql}
              ("user"."id", "user"."name") NOT IN (($1, $2), ($3, $4))
            `,
          [1, 'a', 2, 'b'],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          buildSql((q) =>
            q.whereNotIn(['id', 'name'], raw(`((1, 'a'), (2, 'b'))`)),
          ),
          `
            ${startSql}
            ("user"."id", "user"."name") NOT IN ((1, 'a'), (2, 'b'))
          `,
        );
      });

      it('should handle sub query', () => {
        expectSql(
          buildSql((q) =>
            q.whereNotIn(['id', 'name'], User.select('id', 'name')),
          ),
          `
            ${startSql}
            ("user"."id", "user"."name")
               NOT IN (SELECT "user"."id", "user"."name" FROM "user")
          `,
        );
      });
    });
  });

  describe('orWhereNotIn', () => {
    it('should handle (column, array)', () => {
      expectSql(
        buildSql((q) => q.where({ id: 1 }).orWhereNotIn('id', [1, 2, 3])),
        `
            ${startSql}
            "user"."id" = $1 OR "user"."id" NOT IN ($2, $3, $4)
          `,
        [1, 1, 2, 3],
      );
    });

    it('should handle object of columns and arrays', () => {
      expectSql(
        buildSql((q) =>
          q
            .where({ id: 1 })
            .orWhereNotIn({ id: [1, 2, 3], name: ['a', 'b', 'c'] }),
        ),
        `
            ${startSql}
            "user"."id" = $1
              OR "user"."id" NOT IN ($2, $3, $4) AND "user"."name" NOT IN ($5, $6, $7)
          `,
        [1, 1, 2, 3, 'a', 'b', 'c'],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        buildSql((q) =>
          q.where({ id: 1 }).orWhereNotIn('id', raw('(1, 2, 3)')),
        ),
        `
            ${startSql}
            "user"."id" = $1 OR "user"."id" NOT IN (1, 2, 3)
          `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({ id: 1 }).orWhereNotIn({
            id: raw('(1, 2, 3)'),
            name: raw(`('a', 'b', 'c')`),
          }),
        ),
        `
            ${startSql}
            "user"."id" = $1
               OR "user"."id" NOT IN (1, 2, 3)
              AND "user"."name" NOT IN ('a', 'b', 'c')
          `,
        [1],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        buildSql((q) =>
          q.where({ id: 1 }).orWhereNotIn('id', User.select('id')),
        ),
        `
            ${startSql}
            "user"."id" = $1
               OR "user"."id" NOT IN (SELECT "user"."id" FROM "user")
          `,
        [1],
      );

      expectSql(
        buildSql((q) =>
          q.where({ id: 1 }).orWhereNotIn({
            id: User.select('id'),
            name: User.select('name'),
          }),
        ),
        `
            ${startSql}
            "user"."id" = $1
               OR "user"."id" NOT IN (SELECT "user"."id" FROM "user")
              AND "user"."name" NOT IN (SELECT "user"."name" FROM "user")
          `,
        [1],
      );
    });

    describe('tuple', () => {
      it('should handle values', () => {
        expectSql(
          buildSql((q) =>
            q.where({ id: 1 }).orWhereNotIn(
              ['id', 'name'],
              [
                [1, 'a'],
                [2, 'b'],
              ],
            ),
          ),
          `
              ${startSql}
              "user"."id" = $1
                 OR ("user"."id", "user"."name") NOT IN (($2, $3), ($4, $5))
            `,
          [1, 1, 'a', 2, 'b'],
        );
      });

      it('should handle raw query', () => {
        expectSql(
          buildSql((q) =>
            q
              .where({ id: 1 })
              .orWhereNotIn(['id', 'name'], raw(`((1, 'a'), (2, 'b'))`)),
          ),
          `
              ${startSql}
              "user"."id" = $1
                 OR ("user"."id", "user"."name") NOT IN ((1, 'a'), (2, 'b'))
            `,
          [1],
        );
      });

      it('should handle sub query', () => {
        expectSql(
          buildSql((q) =>
            q
              .where({ id: 1 })
              .orWhereNotIn(['id', 'name'], User.select('id', 'name')),
          ),
          `
              ${startSql}
              "user"."id" = $1
                 OR ("user"."id", "user"."name")
                 NOT IN (SELECT "user"."id", "user"."name" FROM "user")
            `,
          [1],
        );
      });
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
};

const buildSql = (cb: (q: Query) => Query) => {
  return cb(User.all()).toSql();
};

const startSql = `SELECT "user".* FROM "user" WHERE`;

testWhere(buildSql, startSql);
