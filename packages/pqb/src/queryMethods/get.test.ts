import { assertType, db, User, userData, useTestDatabase } from '../test-utils';
import { NotFoundError } from '../errors';

describe('get', () => {
  useTestDatabase();

  describe('get', () => {
    it('should select column and return a single value', async () => {
      const { id } = await User.select('id').create(userData);

      const received = await User.get('id');

      assertType<typeof received, number>();

      expect(received).toBe(id);
    });

    it('should select raw and return a single value', async () => {
      const received = await User.get(
        db.raw((t) => t.integer(), 'count(*)::int'),
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

    it('should select raw and return a single value when exists', async () => {
      const received = await User.getOptional(
        db.raw((t) => t.integer(), 'count(*)::int'),
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
