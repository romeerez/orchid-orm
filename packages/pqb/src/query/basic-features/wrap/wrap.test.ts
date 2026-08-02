import { expectQueryNotMutated } from '../../../test-utils/pqb.test-utils';
import {
  db,
  expectSql,
  type UserDefaultSelect,
  UserSelectAll,
  UserSelectAllWithTable,
} from 'test-utils';

describe('wrap', () => {
  const userDefaultSelect = {} as UserDefaultSelect;
  const userSelectColumns = [UserSelectAll, UserSelectAllWithTable] as const;

  it('should wrap query with another', () => {
    expect(userDefaultSelect).toBeDefined();
    expect(userSelectColumns).toHaveLength(2);

    const q = db.user.all();

    expectSql(
      q.select('Id').wrap(db.user.select('Id')).toSQL(),
      'SELECT "t"."Id" FROM (SELECT "User"."id" "Id" FROM "schema"."user" "User") "t"',
    );

    expectQueryNotMutated(q);
  });

  it('should accept `as` parameter', () => {
    const q = db.user.all();

    expectSql(
      q.select('Id').wrap(db.user.select('Id'), 'wrapped').toSQL(),
      'SELECT "wrapped"."Id" FROM (SELECT "User"."id" "Id" FROM "schema"."user" "User") "wrapped"',
    );

    expectQueryNotMutated(q);
  });
});
