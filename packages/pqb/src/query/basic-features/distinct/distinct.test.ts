import {
  expectQueryNotMutated,
  Profile,
  Snake,
  snakeSelectAll,
  User,
  userColumnsSql,
  userTableColumnsSql,
} from '../../../test-utils/pqb.test-utils';
import { expectSql, testDb } from 'test-utils';

describe('distinct', () => {
  it('should add distinct without specifying columns', () => {
    const q = User.all();

    expectSql(
      q.distinct().toSQL(),
      `SELECT DISTINCT ${userColumnsSql} FROM "schema"."user" "User"`,
    );

    expectQueryNotMutated(q);
  });

  it('should add distinct on columns', () => {
    const q = User.all();

    expectSql(
      q.distinct('id', 'User.name').toSQL(),
      `
          SELECT DISTINCT ON ("User"."id", "User"."name") ${userColumnsSql}
          FROM "schema"."user" "User"
        `,
    );

    expectQueryNotMutated(q);
  });

  it('should add distinct on named columns', () => {
    const q = Snake.distinct('snakeName', 'Snake.tailLength');

    expectSql(
      q.toSQL(),
      `
          SELECT DISTINCT ON ("Snake"."snake_name", "Snake"."tail_length") ${snakeSelectAll}
          FROM "schema"."snake" "Snake"
        `,
    );
  });

  it('should add distinct on joined columns', () => {
    const q = User.all();

    expectSql(
      q
        .join(Profile, 'Profile.userId', '=', 'User.id')
        .distinct('User.id', 'Profile.userId')
        .toSQL(),
      `
          SELECT DISTINCT ON ("User"."id", "Profile"."user_id") ${userTableColumnsSql}
          FROM "schema"."user" "User"
          JOIN "schema"."profile" "Profile" ON "Profile"."user_id" = "User"."id"
        `,
    );

    expectQueryNotMutated(q);
  });

  it('should add distinct on joined named columns', () => {
    const q = User.join(Snake, 'Snake.tailLength', 'User.id').distinct(
      'User.id',
      'Snake.tailLength',
    );

    expectSql(
      q.toSQL(),
      `
          SELECT DISTINCT ON ("User"."id", "Snake"."tail_length") ${userTableColumnsSql}
          FROM "schema"."user" "User"
          JOIN "schema"."snake" "Snake" ON "Snake"."tail_length" = "User"."id"
        `,
    );
  });

  it('should add distinct on joined columns with alias', () => {
    const q = User.all();

    expectSql(
      q
        .join(Profile.as('p'), 'p.userId', '=', 'User.id')
        .distinct('User.id', 'p.userId')
        .toSQL(),
      `
          SELECT DISTINCT ON ("User"."id", "p"."user_id") ${userTableColumnsSql}
          FROM "schema"."user" "User"
          JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
    );

    expectQueryNotMutated(q);
  });

  it('should add distinct on joined columns with named with alias', () => {
    const q = User.join(Snake.as('s'), 's.tailLength', 'User.id').distinct(
      'User.id',
      's.tailLength',
    );

    expectSql(
      q.toSQL(),
      `
          SELECT DISTINCT ON ("User"."id", "s"."tail_length") ${userTableColumnsSql}
          FROM "schema"."user" "User"
          JOIN "schema"."snake" "s" ON "s"."tail_length" = "User"."id"
        `,
    );
  });

  it('should add distinct on raw sql', () => {
    const q = User.all();
    expectSql(
      q.distinct(testDb.sql`"user".id`).toSQL(),
      `
          SELECT DISTINCT ON ("user".id) ${userColumnsSql} FROM "schema"."user" "User"
        `,
    );
    expectQueryNotMutated(q);
  });
});
