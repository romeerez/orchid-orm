import { db, expectQueryNotMutated, expectSql, User } from '../test-utils';

describe('from', () => {
  it('should accept string parameter', () => {
    const q = User.all();
    expectSql(q.from('profile').toSql(), `SELECT * FROM "profile"`);
    expectQueryNotMutated(q);
  });

  it('should accept string parameter with respect to `as`', () => {
    const q = User.all();
    expectSql(
      q.as('t').from('profile').toSql(),
      `SELECT * FROM "profile" AS "t"`,
    );
    expectQueryNotMutated(q);
  });

  it('should accept raw parameter', () => {
    const q = User.all();
    expectSql(
      q.as('t').from(db.raw('profile')).toSql(),
      `SELECT * FROM profile AS "t"`,
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
      User.select('name').from(User).toSql(),
      'SELECT "user"."name" FROM "user"',
    );
    expectQueryNotMutated(q);
  });

  it('should add ONLY keyword when `only` parameter is provided', () => {
    expectSql(
      User.select('id').from(User, { only: true }).toSql(),
      'SELECT "user"."id" FROM ONLY "user"',
    );
  });
});
