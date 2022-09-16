import { AssertEqual, User, userData } from '../test-utils';

describe('upsert', () => {
  it('should return void by default', () => {
    const query = User.find(1).upsert({
      update: { name: 'name' },
      create: userData,
    });

    const eq: AssertEqual<Awaited<typeof query>, void> = true;
    expect(eq).toBe(true);
  });

  it('should update record if exists', async () => {
    const { id } = await User.create(userData);

    const user = await User.selectAll()
      .find(id)
      .upsert({
        update: {
          name: 'updated',
        },
        create: userData,
      });

    expect(user.name).toBe('updated');
  });

  it('should create record if not exists', async () => {
    const user = await User.selectAll()
      .find(123)
      .upsert({
        update: {
          name: 'updated',
        },
        create: { ...userData, name: 'created' },
      });

    expect(user.name).toBe('created');
  });

  it('should throw if more than one row was updated', async () => {
    await User.create([userData, userData]);

    await expect(
      User.findBy({ name: userData.name }).upsert({
        update: {
          name: 'updated',
        },
        create: userData,
      }),
    ).rejects.toThrow();
  });
});
