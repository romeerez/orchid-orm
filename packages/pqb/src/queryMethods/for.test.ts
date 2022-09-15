import { expectQueryNotMutated, expectSql, User } from '../test-utils';
import { raw } from '../common';

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
        q[method as 'forUpdate']().toSql(),
        `SELECT * FROM "user" FOR ${sql}`,
      );
      expectQueryNotMutated(q);
    });

    it('should accept tables', () => {
      const q = User.all();
      expectSql(
        q[method as 'forUpdate'](['a', 'b']).toSql(),
        `SELECT * FROM "user" FOR ${sql} OF "a", "b"`,
      );
      expectQueryNotMutated(q);
    });

    it('should accept raw sql', () => {
      const q = User.all();
      expectSql(
        q[method as 'forUpdate'](raw('raw sql')).toSql(),
        `SELECT * FROM "user" FOR ${sql} OF raw sql`,
      );
      expectQueryNotMutated(q);
    });

    it('should set NO WAIT mode', () => {
      const q = User.all();
      expectSql(
        q[method as 'forUpdate']().noWait().toSql(),
        `SELECT * FROM "user" FOR ${sql} NO WAIT`,
      );
      expectQueryNotMutated(q);
    });

    it('should set SKIP LOCKED mode', () => {
      const q = User.all();
      expectSql(
        q[method as 'forUpdate']().skipLocked().toSql(),
        `SELECT * FROM "user" FOR ${sql} SKIP LOCKED`,
      );
      expectQueryNotMutated(q);
    });
  });
});
