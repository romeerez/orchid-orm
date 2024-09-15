import {
  expectQueryNotMutated,
  Snake,
  snakeData,
  SnakeRecord,
  snakeSelectAll,
  User,
  Profile,
  userData,
  UserInsert,
  Product,
  userColumnsSql,
} from '../test-utils/test-utils';
import {
  assertType,
  expectSql,
  sql,
  testDb,
  useTestDatabase,
} from 'test-utils';
import { RelationConfigBase, RelationQuery } from '../relations';
import { addQueryOn } from './join/join';
import { Query } from '../query/query';

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

  it('should let update all records after using `all` method', async () => {
    const q = User.all().update({ name: 'new name' });

    assertType<Awaited<typeof q>, number>();
  });

  it('should update record with raw sql, returning updated rows count', async () => {
    const count = 2;
    const users = await User.select('id').createMany([userData, userData]);

    const query = User.orWhere(...users).updateSql(User.sql`name = 'name'`);
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

  it('should accept template string for `updateSql`', () => {
    const q = User.all().updateSql`name = ${'name'}`;
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
    expect(updated).toMatchObject({ name: update.name });
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
    expect(updated).toMatchObject({ name: update.name });
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
        RETURNING "snake"."snake_id"
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
    expect(updated).toMatchObject({ name: update.name });
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
        RETURNING "snake"."snake_name" "snakeName", "snake"."tail_length" "tailLength"
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
        RETURNING ${userColumnsSql}
      `,
      [update.name, update.password, id],
    );

    const result = await query;
    assertType<typeof result, typeof User.outputType>();

    const updated = await User.take();
    expect(updated).toMatchObject({ name: update.name });
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
    expect(updated).toMatchObject([
      { name: update.name },
      { name: update.name },
    ]);
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
        RETURNING "snake"."snake_name" "snakeName", "snake"."tail_length" "tailLength"
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
        RETURNING ${userColumnsSql}
      `,
      [update.name, update.password, ids[0], ids[1]],
    );

    const result = await query;
    expect(result[0]).toMatchObject({ name: update.name });

    assertType<typeof result, (typeof User.outputType)[]>();

    const updated = await User.take();
    expect(updated).toMatchObject({ name: update.name });
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
      name: () => sql<string>`'raw sql'`,
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

  it('should support a `WITH` table value in other `WITH` clause', () => {
    const q = User.with('a', User.find(1).select('name').update(userData))
      .with('b', (q) =>
        User.find(2)
          .select('id')
          .update({
            name: () => q.from('a').get('name'),
          }),
      )
      .from('b');

    assertType<Awaited<typeof q>, { id: number }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "a" AS (
          UPDATE "user"
          SET "name" = $1, "password" = $2, "updatedAt" = now()
          WHERE "user"."id" = $3
          RETURNING "user"."name"
        ), "b" AS (
          UPDATE "user"
          SET
            "name" = (
              SELECT "a"."name" FROM "a" LIMIT 1
            ),
            "updatedAt" = now()
          WHERE "user"."id" = $4
          RETURNING "user"."id"
        )
        SELECT * FROM "b"
      `,
      ['name', 'password', 1, 2],
    );
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
        RETURNING ${userColumnsSql}
      `,
      [update.name, update.password, id],
    );

    const result = await query;
    assertType<typeof result, typeof User.outputType>();

    expect(result).toMatchObject({ name: update.name });
  });

  it('should throw when searching for one to update and it is not found', async () => {
    const q = User.selectAll().findBy({ id: 1 }).update({ name: 'new name' });

    assertType<Awaited<typeof q>, typeof User.outputType>();

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
        joinQuery(toQuery: Query, baseQuery: Query) {
          return addQueryOn(
            toQuery,
            baseQuery,
            toQuery,
            'id',
            'profile.userId',
          );
        },
      },
    });
    user.baseQuery = user;

    const profile = Object.assign(Profile, {
      user,
    }) as unknown as Omit<typeof Profile, 'relations'> & {
      relations: {
        user: RelationQuery<RelationConfigBase & { query: typeof User }>;
      };
      user: RelationQuery<RelationConfigBase & { query: typeof User }>;
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
          bio: (q) => q.find(1).update({ name: 'new name' }),
        }),
      ).toThrow();
    });

    it('should forbid updating a column with a result of relation query that performs create', () => {
      expect(() =>
        profile.all().update({
          // @ts-expect-error sub query must be of kind 'select'
          bio: (q) => q.create(userData),
        }),
      ).toThrow();
    });

    it('should forbid updating a column with a result of relation query that performs delete', () => {
      expect(() =>
        profile.all().update({
          // @ts-expect-error sub query must be of kind 'select'
          bio: (q) => q.find(1).delete(),
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
    } as unknown as UserInsert);

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

  describe.each(['increment', 'decrement'] as const)('%s', (action) => {
    const sign = action === 'increment' ? '+' : '-';

    it('should support bigint', () => {
      const table = testDb(
        'table',
        (t) => ({
          num: t.bigint().nullable(),
          nullable: t.bigint().nullable(),
        }),
        undefined,
        { noPrimaryKey: 'ignore' },
      );

      table[action]('num');
      table[action]('nullable');

      table[action]({ num: 1n });
      table[action]({ nullable: 1n });

      table[action]({ num: '1' });
      table[action]({ nullable: '1' });
    });

    it('should not mutate query', () => {
      const q = User.all();

      q.where({ name: 'name' })[action]('age');

      expectQueryNotMutated(q);
    });

    it(`should ${action} column by 1`, () => {
      const q = User[action]('age');

      expectSql(
        q.toSQL(),
        `
          UPDATE "user"
          SET "age" = "age" ${sign} $1,
              "updatedAt" = now()
        `,
        [1],
      );
    });

    it(`should ${action} decimal column by 1`, () => {
      const q = Product[action]('price');

      expectSql(
        q.toSQL(),
        `
          UPDATE "product"
          SET "price" = "price" ${sign} $1
        `,
        [1],
      );
    });

    it(`should ${action} column by provided amount`, () => {
      const q = User[action]({ age: 3 });

      expectSql(
        q.toSQL(),
        `
          UPDATE "user"
          SET "age" = "age" ${sign} $1,
              "updatedAt" = now()
        `,
        [3],
      );
    });

    it(`should ${action} decimal column by provided amount`, () => {
      const q = Product[action]({ price: '1' });

      expectSql(
        q.toSQL(),
        `
          UPDATE "product"
          SET "price" = "price" ${sign} $1
        `,
        ['1'],
      );
    });

    it('should support returning', () => {
      const q = User.select('id')[action]({ age: 3 });

      expectSql(
        q.toSQL(),
        `
          UPDATE "user"
          SET "age" = "age" ${sign} $1,
              "updatedAt" = now()
          RETURNING "user"."id"
        `,
        [3],
      );

      assertType<Awaited<typeof q>, { id: number }[]>();
    });

    it(`should ${action} named column`, () => {
      const q = Snake.select('snakeId')[action]({ tailLength: 3 });

      expectSql(
        q.toSQL(),
        `
          UPDATE "snake"
          SET "tail_length" = "tail_length" ${sign} $1,
              "updated_at" = now()
          RETURNING "snake"."snake_id" "snakeId"
        `,
        [3],
      );

      assertType<Awaited<typeof q>, { snakeId: number }[]>();
    });

    it('should throw not found error when record does not exist', async () => {
      await expect(User.find(123)[action]('age')).rejects.toThrow(
        'Record is not found',
      );
    });

    it('should not throw not found error when record exists', async () => {
      const id = await User.get('id').create(userData);

      const res = await User.find(id)[action]('age');

      expect(res).toBe(1);
      assertType<typeof res, number>();
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
          data: (q) => q.get('data').jsonInsert([0], 'data'),
        });

      expectSql(
        query.toSQL(),
        `
          UPDATE "user"
          SET "name" = $1,
              "id" = "id" + $2,
              "password" = $3,
              "age" = "age" - $4,
              "data" = jsonb_insert("user"."data", $5, $6),
              "updatedAt" = now()
          WHERE "user"."id" = $7
          RETURNING "user"."id"
        `,
        ['name', 1, 'password', 1, '{0}', '"data"', 1],
      );
    });
  });

  describe('updating with empty set', () => {
    const User = testDb('user', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      password: t.text(),
    }));

    beforeAll(async () => {
      await User.insert(userData);
    });

    it('should select count for return type `rowCount`', async () => {
      const q = User.all().update({});

      expectSql(q.toSQL(), `SELECT count(*) FROM "user"`);

      expect(await q).toBe(1);
    });

    it('should select records for return type of many records', async () => {
      const q = User.all().select('name').update({});

      expectSql(q.toSQL(), `SELECT "user"."name" FROM "user"`);

      const res = await q;

      assertType<typeof res, { name: string }[]>();

      expect(res).toEqual([{ name: userData.name }]);
    });

    it('should select one record for return type selecting one record', async () => {
      const q = User.select('name').where().take().update({});

      expectSql(q.toSQL(), `SELECT "user"."name" FROM "user"  LIMIT 1`);

      const res = await q;

      assertType<typeof res, { name: string }>();

      expect(res).toEqual({ name: userData.name });
    });

    it('should get a single value', async () => {
      const q = User.where().take().get('name').update({});

      expectSql(q.toSQL(), `SELECT "user"."name" FROM "user" LIMIT 1`);

      const res = await q;

      assertType<typeof res, string>();

      expect(res).toEqual(userData.name);
    });

    it('should pluck values', async () => {
      const q = User.all().pluck('name').update({});

      expectSql(q.toSQL(), `SELECT "user"."name" FROM "user"`);

      const res = await q;

      assertType<typeof res, string[]>();

      expect(res).toEqual([userData.name]);
    });
  });
});
