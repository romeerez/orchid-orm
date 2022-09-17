import {
  AssertEqual,
  expectMatchObjectWithTimestamps,
  expectQueryNotMutated,
  expectSql,
  User,
  userData,
  useTestDatabase,
} from '../test-utils';
import { raw } from '../common';

describe('update', () => {
  useTestDatabase();

  it('should throw when updating without where condition', () => {
    // @ts-expect-error update should have where condition or forceAll flag
    expect(() => User.update({ name: 'new name' })).toThrow();
  });

  it('should run without where condition when forceAll flag provided', async () => {
    await expect(
      User.update({ name: 'new name' }, true),
    ).resolves.not.toThrow();
  });

  it('should update record with raw sql, returning updated rows count', async () => {
    const count = 2;
    const users = await User.select('id').insert([userData, userData]);

    const q = User.all();

    const query = q.or(...users).update(raw(`name = 'name'`));
    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET name = 'name'
        WHERE "user"."id" = $1 OR "user"."id" = $2
      `,
      [users[0].id, users[1].id],
    );

    const eq: AssertEqual<Awaited<typeof query>, number> = true;
    expect(eq).toBe(true);

    const result = await query;
    expect(result).toBe(count);

    expectQueryNotMutated(q);
  });

  it('should update record, returning updated row count', async () => {
    const q = User.all();

    const { id } = await q.select('id').insert(userData);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = q.where({ id }).update(update);
    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2
        WHERE "user"."id" = $3
      `,
      [update.name, update.password, id],
    );

    const result = await query;
    const eq: AssertEqual<typeof result, number> = true;
    expect(eq).toBe(true);

    expect(result).toBe(1);

    const updated = await User.take();
    expectMatchObjectWithTimestamps(updated, { ...userData, ...update });

    expectQueryNotMutated(q);
  });

  it('should update record, returning value', async () => {
    const q = User.all();

    const id = await q.value('id').insert(userData);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = q.find(id).value('id').update(update);
    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2
        WHERE "user"."id" = $3
        RETURNING "user"."id"
      `,
      [update.name, update.password, id],
    );

    const result = await query;
    const eq: AssertEqual<typeof result, number> = true;
    expect(eq).toBe(true);

    expect(typeof result).toBe('number');

    const updated = await User.take();
    expectMatchObjectWithTimestamps(updated, { ...userData, ...update });

    expectQueryNotMutated(q);
  });

  it('should update record, returning columns', async () => {
    const q = User.all();

    const { id } = await q.select('id').insert(userData);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = q.select('id', 'name').where({ id }).update(update);
    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2
        WHERE "user"."id" = $3
        RETURNING "user"."id", "user"."name"
      `,
      [update.name, update.password, id],
    );

    const result = await query;
    const eq: AssertEqual<typeof result, { id: number; name: string }[]> = true;
    expect(eq).toBe(true);

    const updated = await User.take();
    expectMatchObjectWithTimestamps(updated, { ...userData, ...update });

    expectQueryNotMutated(q);
  });

  it('should update record, returning all columns', async () => {
    const q = User.all();

    const { id } = await q.select('id').insert(userData);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = q.selectAll().where({ id }).update(update);
    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2
        WHERE "user"."id" = $3
        RETURNING *
      `,
      [update.name, update.password, id],
    );

    const result = await query;
    expectMatchObjectWithTimestamps(result[0], { ...userData, ...update });

    const eq: AssertEqual<typeof result, typeof User['type'][]> = true;
    expect(eq).toBe(true);

    const updated = await User.take();
    expectMatchObjectWithTimestamps(updated, { ...userData, ...update });

    expectQueryNotMutated(q);
  });

  it('should ignore undefined values, and should not ignore null', () => {
    const q = User.all();

    const query = q.where({ id: 1 }).update({
      name: 'new name',
      password: undefined,
      data: null,
    });
    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "name" = $1,
            "data" = $2
        WHERE "user"."id" = $3
      `,
      ['new name', null, 1],
    );

    const eq: AssertEqual<Awaited<typeof query>, number> = true;
    expect(eq).toBe(true);

    expectQueryNotMutated(q);
  });

  it('should support raw sql as a value', () => {
    const q = User.all();

    const query = q.where({ id: 1 }).update({
      name: raw(`'raw sql'`),
    });
    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "name" = 'raw sql'
        WHERE "user"."id" = $1
      `,
      [1],
    );

    const eq: AssertEqual<Awaited<typeof query>, number> = true;
    expect(eq).toBe(true);

    expectQueryNotMutated(q);
  });

  it('should return one record when searching for one to update', async () => {
    const q = User.all();

    const { id } = await q.select('id').insert(userData);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = q.selectAll().findBy({ id }).update(update);
    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2
        WHERE "user"."id" = $3
        RETURNING *
      `,
      [update.name, update.password, id],
    );

    const result = await query;
    const eq: AssertEqual<typeof result, typeof User.type> = true;
    expect(eq).toBe(true);

    expectMatchObjectWithTimestamps(result, { ...userData, ...update });

    expectQueryNotMutated(q);
  });

  it('should throw when searching for one to update and it is not found', async () => {
    const q = User.all();

    const query = q.selectAll().findBy({ id: 1 }).update({ name: 'new name' });

    const eq: AssertEqual<Awaited<typeof query>, typeof User.type> = true;
    expect(eq).toBe(true);

    await expect(query).rejects.toThrow();

    expectQueryNotMutated(q);
  });

  describe('updateOrThrow', () => {
    it('should throw if no records were found for update', async () => {
      await expect(
        User.where({ name: 'not found' }).updateOrThrow({ name: 'name' }),
      ).rejects.toThrow();

      await expect(
        User.select('id')
          .where({ name: 'not found' })
          .updateOrThrow({ name: 'name' }),
      ).rejects.toThrow();
    });
  });

  describe('increment', () => {
    it('should increment column by 1', () => {
      const q = User.all();

      const query = q.increment('age');
      expectSql(
        query.toSql(),
        `
          UPDATE "user"
          SET "age" = "age" + $1
        `,
        [1],
      );

      expectQueryNotMutated(q);
    });

    it('should increment column by provided amount', () => {
      const q = User.all();

      const query = q.increment({ age: 3 });
      expectSql(
        query.toSql(),
        `
          UPDATE "user"
          SET "age" = "age" + $1
        `,
        [3],
      );

      expectQueryNotMutated(q);
    });

    it('should support returning', () => {
      const q = User.all();

      const query = q.select('id').increment({ age: 3 });
      expectSql(
        query.toSql(),
        `
          UPDATE "user"
          SET "age" = "age" + $1
          RETURNING "user"."id"
        `,
        [3],
      );

      const eq: AssertEqual<Awaited<typeof query>, { id: number }[]> = true;
      expect(eq).toBe(true);

      expectQueryNotMutated(q);
    });
  });

  describe('decrement', () => {
    it('should decrement column by 1', () => {
      const q = User.all();

      const query = q.decrement('age');
      expectSql(
        query.toSql(),
        `
          UPDATE "user"
          SET "age" = "age" - $1
        `,
        [1],
      );

      expectQueryNotMutated(q);
    });

    it('should decrement column by provided amount', () => {
      const q = User.all();

      const query = q.decrement({ age: 3 });
      expectSql(
        query.toSql(),
        `
          UPDATE "user"
          SET "age" = "age" - $1
        `,
        [3],
      );

      expectQueryNotMutated(q);
    });

    it('should support returning', () => {
      const q = User.all();

      const query = q.select('id').decrement({ age: 3 });
      expectSql(
        query.toSql(),
        `
          UPDATE "user"
          SET "age" = "age" - $1
          RETURNING "user"."id"
        `,
        [3],
      );

      const eq: AssertEqual<Awaited<typeof query>, { id: number }[]> = true;
      expect(eq).toBe(true);

      expectQueryNotMutated(q);
    });
  });
});
