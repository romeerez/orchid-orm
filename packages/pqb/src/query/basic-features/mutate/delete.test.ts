import { expectQueryNotMutated } from '../../../test-utils/pqb.test-utils';
import {
  assertType,
  db,
  expectSql,
  useTestDatabase,
  UserData,
  UserDefaultSelect,
  UserSelectAll,
  UserSelectAllWithTable,
} from 'test-utils';

describe('delete', () => {
  useTestDatabase();

  it('should prevent deleting all with TS error', () => {
    // @ts-expect-error update should have where condition or forceAll flag
    expect(() => db.user.delete()).toThrow(
      'Dangerous delete without conditions',
    );
  });

  it('should allow deleting all records after using `all` method', () => {
    db.user.all().delete();
  });

  it('should throw when deleting with an empty effective where filter', () => {
    expect(() => db.user.where({}).delete().toSQL()).toThrow(
      'Dangerous delete without conditions',
    );

    expect(() => db.user.where({ Id: undefined }).delete().toSQL()).toThrow(
      'Dangerous delete without conditions',
    );
  });

  it('should allow deleting after explicit all with an empty effective where filter', () => {
    expectSql(
      db.user.all().where({ Id: undefined }).delete().toSQL(),
      `
        DELETE FROM "schema"."user" "User"
      `,
    );
  });

  it('should delete records, returning value', async () => {
    const id = await db.user.get('Id').create(UserData);
    const q = db.user.all();

    const query = q.find(id).get('Id').delete();
    expectSql(
      query.toSQL(),
      `
        DELETE FROM "schema"."user" "User" WHERE "User"."id" = $1
        RETURNING "User"."id"
      `,
      [id],
    );

    const result = await query;
    expect(result).toBe(id);

    assertType<typeof result, number>();

    expectQueryNotMutated(q);
  });

  it('should delete records, returning deleted rows count', async () => {
    const rowsCount = 3;

    for (let i = 0; i < rowsCount; i++) {
      await db.user.create(UserData);
    }

    const q = db.user.all();

    const query = q.where({ Id: { gte: 1 } }).delete();
    expectSql(
      query.toSQL(),
      'DELETE FROM "schema"."user" "User" WHERE "User"."id" >= $1',
      [1],
    );

    const result = await query;
    expect(result).toBe(rowsCount);

    assertType<typeof result, number>();

    expectQueryNotMutated(q);
  });

  it('should delete records, returning all columns', () => {
    const q = db.user.all();

    const query = q.selectAll().where({ Id: 1 }).delete();
    expectSql(
      query.toSQL(),
      `DELETE FROM "schema"."user" "User" WHERE "User"."id" = $1 RETURNING ${UserSelectAll}`,
      [1],
    );

    assertType<Awaited<typeof query>, UserDefaultSelect[]>();

    expectQueryNotMutated(q);
  });

  it('should support appending selectAll', async () => {
    const user = await db.user.create(UserData);

    const result = await db.user.where({ Id: user.Id }).delete().selectAll();

    assertType<typeof result, UserDefaultSelect[]>();

    expect(result).toEqual([user]);
  });

  it('should selectAll when deleting a single record', async () => {
    const user = await db.user.create(UserData);

    const result = await db.user.find(user.Id).selectAll().delete();

    assertType<typeof result, UserDefaultSelect>();

    expect(result).toEqual(user);
  });

  it('should support appending selectAll when deleting a single record', async () => {
    const user = await db.user.create(UserData);

    const result = await db.user.find(user.Id).delete().selectAll();

    assertType<typeof result, UserDefaultSelect>();

    expect(result).toEqual(user);
  });

  it('should delete records, returning specified columns', () => {
    const q = db.user.all();

    const query = q.select('Id', 'Name').where({ Id: 1 }).delete();
    expectSql(
      query.toSQL(),
      `DELETE FROM "schema"."user" "User" WHERE "User"."id" = $1 RETURNING "User"."id" "Id", "User"."name" "Name"`,
      [1],
    );

    assertType<Awaited<typeof query>, { Id: number; Name: string }[]>();

    expectQueryNotMutated(q);
  });

  it('should support appending select', async () => {
    const user = await db.user.select('Id', 'Name').create(UserData);

    const result = await db.user
      .where({ Id: user.Id })
      .delete()
      .select('Id', 'Name');

    assertType<typeof result, { Id: number; Name: string }[]>();

    expect(result).toEqual([user]);
  });

  it('should select column when deleting a single record', async () => {
    const user = await db.user.select('Id', 'Name').create(UserData);

    const result = await db.user.find(user.Id).select('Id', 'Name').delete();

    assertType<typeof result, { Id: number; Name: string }>();

    expect(result).toEqual(user);
  });

  it('should support appending select when deleting a single record', async () => {
    const user = await db.user.select('Id', 'Name').create(UserData);

    const result = await db.user.find(user.Id).delete().select('Id', 'Name');

    assertType<typeof result, { Id: number; Name: string }>();

    expect(result).toEqual(user);
  });

  it('should support where and join statements', () => {
    const q = db.user.all();

    const query = q
      .selectAll()
      .where({ Id: 1 })
      .join(db.profile, 'UserId', '=', 'Id')
      .delete();

    expectSql(
      query.toSQL(),
      `
        DELETE FROM "schema"."user" "User"
        USING "schema"."profile" "Profile"
        WHERE "User"."id" = $1 AND "Profile"."user_id" = "User"."id"
        RETURNING ${UserSelectAllWithTable}
      `,
      [1],
    );

    assertType<Awaited<typeof query>, UserDefaultSelect[]>();

    expectQueryNotMutated(q);
  });

  it('should be supported in `WITH` expressions', () => {
    const q = db.user
      .with('a', db.user.find(1).select('Name').delete())
      .with('b', (q) =>
        db.user
          .select('Id')
          .whereIn('Name', q.from('a').pluck('Name'))
          .delete(),
      )
      .from('b');

    assertType<Awaited<typeof q>, { Id: number }[]>();

    expectSql(
      q.toSQL(),
      `
        WITH "a" AS (
          DELETE FROM "schema"."user" "User" WHERE "User"."id" = $1 RETURNING "User"."name" "Name"
        ), "b" AS (
          DELETE FROM "schema"."user" "User"
          WHERE "User"."name" IN (SELECT "a"."Name" FROM "a")
          RETURNING "User"."id" "Id"
        )
        (SELECT *, NULL FROM "b")
        UNION ALL
        SELECT NULL, json_build_object('a', (SELECT json_agg(row_to_json("a".*)) FROM "a"))
      `,
      [1],
    );
  });

  // DELETE FROM ... USING LATERAL does not support referencing the table under deletion.
  it('should throw when deleting after joining a complex query (limit in this case)', () => {
    expect(() =>
      db.user
        .where({ Id: 1 })
        .join(db.profile, (q) => q.on('UserId', 'User.Id').limit(5))
        .delete(),
    ).toThrow('Cannot join a complex query in delete');
  });

  it('should throw when joining a complex query after delete statement (limit in this case)', () => {
    expect(() =>
      db.user
        .where({ Id: 1 })
        .delete()
        .join(db.profile, (q) => q.on('UserId', 'User.Id').limit(5)),
    ).toThrow('Cannot join a complex query in delete');
  });

  it('should throw NotFoundError when no records to delete for a `one` query kind', async () => {
    const q = db.user.find(1).delete();

    await expect(q).rejects.toThrow('Record is not found');
  });
});
