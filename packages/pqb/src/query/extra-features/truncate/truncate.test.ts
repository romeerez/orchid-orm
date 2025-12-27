import { expectQueryNotMutated, User } from '../../../test-utils/pqb.test-utils';
import { expectSql } from 'test-utils';

describe('truncate', () => {
  it('should truncate table', () => {
    const q = User.all();
    expectSql(q.truncate().toSQL(), 'TRUNCATE "user"');
    expectQueryNotMutated(q);
  });

  it('should handle restart identity and cascade options', () => {
    const q = User.all();
    expectSql(
      q.truncate({ restartIdentity: true, cascade: true }).toSQL(),
      'TRUNCATE "user" RESTART IDENTITY CASCADE',
    );
    expectQueryNotMutated(q);
  });
});
