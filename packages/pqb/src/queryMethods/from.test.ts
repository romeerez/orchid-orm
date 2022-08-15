import { expectQueryNotMutated, expectSql, User } from '../test-utils';
import { raw } from '../common';

describe('from', () => {
  it('should accept raw parameter', () => {
    const q = User.all();
    expectSql(
      q.as('t').from(raw('profile')).toSql(),
      `SELECT "t".* FROM profile AS "t"`,
    );
    expectQueryNotMutated(q);
  });

  it('should accept query parameter', () => {
    const q = User.all();
    expectSql(
      q.select('name').from(User.select('name')).toSql(),
      'SELECT "user"."name" FROM (SELECT "user"."name" FROM "user") AS "user"',
    );
    expectQueryNotMutated(q);
  });

  it('accept `as` parameter', () => {
    const q = User.all();
    expectSql(
      q.select('name').from(User.select('name'), 'wrapped').toSql(),
      `
        SELECT "wrapped"."name"
        FROM (SELECT "user"."name" FROM "user") AS "wrapped"
      `,
    );
    expectQueryNotMutated(q);
  });

  it('should not insert sub query and alias if provided query is simple', () => {
    const q = User.all();
    expectSql(
      q.select('name').from(User).toSql(),
      'SELECT "user"."name" FROM "user"',
    );
    expectQueryNotMutated(q);
  });

  it('should add ONLY keyword when `only` parameter is provided', () => {
    const q = User.all();
    expectSql(
      q.select('id').from(User, { only: true }).toSql(),
      'SELECT "user"."id" FROM ONLY "user"',
    );
  });
});
