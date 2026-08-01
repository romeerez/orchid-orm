import { expectSql, db, UserSelectAll } from 'test-utils';

describe('having', () => {
  it('should support simple object as an argument', () => {
    db.user.count().equals(5);
    const q = db.user.having((q) => q.count().equals(5));

    expectSql(
      q.toSQL(),
      `
        SELECT ${UserSelectAll}
        FROM "schema"."user" "User"
        HAVING count(*) = $1
      `,
      [5],
    );
  });

  it('should handle multiple expressions', () => {
    const q = db.user.having(
      (q) => q.sum('Id').gt(5),
      (q) => q.avg('Id').lt(20),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT ${UserSelectAll}
        FROM "schema"."user" "User"
        HAVING sum("User"."id") > $1 AND avg("User"."id") < $2
      `,
      [5, 20],
    );
  });

  it('should support `and`', () => {
    const q = db.user.having((q) => q.min('Id').gt(1).and(q.max('Id').lt(10)));

    expectSql(
      q.toSQL(),
      `
        SELECT ${UserSelectAll}
        FROM "schema"."user" "User"
        HAVING min("User"."id") > $1 AND max("User"."id") < $2
      `,
      [1, 10],
    );
  });

  it('should support `or`', () => {
    const q = db.user.having((q) =>
      q
        .min('Id')
        .gt(1)
        .and(q.max('Id').lt(10))
        .or(q.sum('Id').gte(2).and(q.avg('Id').lte(9))),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT ${UserSelectAll}
        FROM "schema"."user" "User"
        HAVING (min("User"."id") > $1 AND max("User"."id") < $2)
            OR (sum("User"."id") >= $3 AND avg("User"."id") <= $4)
      `,
      [1, 10, 2, 9],
    );
  });
});

describe('havingSql', () => {
  it('should support SQL template literal', () => {
    const q = db.user.havingSql`count(*) = ${5}`;

    expectSql(
      q.toSQL(),
      `
        SELECT ${UserSelectAll}
        FROM "schema"."user" "User"
        HAVING count(*) = $1
      `,
      [5],
    );
  });
});
