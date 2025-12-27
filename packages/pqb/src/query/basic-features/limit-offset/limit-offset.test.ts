import {
  expectQueryNotMutated,
  User,
  userColumnsSql,
} from '../../../test-utils/pqb.test-utils';
import { expectSql } from 'test-utils';

describe('limit', () => {
  it('should set limit', () => {
    const q = User.all();
    expectSql(
      q.limit(5).toSQL(),
      `SELECT ${userColumnsSql} FROM "user" LIMIT $1`,
      [5],
    );
    expectQueryNotMutated(q);
  });

  it('should reset limit', () => {
    const q = User.all();
    expectSql(
      q.limit(undefined).toSQL(),
      `SELECT ${userColumnsSql} FROM "user"`,
    );
    expectQueryNotMutated(q);
  });
});

describe('offset', () => {
  it('should set offset', () => {
    const q = User.all();
    expectSql(
      q.offset(5).toSQL(),
      `SELECT ${userColumnsSql} FROM "user" OFFSET $1`,
      [5],
    );
    expectQueryNotMutated(q);
  });

  it('should reset offset', () => {
    const q = User.all();
    expectSql(
      q.offset(undefined).toSQL(),
      `SELECT ${userColumnsSql} FROM "user"`,
    );
    expectQueryNotMutated(q);
  });
});
