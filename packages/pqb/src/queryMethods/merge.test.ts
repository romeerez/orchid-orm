import { assertType, expectSql, User } from '../test-utils';

describe('merge queries', () => {
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
