import { db, useTestDatabase, UserData } from 'test-utils';

describe('$prepare', () => {
  useTestDatabase();

  it('executes a query without parameters', async () => {
    let name = 'prepared user';
    const findUser = db.$prepare(() => db.user.where({ Name: name }));

    name = 'other user';
    await db.user.create({ ...UserData, Name: 'prepared user' });
    await db.user.create({ ...UserData, Name: name });

    await expect(findUser()).resolves.toMatchObject([
      { Name: 'prepared user' },
    ]);
  });

  it('executes a query with different parameters', async () => {
    const findUser = db.$prepare<{ name: string }>((params) =>
      db.user.where({ Name: params.name }),
    );

    await db.user.create({ ...UserData, Name: 'first user' });
    await db.user.create({ ...UserData, Name: 'second user' });

    await expect(findUser({ name: 'first user' })).resolves.toMatchObject([
      { Name: 'first user' },
    ]);
    await expect(findUser({ name: 'second user' })).resolves.toMatchObject([
      { Name: 'second user' },
    ]);
  });
});
