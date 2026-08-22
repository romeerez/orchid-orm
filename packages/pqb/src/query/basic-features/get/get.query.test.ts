import {
  assertType,
  db,
  expectSql,
  ProfileData,
  testDb,
  useTestDatabase,
  UserData,
} from 'test-utils';
import { NotFoundError } from '../../errors';

describe('get', () => {
  useTestDatabase();

  describe('get', () => {
    it('should select column and return a single value', async () => {
      const { Id } = await db.user.select('Id').create(UserData);
      const q = db.user.get('Id');

      const result = await q;

      assertType<typeof result, number>();

      expect(result).toBe(Id);

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id"
          FROM "schema"."user" "User"
          LIMIT 1
        `,
      );
    });

    it('should reset batch parsers after selecting a taken relation', async () => {
      const { Id } = await db.user.create(UserData);
      const q = db.user.select({ posts: (q) => q.posts.take() });

      const result = await q.get('Id');

      assertType<typeof result, number>();
      expect(result).toBe(Id);
    });

    it('should support chaining the value with operators', async () => {
      await db.user.insert(UserData);
      const q = db.user.get('Id').gt(0);

      const result = await q;

      assertType<typeof result, boolean>();

      expect(result).toBe(true);

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" > $1
          FROM "schema"."user" "User"
          LIMIT 1
        `,
        [0],
      );
    });

    it('should select raw and return a single value', async () => {
      const q = db.user.get(testDb.sql`count(*)::int`.type((t) => t.integer()));

      const result = await q;

      assertType<typeof result, number>();

      expect(result).toBe(0);

      expectSql(
        q.toSQL(),
        `
          SELECT count(*)::int FROM "schema"."user" "User" LIMIT 1
        `,
      );
    });

    it('should select raw from a callback and return a single value', async () => {
      await db.user.create({ ...UserData, Age: 20 });

      const q = db.user.get((q) =>
        testDb.sql`${q.ref('Age')} + 1`.type((t) => t.integer()),
      );

      const result = await q;

      assertType<typeof result, number>();

      expect(result).toBe(21);

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."age" + 1
          FROM "schema"."user" "User"
          LIMIT 1
        `,
      );
    });

    it('should select value query from a callback and return a single value', async () => {
      await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      const q = db.user.get((q) => q.profile.get('Bio'));

      const result = await q;

      assertType<typeof result, string | null>();
      // @ts-expect-error scalar callbacks only accept expressions or single-value queries
      db.user.get((q) => q.profile);

      expect(result).toBe(ProfileData.Bio);

      expectSql(
        q.toSQL(),
        `
          SELECT "v"."v" "v"
          FROM "schema"."user" "User"
          JOIN LATERAL (
            SELECT array["profile"."bio"] "v"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "User"."id" AND "profile"."profile_key" = "User"."user_key"
          ) "v" ON true
          LIMIT 1
        `,
      );
    });

    it('should throw when optional value query from a callback is not found', async () => {
      await db.user.create(UserData);

      const q = db.user.get((q) => q.profile.getOptional('Bio'));

      await expect(() => q).rejects.toThrow(NotFoundError);

      expectSql(
        q.toSQL(),
        `
          SELECT "v"."v" "v"
          FROM "schema"."user" "User"
          JOIN LATERAL (
            SELECT array["profile"."bio"] "v"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "User"."id" AND "profile"."profile_key" = "User"."user_key"
          ) "v" ON true
          LIMIT 1
        `,
      );
    });

    it('should throw if not found', async () => {
      await expect(() => db.user.get('Id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getOptional', () => {
    it('should select column and return a single value when exists', async () => {
      const { Id } = await db.user.select('Id').create(UserData);

      const q = db.user.getOptional('Id');

      const result = await q;

      assertType<typeof result, number | undefined>();

      expect(result).toBe(Id);

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id"
          FROM "schema"."user" "User"
          LIMIT 1
        `,
      );
    });

    it('should reset batch parsers after selecting a taken relation', async () => {
      const { Id } = await db.user.create(UserData);
      const q = db.user.select({ posts: (q) => q.posts.take() });

      const result = await q.getOptional('Id');

      assertType<typeof result, number | undefined>();
      expect(result).toBe(Id);
    });

    it('should select raw and return a single value when exists', async () => {
      const q = db.user.getOptional(
        testDb.sql`count(*)::int`.type((t) => t.integer()),
      );

      const result = await q;

      assertType<typeof result, number | undefined>();

      expect(result).toBe(0);

      expectSql(
        q.toSQL(),
        `
          SELECT count(*)::int
          FROM "schema"."user" "User"
          LIMIT 1
        `,
      );
    });

    it('should select raw from a callback and return a single value when exists', async () => {
      await db.user.create({ ...UserData, Age: 20 });

      const q = db.user.getOptional((q) =>
        testDb.sql`${q.ref('Age')} + 1`.type((t) => t.integer()),
      );

      const result = await q;

      assertType<typeof result, number | undefined>();

      expect(result).toBe(21);

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."age" + 1
          FROM "schema"."user" "User"
          LIMIT 1
        `,
      );
    });

    it('should select optional value query from a callback and return a single value when exists', async () => {
      await db.user.insert({
        ...UserData,
        profile: { create: ProfileData },
      });

      const q = db.user.getOptional((q) => q.profile.getOptional('createdAt'));

      const result = await q;

      assertType<typeof result, Date | undefined>();
      // @ts-expect-error scalar callbacks only accept expressions or single-value queries
      db.user.getOptional((q) => q.profile.select('Bio'));

      expect(result).toEqual(ProfileData.createdAt);

      expectSql(
        q.toSQL(),
        `
          SELECT "v"."v" "v"
          FROM "schema"."user" "User"
          LEFT JOIN LATERAL (
            SELECT array["profile"."created_at"] "v"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "User"."id" AND "profile"."profile_key" = "User"."user_key"
          ) "v" ON true
          LIMIT 1
        `,
      );
    });

    it('should not throw when value query from a callback is not found', async () => {
      await db.user.create(UserData);

      const q = db.user.getOptional((q) => q.profile.get('Bio'));

      const result = await q;

      assertType<typeof result, string | null | undefined>();

      expect(result).toBe(undefined);

      expectSql(
        q.toSQL(),
        `
          SELECT "v"."v" "v"
          FROM "schema"."user" "User"
          LEFT JOIN LATERAL (
            SELECT array["profile"."bio"] "v"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "User"."id" AND "profile"."profile_key" = "User"."user_key"
          ) "v" ON true
          LIMIT 1
        `,
      );
    });

    it('should return undefined if not found', async () => {
      const q = db.user.getOptional('Id');

      const result = await q;

      assertType<typeof result, number | undefined>();

      expect(result).toBe(undefined);

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id"
          FROM "schema"."user" "User"
          LIMIT 1
        `,
      );
    });
  });
});
