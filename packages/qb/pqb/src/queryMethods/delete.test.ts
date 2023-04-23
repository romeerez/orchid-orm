import {
  expectQueryNotMutated,
  Profile,
  Snake,
  snakeSelectAll,
  User,
  userData,
} from '../test-utils/test-utils';
import { DeleteQueryData } from '../sql';
import { assertType, expectSql, useTestDatabase } from 'test-utils';

describe('delete', () => {
  useTestDatabase();

  it('should prevent deleting all with TS error', () => {
    // @ts-expect-error update should have where condition or forceAll flag
    User.delete();
  });

  it('should allow deleting all with empty where', () => {
    User.where().delete();
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

  it('should delete records, returning named column', async () => {
    const query = Snake.findBy({ snakeName: 'name' }).get('snakeName').delete();
    expectSql(
      query.toSql(),
      `
        DELETE FROM "snake" WHERE "snake"."snake_name" = $1
        RETURNING "snake"."snake_name" AS "snakeName"
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

    assertType<Awaited<typeof query>, (typeof User)['type'][]>();

    expectQueryNotMutated(q);
  });

  it('should delete records, returning all named columns', () => {
    const query = Snake.selectAll().where().delete();
    expectSql(
      query.toSql(),
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
      query.toSql(),
      `DELETE FROM "user" WHERE "user"."id" = $1 RETURNING "user"."id", "user"."name"`,
      [1],
    );

    assertType<Awaited<typeof query>, { id: number; name: string }[]>();

    expectQueryNotMutated(q);
  });

  it('should delete records, returning specified named columns', () => {
    const query = Snake.select('snakeName', 'tailLength').where().delete();
    expectSql(
      query.toSql(),
      `
        DELETE FROM "snake"
        RETURNING
          "snake"."snake_name" AS "snakeName",
          "snake"."tail_length" AS "tailLength"
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
      query.toSql(),
      `
        DELETE FROM "user"
        USING "profile"
        WHERE "user"."id" = $1 AND "profile"."userId" = "user"."id"
        RETURNING "user".*
      `,
      [1],
    );

    assertType<Awaited<typeof query>, (typeof User)['type'][]>();

    expectQueryNotMutated(q);
  });
});
