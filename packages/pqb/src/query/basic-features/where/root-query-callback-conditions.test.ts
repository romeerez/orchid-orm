import { db, expectSql, UserSelectAll } from 'test-utils';

describe('conditions on the root query in a select/where callback', () => {
  it('select: exists() becomes the conditions themselves', () => {
    expectSql(
      db.user
        .select({ isAlice: (q) => q.where({ name: 'Alice' }).exists() })
        .toSQL(),
      `SELECT ("User"."name" = $1) "isAlice" FROM "schema"."user" "User"`,
      ['Alice'],
    );
  });

  it('select: exists() with a helper keeps the helper conditions', () => {
    const isAlice = db.user.makeHelper((q) => q.where({ name: 'Alice' }));

    expectSql(
      db.user.select({ isAlice: (q) => q.useHelper(isAlice).exists() }).toSQL(),
      `SELECT ("User"."name" = $1) "isAlice" FROM "schema"."user" "User"`,
      ['Alice'],
    );
  });

  it('select: notExists() becomes the negated conditions', () => {
    expectSql(
      db.user
        .select({ notAlice: (q) => q.where({ name: 'Alice' }).notExists() })
        .toSQL(),
      `SELECT NOT ("User"."name" = $1) "notAlice" FROM "schema"."user" "User"`,
      ['Alice'],
    );
  });

  it('where: exists() becomes the conditions themselves', () => {
    expectSql(
      db.user.where((q) => q.where({ name: 'Alice' }).exists()).toSQL(),
      `SELECT ${UserSelectAll} FROM "schema"."user" "User" WHERE ("User"."name" = $1)`,
      ['Alice'],
    );
  });

  it('select: count() with conditions throws instead of dropping them', () => {
    expect(() =>
      db.user
        .select({ alices: (q) => q.where({ name: 'Alice' }).count() })
        .toSQL(),
    ).toThrow('cannot apply the query');
  });

  it('select: get() with conditions throws instead of dropping them', () => {
    expect(() =>
      db.user
        .select({ name: (q) => q.where({ name: 'Alice' }).get('name') })
        .toSQL(),
    ).toThrow('cannot apply the query');
  });

  it('keeps the bare terminal expression when there are no conditions', () => {
    expectSql(
      db.user.select({ flag: (q) => q.exists() }).toSQL(),
      `SELECT true "flag" FROM "schema"."user" "User"`,
    );
  });
});
