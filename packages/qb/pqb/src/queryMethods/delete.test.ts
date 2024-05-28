import {
  expectQueryNotMutated,
  Profile,
  Snake,
  snakeSelectAll,
  User,
  userData,
  UserRecord,
} from '../test-utils/test-utils';
import { assertType, expectSql, useTestDatabase } from 'test-utils';

describe('delete', () => {
  useTestDatabase();

  it('should prevent deleting all with TS error', () => {
    // @ts-expect-error update should have where condition or forceAll flag
    expect(() => User.delete()).toThrow('Dangerous delete without conditions');
  });

  it('should allow deleting all records after using `all` method', () => {
    User.all().delete();
  });

  it('should delete records, returning value', async () => {
    const id = await User.get('id').create(userData);
    const q = User.all();

    const query = q.find(id).get('id').delete();
    expectSql(
      query.toSQL(),
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

  it('should delete records, returning named column', async () => {
    const query = Snake.findBy({ snakeName: 'name' }).get('snakeName').delete();
    expectSql(
      query.toSQL(),
      `
        DELETE FROM "snake" WHERE "snake"."snake_name" = $1
        RETURNING "snake"."snake_name" "snakeName"
      `,
      ['name'],
    );
  });

  it('should delete records, returning deleted rows count', async () => {
    const rowsCount = 3;

    for (let i = 0; i < rowsCount; i++) {
      await User.create(userData);
    }

    const q = User.all();

    const query = q.where({ id: { gte: 1 } }).delete();
    expectSql(query.toSQL(), 'DELETE FROM "user" WHERE "user"."id" >= $1', [1]);

    const result = await query;
    expect(result).toBe(rowsCount);

    assertType<typeof result, number>();

    expectQueryNotMutated(q);
  });

  it('should delete records, returning all columns', () => {
    const q = User.all();

    const query = q.selectAll().where({ id: 1 }).delete();
    expectSql(
      query.toSQL(),
      `DELETE FROM "user" WHERE "user"."id" = $1 RETURNING *`,
      [1],
    );

    assertType<Awaited<typeof query>, UserRecord[]>();

    expectQueryNotMutated(q);
  });

  it('should delete records, returning all named columns', () => {
    const query = Snake.selectAll().all().delete();
    expectSql(
      query.toSQL(),
      `
        DELETE FROM "snake"
        RETURNING ${snakeSelectAll}
      `,
    );
  });

  it('should delete records, returning specified columns', () => {
    const q = User.all();

    const query = q.select('id', 'name').where({ id: 1 }).delete();
    expectSql(
      query.toSQL(),
      `DELETE FROM "user" WHERE "user"."id" = $1 RETURNING "user"."id", "user"."name"`,
      [1],
    );

    assertType<Awaited<typeof query>, { id: number; name: string }[]>();

    expectQueryNotMutated(q);
  });

  it('should delete records, returning specified named columns', () => {
    const query = Snake.select('snakeName', 'tailLength').all().delete();
    expectSql(
      query.toSQL(),
      `
        DELETE FROM "snake"
        RETURNING
          "snake"."snake_name" "snakeName",
          "snake"."tail_length" "tailLength"
      `,
    );
  });

  it('should support where and join statements', () => {
    const q = User.all();

    const query = q
      .selectAll()
      .where({ id: 1 })
      .join(Profile, 'userId', '=', 'id')
      .delete();

    expectSql(
      query.toSQL(),
      `
        DELETE FROM "user"
        USING "profile"
        WHERE "user"."id" = $1 AND "profile"."userId" = "user"."id"
        RETURNING "user".*
      `,
      [1],
    );

    assertType<Awaited<typeof query>, UserRecord[]>();

    expectQueryNotMutated(q);
  });

  it('should be supported in `WITH` expressions', () => {
    const q = User.with('a', User.find(1).select('name').delete())
      .with('b', (q) =>
        User.select('id').whereIn('name', q.from('a').pluck('name')).delete(),
      )
      .from('b');

    assertType<Awaited<typeof q>, { id: number }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "a" AS (
          DELETE FROM "user" WHERE "user"."id" = $1 RETURNING "user"."name"
        ), "b" AS (
          DELETE FROM "user"
          WHERE "user"."name" IN (SELECT "a"."name" FROM "a")
          RETURNING "user"."id"
        )
        SELECT * FROM "b"
      `,
      [1],
    );
  });

  it('should support implicit lateral join', () => {
    const q = User.selectAll()
      .where({ id: 1 })
      .join(Profile, (q) => q.on('userId', 'id').limit(5))
      .delete();

    expectSql(
      q.toSQL(),
      `
        DELETE FROM "user"
        USING LATERAL (SELECT * FROM "profile" WHERE "profile"."userId" = "user"."id" LIMIT $1) "profile"
        WHERE "user"."id" = $2
        RETURNING "user".*
      `,
      [5, 1],
    );

    assertType<Awaited<typeof q>, UserRecord[]>();
  });

  it('should support explicit lateral join', () => {
    const q = User.selectAll()
      .where({ id: 1 })
      .joinLateral(Profile, (q) => q.on('userId', 'id').limit(5))
      .delete();

    expectSql(
      q.toSQL(),
      `
        DELETE FROM "user"
        USING LATERAL (SELECT * FROM "profile" WHERE "profile"."userId" = "user"."id" LIMIT $1) "profile"
        WHERE "user"."id" = $2
        RETURNING "user".*
      `,
      [5, 1],
    );

    assertType<Awaited<typeof q>, UserRecord[]>();
  });

  it('should throw NotFoundError when no records to delete for a `one` query kind', async () => {
    const q = User.find(1).delete();

    await expect(q).rejects.toThrow('Record is not found');
  });
});
