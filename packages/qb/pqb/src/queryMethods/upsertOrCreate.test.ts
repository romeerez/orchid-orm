import { User, userData } from '../test-utils/test-utils';
import { assertType, testDb, useTestDatabase } from 'test-utils';

describe('upsertOrCreate', () => {
  useTestDatabase();

  describe('upsert', () => {
    it('should return void by default', () => {
      const q = User.find(1).upsert({
        update: { name: 'name' },
        create: userData,
      });

      assertType<Awaited<typeof q>, void>();
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

    it('should create record and return a single value', async () => {
      const id = await User.find(1)
        .upsert({
          update: {},
          create: userData,
        })
        .get('id');

      assertType<typeof id, number>();

      expect(id).toEqual(expect.any(Number));
    });

    it('should create record if not exists with a data from a callback', async () => {
      const user = await User.selectAll()
        .find(123)
        .upsert({
          update: {
            name: 'updated',
          },
          create: () => ({ ...userData, name: 'created' }),
        });

      expect(user.name).toBe('created');
    });

    describe('empty update', () => {
      const UserWithoutTimestamps = testDb('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text(),
      }));

      it('should not create record if it exists', async () => {
        const { id } = await UserWithoutTimestamps.create(userData);

        const user = await UserWithoutTimestamps.selectAll()
          .find(id)
          .upsert({
            update: {},
            create: {
              name: 'new name',
              password: 'new password',
            },
          });

        expect(user.id).toBe(id);
      });

      it('should create record if not exists', async () => {
        const user = await UserWithoutTimestamps.selectAll()
          .find(1)
          .upsert({
            update: {},
            create: {
              name: 'created',
              password: 'new password',
            },
          });

        expect(user.name).toBe('created');
      });
    });

    it('should throw if more than one row was updated', async () => {
      await User.createMany([userData, userData]);

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

  describe('orCreate', () => {
    it('should return void by default', () => {
      const query = User.find(1).orCreate(userData);

      assertType<Awaited<typeof query>, void>();
    });

    it('should not create record if exists', async () => {
      const { id } = await User.create(userData);

      const user = await User.selectAll()
        .find(id)
        .orCreate({
          ...userData,
          name: 'created',
        });

      expect(user.name).toBe(userData.name);
    });

    it('should create record if not exists', async () => {
      const user = await User.selectAll()
        .find(123)
        .orCreate({
          ...userData,
          name: 'created',
        });

      expect(user.name).toBe('created');
    });

    it('should create record if not exists with data from a callback', async () => {
      const user = await User.selectAll()
        .find(123)
        .orCreate(() => ({
          ...userData,
          name: 'created',
        }));

      expect(user.name).toBe('created');
    });
  });
});
