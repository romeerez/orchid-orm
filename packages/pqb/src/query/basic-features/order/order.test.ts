import {
  expectQueryNotMutated,
  Snake,
  snakeSelectAll,
} from '../../../test-utils/pqb.test-utils';
import { db, expectSql, testDb, UserSelectAll } from 'test-utils';

describe('order', () => {
  it('should add order by column ASC when string is provided', () => {
    const q = db.user.all();

    expectSql(
      q.order('Id', 'Name').toSQL(),
      `
          SELECT ${UserSelectAll} FROM "schema"."user" "User"
          ORDER BY "User"."id" ASC, "User"."name" ASC
        `,
    );

    expectQueryNotMutated(q);
  });

  it('should order by named columns', () => {
    const q = Snake.order('snakeName', 'tailLength');

    expectSql(
      q.toSQL(),
      `
          SELECT ${snakeSelectAll} FROM "schema"."snake" "Snake"
          ORDER BY "Snake"."snake_name" ASC, "Snake"."tail_length" ASC
        `,
    );
  });

  it('should handle object parameter', () => {
    const q = db.user.all();

    expectSql(
      q.order({ Id: 'ASC', Name: 'DESC' }).toSQL(),
      `
          SELECT ${UserSelectAll} FROM "schema"."user" "User"
          ORDER BY "User"."id" ASC, "User"."name" DESC
        `,
    );

    expectSql(
      q
        .order({
          Id: 'ASC NULLS FIRST',
          Name: 'DESC NULLS LAST',
        })
        .toSQL(),
      `
          SELECT ${UserSelectAll} FROM "schema"."user" "User"
          ORDER BY "User"."id" ASC NULLS FIRST, "User"."name" DESC NULLS LAST
        `,
    );

    expectQueryNotMutated(q);
  });

  it('should order by object with named columns', () => {
    expectSql(
      Snake.order({ snakeName: 'ASC', tailLength: 'DESC' }).toSQL(),
      `
          SELECT ${snakeSelectAll} FROM "schema"."snake" "Snake"
          ORDER BY "Snake"."snake_name" ASC, "Snake"."tail_length" DESC
        `,
    );

    expectSql(
      Snake.order({
        snakeName: 'ASC NULLS FIRST',
        tailLength: 'DESC NULLS LAST',
      }).toSQL(),
      `
          SELECT ${snakeSelectAll} FROM "schema"."snake" "Snake"
          ORDER BY "Snake"."snake_name" ASC NULLS FIRST, "Snake"."tail_length" DESC NULLS LAST
        `,
    );
  });

  it('adds order with raw sql', () => {
    const q = db.user.all();
    expectSql(
      q.order(testDb.sql`id ASC NULLS FIRST`).toSQL(),
      `
        SELECT ${UserSelectAll} FROM "schema"."user" "User"
        ORDER BY id ASC NULLS FIRST
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should be able to order by a selected value in a sub-query', () => {
    const q = db.user
      .select({
        avg: () => db.user.avg('Id'),
      })
      .order('avg');

    expectSql(
      q.toSQL(),
      `
          SELECT (SELECT avg("User"."id") FROM "schema"."user" "User") "avg"
          FROM "schema"."user" "User"
          ORDER BY "avg" ASC
        `,
    );
  });

  it('should disallow ordering by sub-selected json object or arrays', () => {
    db.user
      .select({
        obj: () => db.user.take(),
      })
      // @ts-expect-error should disallow ordering by object
      .order('obj.name')
      // @ts-expect-error should disallow ordering by object
      .order('obj');

    db.user
      .select({
        arr: () => db.user.all(),
      })
      // @ts-expect-error should disallow ordering by array
      .order('arr');
  });

  it('should not prefix the column when it is customly selected', () => {
    const q = db.user.select({ Name: 'Id' }).order('Name');

    expectSql(
      q.toSQL(),
      `
          SELECT "User"."id" "Name" FROM "schema"."user" "User"
          ORDER BY "id" ASC
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
          FROM "schema"."user" "User"
          LEFT JOIN LATERAL (
            SELECT "profile"."bio" "Bio"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "User"."id"
              AND "profile"."profile_key" = "User"."user_key"
          ) "profile" ON true
          ORDER BY "profile"."Bio" ASC
        `,
    );
  });
});

describe('orderSql', () => {
  it('adds order with raw sql template literal', () => {
    const q = db.user.all();

    expectSql(
      q.orderSql`id ASC NULLS FIRST`.toSQL(),
      `
        SELECT ${UserSelectAll} FROM "schema"."user" "User"
        ORDER BY id ASC NULLS FIRST
      `,
    );
    expectQueryNotMutated(q);
  });
});
