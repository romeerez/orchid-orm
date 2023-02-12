import {
  db,
  expectQueryNotMutated,
  expectSql,
  User,
} from '../test-utils/test-utils';

describe('from', () => {
  it('should accept raw parameter', () => {
    const q = User.all();
    expectSql(
      q.from(db.raw('profile')).as('t').toSql(),
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

  it.todo('should apply column types from inner query'); //, () => {
  // const query = db.from().where({
  //   alias: { contains: 'name' },
  // });
  // query.toSql();
  // });
});
