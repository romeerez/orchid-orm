import { expectQueryNotMutated } from '../../../test-utils/pqb.test-utils';
import { db, expectSql, UserSelectAll } from 'test-utils';

describe('for', () => {
  describe.each`
    method              | sql
    ${'forUpdate'}      | ${'UPDATE'}
    ${'forNoKeyUpdate'} | ${'NO KEY UPDATE'}
    ${'forShare'}       | ${'SHARE'}
    ${'forKeyShare'}    | ${'KEY SHARE'}
  `('$method', ({ method, sql }) => {
    it(`should set FOR ${sql} expression`, () => {
      const q = db.user.all();
      expectSql(
        q[method as 'forUpdate']().toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" FOR ${sql}`,
      );
      expectQueryNotMutated(q);
    });

    it('should accept tables', () => {
      const q = db.user.all();
      expectSql(
        q[method as 'forUpdate'](['a', 'b']).toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" FOR ${sql} OF "a", "b"`,
      );
      expectQueryNotMutated(q);
    });

    it('should accept raw sql', () => {
      const q = db.user.all();
      expectSql(
        q[method as 'forUpdate'](db.user.sql`raw sql`).toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" FOR ${sql} OF raw sql`,
      );
      expectQueryNotMutated(q);
    });

    it('should set NO WAIT mode', () => {
      const q = db.user.all();
      expectSql(
        q[method as 'forUpdate']().noWait().toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" FOR ${sql} NO WAIT`,
      );
      expectQueryNotMutated(q);
    });

    it('should set SKIP LOCKED mode', () => {
      const q = db.user.all();
      expectSql(
        q[method as 'forUpdate']().skipLocked().toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" FOR ${sql} SKIP LOCKED`,
      );
      expectQueryNotMutated(q);
    });
  });
});
