import {
  assertType,
  db,
  expectSql,
  ProfileData,
  UserData,
  useTestDatabase,
} from 'test-utils';
import { NotFoundError } from '../../errors';

describe('select-sub-query value', () => {
  useTestDatabase();

  it('should select a single record of joinLateral, and a single nested record selected by joinLateral query', async () => {
    await db.user.insert({
      ...UserData,
      profile: { create: ProfileData },
    });

    const q = db.user
      .joinLateral(db.profile, (q) =>
        q.select({ author: (q) => q.user.select('Id') }),
      )
      .select('Profile.*');

    const res = await q;

    assertType<
      typeof res,
      {
        Profile: {
          author: { Id: number } | undefined;
        };
      }[]
    >();

    expect(res).toEqual([
      {
        Profile: {
          author: { Id: expect.any(Number) },
        },
      },
    ]);
  });

  it('should support ordering by a selected column from a select aliased in the same way as the main table', async () => {
    const q = db.category
      .select({
        category: (q) => q.category.select('categoryName'),
      })
      .order({ 'category.categoryName': 'ASC' });

    expectSql(
      q.toSQL(),
      `
        SELECT row_to_json("category".*) "category"
        FROM "schema"."category" "Category"
        LEFT JOIN LATERAL (
          SELECT "category"."category_name" "categoryName"
          FROM "schema"."category"
          WHERE "category"."category_name" = "Category"."parent_name"
        ) "category" ON true
        ORDER BY "category"."categoryName" ASC
      `,
    );
  });

  it('should not wrap the value for "not found vs found null" discrimination when the value is a column of same table because "not found" makes no sense here', () => {
    const q = db.user.select({
      Age: (q) => q.get('Age'),
    });

    expectSql(
      q.toSQL(),
      `SELECT "User"."age" "Age" FROM "schema"."user" "User"`,
    );
  });

  it('get: should return undefined when record is not found', async () => {
    await db.user.insert(UserData);

    const res = await db.user.select({
      sub: () => db.profile.getOptional('Bio'),
    });

    assertType<typeof res, { sub: string | null | undefined }[]>();
    expect(res).toEqual([{ sub: undefined }]);
  });

  it('should return null when record is found but the value is null', async () => {
    await db.user.insert({ ...UserData, profile: { create: {} } });

    const res = await db.user.select({
      sub: () => db.profile.getOptional('Bio'),
    });

    assertType<typeof res, { sub: string | null | undefined }[]>();
    expect(res).toEqual([{ sub: null }]);
  });

  it('should return undefined when relation is not found', async () => {
    await db.user.insert(UserData);

    const res = await db.user.select({
      sub: (q) => q.profile.getOptional('Bio'),
    });

    assertType<typeof res, { sub: string | null | undefined }[]>();
    expect(res).toEqual([{ sub: undefined }]);
  });

  it('should return null when relation is found but the value is null', async () => {
    await db.user.insert({ ...UserData, profile: { create: {} } });

    const res = await db.user.select({
      sub: (q) => q.profile.getOptional('Bio'),
    });

    assertType<typeof res, { sub: string | null | undefined }[]>();
    expect(res).toEqual([{ sub: null }]);
  });

  it('should support ordering by the value', async () => {
    await db.user.insertMany([
      { ...UserData, profile: { create: { ...ProfileData, Bio: 'b' } } },
      { ...UserData, profile: { create: { ...ProfileData, Bio: 'a' } } },
    ]);

    const res = await db.user
      .select({
        sub: (q) => q.profile.getOptional('Bio'),
      })
      .order('sub');

    assertType<typeof res, { sub: string | null | undefined }[]>();
    expect(res).toEqual([{ sub: 'a' }, { sub: 'b' }]);
  });

  it('should support where by the value from a sub query', async () => {
    await db.user.insertMany([
      { ...UserData, profile: { create: ProfileData } },
    ]);

    const res = await db.user
      .select({
        sub: (q) => q.profile.getOptional('Bio'),
      })
      .where({ sub: 'bio' });

    assertType<typeof res, { sub: string | null | undefined }[]>();
    expect(res).toEqual([{ sub: 'bio' }]);
  });

  it('should support where by the value prefixed with a table from a sub query', async () => {
    await db.user.insertMany([
      { ...UserData, Active: true, profile: { create: {} } },
    ]);

    const res = await db.user
      .select({
        profile: (q) =>
          q.profile.select({
            user: (q) => q.user.getOptional('Active'),
          }),
      })
      .where({ 'profile.user': true });

    assertType<
      typeof res,
      { profile: { user: boolean | null | undefined } }[]
    >();
    expect(res).toEqual([{ profile: { user: true } }]);
  });

  describe('get of a sub-query', () => {
    it('should return the value of a sub-query', async () => {
      await db.user.insert(UserData);

      const q = db.user.select({
        count: () => db.user.get(() => db.user.count()),
        name: () => db.user.get(() => db.user.get('Name')),
        self: (q) => q.get(() => db.user.count()),
      });

      const result = await q;

      assertType<
        typeof result,
        { count: number; name: string; self: number }[]
      >();

      expect(result).toEqual([{ count: 1, name: UserData.Name, self: 1 }]);

      expectSql(
        q.toSQL(),
        `
          SELECT
            (
              SELECT array[(SELECT count(*) FROM "schema"."user" "User")] "v"
              FROM "schema"."user" "User"
              LIMIT 1
            ) "count",
            (
              SELECT array[(
                SELECT array["User"."name"] FROM "schema"."user" "User" LIMIT 1
              )] "v"
              FROM "schema"."user" "User"
              LIMIT 1
            ) "name",
            (
              SELECT (SELECT count(*) FROM "schema"."user" "User") "v"
              FROM "schema"."user" "User"
              LIMIT 1
            ) "self"
          FROM "schema"."user" "User"
        `,
      );
    });

    it('should tell a not found record from a null value of a sub-query', async () => {
      await db.user.insert(UserData);
      const none = db.user.where({ Name: 'none' });

      const found = await db.user.select({
        count: () => db.user.getOptional(() => db.user.count()),
        age: () => db.user.get(() => db.user.getOptional('Age')),
      });
      expect(found).toEqual([{ count: 1, age: null }]);

      const optional = await db.user.select({
        value: () => none.getOptional(() => db.user.get('Name')),
      });
      expect(optional).toEqual([{ value: undefined }]);

      const age = db.user.getOptional('Age').transform((age) => age ?? 0);
      const transformed = await db.user.select({
        // the transform applies only to a value of a found record
        found: () => db.user.get(() => age),
        notFound: () => none.getOptional(() => age),
      });
      expect(transformed).toEqual([{ found: 0, notFound: undefined }]);

      const relation = await db.user.select({
        value: (q) => q.profile.getOptional(() => db.user.get('Name')),
      });
      expect(relation).toEqual([{ value: undefined }]);

      // an aggregate sub-query always returns a row, but the record of the outer query is not found
      const aggregate = await db.user.select({
        optional: () => none.getOptional(() => db.user.count()),
        relation: (q) => q.profile.getOptional(() => db.user.count()),
        transformed: () =>
          none
            .getOptional(() => db.user.count())
            .transform((n) => (n === undefined ? -1 : n)),
        foundNull: () => db.user.getOptional(() => none.sum('Age')),
      });
      assertType<
        typeof aggregate,
        {
          optional: number | undefined;
          relation: number | undefined;
          transformed: number;
          foundNull: string | null | undefined;
        }[]
      >();
      expect(aggregate).toEqual([
        {
          optional: undefined,
          relation: undefined,
          transformed: -1,
          foundNull: null,
        },
      ]);

      await expect(
        db.user.select({
          value: () => none.get(() => db.user.getOptional('Age')),
        }),
      ).rejects.toThrow(NotFoundError);

      await expect(
        db.user.select({
          value: () => none.get(() => db.user.count()),
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should return a relation value of a sub-query', async () => {
      await db.user.insert({ ...UserData, profile: { create: ProfileData } });

      const q = db.user.select({
        value: () => db.user.get((q) => q.profile.get('Bio')),
      });

      const result = await q;

      assertType<typeof result, { value: string | null }[]>();

      expect(result).toEqual([{ value: ProfileData.Bio }]);

      expectSql(
        q.toSQL(),
        `
          SELECT (
            SELECT array["v"."v"] "v"
            FROM "schema"."user" "User"
            JOIN LATERAL (
              SELECT array["profile"."bio"] "v"
              FROM "schema"."profile"
              WHERE "profile"."user_id" = "User"."id" AND "profile"."profile_key" = "User"."user_key"
            ) "v" ON true
            LIMIT 1
          ) "value"
          FROM "schema"."user" "User"
        `,
      );
    });

    it('should return a sub-query value of a relation', async () => {
      await db.user.insert({ ...UserData, profile: { create: ProfileData } });

      const result = await db.user.select({
        // a value of the same relation that isn't wrapped into an array
        profiles: (q) => q.profile.count(),
        count: (q) => q.profile.get(() => db.user.count()),
        name: (q) => q.profile.get(() => db.user.get('Name')),
      });

      assertType<
        typeof result,
        { profiles: number; count: number; name: string }[]
      >();

      expect(result).toEqual([{ profiles: 1, count: 1, name: UserData.Name }]);
    });
  });

  describe('pluck', () => {
    it('should support value query from a callback', async () => {
      await db.user.insertMany([
        {
          ...UserData,
          profile: { create: {} },
        },
        UserData,
      ]);

      const q = db.user.order('Id').pluck((q) => q.profile.get('Bio'));

      const result = await q;

      assertType<typeof result, (string | null)[]>();

      expect(result).toEqual([null, undefined]);
    });

    it('should support a sub-query value of a relation', async () => {
      await db.user.insertMany([
        {
          ...UserData,
          profile: { create: {} },
        },
        UserData,
      ]);

      const q = db.user
        .order('Id')
        .pluck((q) => q.profile.get(() => db.user.get('Name')));

      const result = await q;

      assertType<typeof result, string[]>();

      expect(result).toEqual([UserData.Name, undefined]);
    });

    it('should return undefined for an aggregate sub-query value of a missing relation', async () => {
      await db.user.insertMany([
        {
          ...UserData,
          profile: { create: {} },
        },
        UserData,
      ]);

      const q = db.user
        .order('Id')
        .pluck((q) => q.profile.getOptional(() => db.user.count()));

      const result = await q;

      assertType<typeof result, (number | undefined)[]>();

      expect(result).toEqual([2, undefined]);
    });

    it('should resolve any aggregations to null, because aggregations always return null', async () => {
      await db.user.insertMany([
        {
          ...UserData,
          profile: { create: {} },
        },
        UserData,
      ]);

      const q = db.user
        .order('Id')
        .pluck((q) => q.profile.stringAgg('Bio', ','));

      const result = await q;

      assertType<typeof result, (string | null)[]>();

      expect(result).toEqual([null, null]);
    });
  });
});
