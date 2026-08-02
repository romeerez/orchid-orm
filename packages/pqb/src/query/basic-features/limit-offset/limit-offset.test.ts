import { db, expectSql, UserSelectAll } from 'test-utils';

describe('limit', () => {
  it('should set limit', () => {
    const q = db.user.all();
    expectSql(
      q.limit(5).toSQL(),
      `SELECT ${UserSelectAll} FROM "schema"."user" "User" LIMIT $1`,
      [5],
    );
    expectSql(q.toSQL(), `SELECT ${UserSelectAll} FROM "schema"."user" "User"`);
  });

  it('should reset limit', () => {
    const q = db.user.all();
    expectSql(
      q.limit(undefined).toSQL(),
      `SELECT ${UserSelectAll} FROM "schema"."user" "User"`,
    );
    expectSql(q.toSQL(), `SELECT ${UserSelectAll} FROM "schema"."user" "User"`);
  });
});

describe('offset', () => {
  it('should set offset', () => {
    const q = db.user.all();
    expectSql(
      q.offset(5).toSQL(),
      `SELECT ${UserSelectAll} FROM "schema"."user" "User" OFFSET $1`,
      [5],
    );
    expectSql(q.toSQL(), `SELECT ${UserSelectAll} FROM "schema"."user" "User"`);
  });

  it('should reset offset', () => {
    const q = db.user.all();
    expectSql(
      q.offset(undefined).toSQL(),
      `SELECT ${UserSelectAll} FROM "schema"."user" "User"`,
    );
    expectSql(q.toSQL(), `SELECT ${UserSelectAll} FROM "schema"."user" "User"`);
  });
});
