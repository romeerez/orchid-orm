import { expectSql, testDb } from 'test-utils';

const User = testDb(
  'user',
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    password: t.string(),
    active: t.boolean().nullable(),
    deletedAt: t.timestamp().nullable(),
  }),
  undefined,
  {
    scopes: {
      default: (q) => q.where({ deletedAt: null }).orWhere({ active: true }),
      someScope: (q) => q.where({ name: 'a' }).orWhere({ name: 'b' }),
    },
  },
);

describe('ScopeMethods', () => {
  describe('scope', () => {
    it('should apply where, whereOr, and order', () => {
      const q = User.unscope('default').scope('someScope');

      expectSql(
        q.toSQL(),
        `
          SELECT * FROM "user"
          WHERE (
             "user"."name" = $1 OR "user"."name" = $2
          )
        `,
        ['a', 'b'],
      );
    });

    it('should not be available if not set for the table', () => {
      // @ts-expect-error this scope was not defined
      expect(() => User.scope('unknown')).toThrow();
    });

    it('should set a type flag to allow updating and deleting', () => {
      const q = User.unscope('default');

      // @ts-expect-error updating without conditions is not allowed
      expect(() => q.update()).toThrow();
      // @ts-expect-error deleting without conditions is not allowed
      expect(() => q.delete()).toThrow();

      q.scope('someScope').update({});
      q.scope('someScope').delete();
    });

    it('should use default scope by default', () => {
      expectSql(
        User.toSQL(),
        `
          SELECT * FROM "user"
          WHERE (
            "user"."deletedAt" IS NULL OR "user"."active" = $1
          )
        `,
        [true],
      );
    });

    it('should be applied to the query correctly when the query uses `orWhere`', () => {
      const q = User.where({ id: 1 }).orWhere({ id: 2 });

      expectSql(
        q.toSQL(),
        `
          SELECT * FROM "user"
          WHERE (
            "user"."id" = $1 OR "user"."id" = $2
          ) AND (
            "user"."deletedAt" IS NULL OR "user"."active" = $3
          )
        `,
        [1, 2, true],
      );
    });
  });

  describe('unscope', () => {
    it('should remove where, orWhere, order that were previously set by the scope', () => {
      const q = User.where({ id: 1 })
        .orWhere({ id: 2 })
        .scope('someScope')
        .where({ id: 3 })
        .orWhere({ id: 4 })
        .unscope('someScope');

      expectSql(
        q.toSQL(),
        `
          SELECT * FROM "user"
          WHERE (
            "user"."id" = $1
            AND "user"."id" = $2
            OR "user"."id" = $3
            OR "user"."id" = $4
          ) AND (
            "user"."deletedAt" IS NULL
            OR "user"."active" = $5
          )
        `,
        [1, 3, 2, 4, true],
      );
    });

    it('should disable the default scope', () => {
      expectSql(
        User.unscope('default').toSQL(),
        `
          SELECT * FROM "user"
        `,
      );
    });

    it('should not mutate query data', () => {
      const q = User.all();
      q.unscope('default').scope('someScope');
      expect(q.q.scopes && Object.keys(q.q.scopes)).toEqual(['default']);
    });
  });
});
