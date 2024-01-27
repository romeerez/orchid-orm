import { expectQueryNotMutated, Snake, User } from '../test-utils/test-utils';
import { expectSql, testDb } from 'test-utils';

['union', 'intersect', 'except'].forEach((what) => {
  const upper = what.toUpperCase();
  describe(what, () => {
    it(`should add ${what}`, () => {
      const q = User.all();
      let query = q.select('id');
      const snake = Snake.select({ id: 'tailLength' });
      query = query[what as 'union']([snake, testDb.sql`SELECT 1`]);
      query = query[
        (what + 'All') as 'unionAll' | 'intersectAll' | 'exceptAll'
      ]([testDb.sql`SELECT 2`], true);

      const wrapped = query.wrap(User.select('id'));

      expectSql(
        wrapped.toSQL(),
        `
          SELECT "t"."id" FROM (
            SELECT "user"."id" FROM "user"
            ${upper}
            SELECT "snake"."tail_length" AS "id" FROM "snake"
            ${upper}
            SELECT 1
            ${upper} ALL
            (SELECT 2)
          ) AS "t"
        `,
      );

      expectQueryNotMutated(q);
    });
  });
});
