import { AssertEqual, User, userData, useTestDatabase } from '../test-utils';
import { NumberColumn } from '../columnSchema';
import { SelectQueryData } from '../sql';
import { NotFoundError } from '../errors';
import { raw } from '../common';

describe('query value', () => {
  useTestDatabase();

  describe('value', () => {
    it('should select column and return a single value', async () => {
      const { id } = await User.select('id').insert(userData);

      const received = await User.value('id');

      const eq: AssertEqual<typeof received, number> = true;
      expect(eq).toBe(true);

      expect(received).toBe(id);
    });

    it('should select raw and return a single value', async () => {
      const received = await User.value(raw<NumberColumn>('count(*)::int'));

      const eq: AssertEqual<typeof received, number> = true;
      expect(eq).toBe(true);

      expect(received).toBe(0);
    });

    it('should throw if not found', async () => {
      await expect(() => User.value('id')).rejects.toThrowError(NotFoundError);
    });

    it('removes `take` from query data', () => {
      expect((User.take().value('id').query as SelectQueryData)?.take).toBe(
        undefined,
      );
    });
  });

  describe('valueOptional', () => {
    it('should select column and return a single value when exists', async () => {
      const { id } = await User.select('id').insert(userData);

      const received = await User.valueOptional('id');

      const eq: AssertEqual<typeof received, number | undefined> = true;
      expect(eq).toBe(true);

      expect(received).toBe(id);
    });

    it('should select raw and return a single value when exists', async () => {
      const received = await User.valueOptional(
        raw<NumberColumn>('count(*)::int'),
      );

      const eq: AssertEqual<typeof received, number | undefined> = true;
      expect(eq).toBe(true);

      expect(received).toBe(0);
    });

    it('should return undefined if not found', async () => {
      const value = await User.valueOptional('id');
      const eq: AssertEqual<typeof value, number | undefined> = true;
      expect(eq).toBe(true);

      expect(value).toBe(undefined);
    });

    it('removes `take` from query data', () => {
      expect(
        (User.take().valueOptional('id').query as SelectQueryData)?.take,
      ).toBe(undefined);
    });
  });
});
