import { line, Message, User } from '../test-utils';

describe('clear', () => {
  it('should remove query statements for select', () => {
    const query = User.with('withAlias', User.all())
      .select('id')
      .selectAs({ as: 'name' })
      .where({ id: 1 })
      .or({ id: 2 })
      .union([User.select('id').selectAs({ as: 'name' })])
      .join(Message, 'authorId', 'id')
      .group('id')
      .order({ id: 'ASC' })
      .having({
        count: {
          id: 5,
        },
      })
      .limit(10)
      .offset(10);

    expect(
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
    ).toBe(
      line(`
        SELECT "user".* FROM "user"
      `),
    );
  });

  it('should clear increment and decrement', () => {
    const expectedSql = line(`
      UPDATE "user" SET "name" = 'new name'
    `);

    expect(
      User.update({ name: 'new name' })
        .increment('age')
        .clear('counters')
        .toSql(),
    ).toBe(expectedSql);

    expect(
      User.update({ name: 'new name' })
        .decrement('age')
        .clear('counters')
        .toSql(),
    ).toBe(expectedSql);
  });
});
