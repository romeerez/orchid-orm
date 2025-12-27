import {
  expectQueryNotMutated,
  Snake,
  User,
} from '../../../test-utils/pqb.test-utils';
import { expectSql } from 'test-utils';

describe('wrap', () => {
  it('should wrap query with another', () => {
    const q = User.all();

    expectSql(
      q.select('id').wrap(User.select('id')).toSQL(),
      'SELECT "t"."id" FROM (SELECT "user"."id" FROM "user") "t"',
    );

    expectQueryNotMutated(q);
  });

  it('should accept `as` parameter', () => {
    const q = User.all();

    expectSql(
      q.select('id').wrap(User.select('id'), 'wrapped').toSQL(),
      'SELECT "wrapped"."id" FROM (SELECT "user"."id" FROM "user") "wrapped"',
    );

    expectQueryNotMutated(q);
  });

  it('should wrap query with named columns', () => {
    const q = Snake.select('snakeName').wrap(Snake.select('snakeName'));

    expectSql(
      q.toSQL(),
      `
          SELECT "t"."snakeName"
          FROM (
            SELECT "snake"."snake_name" "snakeName"
            FROM "snake"
          ) "t"
        `,
    );
  });
});
