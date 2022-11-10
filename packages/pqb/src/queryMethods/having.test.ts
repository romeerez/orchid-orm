import { db, expectQueryNotMutated, expectSql, User } from '../test-utils';

describe('having', () => {
  it('should support { count: value } object', () => {
    const q = User.all();

    expectSql(
      q.having({ count: 5 }).toSql(),
      `
        SELECT *
        FROM "user"
        HAVING count(*) = 5
      `,
    );

    expectQueryNotMutated(q);
  });

  it('should support simple object as argument', () => {
    const q = User.all();

    expectSql(
      q
        .having({
          count: {
            id: 5,
          },
        })
        .toSql(),
      `
        SELECT *
        FROM "user"
        HAVING count("user"."id") = $1
      `,
      [5],
    );

    expectQueryNotMutated(q);
  });

  it('should support column operators', () => {
    const q = User.all();

    expectSql(
      q
        .having({
          sum: {
            id: {
              gt: 5,
              lt: 20,
            },
          },
        })
        .toSql(),
      `
        SELECT *
        FROM "user"
        HAVING sum("user"."id") > $1 AND sum("user"."id") < $2
      `,
      [5, 20],
    );

    expectQueryNotMutated(q);
  });

  it('should support distinct option', () => {
    const q = User.all();

    expectSql(
      q
        .having({
          count: {
            id: {
              equals: 10,
              distinct: true,
            },
          },
        })
        .toSql(),
      `
        SELECT *
        FROM "user"
        HAVING count(DISTINCT "user"."id") = $1
      `,
      [10],
    );

    expectQueryNotMutated(q);
  });

  it('should support order option', () => {
    const q = User.all();

    expectSql(
      q
        .having({
          count: {
            id: {
              equals: 10,
              order: {
                name: 'ASC',
              },
            },
          },
        })
        .toSql(),
      `
        SELECT *
        FROM "user"
        HAVING count("user"."id" ORDER BY "user"."name" ASC) = $1
      `,
      [10],
    );

    expectQueryNotMutated(q);
  });

  it('should support filter and filterOr option', () => {
    const q = User.all();

    expectSql(
      q
        .having({
          count: {
            id: {
              equals: 10,
              filter: {
                id: {
                  lt: 10,
                },
              },
              filterOr: [
                {
                  id: {
                    equals: 15,
                  },
                },
                {
                  id: {
                    gt: 20,
                  },
                },
              ],
            },
          },
        })
        .toSql(),
      `
        SELECT *
        FROM "user"
        HAVING count("user"."id")
          FILTER (
            WHERE "user"."id" < $1 OR "user"."id" = $2 OR "user"."id" > $3
          ) = $4
      `,
      [10, 15, 20, 10],
    );

    expectQueryNotMutated(q);
  });

  it('should support withinGroup option', () => {
    const q = User.all();

    expectSql(
      q
        .having({
          count: {
            id: {
              equals: 10,
              withinGroup: true,
              order: { name: 'ASC' },
            },
          },
        })
        .toSql(),
      `
        SELECT *
        FROM "user"
        HAVING count("user"."id") WITHIN GROUP (ORDER BY "user"."name" ASC) = $1
      `,
      [10],
    );

    expectQueryNotMutated(q);
  });

  it('adds having condition with raw sql', () => {
    const q = User.clone();

    const expectedSql = `
      SELECT *
      FROM "user"
      HAVING count(*) = 1 AND sum(id) = 2
    `;

    expectSql(
      q.having(db.raw('count(*) = 1'), db.raw('sum(id) = 2')).toSql(),
      expectedSql,
    );
    expectQueryNotMutated(q);

    q._having(db.raw('count(*) = 1'), db.raw('sum(id) = 2'));
    expectSql(q.toSql({ clearCache: true }), expectedSql);
  });

  describe('havingOr', () => {
    it('should join conditions with or', () => {
      const q = User.all();
      expectSql(
        q.havingOr({ count: 1 }, { count: 2 }).toSql(),
        `
        SELECT * FROM "user"
        HAVING count(*) = 1 OR count(*) = 2
      `,
      );
      expectQueryNotMutated(q);
    });

    it('should handle sub queries', () => {
      const q = User.all();
      expectSql(
        q
          .havingOr({ count: 1 }, User.having({ count: 2 }, { count: 3 }))
          .toSql(),
        `
        SELECT * FROM "user"
        HAVING count(*) = 1 OR (count(*) = 2 AND count(*) = 3)
      `,
      );
      expectQueryNotMutated(q);
    });

    it('should accept raw sql', () => {
      const q = User.all();
      expectSql(
        q
          .havingOr(db.raw('count(*) = 1 + 2'), db.raw('count(*) = 2 + 3'))
          .toSql(),
        `
        SELECT * FROM "user"
        HAVING count(*) = 1 + 2 OR count(*) = 2 + 3
      `,
      );
      expectQueryNotMutated(q);
    });
  });
});
