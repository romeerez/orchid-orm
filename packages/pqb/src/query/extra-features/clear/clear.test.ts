import {
  Message,
  User,
  userColumnsSql,
} from '../../../test-utils/pqb.test-utils';
import { expectSql, line } from 'test-utils';

describe('clear', () => {
  it('should remove query statements for select', () => {
    const inner = User.select('id', { as: 'name' });

    const query = User.select('id', { as: 'name' })
      .with('withAlias', User.all())
      .where({ id: 1 })
      .orWhere({ id: 2 })
      .union(inner)
      .join(Message, 'authorId', 'id')
      .group('id')
      .order('id')
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
      `SELECT ${userColumnsSql} FROM "schema"."user"`,
    );
  });

  it('should clear increment and decrement', () => {
    const expectedSql = line(`
      UPDATE "schema"."user" SET "name" = $1, "updated_at" = now()
    `);
    const expectedValues = ['new name'];

    expectSql(
      User.all()
        .update({ name: 'new name' })
        .increment('age')
        .clear('counters')
        .toSQL(),
      expectedSql,
      expectedValues,
    );

    expectSql(
      User.all()
        .update({ name: 'new name' })
        .decrement('age')
        .clear('counters')
        .toSQL(),
      expectedSql,
      expectedValues,
    );
  });
});
