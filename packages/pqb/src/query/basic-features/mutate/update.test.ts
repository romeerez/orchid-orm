import { expectQueryNotMutated } from '../../../test-utils/pqb.test-utils';
import {
  assertType,
  ChatData,
  db,
  expectSql,
  MessageData,
  sql,
  testDb,
  testJsonValue,
  UserData,
  UserDefaultSelect,
  UserSelectAll,
  UserSelectAllWithTable,
  useTestDatabase,
} from 'test-utils';

const TableWithReadOnly = testDb(
  'table',
  (t) => ({
    Id: t.identity().primaryKey(),
    key: t.string(),
    value: t.integer().readOnly(),
  }),
  undefined,
  { schema: () => 'schema' },
);

const minUserData = {
  Name: UserData.Name,
  UserKey: UserData.UserKey,
  Password: UserData.Password,
};

describe('update', () => {
  useTestDatabase();

  const update = {
    Name: 'new name',
    Password: 'new password',
  };

  it('should not allow using appReadOnly columns', () => {
    expect(() =>
      TableWithReadOnly.find(1).update({
        key: 'key',
        // @ts-expect-error value is readOnly
        value: 123,
      }),
    ).toThrow('Trying to update a readonly column');
  });

  it('should not mutate query', () => {
    const q = db.user.all();

    q.where({ Name: 'name' }).update(update);

    expectQueryNotMutated(q);
  });

  it('should prevent from updating without conditions with TS and runtime error', () => {
    // @ts-expect-error update should have where condition or forceAll flag
    expect(() => db.user.update({ Name: 'new name' })).toThrow(
      'Dangerous update without conditions',
    );
  });

  it('should throw when updating with an empty effective where filter', () => {
    expect(() => db.user.where({}).update(update).toSQL()).toThrow(
      'Dangerous update without conditions',
    );

    expect(() =>
      db.user.where({ Name: undefined }).update(update).toSQL(),
    ).toThrow('Dangerous update without conditions');
  });

  it('should throw when updateOrThrow has an empty effective where filter', () => {
    expect(() => db.user.where({}).updateOrThrow(update).toSQL()).toThrow(
      'Dangerous update without conditions',
    );

    expect(() =>
      db.user.where({ Name: undefined }).updateOrThrow(update).toSQL(),
    ).toThrow('Dangerous update without conditions');
  });

  it('should allow updating after explicit all with an empty effective where filter', () => {
    expectSql(
      db.user
        .all()
        .where({ Name: undefined })
        .update({ Name: 'new name' })
        .toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET "name" = $1,
            "updated_at" = now()
      `,
      ['new name'],
    );
  });

  it('should let update all records after using `all` method', async () => {
    const q = db.user.all().update({ Name: 'new name' });

    assertType<Awaited<typeof q>, number>();
  });

  it('should update record with raw sql, returning updated rows count', async () => {
    const count = 2;
    const users = await db.user.select('Id').createMany([UserData, UserData]);

    const query = db.user.orWhere(...users).update({
      Name: () => sql`'name'`,
    });

    expectSql(
      query.toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET "name" = 'name', "updated_at" = now()
        WHERE "User"."id" = $1 OR "User"."id" = $2
      `,
      [users[0].Id, users[1].Id],
    );

    assertType<Awaited<typeof query>, number>();

    const result = await query;
    expect(result).toBe(count);
  });

  it('should update record, returning updated row count', async () => {
    const { Id: id } = await db.user.select('Id').create(UserData);

    const query = db.user.where({ Id: id }).update(update);
    expectSql(
      query.toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET "name" = $1,
            "password" = $2,
            "updated_at" = now()
        WHERE "User"."id" = $3
      `,
      [update.Name, update.Password, id],
    );

    const result = await query;
    assertType<typeof result, number>();

    expect(result).toBe(1);

    const updated = await db.user.take();
    expect(updated).toMatchObject({ Name: update.Name });
  });

  it('should update record, returning value', async () => {
    const id = await db.user.get('Id').create(UserData);

    const query = db.user.find(id).get('Id').update(update);
    expectSql(
      query.toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET "name" = $1,
            "password" = $2,
            "updated_at" = now()
        WHERE "User"."id" = $3
        RETURNING "User"."id"
      `,
      [update.Name, update.Password, id],
    );

    const result = await query;
    assertType<typeof result, number>();

    expect(typeof result).toBe('number');

    const updated = await db.user.take();
    expect(updated).toMatchObject({ Name: update.Name });
  });

  it('should update one record, return selected columns', async () => {
    const id = await db.user.get('Id').create(UserData);

    const query = db.user.select('Id', 'Name').find(id).update(update);

    expectSql(
      query.toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET "name" = $1,
            "password" = $2,
            "updated_at" = now()
        WHERE "User"."id" = $3
        RETURNING "User"."id" "Id", "User"."name" "Name"
      `,
      [update.Name, update.Password, id],
    );

    const result = await query;
    assertType<typeof result, { Id: number; Name: string }>();

    const updated = await db.user.take();
    expect(updated).toMatchObject({ Name: update.Name });
  });

  it('should support appending select', async () => {
    const id = await db.user.get('Id').create(UserData);

    const result = await db.user
      .find(id)
      .update(update)
      .select('Name', 'Password');

    assertType<typeof result, { Name: string; Password: string }>();

    expect(result).toEqual(update);
  });

  it('should update one record, return all columns', async () => {
    const id = await db.user.get('Id').create(UserData);

    const query = db.user.selectAll().find(id).update(update);

    expectSql(
      query.toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET "name" = $1,
            "password" = $2,
            "updated_at" = now()
        WHERE "User"."id" = $3
        RETURNING ${UserSelectAll}
      `,
      [update.Name, update.Password, id],
    );

    const result = await query;
    assertType<typeof result, UserDefaultSelect>();

    const updated = await db.user.take();
    expect(updated).toMatchObject({ Name: update.Name });
  });

  it('should support appending selectAll', async () => {
    const id = await db.user.get('Id').create(UserData);

    const result = await db.user.find(id).update(update).selectAll();

    assertType<typeof result, typeof db.user.__outputType>();

    expect(result).toMatchObject({ Name: update.Name });
  });

  it('should update multiple records, returning selected columns', async () => {
    const ids = await db.user.pluck('Id').createMany([UserData, UserData]);

    const query = db.user
      .select('Id', 'Name')
      .where({ Id: { in: ids } })
      .update(update);

    expectSql(
      query.toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET "name" = $1,
            "password" = $2,
            "updated_at" = now()
        WHERE "User"."id" IN ($3, $4)
        RETURNING "User"."id" "Id", "User"."name" "Name"
      `,
      [update.Name, update.Password, ids[0], ids[1]],
    );

    const result = await query;
    assertType<typeof result, { Id: number; Name: string }[]>();

    const updated = await db.user.all();
    expect(updated).toMatchObject([
      { Name: update.Name },
      { Name: update.Name },
    ]);
  });

  it('should support appending select', async () => {
    const ids = await db.user.pluck('Id').createMany([UserData, UserData]);

    const result = await db.user
      .where({ Id: { in: ids } })
      .update(update)
      .select('Id', 'Name');

    assertType<typeof result, { Id: number; Name: string }[]>();

    expect(result).toMatchObject([
      { Name: update.Name },
      { Name: update.Name },
    ]);
  });

  it('should update multiple records, return all columns', async () => {
    const ids = await db.user.pluck('Id').createMany([UserData, UserData]);

    const query = db.user
      .selectAll()
      .where({ Id: { in: ids } })
      .update(update);

    expectSql(
      query.toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET "name" = $1,
            "password" = $2,
            "updated_at" = now()
        WHERE "User"."id" IN ($3, $4)
        RETURNING ${UserSelectAll}
      `,
      [update.Name, update.Password, ids[0], ids[1]],
    );

    const result = await query;
    expect(result[0]).toMatchObject({ Name: update.Name });

    assertType<typeof result, (typeof db.user.__outputType)[]>();

    const updated = await db.user.take();
    expect(updated).toMatchObject({ Name: update.Name });
  });

  it('should support appending selectAll', async () => {
    const ids = await db.user.pluck('Id').createMany([UserData, UserData]);

    const result = await db.user
      .where({ Id: { in: ids } })
      .update(update)
      .selectAll();

    assertType<typeof result, (typeof db.user.__outputType)[]>();

    expect(result).toMatchObject([
      { Name: update.Name },
      { Name: update.Name },
    ]);
  });

  it('should ignore undefined values, and should not ignore null', () => {
    const query = db.user.where({ Id: 1 }).update({
      Name: 'new name',
      Password: undefined,
      Data: null,
    });

    expectSql(
      query.toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET "name" = $1,
            "data" = $2,
            "updated_at" = now()
        WHERE "User"."id" = $3
      `,
      ['new name', null, 1],
    );

    assertType<Awaited<typeof query>, number>();
  });

  it('should support raw sql as a value', () => {
    const query = db.user.where({ Id: 1 }).update({
      Name: () => sql<string>`'raw sql'`,
    });

    expectSql(
      query.toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET "name" = 'raw sql', "updated_at" = now()
        WHERE "User"."id" = $1
      `,
      [1],
    );

    assertType<Awaited<typeof query>, number>();
  });

  it('should support a `WITH` table value in other `WITH` clause', () => {
    const q = db.user
      .with('a', db.user.find(1).select('Name').update(minUserData))
      .with('b', (q) =>
        db.user
          .find(2)
          .select('Id')
          .update({
            Name: () => q.from('a').get('Name'),
          }),
      )
      .from('b');

    assertType<Awaited<typeof q>, { Id: number }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "a" AS (
          UPDATE "schema"."user" "User"
          SET "name" = $1, "user_key" = $2, "password" = $3,
              "updated_at" = now()
          WHERE "User"."id" = $4
          RETURNING "User"."name" "Name"
        ), "b" AS (
          UPDATE "schema"."user" "User"
          SET
            "name" = (
              SELECT "a"."Name" FROM "a" LIMIT 1
            ),
            "updated_at" = now()
          WHERE "User"."id" = $5
          RETURNING "User"."id" "Id"
        )
        (SELECT *, NULL FROM "b")
        UNION ALL
        SELECT NULL, json_build_object(
          'a', (SELECT json_agg(row_to_json("a".*)) FROM "a"),
          'b', (SELECT json_agg(row_to_json("b".*)) FROM "b")
        )
      `,
      [UserData.Name, UserData.UserKey, UserData.Password, 1, 2],
    );
  });

  it('should return one record when searching for one to update', async () => {
    const { Id: id } = await db.user.select('Id').create(UserData);

    const query = db.user.selectAll().findBy({ Id: id }).update(update);

    expectSql(
      query.toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET "name" = $1,
            "password" = $2,
            "updated_at" = now()
        WHERE "User"."id" = $3
        RETURNING ${UserSelectAll}
      `,
      [update.Name, update.Password, id],
    );

    const result = await query;
    assertType<typeof result, typeof db.user.__outputType>();

    expect(result).toMatchObject({ Name: update.Name });
  });

  it('should throw when searching for one to update and it is not found', async () => {
    const q = db.user
      .selectAll()
      .findBy({ Id: 1 })
      .update({ Name: 'new name' });

    assertType<Awaited<typeof q>, typeof db.user.__outputType>();

    await expect(q).rejects.toThrow();
  });

  it('should update column with a sub query result', () => {
    const q = db.user.all().update({
      Name: () => db.user.get('Name'),
    });

    expectSql(
      q.toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET
          "name" = (SELECT "User"."name" FROM "schema"."user" "User" LIMIT 1),
          "updated_at" = now()
      `,
    );
  });

  it('should update column with a result of a sub query that performs update', () => {
    const q = db.user.find(1).update({
      Name: () => db.user.find(2).get('Name').update({ Name: 'new name' }),
    });

    expectSql(
      q.toSQL(),
      `
        WITH "q" AS (
          UPDATE "schema"."user" "User"
             SET "name" = $1,
                 "updated_at" = now()
          WHERE "User"."id" = $2
          RETURNING "User"."name" "Name"
        ), q2 AS (
          UPDATE "schema"."user" "User"
             SET "name" = (SELECT "q"."Name" FROM "q"),
                 "updated_at" = now()
          WHERE "User"."id" = $3
          RETURNING NULL
        )
        SELECT *, NULL FROM q2
        UNION ALL
        SELECT NULL, json_build_object('q', (SELECT json_agg(row_to_json("q".*)) FROM "q"))
      `,
      ['new name', 2, 1],
    );
  });

  it('should throw when an aliased update CTE does not find a record', async () => {
    const { Id } = await db.user.select('Id').create(UserData);
    const q = db.user.find(Id).update({
      Picture: () =>
        db.user.find(-1).get('Picture').update({ Picture: 'new picture' }),
    });

    expectSql(
      q.toSQL(),
      `
        WITH "q" AS (
          UPDATE "schema"."user" "User"
          SET "picture" = $1, "updated_at" = now()
          WHERE "User"."id" = $2
          RETURNING "User"."picture" "Picture"
        ), q2 AS (
          UPDATE "schema"."user" "User"
          SET "picture" = (SELECT "q"."Picture" FROM "q"), "updated_at" = now()
          WHERE "User"."id" = $3
          RETURNING NULL
        )
        SELECT *, NULL FROM q2
        UNION ALL
        SELECT NULL, json_build_object('q', (SELECT json_agg(row_to_json("q".*)) FROM "q"))
      `,
      ['new picture', -1, Id],
    );

    await expect(q).rejects.toThrow('Record for cte q is not found');
  });

  it('should update column with a result of a sub query that performs create', () => {
    const q = db.user.find(1).update({
      Name: () => db.user.get('Name').create(minUserData),
    });

    expectSql(
      q.toSQL(),
      `
          WITH "q" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
            VALUES ($1, $2, $3)
            RETURNING "User"."name" "Name"
          )
          UPDATE "schema"."user" "User"
             SET "name" = (SELECT "q"."Name" FROM "q"),
                 "updated_at" = now()
          WHERE "User"."id" = $4
        `,
      [minUserData.Name, minUserData.UserKey, minUserData.Password, 1],
    );
  });

  it('should update column with a result of a sub query that performs delete', () => {
    const q = db.user.find(1).update({
      Name: () => db.user.find(2).get('Name').delete(),
    });

    expectSql(
      q.toSQL(),
      `
          WITH "q" AS (
            DELETE FROM "schema"."user" "User"
            WHERE "User"."id" = $1
            RETURNING "User"."name" "Name"
          ), q2 AS (
            UPDATE "schema"."user" "User"
               SET "name" = (SELECT "q"."Name" FROM "q"),
                   "updated_at" = now()
            WHERE "User"."id" = $2
            RETURNING NULL
          )
          SELECT *, NULL FROM q2
          UNION ALL
          SELECT NULL, json_build_object('q', (SELECT json_agg(row_to_json("q".*)) FROM "q"))
        `,
      [2, 1],
    );
  });

  describe('update with relation query', () => {
    it('should update column with a sub query callback', () => {
      const q = db.profile.all().update({
        UserId: (q) => q.user.get('Id'),
      });

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."profile" "Profile"
          SET
            "user_id" = (
              SELECT "user"."id" FROM "schema"."user" WHERE "user"."id" = "Profile"."user_id" AND "user"."user_key" = "Profile"."profile_key"
            ),
            "updated_at" = now()
        `,
      );
    });

    it('should forbid updating a column with a result of relation query that performs update', () => {
      expect(() =>
        db.profile.all().update({
          // @ts-expect-error sub query must be of kind 'select'
          Bio: (q) => q.find(1).update({ Name: 'new name' }),
        }),
      ).toThrow();
    });

    it('should forbid updating a column with a result of relation query that performs create', () => {
      expect(() =>
        db.profile.all().update({
          // @ts-expect-error sub query must be of kind 'select'
          Bio: (q) => q.create(UserData),
        }),
      ).toThrow();
    });

    it('should forbid updating a column with a result of relation query that performs delete', () => {
      expect(() =>
        db.profile.all().update({
          // @ts-expect-error sub query must be of kind 'select'
          Bio: (q) => q.find(1).delete(),
        }),
      ).toThrow();
    });
  });

  describe('updateOrThrow', () => {
    it('should throw if no records were found for update', async () => {
      await expect(
        db.user.where({ Name: 'not found' }).updateOrThrow({ Name: 'name' }),
      ).rejects.toThrow();

      await expect(
        db.user
          .select('Id')
          .where({ Name: 'not found' })
          .updateOrThrow({ Name: 'name' }),
      ).rejects.toThrow();
    });
  });

  it('should strip unknown keys', () => {
    const query = db.user.find(1).update({
      Name: 'name',
      unknown: 'should be stripped',
    } as never);

    expectSql(
      query.toSQL(),
      `
          UPDATE "schema"."user" "User"
          SET "name" = $1, "updated_at" = now()
          WHERE "User"."id" = $2
        `,
      ['name', 1],
    );
  });

  describe.each(['increment', 'decrement'] as const)('%s', (action) => {
    const sign = action === 'increment' ? '+' : '-';

    it('should not allow using appReadOnly columns', () => {
      // @ts-expect-error value is readOnly
      expect(() => TableWithReadOnly.find(1)[action]('value')).toThrow(
        'Trying to update a readonly column',
      );

      // @ts-expect-error value is readOnly
      expect(() => TableWithReadOnly.find(1)[action]({ value: 1 })).toThrow(
        'Trying to update a readonly column',
      );
    });

    it('should support bigint', () => {
      const table = testDb(
        'table',
        (t) => ({
          num: t.bigint().nullable(),
          nullable: t.bigint().nullable(),
        }),
        undefined,
        {
          schema: () => 'schema',
          noPrimaryKey: 'ignore',
        },
      );

      table[action]('num');
      table[action]('nullable');

      table[action]({ num: 1n });
      table[action]({ nullable: 1n });

      table[action]({ num: '1' });
      table[action]({ nullable: '1' });
    });

    it('should not mutate query', () => {
      const q = db.user.all();

      q.where({ Name: 'name' })[action]('Age');

      expectQueryNotMutated(q);
    });

    it(`should ${action} column by 1`, () => {
      const q = db.user.all()[action]('Age');

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "age" = "age" ${sign} $1,
              "updated_at" = now()
        `,
        [1],
      );
    });

    it(`should ${action} decimal column by 1`, () => {
      const q = db.product.all()[action]('priceAmount');

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."product" "Product"
          SET "price_amount" = "price_amount" ${sign} $1
        `,
        [1],
      );
    });

    it(`should ${action} column by provided amount`, () => {
      const q = db.user.all()[action]({ Age: 3 });

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "age" = "age" ${sign} $1,
              "updated_at" = now()
        `,
        [3],
      );
    });

    it(`should ${action} decimal column by provided amount`, () => {
      const q = db.product.all()[action]({ priceAmount: '1' });

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."product" "Product"
          SET "price_amount" = "price_amount" ${sign} $1
        `,
        ['1'],
      );
    });

    it('should support returning', () => {
      const q = db.user.select('Id').all()[action]({ Age: 3 });

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "age" = "age" ${sign} $1,
              "updated_at" = now()
          RETURNING "User"."id" "Id"
        `,
        [3],
      );

      assertType<Awaited<typeof q>, { Id: number }[]>();
    });

    it('should support appending select', () => {
      const q = db.user.all()[action]({ Age: 3 }).select('Id');

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "age" = "age" ${sign} $1,
              "updated_at" = now()
          RETURNING "User"."id" "Id"
        `,
        [3],
      );

      assertType<Awaited<typeof q>, { Id: number }[]>();
    });

    it('should throw not found error when record does not exist', async () => {
      await expect(db.user.find(123)[action]('Age')).rejects.toThrow(
        'Record is not found',
      );
    });

    it('should not throw not found error when record exists', async () => {
      const id = await db.user.get('Id').create(UserData);

      const res = await db.user.find(id)[action]('Age');

      expect(res).toBe(1);
      assertType<typeof res, number>();
    });
  });

  describe('chaining', () => {
    it('should handle multiple updates with increment and decrement', () => {
      const query = db.user
        .select('Id')
        .find(1)
        .update({ Name: 'name' })
        .increment('Id')
        .update({ Password: 'password' })
        .decrement('Age')
        .update({
          Data: (q) => q.get('Data').jsonInsert([0], 'data'),
        });

      expectSql(
        query.toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET
              "data" = jsonb_insert("User"."data", $1, $2),
              "age" = "age" - $3,
              "password" = $4,
              "id" = "id" + $5,
              "name" = $6,
              "updated_at" = now()
          WHERE "User"."id" = $7
          RETURNING "User"."id" "Id"
        `,
        ['{0}', '"data"', 1, 'password', 1, 'name', 1],
      );
    });
  });

  describe('updating with empty set', () => {
    beforeAll(async () => {
      await db.userNoTimestamps.insert({
        Name: 'name',
        Password: 'password',
      });
    });

    it('should select count for return type `rowCount`', async () => {
      const q = db.userNoTimestamps.all().update({});

      expectSql(q.toSQL(), `SELECT count(*) FROM "schema"."user" "User"`);

      expect(await q).toBe(1);
    });

    it('should select records for return type of many records', async () => {
      const q = db.userNoTimestamps.all().select('Name').update({});

      expectSql(
        q.toSQL(),
        `SELECT "User"."name" "Name" FROM "schema"."user" "User"`,
      );

      const res = await q;

      assertType<typeof res, { Name: string }[]>();

      expect(res).toEqual([{ Name: 'name' }]);
    });

    it('should select one record for return type selecting one record', async () => {
      const q = db.userNoTimestamps.select('Name').all().take().update({});

      expectSql(
        q.toSQL(),
        `SELECT "User"."name" "Name" FROM "schema"."user" "User"  LIMIT 1`,
      );

      const res = await q;

      assertType<typeof res, { Name: string }>();

      expect(res).toEqual({ Name: 'name' });
    });

    it('should get a single value', async () => {
      const q = db.userNoTimestamps.all().take().get('Name').update({});

      expectSql(
        q.toSQL(),
        `SELECT "User"."name" FROM "schema"."user" "User" LIMIT 1`,
      );

      const res = await q;

      assertType<typeof res, string>();

      expect(res).toEqual('name');
    });

    it('should pluck values', async () => {
      const q = db.userNoTimestamps.all().pluck('Name').update({});

      expectSql(
        q.toSQL(),
        `SELECT "User"."name" "Name" FROM "schema"."user" "User"`,
      );

      const res = await q;

      assertType<typeof res, string[]>();

      expect(res).toEqual(['name']);
    });
  });

  describe('updateFrom', () => {
    it('should not throw on not found', async () => {
      const res = await db.user
        .updateFrom(() => db.user.as('u').find(0))
        .set({ Name: 'name' });

      expect(res).toBe(0);
    });

    it('updates from a table, merges where conditions, allows setting where on the from table after updateFrom', async () => {
      const q = db.message
        .updateFrom((q) => q.sender)
        .where({
          'sender.Id': 1,
        })
        .set({
          Text: (q) => q.ref('sender.Name'),
        });

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."message" "Message"
          SET "text" = "sender"."name", "updated_at" = now()
          FROM "schema"."user" "sender"
          WHERE ("sender"."id" = $1)
            AND ("Message"."deleted_at" IS NULL)
            AND "sender"."id" = "Message"."author_id"
            AND "sender"."user_key" = "Message"."message_key"
        `,
        [1],
      );
    });

    it('supports join', async () => {
      const user = await db.user
        .create({
          ...UserData,
          messages: {
            create: [
              {
                ...MessageData,
                chat: {
                  create: ChatData,
                },
              },
            ],
          },
        })
        .select('Id', {
          chatId: (q) => q.messages.get('messages.ChatId'),
        });

      const q = db.message
        .updateFrom(
          () => db.user,
          (q) => q.on('Id', 'Message.AuthorId'),
        )
        .join('chat', (q) => q.where({ Title: ChatData.Title }))
        .where({
          'User.Id': user.Id,
          'chat.IdOfChat': user.chatId,
        })
        .set({
          Text: (q) => q.ref('User.Name'),
          Active: (q) => q.ref('chat.Active'),
        })
        .select('updatedAt');

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."message" "Message"
          SET
            "text" = "User"."name",
            "active" = "chat"."active",
            "updated_at" = now()
          FROM "schema"."user" "User"
          JOIN "schema"."chat" ON true
          WHERE ("User"."id" = $2 AND "chat"."id_of_chat" = $3)
            AND ("Message"."deleted_at" IS NULL)
            AND "User"."id" = "Message"."author_id"
            AND "chat"."id_of_chat" = "Message"."chat_id"
            AND "chat"."chat_key" = "Message"."message_key"
            AND "chat"."title" = $1
          RETURNING "Message"."updated_at" "updatedAt"
        `,
        [ChatData.Title, user.Id, user.chatId],
      );

      const res = await q;

      expect(res).toEqual([{ updatedAt: expect.any(Date) }]);
    });

    it('turns from into a subquery if it is complex, respects aliased columns', () => {
      const q = db.message
        .updateFrom(
          () => db.user.select({ i: 'Id', n: 'Name' }),
          (q) => q.on('i', 'Message.AuthorId'),
        )
        .set({
          Text: (q) => q.ref('User.n'),
        });

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."message" "Message"
          SET "text" = "User"."n", "updated_at" = now()
          FROM (
            SELECT "User"."id" "i", "User"."name" "n"
            FROM "schema"."user" "User"
          ) "User"
          WHERE ("Message"."deleted_at" IS NULL)
            AND "User"."i" = "Message"."author_id"
        `,
      );
    });

    it('supports relation passed as a string and having a callback with conditions', () => {
      const q = db.message
        .updateFrom('sender', (q) =>
          q.where({
            'sender.updatedAt': q.ref('Message.updatedAt'),
          }),
        )
        .where({ 'sender.Id': 1 })
        .set({
          Text: (q) => q.ref('sender.Name'),
        });

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."message" "Message"
          SET "text" = "sender"."name", "updated_at" = now()
          FROM "schema"."user" "sender"
          WHERE ("sender"."id" = $1)
            AND ("Message"."deleted_at" IS NULL)
            AND "sender"."id" = "Message"."author_id"
            AND "sender"."user_key" = "Message"."message_key"
            AND "sender"."updated_at" = "Message"."updated_at"
        `,
        [1],
      );
    });

    it('forbid referencing updating table in from clause', () => {
      expect(() =>
        db.message.updateFrom((q) =>
          db.user
            .select({ i: 'Id', n: 'Name' })
            // @ts-expect-error `ref` is not available here on purpose
            .where({ Id: q.ref('AuthorId') }),
        ),
      ).toThrow();
    });

    it('should support CTE', () => {
      const q = db.message
        .with('w', db.user.select({ i: 'Id', n: 'Name' }))
        .updateFrom('w')
        .where({
          AuthorId: (q) => q.ref('w.i'),
        })
        .set({
          Text: (q) => q.ref('w.n'),
        });

      expectSql(
        q.toSQL(),
        `
          WITH "w" AS (
            SELECT "User"."id" "i", "User"."name" "n"
            FROM "schema"."user" "User"
          )
          UPDATE "schema"."message" "Message"
          SET "text" = "w"."n", "updated_at" = now()
          FROM "w"
          WHERE ("Message"."author_id" = "w"."i")
            AND ("Message"."deleted_at" IS NULL)
        `,
      );
    });

    it('should support CTE with a 2nd argument callback', () => {
      const q = db.message
        .with('w', db.user.select({ i: 'Id', n: 'Name' }))
        .updateFrom('w', (q) => q.on('i', 'Message.AuthorId'))
        .where({
          'w.n': 'name',
        })
        .set({
          Text: (q) => q.ref('w.n'),
        });

      expectSql(
        q.toSQL(),
        `
          WITH "w" AS (
            SELECT "User"."id" "i", "User"."name" "n"
            FROM "schema"."user" "User"
          )
          UPDATE "schema"."message" "Message"
          SET "text" = "w"."n", "updated_at" = now()
          FROM "w"
          WHERE ("w"."n" = $1)
            AND ("Message"."deleted_at" IS NULL)
            AND "w"."i" = "Message"."author_id"
        `,
        ['name'],
      );
    });
  });
});

describe('updateMany', () => {
  useTestDatabase();

  describe('SQL shape', () => {
    it('should generate UPDATE ... FROM (VALUES ...) for updateManyOptional', () => {
      expectSql(
        db.user
          .updateManyOptional([
            { Id: 1, Name: 'Alice' },
            { Id: 2, Name: 'Bob' },
          ])
          .toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "updated_at" = now(), "name" = "v"."name"
          FROM (VALUES ($1::int4, $2::text), ($3, $4)) "v"("id", "name")
          WHERE "User"."id" = "v"."id"
        `,
        [1, 'Alice', 2, 'Bob'],
      );
    });

    it('should support composite primary keys', () => {
      expectSql(
        db.uniqueTable
          .updateManyOptional([
            { id: 1, one: 'a', thirdColumn: 'x' },
            { id: 2, one: 'b', thirdColumn: 'y' },
          ])
          .toSQL(),
        `
          UPDATE "schema"."unique_table" "uniqueTable"
          SET "third_column" = "v"."third_column"
          FROM (VALUES ($1::int4, $2::text, $3::text), ($4, $5, $6)) "v"("id", "one", "third_column")
          WHERE "uniqueTable"."id" = "v"."id" AND "uniqueTable"."one" = "v"."one"
        `,
        [1, 'a', 'x', 2, 'b', 'y'],
      );
    });

    it('should generate CTE for strict updateMany with select', () => {
      const columns = db.user.q.selectAllColumns!;
      expectSql(
        db.user
          .selectAll()
          .updateMany([{ Id: 1, Name: 'Alice' }])
          .toSQL(),
        `
          WITH q AS (
            UPDATE "schema"."user" "User"
            SET "updated_at" = now(), "name" = "v"."name"
            FROM (VALUES ($1::int4, $2::text)) "v"("id", "name")
            WHERE "User"."id" = "v"."id"
            RETURNING ${UserSelectAllWithTable}
          )
          SELECT *, NULL FROM q
          UNION ALL
          SELECT ${columns.map(() => 'NULL').join(', ')},
          json_build_object('#q',
            CASE WHEN (SELECT count(*) FROM "q") < 1
            THEN (SELECT ':not-found:1:0')::int END)
        `,
        [1, 'Alice'],
      );
    });

    it('should generate updateManyBy with a string key', () => {
      expectSql(
        db.user
          .updateManyByOptional('Id', [{ Id: 1, Password: 'new-pass' }])
          .toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "updated_at" = now(), "password" = "v"."password"
          FROM (VALUES ($1::int4, $2::text)) "v"("id", "password")
          WHERE "User"."id" = "v"."id"
        `,
        [1, 'new-pass'],
      );
    });

    it('should generate updateManyBy with a tuple key', () => {
      expectSql(
        db.uniqueTable
          .updateManyByOptional(
            ['thirdColumn', 'fourthColumn'],
            [{ thirdColumn: 'a', fourthColumn: 1, one: 'updated' }],
          )
          .toSQL(),
        `
          UPDATE "schema"."unique_table" "uniqueTable"
          SET "one" = "v"."one"
          FROM (VALUES ($1::text, $2::int4, $3::text)) "v"("third_column", "fourth_column", "one")
          WHERE "uniqueTable"."third_column" = "v"."third_column"
            AND "uniqueTable"."fourth_column" = "v"."fourth_column"
        `,
        ['a', 1, 'updated'],
      );
    });

    it('should let .set() override per-row columns', () => {
      expectSql(
        db.user
          .updateManyOptional([{ Id: 1, Name: 'Alice' }])
          .set({
            Name: 'Override',
            Password: 'shared-pass',
          })
          .toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "name" = $1, "password" = $2, "updated_at" = now()
          FROM (VALUES ($3::int4, $4::text)) "v"("id", "name")
          WHERE "User"."id" = "v"."id"
        `,
        ['Override', 'shared-pass', 1, 'Alice'],
      );
    });

    it('should let .set() override per-row columns when .set() is before updateManyOptional', () => {
      expectSql(
        db.user
          .all()
          .set({
            Name: 'Override',
            Password: 'shared-pass',
          })
          .updateManyOptional([{ Id: 1, Name: 'Alice' }])
          .toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "name" = $1, "password" = $2, "updated_at" = now()
            FROM (VALUES ($3::int4, $4::text)) "v"("id", "name")
          WHERE "User"."id" = "v"."id"
        `,
        ['Override', 'shared-pass', 1, 'Alice'],
      );
    });

    it('should support .where() conditions', () => {
      expectSql(
        db.user
          .where({ Age: 18 })
          .updateManyOptional([{ Id: 1, Name: 'Alice' }])
          .toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "updated_at" = now(), "name" = "v"."name"
          FROM (VALUES ($1::int4, $2::text)) "v"("id", "name")
          WHERE "User"."age" = $3 AND "User"."id" = "v"."id"
        `,
        [1, 'Alice', 18],
      );
    });

    it('should support whereExists', () => {
      expectSql(
        db.user
          .whereExists(db.message.includeDeleted(), 'AuthorId', 'Id')
          .updateManyOptional([{ Id: 1, Name: 'Alice' }])
          .toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "updated_at" = now(), "name" = "v"."name"
          FROM (VALUES ($1::int4, $2::text)) "v"("id", "name")
          WHERE
            EXISTS (
              SELECT 1 FROM "schema"."message" "Message"
              WHERE "Message"."author_id" = "User"."id"
            )
            AND "User"."id" = "v"."id"
        `,
        [1, 'Alice'],
      );
    });

    it('should apply softDelete filter', () => {
      expectSql(
        db.message.updateManyOptional([{ Id: 1, Text: 'text' }]).toSQL(),
        `
          UPDATE "schema"."message" "Message"
          SET "updated_at" = now(), "text" = "v"."text"
          FROM (VALUES ($1::int4, $2::text)) "v"("id", "text")
          WHERE ("Message"."id" = "v"."id")
            AND ("Message"."deleted_at" IS NULL)
        `,
        [1, 'text'],
      );
    });

    it('should generate CTE with RETURNING NULL in strict rowCount mode', () => {
      expectSql(
        db.user.updateMany([{ Id: 1, Name: 'Alice' }]).toSQL(),
        `
          WITH q AS (
            UPDATE "schema"."user" "User"
            SET "updated_at" = now(), "name" = "v"."name"
            FROM (VALUES ($1::int4, $2::text)) "v"("id", "name")
            WHERE "User"."id" = "v"."id"
            RETURNING NULL
          )
          SELECT *, NULL FROM q
          UNION ALL
          SELECT NULL,
          json_build_object('#q',
            CASE WHEN (SELECT count(*) FROM "q") < 1
            THEN (SELECT ':not-found:1:0')::int END)
        `,
        [1, 'Alice'],
      );
    });
  });

  describe('execution', () => {
    it('should batch update records and return count', async () => {
      const users = await db.user.select('Id').createMany([
        { ...UserData, Name: 'exec1' },
        { ...UserData, Name: 'exec2' },
      ]);

      const count = await db.user.updateMany([
        { Id: users[0].Id, Name: 'updated1' },
        { Id: users[1].Id, Name: 'updated2' },
      ]);

      expect(count).toBe(2);

      const updated = await db.user
        .where({ Id: { in: users.map((u) => u.Id) } })
        .order('Id')
        .pluck('Name');
      expect(updated).toEqual(['updated1', 'updated2']);
    });

    it('should return void with exec', async () => {
      const user = await db.user.select('Id').create({
        ...UserData,
        Name: 'exec-void',
      });

      const result = await db.user
        .updateManyOptional([{ Id: user.Id, Name: 'exec-void-updated' }])
        .exec();

      expect(result).toBe(undefined);

      const updated = await db.user.find(user.Id).get('Name');
      expect(updated).toBe('exec-void-updated');
    });

    it('should return records when select is used', async () => {
      const users = await db.user.select('Id').createMany([
        { ...UserData, Name: 'sel1' },
        { ...UserData, Name: 'sel2' },
      ]);

      const result = await db.user
        .select('Id', 'Name')
        .updateMany([
          { Id: users[0].Id, Name: 'sel-upd1' },
          { Id: users[1].Id, Name: 'sel-upd2' },
        ])
        .order('Name');

      expect(result.map((r) => r.Name)).toEqual(['sel-upd1', 'sel-upd2']);
    });

    // RETURNING must qualify columns with the table name,
    // otherwise "id" is ambiguous between "user"."id" and "v"."id".
    it('should selectAll without ambiguous column reference', async () => {
      const users = await db.user.select('Id').createMany([
        { ...UserData, Name: 'amb1' },
        { ...UserData, Name: 'amb2' },
      ]);

      const result = await db.user
        .selectAll()
        .updateMany([
          { Id: users[0].Id, Name: 'amb-upd1' },
          { Id: users[1].Id, Name: 'amb-upd2' },
        ])
        .order('Name');

      expect(result.map((r) => r.Name)).toEqual(['amb-upd1', 'amb-upd2']);
    });

    it('should throw NotFoundError for strict variant when row is missing', async () => {
      const user = await db.user.select('Id').create({
        ...UserData,
        Name: 'strict-test',
      });

      await expect(
        db.user.updateMany([
          { Id: user.Id, Name: 'ok' },
          { Id: 999999, Name: 'missing' },
        ]),
      ).rejects.toThrow('Expected to find at least 2 record(s), but found 1');
    });

    it('should NOT throw for optional variant when row is missing', async () => {
      const user = await db.user.select('Id').create({
        ...UserData,
        Name: 'optional-test',
      });

      const count = await db.user.updateManyOptional([
        { Id: user.Id, Name: 'ok-updated' },
        { Id: 999999, Name: 'missing' },
      ]);

      expect(count).toBe(1);
    });
  });

  describe('fallback to select', () => {
    it('should select count when nothing to update', () => {
      expectSql(
        db.userNoTimestamps.updateMany([{ Id: 1 }, { Id: 2 }]).toSQL(),
        `
          SELECT count(*) FROM "schema"."user" "User",
          (VALUES ($1::int4), ($2)) "v"("id")
          WHERE "User"."id" = "v"."id"
        `,
        [1, 2],
      );
    });

    it('should select columns when nothing to update', () => {
      expectSql(
        db.userNoTimestamps
          .select('Id', 'Name')
          .updateMany([{ Id: 1 }, { Id: 2 }])
          .toSQL(),
        `
          SELECT "User"."id" "Id", "User"."name" "Name"
          FROM "schema"."user" "User",
          (VALUES ($1::int4), ($2)) "v"("id")
          WHERE "User"."id" = "v"."id"
        `,
        [1, 2],
      );
    });
  });

  describe('validation', () => {
    it('should ignore undefined fields in all rows', () => {
      expectSql(
        db.user
          .updateMany([
            { Id: 1, Name: 'Alice', Password: undefined },
            { Id: 2, Name: 'Bob', Password: undefined },
          ])
          .toSQL(),
        `
          WITH q AS (
            UPDATE "schema"."user" "User"
            SET "updated_at" = now(), "name" = "v"."name"
            FROM (VALUES ($1::int4, $2::text), ($3, $4)) "v"("id", "name")
            WHERE "User"."id" = "v"."id"
            RETURNING NULL
          )
          SELECT *, NULL FROM q
          UNION ALL
          SELECT NULL,
          json_build_object('#q',
            CASE WHEN (SELECT count(*) FROM "q") < 2
            THEN (SELECT ':not-found:2:' || (SELECT count(*) FROM "q"))::int END)
        `,
        [1, 'Alice', 2, 'Bob'],
      );
    });

    it('should throw when undefined field is inconsistent across rows', () => {
      expect(() =>
        db.user
          .updateMany([
            { Id: 1, Name: 'a', Password: 'p' },
            { Id: 2, Name: 'b', Password: undefined },
          ])
          .toSQL(),
      ).toThrow('different columns');
    });

    it('should throw on rows with different columns', () => {
      expect(() =>
        db.user
          .updateMany([
            { Id: 1, Name: 'a' },
            { Id: 2, Name: 'b', Password: 'p' },
          ])
          .toSQL(),
      ).toThrow('different columns');
    });

    it('should throw on inconsistent rows even with .set() covering the gap', () => {
      expect(() =>
        db.user
          .updateMany([
            { Id: 1, Name: 'a', Age: 18 },
            { Id: 2, Name: 'b' },
          ])
          .set({ Age: 20 })
          .toSQL(),
      ).toThrow('different columns');
    });

    it('should throw on readOnly column in updateMany data', () => {
      expect(() =>
        TableWithReadOnly.updateMany([
          // @ts-expect-error value is readOnly
          { Id: 1, key: 'a', value: 42 },
        ]).toSQL(),
      ).toThrow('Trying to update a readonly column');
    });

    it('should return empty for empty data', async () => {
      const count = await db.user.updateMany([]);
      expect(count).toBe(0);

      const result = await db.user.selectAll().updateMany([]);
      expect(result).toEqual([]);
    });

    it('should work with an expression as key value', () => {
      expectSql(
        db.user.updateManyOptional([{ Id: sql`1`, Name: 'a' }]).toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "updated_at" = now(), "name" = "v"."name"
          FROM (VALUES (1::int4, $1::text)) "v"("id", "name")
          WHERE "User"."id" = "v"."id"
        `,
        ['a'],
      );
    });

    it('should support expression values inside VALUES', () => {
      expectSql(
        db.user.updateManyOptional([{ Id: 1, Name: sql`'expr'` }]).toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "updated_at" = now(), "name" = "v"."name"
          FROM (VALUES ($1::int4, 'expr'::text)) "v"("id", "name")
          WHERE "User"."id" = "v"."id"
        `,
        [1],
      );
    });

    it('should not add RETURNING with exec', () => {
      expectSql(
        db.user
          .updateManyOptional([{ Id: 1, Name: 'a' }])
          .exec()
          .toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "updated_at" = now(), "name" = "v"."name"
          FROM (VALUES ($1::int4, $2::text)) "v"("id", "name")
          WHERE "User"."id" = "v"."id"
        `,
        [1, 'a'],
      );
    });

    it('should encode values with column.data.encode', () => {
      expectSql(
        db.user
          .updateManyOptional([{ Id: 1, Data: { name: 'a', tags: ['b'] } }])
          .toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "updated_at" = now(), "data" = "v"."data"
          FROM (VALUES ($1::int4, $2::jsonb)) "v"("id", "data")
          WHERE "User"."id" = "v"."id"
        `,
        [1, testJsonValue({ name: 'a', tags: ['b'] })],
      );
    });
  });

  describe('types', () => {
    it('should return number by default', () => {
      const q = db.user.updateMany([{ Id: 1, Name: 'a' }]);
      assertType<Awaited<typeof q>, number>();
    });

    it('should return array when select is used', () => {
      const q = db.user.select('Id', 'Name').updateMany([{ Id: 1, Name: 'a' }]);
      assertType<Awaited<typeof q>, { Id: number; Name: string }[]>();
    });

    it('should map one returnType to all', () => {
      const q = db.user.selectAll().updateMany([{ Id: 1, Name: 'a' }]);
      assertType<Awaited<typeof q>, (typeof db.user.__outputType)[]>();
    });
  });
});
