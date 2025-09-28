import { User, userData } from '../test-utils/test-utils';
import { NotFoundError } from 'orchid-core';
import { assertType, TestAdapter, useTestDatabase } from 'test-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const query = jest.fn<any, any>(() => Promise.resolve({ rows: [] }));
TestAdapter.prototype.query = query;
TestAdapter.prototype.arrays = query;

describe('none', () => {
  test('mock is set up correctly', async () => {
    await User;
    expect(query).toBeCalled();
    query.mockClear();
  });

  it('should return empty array for return types `all`, `rows`, `pluck`', async () => {
    const result = await Promise.all([
      User.none(),
      User.all().none(),
      User.rows().none(),
      User.pluck('id').none(),
    ]);

    expect(result).toEqual([[], [], [], []]);
    expect(query).not.toBeCalled();
  });

  it('should return undefined for return types `one`, `value`, `void`', async () => {
    const result = await Promise.all([
      User.takeOptional().none(),
      User.getOptional('id').none(),
      User.exec().none(),
    ]);

    expect(result).toEqual([undefined, undefined, undefined]);
    expect(query).not.toBeCalled();
  });

  it('should return 0 for return type `rowCount`', async () => {
    const result = await Promise.all([
      User.insert(userData).none(),
      User.all().update({}).none(),
      User.all().delete().none(),
    ]);

    expect(result).toEqual([0, 0, 0]);
    expect(query).not.toBeCalled();
  });

  it('should throw NotFoundError for return types `oneOrThrow`, `valueOrThrow`', async () => {
    const result = await Promise.allSettled([
      User.take().none(),
      User.get('id').none(),
    ]);

    expect(result).toEqual([
      { status: 'rejected', reason: expect.any(NotFoundError) },
      { status: 'rejected', reason: expect.any(NotFoundError) },
    ]);
    expect(query).not.toBeCalled();
  });

  it('should return false for exists', async () => {
    const result = await User.none().exists();

    assertType<typeof result, boolean>();

    expect(result).toBe(false);
  });

  describe('with db', () => {
    useTestDatabase();

    it('should return false for exists in a sub-select', async () => {
      await User.insert(userData);

      const result = await User.select({
        exists: () => User.none().exists(),
      }).take();

      assertType<typeof result, { exists: boolean }>();

      expect(result).toEqual({ exists: false });
    });
  });
});
