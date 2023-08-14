import {
  expectQueryNotMutated,
  Snake,
  snakeData,
  SnakeRecord,
  snakeSelectAll,
  User,
  Profile,
  userData,
  UserRecord,
} from '../test-utils/test-utils';
import { assertType, expectSql, useTestDatabase } from 'test-utils';
import { RelationConfigBase, RelationQuery } from '../relations';
import { addQueryOn } from './join/join';
import { Query } from '../query/query';
import { raw } from '../sql/rawSql';

describe('update', () => {
  useTestDatabase();

  const update = {
    name: 'new name',
    password: 'new password',
  };

  const snakeUpdate = {
    snakeName: 'new name',
    tailLength: 10,
  };

  it('should not mutate query', () => {
    const q = User.all();
    q.where({ name: 'name' }).update(update);
    expectQueryNotMutated(q);
  });

  it('should prevent from updating without conditions with TS and runtime error', () => {
    // @ts-expect-error update should have where condition or forceAll flag
    expect(() => User.update({ name: 'new name' })).toThrow(
      'Dangerous update without conditions',
    );
  });

  it('should let update all records after using `all` method', () => {
    User.all().update({ name: 'new name' });
  });

  it('should update record with raw sql, returning updated rows count', async () => {
    const count = 2;
    const users = await User.select('id').createMany([userData, userData]);

    const query = User.orWhere(...users).updateRaw(raw`name = 'name'`);
    expectSql(
      query.toSQL(),
      `
        UPDATE "user"
        SET name = 'name', "updatedAt" = now()
        WHERE "user"."id" = $1 OR "user"."id" = $2
      `,
      [users[0].id, users[1].id],
    );

    assertType<Awaited<typeof query>, number>();

    const result = await query;
    expect(result).toBe(count);
  });

  it('should accept template string for `updateRaw`', () => {
    const q = User.all().updateRaw`name = ${'name'}`;
    expectSql(
      q.toSQL(),
      `
        UPDATE "user"
        SET name = $1, "updatedAt" = now()
      `,
      ['name'],
    );
  });

  it('should update record, returning updated row count', async () => {
    const { id } = await User.select('id').create(userData);

    const query = User.where({ id }).update(update);
    expectSql(
      query.toSQL(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2,
            "updatedAt" = now()
        WHERE "user"."id" = $3
      `,
      [update.name, update.password, id],
    );

    const result = await query;
    assertType<typeof result, number>();

    expect(result).toBe(1);

    const updated = await User.take();
    expect(updated).toMatchObject({ ...userData, ...update });
  });

  it('should update record with named columns, returning updated row count', async () => {
    const id = await Snake.get('snakeId').create(snakeData);

    const q = Snake.find(id).update(snakeUpdate);

    expectSql(
      q.toSQL(),
      `
        UPDATE "snake"
        SET "snake_name" = $1,
            "tail_length" = $2,
            "updated_at" = now()
        WHERE "snake"."snake_id" = $3
      `,
      [snakeUpdate.snakeName, snakeUpdate.tailLength, id],
    );

    const result = await q;
    assertType<typeof result, number>();

    expect(result).toBe(1);

    const updated = await Snake.take();
    expect(updated).toMatchObject({ ...snakeData, ...snakeUpdate });
  });

  it('should update record, returning value', async () => {
    const id = await User.get('id').create(userData);

    const query = User.find(id).get('id').update(update);
    expectSql(
      query.toSQL(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2,
            "updatedAt" = now()
        WHERE "user"."id" = $3
        RETURNING "user"."id"
      `,
      [update.name, update.password, id],
    );

    const result = await query;
    assertType<typeof result, number>();

    expect(typeof result).toBe('number');

    const updated = await User.take();
    expect(updated).toMatchObject({ ...userData, ...update });
  });

  it('should update record with named columns, returning value', async () => {
    const id = await Snake.get('snakeId').create(snakeData);

    const q = Snake.find(id).get('snakeId').update(snakeUpdate);

    expectSql(
      q.toSQL(),
      `
        UPDATE "snake"
        SET "snake_name" = $1,
            "tail_length" = $2,
            "updated_at" = now()
        WHERE "snake"."snake_id" = $3
        RETURNING "snake"."snake_id" AS "snakeId"
      `,
      [snakeUpdate.snakeName, snakeUpdate.tailLength, id],
    );

    const result = await q;
    assertType<typeof result, number>();

    expect(result).toBe(id);

    const updated = await Snake.take();
    expect(updated).toMatchObject({ ...snakeData, ...snakeUpdate });
  });

  it('should update one record, return selected columns', async () => {
    const id = await User.get('id').create(userData);

    const query = User.select('id', 'name').find(id).update(update);

    expectSql(
      query.toSQL(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2,
            "updatedAt" = now()
        WHERE "user"."id" = $3
        RETURNING "user"."id", "user"."name"
      `,
      [update.name, update.password, id],
    );

    const result = await query;
    assertType<typeof result, { id: number; name: string }>();

    const updated = await User.take();
    expect(updated).toMatchObject({ ...userData, ...update });
  });

  it('should update one record with named columns, return selected columns', async () => {
    const id = await Snake.get('snakeId').create(snakeData);

    const q = Snake.select('snakeName', 'tailLength')
      .find(id)
      .update(snakeUpdate);

    expectSql(
      q.toSQL(),
      `
        UPDATE "snake"
        SET "snake_name" = $1,
            "tail_length" = $2,
            "updated_at" = now()
        WHERE "snake"."snake_id" = $3
        RETURNING "snake"."snake_name" AS "snakeName", "snake"."tail_length" AS "tailLength"
      `,
      [snakeUpdate.snakeName, snakeUpdate.tailLength, id],
    );

    const result = await q;
    assertType<typeof result, Pick<SnakeRecord, 'snakeName' | 'tailLength'>>();

    expect(result).toEqual(snakeUpdate);

    const updated = await Snake.take();
    expect(updated).toMatchObject({ ...snakeData, ...snakeUpdate });
  });

  it('should update one record, return all columns', async () => {
    const id = await User.get('id').create(userData);

    const query = User.selectAll().find(id).update(update);

    expectSql(
      query.toSQL(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2,
            "updatedAt" = now()
        WHERE "user"."id" = $3
        RETURNING *
      `,
      [update.name, update.password, id],
    );

    const result = await query;
    assertType<typeof result, typeof User.type>();

    const updated = await User.take();
    expect(updated).toMatchObject({ ...userData, ...update });
  });

  it('should update one record with named columns, return all columns', async () => {
    const id = await Snake.get('snakeId').create(snakeData);

    const q = Snake.selectAll().find(id).update(snakeUpdate);

    expectSql(
      q.toSQL(),
      `
        UPDATE "snake"
        SET "snake_name" = $1,
            "tail_length" = $2,
            "updated_at" = now()
        WHERE "snake"."snake_id" = $3
        RETURNING ${snakeSelectAll}
      `,
      [snakeUpdate.snakeName, snakeUpdate.tailLength, id],
    );

    const result = await q;
    assertType<typeof result, SnakeRecord>();

    const updated = await Snake.take();
    expect(updated).toMatchObject({ ...snakeData, ...snakeUpdate });
  });

  it('should update multiple records, returning selected columns', async () => {
    const ids = await User.pluck('id').createMany([userData, userData]);

    const query = User.select('id', 'name')
      .where({ id: { in: ids } })
      .update(update);

    expectSql(
      query.toSQL(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2,
            "updatedAt" = now()
        WHERE "user"."id" IN ($3, $4)
        RETURNING "user"."id", "user"."name"
      `,
      [update.name, update.password, ids[0], ids[1]],
    );

    const result = await query;
    assertType<typeof result, { id: number; name: string }[]>();

    const updated = await User.all();
    expect(updated).toMatchObject([update, update]);
  });

  it('should update multiple records with named columns, return selected columns', async () => {
    const ids = await Snake.pluck('snakeId').createMany([snakeData, snakeData]);

    const q = Snake.select('snakeName', 'tailLength')
      .where({ snakeId: { in: ids } })
      .update(snakeUpdate);

    expectSql(
      q.toSQL(),
      `
        UPDATE "snake"
        SET "snake_name" = $1,
            "tail_length" = $2,
            "updated_at" = now()
        WHERE "snake"."snake_id" IN ($3, $4)
        RETURNING "snake"."snake_name" AS "snakeName", "snake"."tail_length" AS "tailLength"
      `,
      [snakeUpdate.snakeName, snakeUpdate.tailLength, ...ids],
    );

    const result = await q;
    assertType<
      typeof result,
      Pick<SnakeRecord, 'snakeName' | 'tailLength'>[]
    >();

    const updated = await Snake.all();
    expect(updated).toMatchObject([snakeUpdate, snakeUpdate]);
  });

  it('should update multiple records, return all columns', async () => {
    const ids = await User.pluck('id').createMany([userData, userData]);

    const query = User.selectAll()
      .where({ id: { in: ids } })
      .update(update);

    expectSql(
      query.toSQL(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2,
            "updatedAt" = now()
        WHERE "user"."id" IN ($3, $4)
        RETURNING *
      `,
      [update.name, update.password, ids[0], ids[1]],
    );

    const result = await query;
    expect(result[0]).toMatchObject({ ...userData, ...update });

    assertType<typeof result, (typeof User)['type'][]>();

    const updated = await User.take();
    expect(updated).toMatchObject({ ...userData, ...update });
  });

  it('should update multiple records with named columns, return all columns', async () => {
    const ids = await Snake.pluck('snakeId').createMany([snakeData, snakeData]);

    const q = Snake.selectAll()
      .where({ snakeId: { in: ids } })
      .update(snakeUpdate);

    expectSql(
      q.toSQL(),
      `
        UPDATE "snake"
        SET "snake_name" = $1,
            "tail_length" = $2,
            "updated_at" = now()
        WHERE "snake"."snake_id" IN ($3, $4)
        RETURNING ${snakeSelectAll}
      `,
      [snakeUpdate.snakeName, snakeUpdate.tailLength, ...ids],
    );

    const result = await q;
    assertType<typeof result, SnakeRecord[]>();

    const updated = await Snake.all();
    expect(updated).toMatchObject([snakeUpdate, snakeUpdate]);
  });

  it('should ignore undefined values, and should not ignore null', () => {
    const query = User.where({ id: 1 }).update({
      name: 'new name',
      password: undefined,
      data: null,
    });

    expectSql(
      query.toSQL(),
      `
        UPDATE "user"
        SET "name" = $1,
            "data" = $2,
            "updatedAt" = now()
        WHERE "user"."id" = $3
      `,
      ['new name', null, 1],
    );

    assertType<Awaited<typeof query>, number>();
  });

  it('should support raw sql as a value', () => {
    const query = User.where({ id: 1 }).update({
      name: raw`'raw sql'`,
    });

    expectSql(
      query.toSQL(),
      `
        UPDATE "user"
        SET "name" = 'raw sql', "updatedAt" = now()
        WHERE "user"."id" = $1
      `,
      [1],
    );

    assertType<Awaited<typeof query>, number>();
  });

  it('should return one record when searching for one to update', async () => {
    const { id } = await User.select('id').create(userData);

    const query = User.selectAll().findBy({ id }).update(update);

    expectSql(
      query.toSQL(),
      `
        UPDATE "user"
        SET "name" = $1,
            "password" = $2,
            "updatedAt" = now()
        WHERE "user"."id" = $3
        RETURNING *
      `,
      [update.name, update.password, id],
    );

    const result = await query;
    assertType<typeof result, typeof User.type>();

    expect(result).toMatchObject({ ...userData, ...update });
  });

  it('should throw when searching for one to update and it is not found', async () => {
    const q = User.selectAll().findBy({ id: 1 }).update({ name: 'new name' });

    assertType<Awaited<typeof q>, typeof User.type>();

    await expect(q).rejects.toThrow();
  });

  it('should update column with a sub query result', () => {
    const q = User.all().update({
      name: User.get('name'),
    });

    expectSql(
      q.toSQL(),
      `
        UPDATE "user"
        SET
          "name" = (SELECT "user"."name" FROM "user" LIMIT 1),
          "updatedAt" = now()
      `,
    );
  });

  it('should update column with a result of a sub query that performs update', () => {
    const q = User.find(1).update({
      name: User.find(2).get('name').update({ name: 'new name' }),
    });

    expectSql(
      q.toSQL(),
      `
        WITH "q" AS (
          UPDATE "user"
             SET "name" = $1,
                 "updatedAt" = now()
          WHERE "user"."id" = $2
          RETURNING "user"."name"
        )
        UPDATE "user"
           SET "name" = (SELECT * FROM "q"),
               "updatedAt" = now()
        WHERE "user"."id" = $3
      `,
      ['new name', 2, 1],
    );
  });

  it('should update column with a result of a sub query that performs create', () => {
    const q = User.find(1).update({
      name: User.get('name').create(userData),
    });

    expectSql(
      q.toSQL(),
      `
        WITH "q" AS (
          INSERT INTO "user"("name", "password")
          VALUES ($1, $2)
          RETURNING "user"."name"
        )
        UPDATE "user"
           SET "name" = (SELECT * FROM "q"),
               "updatedAt" = now()
        WHERE "user"."id" = $3
      `,
      [userData.name, userData.password, 1],
    );
  });

  it('should update column with a result of a sub query that performs delete', () => {
    const q = User.find(1).update({
      name: User.find(2).get('name').delete(),
    });

    expectSql(
      q.toSQL(),
      `
        WITH "q" AS (
          DELETE FROM "user"
          WHERE "user"."id" = $1
          RETURNING "user"."name"
        )
        UPDATE "user"
           SET "name" = (SELECT * FROM "q"),
               "updatedAt" = now()
        WHERE "user"."id" = $2
      `,
      [2, 1],
    );
  });

  describe('update with relation query', () => {
    const user = Object.assign(Object.create(User), {
      relationConfig: {
        joinQuery(fromQuery: Query, toQuery: Query) {
          return addQueryOn(toQuery, fromQuery, toQuery, 'id', 'userId');
        },
      },
    });
    user.baseQuery = user;

    const profile = Object.assign(Profile, {
      user,
    }) as unknown as typeof Profile & {
      relations: {
        user: RelationQuery<'user', RelationConfigBase, typeof User>;
      };
      user: RelationQuery<'user', RelationConfigBase, typeof User>;
    };

    it('should update column with a sub query callback', () => {
      const q = profile.all().update({
        userId: (q) => q.user.get('id'),
      });

      expectSql(
        q.toSQL(),
        `
        UPDATE "profile"
        SET
          "userId" = (
            SELECT "user"."id"
            FROM "user"
            WHERE "user"."id" = "profile"."userId"
            LIMIT 1
          ),
          "updatedAt" = now()
      `,
      );
    });

    it('should forbid updating a column with a result of relation query that performs update', () => {
      expect(() =>
        profile.all().update({
          // @ts-expect-error sub query must be of kind 'select'
          bio: (q) => q.user.get('name').find(1).update({ name: 'new name' }),
        }),
      ).toThrow();
    });

    it('should forbid updating a column with a result of relation query that performs create', () => {
      expect(() =>
        profile.all().update({
          // @ts-expect-error sub query must be of kind 'select'
          bio: (q) => q.user.get('name').create(userData),
        }),
      ).toThrow();
    });

    it('should forbid updating a column with a result of relation query that performs delete', () => {
      expect(() =>
        profile.all().update({
          // @ts-expect-error sub query must be of kind 'select'
          bio: (q) => q.user.get('name').find(1).delete(),
        }),
      ).toThrow();
    });
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

  it('should strip unknown keys', () => {
    const query = User.find(1).update({
      name: 'name',
      unknown: 'should be stripped',
    } as unknown as UserRecord);

    expectSql(
      query.toSQL(),
      `
        UPDATE "user"
        SET "name" = $1, "updatedAt" = now()
        WHERE "user"."id" = $2
      `,
      ['name', 1],
    );
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
        query.toSQL(),
        `
          UPDATE "user"
          SET "age" = "age" + $1,
              "updatedAt" = now()
        `,
        [1],
      );
    });

    it('should increment column by provided amount', () => {
      const query = User.increment({ age: 3 });
      expectSql(
        query.toSQL(),
        `
          UPDATE "user"
          SET "age" = "age" + $1,
              "updatedAt" = now()
        `,
        [3],
      );
    });

    it('should support returning', () => {
      const query = User.select('id').increment({ age: 3 });
      expectSql(
        query.toSQL(),
        `
          UPDATE "user"
          SET "age" = "age" + $1,
              "updatedAt" = now()
          RETURNING "user"."id"
        `,
        [3],
      );

      assertType<Awaited<typeof query>, { id: number }[]>();
    });

    it('should increment named column', () => {
      const q = Snake.select('snakeId').increment({ tailLength: 3 });

      expectSql(
        q.toSQL(),
        `
          UPDATE "snake"
          SET "tail_length" = "tail_length" + $1,
              "updated_at" = now()
          RETURNING "snake"."snake_id" AS "snakeId"
        `,
        [3],
      );

      assertType<Awaited<typeof q>, { snakeId: number }[]>();
    });
  });

  describe('decrement', () => {
    it('should decrement column by 1', () => {
      const query = User.decrement('age');
      expectSql(
        query.toSQL(),
        `
          UPDATE "user"
          SET "age" = "age" - $1,
              "updatedAt" = now()
        `,
        [1],
      );
    });

    it('should decrement column by provided amount', () => {
      const query = User.decrement({ age: 3 });
      expectSql(
        query.toSQL(),
        `
          UPDATE "user"
          SET "age" = "age" - $1,
              "updatedAt" = now()
        `,
        [3],
      );
    });

    it('should support returning', () => {
      const query = User.select('id').decrement({ age: 3 });
      expectSql(
        query.toSQL(),
        `
          UPDATE "user"
          SET "age" = "age" - $1,
              "updatedAt" = now()
          RETURNING "user"."id"
        `,
        [3],
      );

      assertType<Awaited<typeof query>, { id: number }[]>();
    });

    it('should decrement named column', () => {
      const q = Snake.select('snakeId').decrement({ tailLength: 3 });

      expectSql(
        q.toSQL(),
        `
          UPDATE "snake"
          SET "tail_length" = "tail_length" - $1,
              "updated_at" = now()
          RETURNING "snake"."snake_id" AS "snakeId"
        `,
        [3],
      );

      assertType<Awaited<typeof q>, { snakeId: number }[]>();
    });
  });

  describe('chaining', () => {
    it('should handle multiple updates with increment and decrement', () => {
      const query = User.select('id')
        .find(1)
        .update({ name: 'name' })
        .increment('id')
        .update({ password: 'password' })
        .decrement('age')
        .update({
          data: (q) => q.jsonInsert('data', [0], 'data'),
        });

      expectSql(
        query.toSQL(),
        `
          UPDATE "user"
          SET "name" = $1,
              "id" = "id" + $2,
              "password" = $3,
              "age" = "age" - $4,
              "data" = jsonb_insert("user"."data", '{0}', $5),
              "updatedAt" = now()
          WHERE "user"."id" = $6
          RETURNING "user"."id"
        `,
        ['name', 1, 'password', 1, '"data"', 1],
      );
    });
  });
});
