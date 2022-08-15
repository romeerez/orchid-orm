import {
  AssertEqual,
  expectQueryNotMutated,
  expectSql,
  Profile,
  User,
} from '../test-utils';
import { DeleteQueryData } from '../sql';

describe('delete', () => {
  it('should be aliased as `del`', () => {
    const a = User.delete();
    const b = User.del();
    expect((a.query as DeleteQueryData).type).toBeTruthy();
    expect(a.query).toEqual(b.query);
  });

  it('should delete records, returning void', () => {
    const q = User.all();

    const query = q.delete();
    expectSql(query.toSql(), 'DELETE FROM "user"');

    const eq: AssertEqual<Awaited<typeof query>, void> = true;
    expect(eq).toBe(true);

    expectQueryNotMutated(q);
  });

  it('should delete records, returning all columns', () => {
    const q = User.all();

    const query = q.delete('*');
    expectSql(query.toSql(), `DELETE FROM "user" RETURNING *`);

    const eq: AssertEqual<Awaited<typeof query>, typeof User['type'][]> = true;
    expect(eq).toBe(true);

    expectQueryNotMutated(q);
  });

  it('should delete records, returning specified columns', () => {
    const q = User.all();

    const query = q.delete(['id', 'name']);
    expectSql(
      query.toSql(),
      `DELETE FROM "user" RETURNING "user"."id", "user"."name"`,
    );

    const eq: AssertEqual<
      Awaited<typeof query>,
      { id: number; name: string }[]
    > = true;
    expect(eq).toBe(true);

    expectQueryNotMutated(q);
  });

  it('should support where and join statements', () => {
    const q = User.all();

    const query = q
      .delete('*')
      .where({ id: 1 })
      .join(Profile, 'userId', '=', 'id');

    expectSql(
      query.toSql(),
      `
        DELETE FROM "user"
        USING "profile"
        WHERE "user"."id" = $1 AND "profile"."userId" = "user"."id"
        RETURNING *
      `,
      [1],
    );

    const eq: AssertEqual<Awaited<typeof query>, typeof User['type'][]> = true;
    expect(eq).toBe(true);

    expectQueryNotMutated(q);
  });
});
