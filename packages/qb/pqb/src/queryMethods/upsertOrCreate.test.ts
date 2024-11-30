import { User, userData } from '../test-utils/test-utils';
import { assertType, testDb, useTestDatabase } from 'test-utils';
import { TransactionAdapter } from '../adapter';
import { QueryInput } from 'orchid-core';

const emulateReturnNoRowsOnce = () => {
  // emulate the edge case when first query doesn't find the record, and then in CTE it appears
  const { query } = TransactionAdapter.prototype;
  TransactionAdapter.prototype.query = async function (
    this: unknown,
    q: QueryInput,
  ) {
    const result = await query.call(this, q);
    result.rowCount = 0;
    TransactionAdapter.prototype.query = query;
    return result;
  } as never;
};

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

    it('should inject update data into create function', async () => {
      const created = await User.find(1)
        .select('*')
        .upsert({
          update: {
            name: 'name',
          },
          create: (data) => ({
            ...data,
            password: 'password',
          }),
        });

      expect(created).toMatchObject({
        name: 'name',
      });

      expect(created).not.toMatchObject({
        password: 'password',
      });
    });

    it('should use `data` for both update and create', async () => {
      const created = await User.find(1)
        .select('*')
        .upsert({
          data: {
            name: 'name',
          },
          create: {
            password: 'password',
          },
        });

      expect(created).toMatchObject({
        name: 'name',
      });

      expect(created).not.toMatchObject({
        password: 'password',
      });
    });

    it('should use `data` for both update and create with function', async () => {
      const created = await User.find(1).upsert({
        data: {
          name: 'name',
        },
        create: (data) => ({
          password: data.name,
        }),
      });

      assertType<typeof created, void>();

      expect(created).toBe(undefined);
    });

    it('should call both before hooks, after update hooks when updated, should return void by default', async () => {
      await User.create(userData);

      const beforeUpdate = jest.fn();
      const afterUpdate = jest.fn();
      const afterUpdateCommit = jest.fn();
      const beforeCreate = jest.fn();
      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      emulateReturnNoRowsOnce();

      const res = await User.findBy({ name: 'name' })
        .upsert({
          data: userData,
          create: userData,
        })
        .beforeUpdate(beforeUpdate)
        .afterUpdate(['id'], afterUpdate)
        .afterUpdateCommit(['name'], afterUpdateCommit)
        .beforeCreate(beforeCreate)
        .afterCreate(['password'], afterCreate)
        .afterCreateCommit(['age'], afterCreateCommit);

      assertType<typeof res, void>();
      expect(res).toBe(undefined);

      expect(beforeUpdate).toHaveBeenCalledTimes(1);
      expect(afterUpdate).toHaveBeenCalledWith(
        [
          {
            id: expect.any(Number),
            name: 'name',
            password: 'password',
            age: null,
          },
        ],
        expect.any(Object),
      );
      expect(afterUpdateCommit).toHaveBeenCalledWith(
        [
          {
            id: expect.any(Number),
            name: 'name',
            password: 'password',
            age: null,
          },
        ],
        expect.any(Object),
      );
      expect(beforeCreate).toHaveBeenCalledTimes(1);
      expect(afterCreate).not.toHaveBeenCalled();
      expect(afterCreateCommit).not.toHaveBeenCalled();
    });

    it('should call both before hooks, after update hooks when updated, should return selected columns', async () => {
      await User.create(userData);

      const beforeUpdate = jest.fn();
      const afterUpdate = jest.fn();
      const afterUpdateCommit = jest.fn();
      const beforeCreate = jest.fn();
      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      emulateReturnNoRowsOnce();

      const res = await User.findBy({ name: 'name' })
        .select('id')
        .upsert({
          data: userData,
          create: userData,
        })
        .beforeUpdate(beforeUpdate)
        .afterUpdate(['id'], afterUpdate)
        .afterUpdateCommit(['name'], afterUpdateCommit)
        .beforeCreate(beforeCreate)
        .afterCreate(['password'], afterCreate)
        .afterCreateCommit(['age'], afterCreateCommit);

      assertType<typeof res, { id: number }>();
      expect(res).toEqual({ id: expect.any(Number) });

      expect(beforeUpdate).toHaveBeenCalledTimes(1);
      expect(afterUpdate).toHaveBeenCalledWith(
        [
          {
            id: expect.any(Number),
            name: 'name',
            password: 'password',
            age: null,
          },
        ],
        expect.any(Object),
      );
      expect(afterUpdateCommit).toHaveBeenCalledWith(
        [
          {
            id: expect.any(Number),
            name: 'name',
            password: 'password',
            age: null,
          },
        ],
        expect.any(Object),
      );
      expect(beforeCreate).toHaveBeenCalledTimes(1);
      expect(afterCreate).not.toHaveBeenCalled();
      expect(afterCreateCommit).not.toHaveBeenCalled();
    });

    it('should call after create hooks when created', async () => {
      const beforeUpdate = jest.fn();
      const afterUpdate = jest.fn();
      const afterUpdateCommit = jest.fn();
      const beforeCreate = jest.fn();
      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      const res = await User.findBy({ name: 'name' })
        .upsert({
          data: userData,
          create: userData,
        })
        .beforeUpdate(beforeUpdate)
        .afterUpdate(['id'], afterUpdate)
        .afterUpdateCommit(['name'], afterUpdateCommit)
        .beforeCreate(beforeCreate)
        .afterCreate(['password'], afterCreate)
        .afterCreateCommit(['age'], afterCreateCommit);

      assertType<typeof res, void>();
      expect(res).toBe(undefined);

      expect(beforeUpdate).toHaveBeenCalledTimes(1);
      expect(afterUpdate).not.toHaveBeenCalled();
      expect(afterUpdateCommit).not.toHaveBeenCalled();
      expect(beforeCreate).toHaveBeenCalledTimes(1);
      expect(afterCreate).toHaveBeenCalledWith(
        [
          {
            id: expect.any(Number),
            name: 'name',
            password: 'password',
            age: null,
          },
        ],
        expect.any(Object),
      );
      expect(afterCreateCommit).toHaveBeenCalledWith(
        [
          {
            id: expect.any(Number),
            name: 'name',
            password: 'password',
            age: null,
          },
        ],
        expect.any(Object),
      );
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

    it('should not call after create hooks when not created, should return void by default', async () => {
      await User.create(userData);

      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      emulateReturnNoRowsOnce();

      const res = await User.findBy({ name: 'name' })
        .orCreate(userData)
        .afterCreate(['password'], afterCreate)
        .afterCreateCommit(['age'], afterCreateCommit);

      assertType<typeof res, void>();
      expect(res).toBe(undefined);

      expect(afterCreate).not.toHaveBeenCalled();
      expect(afterCreateCommit).not.toHaveBeenCalled();
    });

    it('should not call after create hooks when not created, should return only the selected columns', async () => {
      await User.create(userData);

      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      emulateReturnNoRowsOnce();

      const res = await User.select('id')
        .findBy({ name: 'name' })
        .orCreate(userData)
        .afterCreate(['password'], afterCreate)
        .afterCreateCommit(['age'], afterCreateCommit);

      assertType<typeof res, { id: number }>();
      expect(res).toEqual({ id: expect.any(Number) });

      expect(afterCreate).not.toHaveBeenCalled();
      expect(afterCreateCommit).not.toHaveBeenCalled();
    });

    it('should call after create hooks when created', async () => {
      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      await User.findBy({ name: 'name' })
        .orCreate(userData)
        .afterCreate(['password'], afterCreate)
        .afterCreateCommit(['age'], afterCreateCommit);

      expect(afterCreate).toHaveBeenCalledWith(
        [
          {
            password: 'password',
            age: null,
          },
        ],
        expect.any(Object),
      );
      expect(afterCreateCommit).toHaveBeenCalledWith(
        [
          {
            password: 'password',
            age: null,
          },
        ],
        expect.any(Object),
      );
    });
  });
});
