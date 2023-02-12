import { expectSql, line, Message, User } from '../test-utils/test-utils';

describe('clear', () => {
  it('should remove query statements for select', () => {
    const query = User.with('withAlias', User.all())
      .select('id', { as: 'name' })
      .where({ id: 1 })
      .or({ id: 2 })
      .union([User.select('id', { as: 'name' })])
      .join(Message, 'authorId', 'id')
      .group('id')
      .order('id')
      .having({
        count: {
          id: 5,
        },
      })
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
        .toSql(),
      `SELECT * FROM "user"`,
    );
  });

  it('should clear increment and decrement', () => {
    const expectedSql = line(`
      UPDATE "user" SET "name" = $1, "updatedAt" = now()
    `);
    const expectedValues = ['new name'];

    expectSql(
      User.where()
        .update({ name: 'new name' })
        .increment('age')
        .clear('counters')
        .toSql(),
      expectedSql,
      expectedValues,
    );

    expectSql(
      User.where()
        .update({ name: 'new name' })
        .decrement('age')
        .clear('counters')
        .toSql(),
      expectedSql,
      expectedValues,
    );
  });
});
