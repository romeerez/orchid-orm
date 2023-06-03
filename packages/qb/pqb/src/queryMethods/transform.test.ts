import { User, userData } from '../test-utils/test-utils';
import { assertType, useTestDatabase } from 'test-utils';

describe('transform', () => {
  useTestDatabase();

  it('should load and transform records, with respect to column parsers', async () => {
    await User.count().create(userData);

    const q = User.select('name', 'createdAt').transform((nodes) => ({
      nodes,
      cursor: 1,
    }));

    assertType<
      Awaited<typeof q>,
      { nodes: { name: string; createdAt: Date }[]; cursor: number }
    >();

    const res = await q;
    expect(res).toEqual({
      nodes: [{ name: userData.name, createdAt: expect.any(Date) }],
      cursor: 1,
    });
  });

  it('should load and transform records from a sub-query, with respect to column parsers', async () => {
    await User.count().create(userData);

    const q = User.select('id', {
      users: () =>
        User.select('name', 'createdAt')
          .take()
          .transform((nodes) => ({
            nodes,
            cursor: 1,
          })),
    });

    assertType<
      Awaited<typeof q>,
      {
        id: number;
        users: { nodes: { name: string; createdAt: Date }; cursor: number };
      }[]
    >();

    const res = await q;
    expect(res).toEqual([
      {
        id: expect.any(Number),
        users: {
          nodes: {
            name: userData.name,
            createdAt: expect.any(Date),
          },
          cursor: 1,
        },
      },
    ]);
  });
});
