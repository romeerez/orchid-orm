import {
  AssertEqual,
  expectQueryNotMutated,
  expectSql,
  User,
  userData,
  useTestDatabase,
} from '../test-utils';
import { raw } from '../common';

describe('update', () => {
  useTestDatabase();

  const update = {
    name: 'new name',
    password: 'new password',
  };

  it('should not mutate query', () => {
    const q = User.all();
    q.where({ name: 'name' }).update(update);
    expectQueryNotMutated(q);
  });

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

    const query = User.or(...users).update(raw(`name = 'name'`));
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
  });

  it('should update record, returning updated row count', async () => {
    const { id } = await User.select('id').insert(userData);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = User.where({ id }).update(update);
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
    expect(updated).toMatchObject({ ...userData, ...update });
  });

  it('should update record, returning value', async () => {
    const id = await User.get('id').insert(userData);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = User.find(id).get('id').update(update);
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
    expect(updated).toMatchObject({ ...userData, ...update });
  });

  it('should update one record, return selected columns', async () => {
    const id = await User.get('id').insert(userData);

    const query = User.select('id', 'name').find(id).update(update);

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
    const eq: AssertEqual<typeof result, { id: number; name: string }> = true;
    expect(eq).toBe(true);

    const updated = await User.take();
    expect(updated).toMatchObject({ ...userData, ...update });
  });

  it('should update one record, return all columns', async () => {
    const id = await User.get('id').insert(userData);

    const query = User.selectAll().find(id).update(update);

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

    const updated = await User.take();
    expect(updated).toMatchObject({ ...userData, ...update });
  });

  it('should update multiple records, returning selected columns', async () => {
    const ids = await User.pluck('id').insert([userData, userData]);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = User.select('id', 'name')
      .where({ id: { in: ids } })
      .update(update);

    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2
        WHERE "user"."id" IN ($3, $4)
        RETURNING "user"."id", "user"."name"
      `,
      [update.name, update.password, ids[0], ids[1]],
    );

    const result = await query;
    const eq: AssertEqual<typeof result, { id: number; name: string }[]> = true;
    expect(eq).toBe(true);

    const updated = await User.take();
    expect(updated).toMatchObject({ ...userData, ...update });
  });

  it('should update multiple records, returning all columns', async () => {
    const ids = await User.pluck('id').insert([userData, userData]);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = User.selectAll()
      .where({ id: { in: ids } })
      .update(update);

    expectSql(
      query.toSql(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2
        WHERE "user"."id" IN ($3, $4)
        RETURNING *
      `,
      [update.name, update.password, ids[0], ids[1]],
    );

    const result = await query;
    expect(result[0]).toMatchObject({ ...userData, ...update });

    const eq: AssertEqual<typeof result, typeof User['type'][]> = true;
    expect(eq).toBe(true);

    const updated = await User.take();
    expect(updated).toMatchObject({ ...userData, ...update });
  });

  it('should ignore undefined values, and should not ignore null', () => {
    const query = User.where({ id: 1 }).update({
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
  });

  it('should support raw sql as a value', () => {
    const query = User.where({ id: 1 }).update({
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
  });

  it('should return one record when searching for one to update', async () => {
    const { id } = await User.select('id').insert(userData);

    const update = {
      name: 'new name',
      password: 'new password',
    };

    const query = User.selectAll().findBy({ id }).update(update);
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

    expect(result).toMatchObject({ ...userData, ...update });
  });

  it('should throw when searching for one to update and it is not found', async () => {
    const query = User.selectAll()
      .findBy({ id: 1 })
      .update({ name: 'new name' });

    const eq: AssertEqual<Awaited<typeof query>, typeof User.type> = true;
    expect(eq).toBe(true);

    await expect(query).rejects.toThrow();
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
    it('should not mutate query', () => {
      const q = User.all();
      q.where({ name: 'name' }).increment('age');
      expectQueryNotMutated(q);
    });

    it('should increment column by 1', () => {
      const query = User.increment('age');
      expectSql(
        query.toSql(),
        `
          UPDATE "user"
          SET "age" = "age" + $1
        `,
        [1],
      );
    });

    it('should increment column by provided amount', () => {
      const query = User.increment({ age: 3 });
      expectSql(
        query.toSql(),
        `
          UPDATE "user"
          SET "age" = "age" + $1
        `,
        [3],
      );
    });

    it('should support returning', () => {
      const query = User.select('id').increment({ age: 3 });
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
    });
  });

  describe('decrement', () => {
    it('should decrement column by 1', () => {
      const query = User.decrement('age');
      expectSql(
        query.toSql(),
        `
          UPDATE "user"
          SET "age" = "age" - $1
        `,
        [1],
      );
    });

    it('should decrement column by provided amount', () => {
      const query = User.decrement({ age: 3 });
      expectSql(
        query.toSql(),
        `
          UPDATE "user"
          SET "age" = "age" - $1
        `,
        [3],
      );
    });

    it('should support returning', () => {
      const query = User.select('id').decrement({ age: 3 });
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
    });
  });
});
