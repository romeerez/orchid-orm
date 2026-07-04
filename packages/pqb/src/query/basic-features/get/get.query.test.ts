import {
  Snake,
  snakeData,
  User,
  userData,
} from '../../../test-utils/pqb.test-utils';
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
      const { id } = await User.select('id').create(userData);
      const q = User.get('id');

      const result = await q;

      assertType<typeof result, number>();

      expect(result).toBe(id);

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id"
          FROM "schema"."user"
          LIMIT 1
        `,
      );
    });

    it('should support chaining the value with operators', async () => {
      await User.insert(userData);
      const q = User.get('id').gt(0);

      const result = await q;

      assertType<typeof result, boolean>();

      expect(result).toBe(true);

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id" > $1
          FROM "schema"."user"
          LIMIT 1
        `,
        [0],
      );
    });

    it('should select named column and return a single value', async () => {
      const { snakeName } = await Snake.select('snakeName').create(snakeData);

      const q = Snake.get('snakeName');

      const result = await q;

      assertType<typeof result, string>();

      expect(result).toBe(snakeName);

      expectSql(
        q.toSQL(),
        `
          SELECT "snake"."snake_name"
          FROM "schema"."snake"
          LIMIT 1
        `,
      );
    });

    it('should select raw and return a single value', async () => {
      const q = User.get(testDb.sql`count(*)::int`.type((t) => t.integer()));

      const result = await q;

      assertType<typeof result, number>();

      expect(result).toBe(0);

      expectSql(
        q.toSQL(),
        `
          SELECT count(*)::int FROM "schema"."user" LIMIT 1
        `,
      );
    });

    it('should select raw from a callback and return a single value', async () => {
      await User.create({ ...userData, age: 20 });

      const q = User.get((q) =>
        testDb.sql`${q.ref('age')} + 1`.type((t) => t.integer()),
      );

      const result = await q;

      assertType<typeof result, number>();

      expect(result).toBe(21);

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."age" + 1
          FROM "schema"."user"
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
          FROM "schema"."user"
          JOIN LATERAL (
            SELECT array["profile"."bio"] "v"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "user"."id" AND "profile"."profile_key" = "user"."user_key"
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
          FROM "schema"."user"
          JOIN LATERAL (
            SELECT array["profile"."bio"] "v"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "user"."id" AND "profile"."profile_key" = "user"."user_key"
          ) "v" ON true
          LIMIT 1
        `,
      );
    });

    it('should throw if not found', async () => {
      await expect(() => User.get('id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getOptional', () => {
    it('should select column and return a single value when exists', async () => {
      const { id } = await User.select('id').create(userData);

      const q = User.getOptional('id');

      const result = await q;

      assertType<typeof result, number | undefined>();

      expect(result).toBe(id);

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id"
          FROM "schema"."user"
          LIMIT 1
        `,
      );
    });

    it('should select named column and return a single value when exists', async () => {
      const { snakeName } = await Snake.select('snakeName').create(snakeData);

      const q = Snake.getOptional('snakeName');

      const result = await q;

      assertType<typeof result, string | undefined>();

      expect(result).toBe(snakeName);

      expectSql(
        q.toSQL(),
        `
          SELECT "snake"."snake_name"
          FROM "schema"."snake"
          LIMIT 1
        `,
      );
    });

    it('should select raw and return a single value when exists', async () => {
      const q = User.getOptional(
        testDb.sql`count(*)::int`.type((t) => t.integer()),
      );

      const result = await q;

      assertType<typeof result, number | undefined>();

      expect(result).toBe(0);

      expectSql(
        q.toSQL(),
        `
          SELECT count(*)::int
          FROM "schema"."user"
          LIMIT 1
        `,
      );
    });

    it('should select raw from a callback and return a single value when exists', async () => {
      await User.create({ ...userData, age: 20 });

      const q = User.getOptional((q) =>
        testDb.sql`${q.ref('age')} + 1`.type((t) => t.integer()),
      );

      const result = await q;

      assertType<typeof result, number | undefined>();

      expect(result).toBe(21);

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."age" + 1
          FROM "schema"."user"
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
          FROM "schema"."user"
          LEFT JOIN LATERAL (
            SELECT array["profile"."created_at"] "v"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "user"."id" AND "profile"."profile_key" = "user"."user_key"
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
          FROM "schema"."user"
          LEFT JOIN LATERAL (
            SELECT array["profile"."bio"] "v"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "user"."id" AND "profile"."profile_key" = "user"."user_key"
          ) "v" ON true
          LIMIT 1
        `,
      );
    });

    it('should return undefined if not found', async () => {
      const q = User.getOptional('id');

      const result = await q;

      assertType<typeof result, number | undefined>();

      expect(result).toBe(undefined);

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id"
          FROM "schema"."user"
          LIMIT 1
        `,
      );
    });
  });
});
