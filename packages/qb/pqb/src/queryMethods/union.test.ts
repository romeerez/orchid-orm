import {
  db,
  expectQueryNotMutated,
  expectSql,
  Snake,
  User,
} from '../test-utils/test-utils';

['union', 'intersect', 'except'].forEach((what) => {
  const upper = what.toUpperCase();
  describe(what, () => {
    it(`should add ${what}`, () => {
      const q = User.all();
      let query = q.select('id');
      const snake = Snake.select({ id: 'tailLength' });
      query = query[what as 'union']([snake, db.raw('SELECT 1')]);
      query = query[
        (what + 'All') as 'unionAll' | 'intersectAll' | 'exceptAll'
      ]([db.raw('SELECT 2')], true);

      const wrapped = query.wrap(User.select('id'));

      expectSql(
        wrapped.toSql(),
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

    it('has modifier', () => {
      const q = User.select('id');
      q[`_${what}` as '_union']([db.raw('SELECT 1')]);
      expectSql(
        q.toSql(),
        `
          SELECT "user"."id" FROM "user"
          ${upper}
          SELECT 1
        `,
      );
      q[`_${what}All` as '_unionAll']([db.raw('SELECT 2')], true);
      expectSql(
        q.toSql({ clearCache: true }),
        `
        SELECT "user"."id" FROM "user"
        ${upper}
        SELECT 1
        ${upper} ALL
        (SELECT 2)
      `,
      );
    });
  });
});
