import { assertType, expectSql, User } from '../test-utils';
import { QueryReturnType } from '../query';

describe('merge queries', () => {
  describe('select', () => {
    it('should use second select when no select', () => {
      const q = User.merge(User.select('id'));

      assertType<Awaited<typeof q>, { id: number }[]>();

      expectSql(q.toSql(), `SELECT "user"."id" FROM "user"`);
    });

    it('should merge selects when both have it', () => {
      const q = User.select('id').merge(User.select('name'));

      assertType<Awaited<typeof q>, { id: number; name: string }[]>();

      expectSql(q.toSql(), `SELECT "user"."id", "user"."name" FROM "user"`);
    });
  });

  describe('returnType', () => {
    it('should have default return type if none of the queries have it', () => {
      const q = User.merge(User);

      assertType<typeof q.returnType, QueryReturnType>();
    });

    it('should use left return type unless right has it', () => {
      const q = User.take().merge(User);

      assertType<typeof q.returnType, 'oneOrThrow'>();

      expectSql(q.toSql(), `SELECT * FROM "user" LIMIT $1`, [1]);
    });

    it('should prefer right return type', () => {
      const q = User.take().merge(User.all());

      assertType<typeof q.returnType, 'all'>();

      expectSql(q.toSql(), `SELECT * FROM "user"`);
    });
  });
});
