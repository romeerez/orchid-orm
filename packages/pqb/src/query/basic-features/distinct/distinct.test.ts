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
      `SELECT DISTINCT ${userColumnsSql} FROM "schema"."user"`,
    );

    expectQueryNotMutated(q);
  });

  it('should add distinct on columns', () => {
    const q = User.all();

    expectSql(
      q.distinct('id', 'user.name').toSQL(),
      `
          SELECT DISTINCT ON ("user"."id", "user"."name") ${userColumnsSql}
          FROM "schema"."user"
        `,
    );

    expectQueryNotMutated(q);
  });

  it('should add distinct on named columns', () => {
    const q = Snake.distinct('snakeName', 'snake.tailLength');

    expectSql(
      q.toSQL(),
      `
          SELECT DISTINCT ON ("snake"."snake_name", "snake"."tail_length") ${snakeSelectAll}
          FROM "schema"."snake"
        `,
    );
  });

  it('should add distinct on joined columns', () => {
    const q = User.all();

    expectSql(
      q
        .join(Profile, 'profile.userId', '=', 'user.id')
        .distinct('user.id', 'profile.userId')
        .toSQL(),
      `
          SELECT DISTINCT ON ("user"."id", "profile"."user_id") ${userTableColumnsSql}
          FROM "schema"."user"
          JOIN "schema"."profile" ON "profile"."user_id" = "user"."id"
        `,
    );

    expectQueryNotMutated(q);
  });

  it('should add distinct on joined named columns', () => {
    const q = User.join(Snake, 'snake.tailLength', 'user.id').distinct(
      'user.id',
      'snake.tailLength',
    );

    expectSql(
      q.toSQL(),
      `
          SELECT DISTINCT ON ("user"."id", "snake"."tail_length") ${userTableColumnsSql}
          FROM "schema"."user"
          JOIN "schema"."snake" ON "snake"."tail_length" = "user"."id"
        `,
    );
  });

  it('should add distinct on joined columns with alias', () => {
    const q = User.all();

    expectSql(
      q
        .join(Profile.as('p'), 'p.userId', '=', 'user.id')
        .distinct('user.id', 'p.userId')
        .toSQL(),
      `
          SELECT DISTINCT ON ("user"."id", "p"."user_id") ${userTableColumnsSql}
          FROM "schema"."user"
          JOIN "schema"."profile" "p" ON "p"."user_id" = "user"."id"
        `,
    );

    expectQueryNotMutated(q);
  });

  it('should add distinct on joined columns with named with alias', () => {
    const q = User.join(Snake.as('s'), 's.tailLength', 'user.id').distinct(
      'user.id',
      's.tailLength',
    );

    expectSql(
      q.toSQL(),
      `
          SELECT DISTINCT ON ("user"."id", "s"."tail_length") ${userTableColumnsSql}
          FROM "schema"."user"
          JOIN "schema"."snake" "s" ON "s"."tail_length" = "user"."id"
        `,
    );
  });

  it('should add distinct on raw sql', () => {
    const q = User.all();
    expectSql(
      q.distinct(testDb.sql`"user".id`).toSQL(),
      `
          SELECT DISTINCT ON ("user".id) ${userColumnsSql} FROM "schema"."user"
        `,
    );
    expectQueryNotMutated(q);
  });
});
