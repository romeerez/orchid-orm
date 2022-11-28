import {
  assertType,
  expectQueryNotMutated,
  expectSql,
  Profile,
  User,
  userData,
  useTestDatabase,
} from '../test-utils/test-utils';
import { DeleteQueryData } from '../sql';

describe('delete', () => {
  useTestDatabase();

  it('should throw when updating without where condition', () => {
    // @ts-expect-error update should have where condition or forceAll flag
    expect(() => User.delete()).toThrow();
  });

  it('should run without where condition when forceAll flag provided', async () => {
    await expect(User.delete(true)).resolves.not.toThrow();
  });

  it('should be aliased as `del`', () => {
    const a = User.where({ id: 1 }).delete();
    const b = User.where({ id: 1 }).del();
    expect((a.query as DeleteQueryData).type).toBeTruthy();
    expect(a.query).toEqual(b.query);
  });

  it('should delete records, returning value', async () => {
    const id = await User.get('id').create(userData);
    const q = User.all();

    const query = q.find(id).get('id').delete();
    expectSql(
      query.toSql(),
      `
        DELETE FROM "user" WHERE "user"."id" = $1
        RETURNING "user"."id"
      `,
      [id],
    );

    const result = await query;
    expect(result).toBe(id);

    assertType<typeof result, number>();

    expectQueryNotMutated(q);
  });

  it('should delete records, returning deleted rows count', async () => {
    const rowsCount = 3;

    for (let i = 0; i < rowsCount; i++) {
      await User.create(userData);
    }

    const q = User.all();

    const query = q.where({ id: { gte: 1 } }).delete();
    expectSql(query.toSql(), 'DELETE FROM "user" WHERE "user"."id" >= $1', [1]);

    const result = await query;
    expect(result).toBe(rowsCount);

    assertType<typeof result, number>();

    expectQueryNotMutated(q);
  });

  it('should delete records, returning all columns', () => {
    const q = User.all();

    const query = q.selectAll().where({ id: 1 }).delete();
    expectSql(
      query.toSql(),
      `DELETE FROM "user" WHERE "user"."id" = $1 RETURNING *`,
      [1],
    );

    assertType<Awaited<typeof query>, typeof User['type'][]>();

    expectQueryNotMutated(q);
  });

  it('should delete records, returning specified columns', () => {
    const q = User.all();

    const query = q.select('id', 'name').where({ id: 1 }).delete();
    expectSql(
      query.toSql(),
      `DELETE FROM "user" WHERE "user"."id" = $1 RETURNING "user"."id", "user"."name"`,
      [1],
    );

    assertType<Awaited<typeof query>, { id: number; name: string }[]>();

    expectQueryNotMutated(q);
  });

  it('should support where and join statements', () => {
    const q = User.all();

    const query = q
      .selectAll()
      .where({ id: 1 })
      .join(Profile, 'userId', '=', 'id')
      .delete();

    expectSql(
      query.toSql(),
      `
        DELETE FROM "user"
        USING "profile"
        WHERE "user"."id" = $1 AND "profile"."userId" = "user"."id"
        RETURNING "user".*
      `,
      [1],
    );

    assertType<Awaited<typeof query>, typeof User['type'][]>();

    expectQueryNotMutated(q);
  });
});
