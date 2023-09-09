import { Snake, snakeData, User, userData } from '../test-utils/test-utils';
import { NotFoundError } from '../errors';
import { assertType, expectSql, testDb, useTestDatabase } from 'test-utils';

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
          FROM "user"
          LIMIT 1
        `,
      );
    });

    it('should support chaining the value with operators', async () => {
      await User.count().create(userData);
      const q = User.get('id').gt(0);

      const result = await q;

      assertType<typeof result, boolean>();

      expect(result).toBe(true);

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id" > $1
          FROM "user"
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
          SELECT "snake"."snake_name" AS "snakeName"
          FROM "snake"
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
          SELECT count(*)::int FROM "user" LIMIT 1
        `,
      );
    });

    it('should throw if not found', async () => {
      await expect(() => User.get('id')).rejects.toThrowError(NotFoundError);
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
          FROM "user"
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
          SELECT "snake"."snake_name" AS "snakeName"
          FROM "snake"
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
          FROM "user"
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
          FROM "user"
          LIMIT 1
        `,
      );
    });
  });
});
