import { Snake, snakeData, User, userData } from '../test-utils/test-utils';
import { NotFoundError } from '../errors';
import { assertType, testDb, useTestDatabase } from 'test-utils';

describe('get', () => {
  useTestDatabase();

  describe('get', () => {
    it('should select column and return a single value', async () => {
      const { id } = await User.select('id').create(userData);

      const received = await User.get('id');

      assertType<typeof received, number>();

      expect(received).toBe(id);
    });

    it('should select named column and return a single value', async () => {
      const { snakeName } = await Snake.select('snakeName').create(snakeData);

      const received = await Snake.get('snakeName');

      assertType<typeof received, string>();

      expect(received).toBe(snakeName);
    });

    it('should select raw and return a single value', async () => {
      const received = await User.get(
        testDb.raw((t) => t.integer(), 'count(*)::int'),
      );

      assertType<typeof received, number>();

      expect(received).toBe(0);
    });

    it('should throw if not found', async () => {
      await expect(() => User.get('id')).rejects.toThrowError(NotFoundError);
    });
  });

  describe('getOptional', () => {
    it('should select column and return a single value when exists', async () => {
      const { id } = await User.select('id').create(userData);

      const received = await User.getOptional('id');

      assertType<typeof received, number | undefined>();

      expect(received).toBe(id);
    });

    it('should select named column and return a single value when exists', async () => {
      const { snakeName } = await Snake.select('snakeName').create(snakeData);

      const received = await Snake.getOptional('snakeName');

      assertType<typeof received, string | undefined>();

      expect(received).toBe(snakeName);
    });

    it('should select raw and return a single value when exists', async () => {
      const received = await User.getOptional(
        testDb.raw((t) => t.integer(), 'count(*)::int'),
      );

      assertType<typeof received, number | undefined>();

      expect(received).toBe(0);
    });

    it('should return undefined if not found', async () => {
      const value = await User.getOptional('id');
      assertType<typeof value, number | undefined>();

      expect(value).toBe(undefined);
    });
  });
});
