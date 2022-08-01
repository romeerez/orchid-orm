import { Chat, expectQueryNotMutated, line, User } from '../test-utils';
import { raw } from '../common';

['union', 'intersect', 'except'].forEach((what) => {
  const upper = what.toUpperCase();
  describe(what, () => {
    it(`adds ${what}`, () => {
      const q = User.all();
      let query = q.select('id');
      query = query[what as 'union']([Chat.select('id'), raw('SELECT 1')]);
      query = query[
        (what + 'All') as 'unionAll' | 'intersectAll' | 'exceptAll'
      ]([raw('SELECT 2')], true);

      const wrapped = query.wrap(User.select('id'));

      expect(wrapped.toSql()).toBe(
        line(`
        SELECT "t"."id" FROM (
          SELECT "user"."id" FROM "user"
          ${upper}
          SELECT "chat"."id" FROM "chat"
          ${upper}
          SELECT 1
          ${upper} ALL
          (SELECT 2)
        ) AS "t"
      `),
      );

      expectQueryNotMutated(q);
    });

    it('has modifier', () => {
      const q = User.select('id');
      q[`_${what}` as '_union']([raw('SELECT 1')]);
      expect(q.toSql()).toBe(
        line(`
          SELECT "user"."id" FROM "user"
          ${upper}
          SELECT 1
        `),
      );
      q[`_${what}All` as '_unionAll']([raw('SELECT 2')], true);
      expect(q.toSql()).toBe(
        line(`
        SELECT "user"."id" FROM "user"
        ${upper}
        SELECT 1
        ${upper} ALL
        (SELECT 2)
      `),
      );
    });
  });
});
