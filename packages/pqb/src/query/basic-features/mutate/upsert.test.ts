import {
  emulateReturnNoRowsOnce,
  User,
  userData,
  UserRecord,
} from '../../../test-utils/pqb.test-utils';
import {
  assertType,
  sql,
  testDb,
  TestTransactionAdapter,
  useTestDatabase,
} from 'test-utils';

const TableWithReadOnly = testDb('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
  password: t.integer().readOnly(),
}));

describe('upsert', () => {
  useTestDatabase();

  it('should not allow using appReadOnly columns in update', () => {
    expect(() =>
      TableWithReadOnly.find(1).upsert({
        update: {
          // @ts-expect-error password is readOnly
          password: 'password',
        },
        create: { name: 'name' },
      }),
    ).toThrow('Trying to update a readonly column');
  });

  it('should not allow using appReadOnly columns in data', () => {
    expect(() =>
      TableWithReadOnly.find(1).upsert({
        data: {
          // @ts-expect-error password is readOnly
          password: 'password',
        },
        create: { name: 'name' },
      }),
    ).toThrow('Trying to update a readonly column');
  });

  it('should not allow using appReadOnly columns in create', async () => {
    expect(() =>
      TableWithReadOnly.find(1).upsert({
        update: { name: 'name' },
        create: {
          name: 'name',
          // @ts-expect-error password is readOnly
          password: 'password',
        },
      }),
    ).toThrow('Trying to insert a readonly column');
  });

  it('should return void by default', () => {
    const q = User.find(1).upsert({
      update: { name: 'name' },
      create: userData,
    });

    assertType<Awaited<typeof q>, void>();
  });

  it('should update record if exists, should support sql and sub-queries', async () => {
    const { id } = await User.create(userData);

    const user = await User.selectAll()
      .find(id)
      .upsert({
        update: {
          data: { name: 'updated', tags: ['tag'] },
          age: () => sql`28`,
          name: () =>
            User.create({
              ...userData,
              name: 'updated',
            }).get('name'),
        },
        create: userData,
      });

    assertType<typeof user, UserRecord>();

    expect(user).toMatchObject({
      name: 'updated',
      age: 28,
      data: { name: 'updated', tags: ['tag'] },
    });
  });

  it('should create record if not exists, should support sql and sub-queries', async () => {
    const user = await User.selectAll()
      .find(123)
      .upsert({
        update: {
          name: 'updated',
        },
        create: {
          data: { name: 'created', tags: ['tag'] },
          password: 'password',
          age: () => sql`28`,
          name: () =>
            User.create({
              ...userData,
              name: 'created',
            }).get('name'),
        },
      });

    assertType<typeof user, UserRecord>();

    expect(user).toMatchObject({
      data: { name: 'created', tags: ['tag'] },
      age: 28,
      name: 'created',
    });
  });

  it('should create record and return a single value', async () => {
    const id = await User.get('id').find(1).upsert({
      update: {},
      create: userData,
    });

    assertType<typeof id, number>();

    expect(id).toEqual(expect.any(Number));
  });

  it('should create record and return a single value having get in the end', async () => {
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

    assertType<typeof user, UserRecord>();

    expect(user.name).toBe('created');
  });

  // FOR UPDATE only makes sense for SELECT queries, it should be omitted for both the update and insert parts
  it('should keep FOR UPDATE for the select part, but omit it for the INSERT part', async () => {
    const spy = jest.spyOn(TestTransactionAdapter.prototype, 'arrays');

    await User.find(123).upsert({ update: {}, create: userData }).forUpdate();

    expect(spy.mock.calls).toEqual([
      ['UPDATE "user" SET "updated_at" = now() WHERE "user"."id" = $1', [123]],
      [
        'WITH "q" AS (' +
          'UPDATE "user" SET "updated_at" = now() WHERE "user"."id" = $1 RETURNING NULL' +
          '), "q2" AS (' +
          'INSERT INTO "user"("name", "password") SELECT $2, $3 WHERE NOT EXISTS (SELECT 1 FROM "q") RETURNING NULL' +
          ') SELECT  FROM "q" UNION ALL SELECT  FROM "q2"',
        [123, ...Object.values(userData)],
      ],
    ]);
  });

  describe('empty update', () => {
    const UserWithoutTimestamps = testDb('user', (t) => ({
      id: t.serial().primaryKey(),
      name: t.text(),
      password: t.text(),
    }));

    interface UserRecord {
      id: number;
      name: string;
      password: string;
    }

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

      assertType<typeof user, UserRecord>();

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

      assertType<typeof user, UserRecord>();

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

    assertType<typeof created, UserRecord>();

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

    assertType<typeof created, UserRecord>();

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
        },
      ],
      expect.any(Object),
    );
    expect(afterUpdateCommit).toHaveBeenCalledWith(
      [
        {
          id: expect.any(Number),
          name: 'name',
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
        },
      ],
      expect.any(Object),
    );
    expect(afterUpdateCommit).toHaveBeenCalledWith(
      [
        {
          id: expect.any(Number),
          name: 'name',
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

  it('should name updating and creating CTEs uniquely', async () => {
    const result = await testDb
      .with('a', () =>
        User.find(1)
          .upsert({ update: { name: 'name' }, create: userData })
          .select('id'),
      )
      .with('b', () =>
        User.find(1)
          .upsert({ update: { name: 'name' }, create: userData })
          .select('id'),
      )
      .from(['a', 'b'])
      .select({ a: 'a.id', b: 'b.id' });

    expect(result).toEqual([
      {
        a: expect.any(Number),
        b: expect.any(Number),
      },
    ]);
  });
});
