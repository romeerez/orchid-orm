import { emulateReturnNoRowsOnce } from '../../../test-utils/pqb.test-utils';
import {
  assertType,
  db,
  sql,
  testDb,
  UserData,
  UserDefaultSelect,
  useTestDatabase,
} from 'test-utils';
import { TransactionAdapterClass } from '../../../adapters/adapter';
import { testTransaction } from '../../../testTransaction';

const minUserData = {
  Name: UserData.Name,
  UserKey: UserData.UserKey,
  Password: UserData.Password,
};

const TableWithReadOnly = testDb(
  'user',
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    password: t.integer().readOnly(),
  }),
  undefined,
  {
    schema: () => 'schema',
  },
);

const TableWithSoftDelete = testDb(
  'user',
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    password: t.string(),
    deletedAt: t.timestamp().nullable(),
  }),
  undefined,
  {
    schema: () => 'schema',
    softDelete: true,
  },
);

const arraysSpy = jest.spyOn(TransactionAdapterClass.prototype, 'arrays');
const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');

describe('upsert', () => {
  useTestDatabase();

  it('should not call create callback producing data when the record is found', async () => {
    const fn = jest.fn(() => minUserData);
    const id = await db.user.get('Id').insert(minUserData);

    await db.user.find(id).upsert({
      update: {
        Name: 'new name',
      },
      create: fn,
    });

    expect(fn).not.toHaveBeenCalled();
  });

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
    const q = db.user.find(1).upsert({
      update: { Name: 'name' },
      create: minUserData,
    });

    assertType<Awaited<typeof q>, void>();
  });

  it('should update record if exists, should support sql and sub-queries', async () => {
    const { Id } = await db.user.create(minUserData);

    const user = await db.user
      .selectAll()
      .find(Id)
      .upsert({
        update: {
          Data: { name: 'updated', tags: ['tag'] },
          Age: () => sql`28`,
          Name: () =>
            db.user
              .create({
                ...minUserData,
                Name: 'updated',
              })
              .get('Name'),
        },
        create: minUserData,
      });

    assertType<typeof user, UserDefaultSelect>();

    expect(user).toMatchObject({
      Name: 'updated',
      Age: 28,
      Data: { name: 'updated', tags: ['tag'] },
    });
  });

  it('should create record if not exists, should support sql and sub-queries', async () => {
    const user = await db.user
      .selectAll()
      .find(123)
      .upsert({
        update: {
          Name: 'updated',
        },
        create: {
          ...minUserData,
          Data: { name: 'created', tags: ['tag'] },
          Age: () => sql`28`,
          Name: () =>
            db.user
              .create({
                ...minUserData,
                Name: 'created',
              })
              .get('Name'),
        },
      });

    assertType<typeof user, UserDefaultSelect>();

    expect(user).toMatchObject({
      Data: { name: 'created', tags: ['tag'] },
      Age: 28,
      Name: 'created',
    });
  });

  it('should create record and return a single value', async () => {
    const id = await db.user.get('Id').find(1).upsert({
      update: {},
      create: minUserData,
    });

    assertType<typeof id, number>();

    expect(id).toEqual(expect.any(Number));
  });

  it('should create record and return a single value having get in the end', async () => {
    const id = await db.user
      .find(1)
      .upsert({
        update: {},
        create: minUserData,
      })
      .get('Id');

    assertType<typeof id, number>();

    expect(id).toEqual(expect.any(Number));
  });

  it('should create record if not exists with a data from a callback', async () => {
    const user = await db.user
      .selectAll()
      .find(123)
      .upsert({
        update: {
          Name: 'updated',
        },
        create: () => ({ ...minUserData, Name: 'created' }),
      });

    assertType<typeof user, UserDefaultSelect>();

    expect(user.Name).toBe('created');
  });

  // FOR UPDATE only makes sense for SELECT queries, it should be omitted for both the update and insert parts
  it('should keep FOR UPDATE for the select part, but omit it for the INSERT part', async () => {
    querySpy.mockClear();
    arraysSpy.mockClear();

    await db.user
      .find(123)
      .upsert({ update: {}, create: minUserData })
      .forUpdate();

    expect([...querySpy.mock.calls, ...arraysSpy.mock.calls]).toEqual([
      [
        'UPDATE "schema"."user" "User" SET "updated_at" = now() WHERE "User"."id" = $1',
        [123],
        undefined,
      ],
      [
        'WITH "q" AS (' +
          'UPDATE "schema"."user" "User" SET "updated_at" = now() WHERE "User"."id" = $1 RETURNING NULL' +
          '), "q2" AS (' +
          'INSERT INTO "schema"."user" AS "User"("name", "user_key", "password") SELECT $2, $3, $4 WHERE (NOT EXISTS (SELECT 1 FROM "q")) RETURNING NULL' +
          ') SELECT  FROM "q" UNION ALL SELECT  FROM "q2"',
        [123, ...Object.values(minUserData)],
        undefined,
      ],
    ]);
  });

  it('should omit soft delete check from the insert part, since it was applied in the selecting sub query', async () => {
    querySpy.mockClear();
    arraysSpy.mockClear();

    const softDeleteData = { name: 'name', password: 'password' };
    await TableWithSoftDelete.find(123).upsert({
      update: {},
      create: softDeleteData,
    });

    expect([...querySpy.mock.calls, ...arraysSpy.mock.calls]).toEqual([
      [
        'SELECT FROM "schema"."user" WHERE ("user"."id" = $1) AND ("user"."deleted_at" IS NULL)',
        [123],
      ],
      [
        'WITH "q" AS (' +
          'SELECT FROM "schema"."user" WHERE ("user"."id" = $1) AND ("user"."deleted_at" IS NULL)' +
          '), "q2" AS (' +
          'INSERT INTO "schema"."user"("name", "password") SELECT $2, $3 WHERE (NOT EXISTS (SELECT 1 FROM "q")) RETURNING NULL' +
          ') SELECT  FROM "q" UNION ALL SELECT  FROM "q2"',
        [123, ...Object.values(softDeleteData)],
      ],
    ]);
  });

  describe('empty update', () => {
    const UserWithoutTimestamps = testDb(
      'user',
      (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text(),
      }),
      undefined,
      {
        schema: () => 'schema',
      },
    );

    interface UserRecord {
      id: number;
      name: string;
      password: string;
    }

    it('should not create record if it exists', async () => {
      const { id } = await UserWithoutTimestamps.create({
        name: minUserData.Name,
        password: minUserData.Password,
      });

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
    await db.user.createMany([minUserData, minUserData]);

    await expect(
      db.user
        .where({ Name: minUserData.Name })
        .take()
        .upsert({
          update: {
            Name: 'updated',
          },
          create: minUserData,
        }),
    ).rejects.toThrow();
  });

  it('should inject update data into create function', async () => {
    const created = await db.user
      .find(1)
      .select('*')
      .upsert({
        update: {
          Name: 'name',
        },
        create: (data) => ({
          ...minUserData,
          ...data,
          Password: 'password',
        }),
      });

    assertType<typeof created, UserDefaultSelect>();

    expect(created).toMatchObject({
      Name: 'name',
    });

    expect(created).not.toMatchObject({
      Password: 'password',
    });
  });

  it('should use `data` for both update and create', async () => {
    const created = await db.user
      .find(1)
      .select('*')
      .upsert({
        data: {
          Name: 'name',
        },
        create: {
          ...minUserData,
          Password: 'password',
        },
      });

    assertType<typeof created, UserDefaultSelect>();

    expect(created).toMatchObject({
      Name: 'name',
    });

    expect(created).not.toMatchObject({
      Password: 'password',
    });
  });

  it('should use `data` for both update and create with function', async () => {
    const created = await db.user.find(1).upsert({
      data: {
        Name: 'name',
      },
      create: (data) => ({
        ...minUserData,
        Password: data.Name,
      }),
    });

    assertType<typeof created, void>();

    expect(created).toBe(undefined);
  });

  it('should call both before hooks, after update hooks when updated, should return void by default', async () => {
    await testTransaction.start(db);

    try {
      const { Id } = await db.user.create(minUserData);

      const beforeUpdate = jest.fn();
      const afterUpdate = jest.fn();
      const afterUpdateCommit = jest.fn();
      const beforeCreate = jest.fn();
      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      emulateReturnNoRowsOnce();

      const res = await db.user
        .find(Id)
        .upsert({
          data: minUserData,
          create: minUserData,
        })
        .beforeUpdate(beforeUpdate)
        .afterUpdate(['Id'], afterUpdate)
        .afterUpdateCommit(['Name'], afterUpdateCommit)
        .beforeCreate(beforeCreate)
        .afterCreate(['Password'], afterCreate)
        .afterCreateCommit(['Age'], afterCreateCommit);

      assertType<typeof res, void>();
      expect(res).toBe(undefined);

      expect(beforeUpdate).toHaveBeenCalledTimes(1);
      expect(afterUpdate).toHaveBeenCalledWith(
        [
          {
            Id: expect.any(Number),
            Name: 'name',
          },
        ],
        expect.any(Object),
      );
      expect(afterUpdateCommit).toHaveBeenCalledWith(
        [
          {
            Id: expect.any(Number),
            Name: 'name',
          },
        ],
        expect.any(Object),
      );
      expect(beforeCreate).toHaveBeenCalledTimes(1);
      expect(afterCreate).not.toHaveBeenCalled();
      expect(afterCreateCommit).not.toHaveBeenCalled();
    } finally {
      await testTransaction.rollback(db);
    }
  });

  it('should call both before hooks, after update hooks when updated, should return selected columns', async () => {
    await testTransaction.start(db);

    try {
      const { Id } = await db.user.create(minUserData);

      const beforeUpdate = jest.fn();
      const afterUpdate = jest.fn();
      const afterUpdateCommit = jest.fn();
      const beforeCreate = jest.fn();
      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      emulateReturnNoRowsOnce();

      const res = await db.user
        .find(Id)
        .select('Id')
        .upsert({
          data: minUserData,
          create: minUserData,
        })
        .beforeUpdate(beforeUpdate)
        .afterUpdate(['Id'], afterUpdate)
        .afterUpdateCommit(['Name'], afterUpdateCommit)
        .beforeCreate(beforeCreate)
        .afterCreate(['Password'], afterCreate)
        .afterCreateCommit(['Age'], afterCreateCommit);

      assertType<typeof res, { Id: number }>();
      expect(res).toEqual({ Id: expect.any(Number) });

      expect(beforeUpdate).toHaveBeenCalledTimes(1);
      expect(afterUpdate).toHaveBeenCalledWith(
        [
          {
            Id: expect.any(Number),
            Name: 'name',
          },
        ],
        expect.any(Object),
      );
      expect(afterUpdateCommit).toHaveBeenCalledWith(
        [
          {
            Id: expect.any(Number),
            Name: 'name',
          },
        ],
        expect.any(Object),
      );
      expect(beforeCreate).toHaveBeenCalledTimes(1);
      expect(afterCreate).not.toHaveBeenCalled();
      expect(afterCreateCommit).not.toHaveBeenCalled();
    } finally {
      await testTransaction.rollback(db);
    }
  });

  it('should call after create hooks when created', async () => {
    const beforeUpdate = jest.fn();
    const afterUpdate = jest.fn();
    const afterUpdateCommit = jest.fn();
    const beforeCreate = jest.fn();
    const afterCreate = jest.fn();
    const afterCreateCommit = jest.fn();

    await testTransaction.start(db);

    try {
      const res = await db.user
        .find(123)
        .upsert({
          data: minUserData,
          create: minUserData,
        })
        .beforeUpdate(beforeUpdate)
        .afterUpdate(['Id'], afterUpdate)
        .afterUpdateCommit(['Name'], afterUpdateCommit)
        .beforeCreate(beforeCreate)
        .afterCreate(['Password'], afterCreate)
        .afterCreateCommit(['Age'], afterCreateCommit);

      assertType<typeof res, void>();
      expect(res).toBe(undefined);

      expect(beforeUpdate).toHaveBeenCalledTimes(1);
      expect(afterUpdate).not.toHaveBeenCalled();
      expect(afterUpdateCommit).not.toHaveBeenCalled();
      expect(beforeCreate).toHaveBeenCalledTimes(1);
      expect(afterCreate).toHaveBeenCalledWith(
        [
          {
            Password: 'password',
            Age: null,
          },
        ],
        expect.any(Object),
      );
      expect(afterCreateCommit).toHaveBeenCalledWith(
        [
          {
            Password: 'password',
            Age: null,
          },
        ],
        expect.any(Object),
      );
    } finally {
      await testTransaction.rollback(db);
    }
  });

  it('should name updating and creating CTEs uniquely', async () => {
    const result = await testDb
      .with('a', () =>
        db.user
          .find(1)
          .upsert({ update: { Name: 'name' }, create: minUserData })
          .select('Id'),
      )
      .with('b', () =>
        db.user
          .find(1)
          .upsert({ update: { Name: 'name' }, create: minUserData })
          .select('Id'),
      )
      .from(['a', 'b'])
      .select({ a: 'a.Id', b: 'b.Id' });

    expect(result).toEqual([
      {
        a: expect.any(Number),
        b: expect.any(Number),
      },
    ]);
  });
});
