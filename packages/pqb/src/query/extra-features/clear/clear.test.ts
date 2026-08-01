import { db, expectSql, line, UserSelectAll } from 'test-utils';

describe('clear', () => {
  it('should remove query statements for select', () => {
    const inner = db.user.all();

    const query = db.user
      .select('*')
      .with('withAlias', db.user.all())
      .where({ Id: 1 })
      .orWhere({ Id: 2 })
      .join(db.message, 'AuthorId', 'Id')
      .group('Id')
      .order('Id')
      .union(inner)
      .having((q) => q.count().equals(1))
      .limit(10)
      .offset(10);

    expectSql(
      query
        .clear(
          'with',
          'select',
          'where',
          'union',
          'join',
          'group',
          'order',
          'having',
          'limit',
          'offset',
        )
        .toSQL(),
      `SELECT ${UserSelectAll} FROM "schema"."user" "User"`,
    );
  });

  it('should clear increment and decrement', () => {
    const expectedSql = line(`
      UPDATE "schema"."user" "User" SET "name" = $1, "updated_at" = now()
    `);
    const expectedValues = ['new name'];

    expectSql(
      db.user
        .all()
        .update({ Name: 'new name' })
        .increment('Age')
        .clear('counters')
        .toSQL(),
      expectedSql,
      expectedValues,
    );

    expectSql(
      db.user
        .all()
        .update({ Name: 'new name' })
        .decrement('Age')
        .clear('counters')
        .toSQL(),
      expectedSql,
      expectedValues,
    );
  });
});
