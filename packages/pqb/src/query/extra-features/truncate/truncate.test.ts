import { expectQueryNotMutated } from '../../../test-utils/pqb.test-utils';
import { db, expectSql } from 'test-utils';

describe('truncate', () => {
  it('should truncate table', () => {
    const q = db.user.all();
    expectSql(q.truncate().toSQL(), 'TRUNCATE "schema"."user"');
    expectQueryNotMutated(q);
  });

  it('should handle restart identity and cascade options', () => {
    const q = db.user.all();
    expectSql(
      q.truncate({ restartIdentity: true, cascade: true }).toSQL(),
      'TRUNCATE "schema"."user" RESTART IDENTITY CASCADE',
    );
    expectQueryNotMutated(q);
  });
});
