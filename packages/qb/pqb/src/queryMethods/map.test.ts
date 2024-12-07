import { assertType, useTestDatabase } from 'test-utils';
import { User, userData } from '../test-utils/test-utils';

describe('map', () => {
  useTestDatabase();

  beforeAll(async () => {
    await User.insert(userData);
  });

  it('should not apply map when doing aggregations', async () => {
    const res = await User.select('name')
      .map(() => false)
      .count();

    assertType<Awaited<typeof res>, number>();

    expect(res).toBe(1);
  });

  it('should map multiple records', async () => {
    const res = await User.select('name', 'createdAt').map((user) => ({
      nameLength: user.name.length,
      createdAt: user.createdAt,
    }));

    assertType<typeof res, { nameLength: number; createdAt: Date }[]>();

    expect(res).toEqual([
      { nameLength: userData.name.length, createdAt: expect.any(Date) },
    ]);
  });

  it('should map a single record', async () => {
    const res = await User.select('name', 'createdAt')
      .take()
      .map((user) => ({
        nameLength: user.name.length,
        createdAt: user.createdAt,
      }));

    assertType<typeof res, { nameLength: number; createdAt: Date }>();

    expect(res).toEqual({
      nameLength: userData.name.length,
      createdAt: expect.any(Date),
    });
  });

  it('should transform records in a sub-query', async () => {
    const res = await User.select('id', {
      users: () =>
        User.select('name', 'createdAt').map((user) => ({
          nameLength: user.name.length,
          createdAt: user.createdAt,
        })),
    });

    assertType<
      typeof res,
      { id: number; users: { nameLength: number; createdAt: Date }[] }[]
    >();

    expect(res).toEqual([
      {
        id: expect.any(Number),
        users: [
          {
            nameLength: userData.name.length,
            createdAt: expect.any(Date),
          },
        ],
      },
    ]);
  });

  it('should not be called when there is no records for takeOptional', async () => {
    const fn = jest.fn();

    const res = await User.findOptional(0).map(fn);

    expect(res).toBe(undefined);
    expect(fn).not.toBeCalled();
  });

  describe('nested map', () => {
    it('should transform `all` result into `pluck`', async () => {
      const res = await User.select({
        nested: () => User.select('name').map(({ name }) => `${name} mapped`),
      });

      assertType<typeof res, { nested: string[] }[]>();

      expect(res).toEqual([{ nested: ['name mapped'] }]);
    });

    it('should transform `one` result into `value`', async () => {
      const res = await User.select({
        nested: () =>
          User.select('name')
            .takeOptional()
            .map(({ name }) => `${name} mapped`),
      });

      assertType<typeof res, { nested: string | undefined }[]>();

      expect(res).toEqual([{ nested: 'name mapped' }]);
    });

    it('should transform `oneOrThrow` result into `valueOrThrow`', async () => {
      const res = await User.select({
        nested: () =>
          User.select('name')
            .takeOptional()
            .map(({ name }) => `${name} mapped`),
      });

      assertType<typeof res, { nested: string | undefined }[]>();

      expect(res).toEqual([{ nested: 'name mapped' }]);
    });

    it('should handle `value` query', async () => {
      const res = await User.select({
        nested: () => User.getOptional('name').map((name) => `${name} mapped`),
      });

      assertType<typeof res, { nested: string | undefined }[]>();

      expect(res).toEqual([{ nested: 'name mapped' }]);
    });

    it('should handle `valueOrThrow` query', async () => {
      const res = await User.select({
        nested: () => User.get('name').map((name) => `${name} mapped`),
      });

      assertType<typeof res, { nested: string }[]>();

      expect(res).toEqual([{ nested: 'name mapped' }]);
    });

    it('should handle `pluck` query', async () => {
      const res = await User.select({
        nested: () => User.pluck('name').map((name) => `${name} mapped`),
      });

      assertType<typeof res, { nested: string[] }[]>();

      expect(res).toEqual([{ nested: ['name mapped'] }]);
    });
  });
});
