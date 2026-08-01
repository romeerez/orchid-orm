import {
  expectQueryNotMutated,
  Snake,
  snakeSelectAll,
} from '../../../test-utils/pqb.test-utils';
import {
  db,
  expectSql,
  testDb,
  UserSelectAll,
  UserSelectAllWithTable,
} from 'test-utils';

describe('distinct', () => {
  it('should add distinct without specifying columns', () => {
    const q = db.user.all();

    expectSql(
      q.distinct().toSQL(),
      `SELECT DISTINCT ${UserSelectAll} FROM "schema"."user" "User"`,
    );

    expectQueryNotMutated(q);
  });

  it('should add distinct on columns', () => {
    const q = db.user.all();

    expectSql(
      q.distinct('Id', 'User.Name').toSQL(),
      `
          SELECT DISTINCT ON ("User"."id", "User"."name") ${UserSelectAll}
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
    const q = db.user.all();

    expectSql(
      q
        .join(db.profile, 'Profile.UserId', '=', 'User.Id')
        .distinct('User.Id', 'Profile.UserId')
        .toSQL(),
      `
          SELECT DISTINCT ON ("User"."id", "Profile"."user_id") ${UserSelectAllWithTable}
          FROM "schema"."user" "User"
          JOIN "schema"."profile" "Profile" ON "Profile"."user_id" = "User"."id"
        `,
    );

    expectQueryNotMutated(q);
  });

  it('should add distinct on joined named columns', () => {
    const q = db.user
      .join(Snake, 'Snake.tailLength', 'User.Id')
      .distinct('User.Id', 'Snake.tailLength');

    expectSql(
      q.toSQL(),
      `
          SELECT DISTINCT ON ("User"."id", "Snake"."tail_length") ${UserSelectAllWithTable}
          FROM "schema"."user" "User"
          JOIN "schema"."snake" "Snake" ON "Snake"."tail_length" = "User"."id"
        `,
    );
  });

  it('should add distinct on joined columns with alias', () => {
    const q = db.user.all();

    expectSql(
      q
        .join(db.profile.as('p'), 'p.UserId', '=', 'User.Id')
        .distinct('User.Id', 'p.UserId')
        .toSQL(),
      `
          SELECT DISTINCT ON ("User"."id", "p"."user_id") ${UserSelectAllWithTable}
          FROM "schema"."user" "User"
          JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
    );

    expectQueryNotMutated(q);
  });

  it('should add distinct on joined columns with named with alias', () => {
    const q = db.user
      .join(Snake.as('s'), 's.tailLength', 'User.Id')
      .distinct('User.Id', 's.tailLength');

    expectSql(
      q.toSQL(),
      `
          SELECT DISTINCT ON ("User"."id", "s"."tail_length") ${UserSelectAllWithTable}
          FROM "schema"."user" "User"
          JOIN "schema"."snake" "s" ON "s"."tail_length" = "User"."id"
        `,
    );
  });

  it('should add distinct on raw sql', () => {
    const q = db.user.all();
    expectSql(
      q.distinct(testDb.sql`"user".id`).toSQL(),
      `
          SELECT DISTINCT ON ("user".id) ${UserSelectAll} FROM "schema"."user" "User"
        `,
    );
    expectQueryNotMutated(q);
  });
});
