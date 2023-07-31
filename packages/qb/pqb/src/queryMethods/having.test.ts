import { expectSql } from 'test-utils';
import { User } from '../test-utils/test-utils';

describe('having', () => {
  it('should support SQL template literal', () => {
    const q = User.having`count(*) = ${5}`;

    expectSql(
      q.toSQL(),
      `
        SELECT *
        FROM "user"
        HAVING count(*) = $1
      `,
      [5],
    );
  });

  it('should support simple object as an argument', () => {
    const q = User.having((q) => q.count().equals(5));

    expectSql(
      q.toSQL(),
      `
        SELECT *
        FROM "user"
        HAVING count(*) = $1
      `,
      [5],
    );
  });

  it('should handle multiple expressions', () => {
    const q = User.having(
      (q) => q.sum('id').gt(5),
      (q) => q.avg('id').lt(20),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT *
        FROM "user"
        HAVING sum("user"."id") > $1 AND avg("user"."id") < $2
      `,
      [5, 20],
    );
  });

  it('should support `and`', () => {
    const q = User.having((q) => q.min('id').gt(1).and(q.max('id').lt(10)));

    expectSql(
      q.toSQL(),
      `
        SELECT *
        FROM "user"
        HAVING min("user"."id") > $1 AND max("user"."id") < $2
      `,
      [1, 10],
    );
  });

  it('should support `or`', () => {
    const q = User.having((q) =>
      q
        .min('id')
        .gt(1)
        .and(q.max('id').lt(10))
        .or(q.sum('id').gte(2).and(q.avg('id').lte(9))),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT *
        FROM "user"
        HAVING (min("user"."id") > $1 AND max("user"."id") < $2)
            OR (sum("user"."id") >= $3 AND avg("user"."id") <= $4)
      `,
      [1, 10, 2, 9],
    );
  });
});
