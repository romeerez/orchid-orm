import { expectSql, testDb } from 'test-utils';
import { User } from '../test-utils/test-utils';

const table = testDb(
  'table',
  (t) => ({
    id: t.identity().primaryKey(),
    active: t.boolean(),
  }),
  {
    scopes: {
      someScope: (q) => q.where({ active: true }).orWhere({ id: 1 }),
    },
  },
);

const tableWithDefaultScope = testDb(
  'table',
  (t) => ({
    id: t.identity().primaryKey(),
    active: t.boolean(),
  }),
  {
    scopes: {
      default: (q) => q.where({ active: true }).orWhere({ id: 1 }),
    },
  },
);

describe('ScopeMethods', () => {
  describe('scope', () => {
    it('should apply where, whereOr, and order', () => {
      const q = table.scope('someScope');

      expectSql(
        q.toSQL(),
        `
          SELECT * FROM "table"
          WHERE "table"."active" = $1
             OR "table"."id" = $2
        `,
        [true, 1],
      );
    });

    it('should not be available if not set for the table', () => {
      // @ts-expect-error this scope was not defined
      expect(() => User.scope('someScope')).toThrow();
    });

    it('should set a type flag to allow updating and deleting', () => {
      // @ts-expect-error updating without conditions is not allowed
      expect(() => table.update()).toThrow();
      // @ts-expect-error deleting without conditions is not allowed
      expect(() => table.delete()).toThrow();

      table.scope('someScope').update({});
      table.scope('someScope').delete();
    });

    it('should use default scope by default', () => {
      expectSql(
        tableWithDefaultScope.toSQL(),
        `
          SELECT * FROM "table"
          WHERE "table"."active" = $1
             OR "table"."id" = $2
        `,
        [true, 1],
      );
    });
  });

  describe('unScope', () => {
    it('should remove where, orWhere, order that were previously set by the scope', () => {
      const q = table
        .where({ id: 2 })
        .orWhere({ id: 3 })
        .order({ active: 'ASC' })
        .scope('someScope')
        .where({ id: 4 })
        .orWhere({ id: 5 })
        .order({ active: 'DESC' })
        .unScope('someScope');

      expectSql(
        q.toSQL(),
        `
          SELECT * FROM "table"
          WHERE "table"."id" = $1
            AND "table"."id" = $2
             OR "table"."id" = $3
             OR "table"."id" = $4
          ORDER BY
            "table"."active" ASC, "table"."active" DESC
        `,
        [2, 4, 3, 5],
      );
    });

    it('should disable the default scope', async () => {
      expectSql(
        tableWithDefaultScope.unScope('default').toSQL(),
        `
          SELECT * FROM "table"
        `,
      );
    });
  });
});
