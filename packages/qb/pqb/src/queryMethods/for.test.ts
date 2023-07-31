import { expectQueryNotMutated, User } from '../test-utils/test-utils';
import { expectSql } from 'test-utils';

describe('for', () => {
  describe.each`
    method              | sql
    ${'forUpdate'}      | ${'UPDATE'}
    ${'forNoKeyUpdate'} | ${'NO KEY UPDATE'}
    ${'forShare'}       | ${'SHARE'}
    ${'forKeyShare'}    | ${'KEY SHARE'}
  `('$method', ({ method, sql }) => {
    it(`should set FOR ${sql} expression`, () => {
      const q = User.all();
      expectSql(
        q[method as 'forUpdate']().toSQL(),
        `SELECT * FROM "user" FOR ${sql}`,
      );
      expectQueryNotMutated(q);
    });

    it('should accept tables', () => {
      const q = User.all();
      expectSql(
        q[method as 'forUpdate'](['a', 'b']).toSQL(),
        `SELECT * FROM "user" FOR ${sql} OF "a", "b"`,
      );
      expectQueryNotMutated(q);
    });

    it('should accept raw sql', () => {
      const q = User.all();
      expectSql(
        q[method as 'forUpdate'](User.sql`raw sql`).toSQL(),
        `SELECT * FROM "user" FOR ${sql} OF raw sql`,
      );
      expectQueryNotMutated(q);
    });

    it('should set NO WAIT mode', () => {
      const q = User.all();
      expectSql(
        q[method as 'forUpdate']().noWait().toSQL(),
        `SELECT * FROM "user" FOR ${sql} NO WAIT`,
      );
      expectQueryNotMutated(q);
    });

    it('should set SKIP LOCKED mode', () => {
      const q = User.all();
      expectSql(
        q[method as 'forUpdate']().skipLocked().toSQL(),
        `SELECT * FROM "user" FOR ${sql} SKIP LOCKED`,
      );
      expectQueryNotMutated(q);
    });
  });
});
