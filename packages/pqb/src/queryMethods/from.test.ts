import { expectQueryNotMutated, line, User } from '../test-utils';
import { raw } from '../common';

describe('from', () => {
  it('should accept raw parameter', () => {
    const q = User.all();
    expect(q.as('t').from(raw('profile')).toSql()).toBe(
      line(`
        SELECT "t".* FROM profile AS "t"
      `),
    );
    expectQueryNotMutated(q);
  });

  it('should accept query parameter', () => {
    const q = User.all();
    expect(q.select('name').from(User.select('name')).toSql()).toBe(
      'SELECT "user"."name" FROM (SELECT "user"."name" FROM "user") AS "user"',
    );
    expectQueryNotMutated(q);
  });

  it('accept `as` parameter', () => {
    const q = User.all();
    expect(q.select('name').from(User.select('name'), 'wrapped').toSql()).toBe(
      line(`
          SELECT "wrapped"."name"
          FROM (SELECT "user"."name" FROM "user") AS "wrapped"
        `),
    );
    expectQueryNotMutated(q);
  });

  it('should not insert sub query and alias if provided query is simple', () => {
    const q = User.all();
    expect(q.select('name').from(User).toSql()).toBe(
      'SELECT "user"."name" FROM "user"',
    );
    expectQueryNotMutated(q);
  });

  it('should add ONLY keyword when `only` parameter is provided', () => {
    const q = User.all();
    expect(q.select('id').from(User, { only: true }).toSql()).toBe(
      'SELECT "user"."id" FROM ONLY "user"',
    );
  });
});
