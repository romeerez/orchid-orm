import {
  expectQueryNotMutated,
  Snake,
  snakeSelectAll,
  User,
  userColumnsSql,
} from '../../../test-utils/pqb.test-utils';
import { db, expectSql, testDb } from 'test-utils';

describe('order', () => {
  it('should add order by column ASC when string is provided', () => {
    const q = User.all();

    expectSql(
      q.order('id', 'name').toSQL(),
      `
          SELECT ${userColumnsSql} FROM "user"
          ORDER BY "user"."id" ASC, "user"."name" ASC
        `,
    );

    expectQueryNotMutated(q);
  });

  it('should order by named columns', () => {
    const q = Snake.order('snakeName', 'tailLength');

    expectSql(
      q.toSQL(),
      `
          SELECT ${snakeSelectAll} FROM "snake"
          ORDER BY "snake"."snake_name" ASC, "snake"."tail_length" ASC
        `,
    );
  });

  it('should handle object parameter', () => {
    const q = User.all();

    expectSql(
      q.order({ id: 'ASC', name: 'DESC' }).toSQL(),
      `
          SELECT ${userColumnsSql} FROM "user"
          ORDER BY "user"."id" ASC, "user"."name" DESC
        `,
    );

    expectSql(
      q
        .order({
          id: 'ASC NULLS FIRST',
          name: 'DESC NULLS LAST',
        })
        .toSQL(),
      `
          SELECT ${userColumnsSql} FROM "user"
          ORDER BY "user"."id" ASC NULLS FIRST, "user"."name" DESC NULLS LAST
        `,
    );

    expectQueryNotMutated(q);
  });

  it('should order by object with named columns', () => {
    expectSql(
      Snake.order({ snakeName: 'ASC', tailLength: 'DESC' }).toSQL(),
      `
          SELECT ${snakeSelectAll} FROM "snake"
          ORDER BY "snake"."snake_name" ASC, "snake"."tail_length" DESC
        `,
    );

    expectSql(
      Snake.order({
        snakeName: 'ASC NULLS FIRST',
        tailLength: 'DESC NULLS LAST',
      }).toSQL(),
      `
          SELECT ${snakeSelectAll} FROM "snake"
          ORDER BY "snake"."snake_name" ASC NULLS FIRST, "snake"."tail_length" DESC NULLS LAST
        `,
    );
  });

  it('adds order with raw sql', () => {
    const q = User.all();
    expectSql(
      q.order(testDb.sql`id ASC NULLS FIRST`).toSQL(),
      `
        SELECT ${userColumnsSql} FROM "user"
        ORDER BY id ASC NULLS FIRST
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should be able to order by a selected value in a sub-query', () => {
    const q = User.select({
      count: () => User.count(),
    }).order('count');

    expectSql(
      q.toSQL(),
      `
          SELECT (SELECT count(*) FROM "user") "count"
          FROM "user"
          ORDER BY "count" ASC
        `,
    );
  });

  it('should disallow ordering by sub-selected json object or arrays', () => {
    User.select({
      obj: () => User.take(),
    })
      // @ts-expect-error should disallow ordering by object
      .order('obj.name')
      // @ts-expect-error should disallow ordering by object
      .order('obj');

    User.select({
      arr: () => User.all(),
      // @ts-expect-error should disallow ordering by array
    }).order('arr');
  });

  it('should not prefix the column when it is customly selected', () => {
    const q = User.select({ name: 'id' }).order('name');

    expectSql(
      q.toSQL(),
      `
          SELECT "user"."id" "name" FROM "user"
          ORDER BY "name" ASC
        `,
    );
  });

  it('should order by relation single record column, it is implicitly joined', () => {
    const q = db.user
      .select({
        profile: (q) => q.profile.select('Bio'),
      })
      .order('profile.Bio');

    expectSql(
      q.toSQL(),
      `
          SELECT row_to_json("profile".*) "profile"
          FROM "user"
          LEFT JOIN LATERAL (
            SELECT "profile"."bio" "Bio"
            FROM "profile"
            WHERE "profile"."user_id" = "user"."id"
              AND "profile"."profile_key" = "user"."user_key"
          ) "profile" ON true
          ORDER BY "profile"."Bio" ASC
        `,
    );
  });
});

describe('orderSql', () => {
  it('adds order with raw sql template literal', () => {
    const q = User.all();

    expectSql(
      q.orderSql`id ASC NULLS FIRST`.toSQL(),
      `
        SELECT ${userColumnsSql} FROM "user"
        ORDER BY id ASC NULLS FIRST
      `,
    );
    expectQueryNotMutated(q);
  });
});
