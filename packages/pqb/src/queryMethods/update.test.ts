import {
  AssertEqual,
  expectMatchObjectWithTimestamps,
  expectQueryNotMutated,
  line,
  User,
  useTestDatabase,
} from '../test-utils';
import { raw } from '../common';

describe('update', () => {
  useTestDatabase();

  const now = new Date();
  const data = {
    name: 'name',
    password: 'password',
    createdAt: now,
    updatedAt: now,
  };

  it('should update record with raw sql, returning void', () => {
    const q = User.all();

    const query = q.update(raw('raw sql'));
    expect(query.toSql()).toBe(
      line(`
        UPDATE "user"
        SET raw sql
      `),
    );

    const eq: AssertEqual<Awaited<typeof query>, void> = true;
    expect(eq).toBe(true);

    expectQueryNotMutated(q);
  });

  it('should update record, returning void', async () => {
    const q = User.all();

    const { id } = await q.insert(data, ['id']);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = q.where({ id }).update(update);
    expect(query.toSql()).toBe(
      line(`
        UPDATE "user"
        SET "name" = 'new name',
            "password" = 'new password'
        WHERE "user"."id" = ${id}
      `),
    );

    const result = await query;
    const eq: AssertEqual<typeof result, void> = true;
    expect(eq).toBe(true);

    const updated = await User.take();
    expectMatchObjectWithTimestamps(updated, { ...data, ...update });

    expectQueryNotMutated(q);
  });

  it('should update record, returning columns', async () => {
    const q = User.all();

    const { id } = await q.insert(data, ['id']);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = q.where({ id }).update(update, ['id', 'name']);
    expect(query.toSql()).toBe(
      line(`
        UPDATE "user"
        SET "name" = 'new name',
            "password" = 'new password'
        WHERE "user"."id" = ${id}
        RETURNING "user"."id", "user"."name"
      `),
    );

    const result = await query;
    const eq: AssertEqual<typeof result, { id: number; name: string }[]> = true;
    expect(eq).toBe(true);

    const updated = await User.take();
    expectMatchObjectWithTimestamps(updated, { ...data, ...update });

    expectQueryNotMutated(q);
  });

  it('should update record, returning all columns', async () => {
    const q = User.all();

    const { id } = await q.insert(data, ['id']);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = q.where({ id }).update(update, '*');
    expect(query.toSql()).toBe(
      line(`
        UPDATE "user"
        SET "name" = 'new name',
            "password" = 'new password'
        WHERE "user"."id" = ${id}
        RETURNING *
      `),
    );

    const result = await query;
    expectMatchObjectWithTimestamps(result[0], { ...data, ...update });

    const eq: AssertEqual<typeof result, typeof User['type'][]> = true;
    expect(eq).toBe(true);

    const updated = await User.take();
    expectMatchObjectWithTimestamps(updated, { ...data, ...update });

    expectQueryNotMutated(q);
  });
});
