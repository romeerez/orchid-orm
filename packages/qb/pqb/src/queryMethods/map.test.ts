import { assertType, useTestDatabase } from 'test-utils';
import { User, userData } from '../test-utils/test-utils';

describe('map', () => {
  useTestDatabase();

  beforeAll(async () => {
    await User.insert(userData);
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
});
