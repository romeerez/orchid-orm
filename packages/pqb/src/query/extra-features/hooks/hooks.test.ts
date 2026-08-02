import {
  db,
  defineTable,
  expectSql,
  ProfileData,
  sql,
  testOrchidORMWithAdapter,
  useTestDatabase,
  UserData,
} from 'test-utils';
import { emulateReturnNoRowsOnce } from '../../../test-utils/pqb.test-utils';
import { QueryCreate } from '../../basic-features/mutate/create';
import { QueryUpdate } from '../../basic-features/mutate/update';
import { QueryUpsert } from '../../basic-features/mutate/upsert';
import { QueryDelete } from '../../basic-features/mutate/delete';
import { QueryOrCreate } from '../../basic-features/mutate/or-create';
import { QueryCreateFrom } from '../../basic-features/mutate/create-from';
import { noop } from '../../../utils';
import { _appendQuery } from '../append-query/append-query';

const hookSet = {
  beforeCreate: {
    Password: 'password from beforeCreate',
  },
  beforeUpdate: {
    Active: false,
  },
  beforeSave: {
    Picture: 'picture from beforeSave',
  },
};

const hookSetCreateValues = {
  ...hookSet.beforeCreate,
  ...hookSet.beforeSave,
};

const hookSetUpdateValues = {
  ...hookSet.beforeUpdate,
  ...hookSet.beforeSave,
};

const hooksWithNoDeps = {
  beforeQuery: { fn: jest.fn().mockName('beforeQuery') },
  beforeCreate: {
    fn: jest
      .fn(({ set }) => {
        set(hookSet.beforeCreate);
      })
      .mockName('beforeCreate'),
  },
  beforeUpdate: {
    fn: jest
      .fn(({ set }) => {
        set(hookSet.beforeUpdate);
      })
      .mockName('beforeUpdate'),
  },
  beforeSave: {
    fn: jest
      .fn(({ set }) => {
        set(hookSet.beforeSave);
      })
      .mockName('beforeSave'),
  },
  beforeDelete: { fn: jest.fn().mockName('beforeDelete') },
  afterQuery: { fn: jest.fn().mockName('afterQuery') },
};

const deps: ('Name' | 'Age')[] = ['Name', 'Age'];
const depData = { Name: 'name', Age: null };

const hooksWithDeps = {
  afterCreate: { deps, fn: jest.fn().mockName('afterCreate') },
  afterUpdate: { deps, fn: jest.fn().mockName('afterUpdate') },
  afterSave: { deps, fn: jest.fn().mockName('afterSave') },
  afterDelete: { deps, fn: jest.fn().mockName('afterDelete') },
  afterCreateCommit: { deps, fn: jest.fn().mockName('afterCreateCommit') },
  afterUpdateCommit: { deps, fn: jest.fn().mockName('afterUpdateCommit') },
  afterSaveCommit: { deps, fn: jest.fn().mockName('afterSaveCommit') },
  afterDeleteCommit: { deps, fn: jest.fn().mockName('afterDeleteCommit') },
};

const hookMap = { ...hooksWithNoDeps, ...hooksWithDeps };

let User = db.user;

for (const k in hookMap) {
  const key = k as keyof typeof hookMap;
  const hook = hookMap[key];
  if ('deps' in hook) {
    User = User[key as keyof typeof hooksWithDeps](hook.deps, hook.fn);
  } else {
    User = User[key as keyof typeof hooksWithNoDeps](hook.fn);
  }
}

const toDataArr = (data?: unknown[], arg?: number | unknown[]) =>
  arg
    ? typeof arg === 'number'
      ? Array.from({ length: arg }, () => data)
      : arg
    : [];

const assert = {
  hooksBeingCalledV2(params: {
    data?: unknown[];
    beforeQuery?: number;
    beforeCreate?: number;
    beforeUpdate?: number;
    beforeDelete?: number;
    beforeSave?: number;
    afterQuery?: number;
    afterCreate?: number | unknown[];
    afterUpdate?: number | unknown[];
    afterDelete?: number | unknown[];
    afterSave?: number | unknown[];
    afterCreateCommit?: number | unknown[];
    afterUpdateCommit?: number | unknown[];
    afterDeleteCommit?: number | unknown[];
    afterSaveCommit?: number | unknown[];
  }) {
    const data = params?.data?.map((item) => expect.objectContaining(item));

    const expected = {
      beforeQuery: params.beforeQuery || 0,
      beforeCreate: params.beforeCreate || 0,
      beforeUpdate: params.beforeUpdate || 0,
      beforeDelete: params.beforeDelete || 0,
      beforeSave: params.beforeSave || 0,
      afterQuery: params.afterQuery || 0,
      afterCreate: toDataArr(data, params.afterCreate),
      afterUpdate: toDataArr(data, params.afterUpdate),
      afterDelete: toDataArr(data, params.afterDelete),
      afterSave: toDataArr(data, params.afterSave),
      afterCreateCommit: toDataArr(data, params.afterCreateCommit),
      afterUpdateCommit: toDataArr(data, params.afterUpdateCommit),
      afterDeleteCommit: toDataArr(data, params.afterDeleteCommit),
      afterSaveCommit: toDataArr(data, params.afterSaveCommit),
    };

    const actual = {
      beforeQuery: hookMap.beforeQuery.fn.mock.calls.length,
      beforeCreate: hookMap.beforeCreate.fn.mock.calls.length,
      beforeUpdate: hookMap.beforeUpdate.fn.mock.calls.length,
      beforeDelete: hookMap.beforeDelete.fn.mock.calls.length,
      beforeSave: hookMap.beforeSave.fn.mock.calls.length,
      afterQuery: hookMap.afterQuery.fn.mock.calls.length,
      afterCreate: hookMap.afterCreate.fn.mock.calls.map((call) => call[0]),
      afterUpdate: hookMap.afterUpdate.fn.mock.calls.map((call) => call[0]),
      afterDelete: hookMap.afterDelete.fn.mock.calls.map((call) => call[0]),
      afterSave: hookMap.afterSave.fn.mock.calls.map((call) => call[0]),
      afterCreateCommit: hookMap.afterCreateCommit.fn.mock.calls.map(
        (call) => call[0],
      ),
      afterUpdateCommit: hookMap.afterUpdateCommit.fn.mock.calls.map(
        (call) => call[0],
      ),
      afterDeleteCommit: hookMap.afterDeleteCommit.fn.mock.calls.map(
        (call) => call[0],
      ),
      afterSaveCommit: hookMap.afterSaveCommit.fn.mock.calls.map(
        (call) => call[0],
      ),
    };

    expect(actual).toEqual(expected);
  },
  createHooksBeingCalled({ data, cte }: { data: unknown[]; cte?: boolean }) {
    assert.hooksBeingCalledV2({
      data,
      beforeQuery: cte ? 0 : 1,
      afterQuery: cte ? 0 : 1,
      beforeCreate: 1,
      beforeSave: 1,
      afterCreate: 1,
      afterSave: 1,
      afterCreateCommit: 1,
      afterSaveCommit: 1,
    });
  },
  updateHooksBeingCalled({ data, cte }: { data: unknown[]; cte?: boolean }) {
    assert.hooksBeingCalledV2({
      data,
      beforeQuery: cte ? 0 : 1,
      afterQuery: cte ? 0 : 1,
      beforeUpdate: 1,
      beforeSave: 1,
      afterUpdate: 1,
      afterSave: 1,
      afterUpdateCommit: 1,
      afterSaveCommit: 1,
    });
  },
  upsertCreateHookBeingCalled({
    data,
    cte,
  }: {
    data: unknown[];
    cte?: boolean;
  }) {
    assert.hooksBeingCalledV2({
      data,
      beforeQuery: cte ? 0 : 1,
      afterQuery: cte ? 0 : 1,
      beforeUpdate: 1,
      beforeCreate: 1,
      beforeSave: 2,
      afterCreate: 1,
      afterSave: 1,
      afterCreateCommit: 1,
      afterSaveCommit: 1,
    });
  },
  upsertUpdateHookBeingCalled({
    data,
    cte,
  }: {
    data: unknown[];
    cte?: boolean;
  }) {
    assert.hooksBeingCalledV2({
      data,
      beforeQuery: cte ? 0 : 1,
      afterQuery: cte ? 0 : 1,
      beforeUpdate: 1,
      beforeCreate: cte ? 1 : 0,
      beforeSave: cte ? 2 : 1,
      afterUpdate: 1,
      afterSave: 1,
      afterUpdateCommit: 1,
      afterSaveCommit: 1,
    });
  },
  upsertUpdateIn2ndQueryHooksBeingCalled({ data }: { data: unknown[] }) {
    assert.hooksBeingCalledV2({
      data,
      beforeQuery: 1,
      afterQuery: 1,
      beforeUpdate: 1,
      beforeCreate: 1,
      beforeSave: 2,
      afterUpdate: 1,
      afterSave: 1,
      afterUpdateCommit: 1,
      afterSaveCommit: 1,
    });
  },
  orCreateCreateHooksBeingCalled({ data }: { data: unknown[] }) {
    assert.hooksBeingCalledV2({
      data,
      beforeQuery: 1,
      afterQuery: 1,
      beforeCreate: 1,
      beforeSave: 1,
      afterCreate: 1,
      afterSave: 1,
      afterCreateCommit: 1,
      afterSaveCommit: 1,
    });
  },
  queryHooksBeingCalled({ data }: { data: unknown[] }) {
    assert.hooksBeingCalledV2({
      data,
      beforeQuery: 1,
      afterQuery: 1,
    });
  },
  orCreateFindCteHooksBeingCalled({ data }: { data: unknown[] }) {
    assert.hooksBeingCalledV2({
      data,
      beforeCreate: 1,
      beforeSave: 1,
    });
  },
  orCreateCreateCteHooksBeingCalled({ data }: { data: unknown[] }) {
    assert.hooksBeingCalledV2({
      data,
      beforeCreate: 1,
      beforeSave: 1,
      afterCreate: 1,
      afterSave: 1,
      afterCreateCommit: 1,
      afterSaveCommit: 1,
    });
  },
  deleteHooksCteBeingCalled({ data }: { data: unknown[] }) {
    assert.hooksBeingCalledV2({
      data,
      beforeDelete: 1,
      afterDelete: 1,
      afterDeleteCommit: 1,
    });
  },
};

describe('hooks', () => {
  useTestDatabase(db);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const tested: Record<string, boolean> = {};

  describe('afterSave and afterSaveCommit applied without afterCreate or afterUpdate', () => {
    it('afterSave should be called properly when creating', async () => {
      const fn = jest.fn();

      const q = db.user.afterSave(['Name'], fn).insert(UserData);
      await q;

      expect(fn.mock.calls).toMatchObject([[[{ Name: UserData.Name }], q]]);
    });

    it('afterSaveCommit should be called properly when creating', async () => {
      const fn = jest.fn();

      const q = db.user.afterSaveCommit(['Name'], fn).insert(UserData);
      await q;

      expect(fn.mock.calls).toMatchObject([[[{ Name: UserData.Name }], q]]);
    });

    it('afterSave should be called properly when updating', async () => {
      const fn = jest.fn();
      const id = await db.user.get('Id').insert(UserData);

      const q = db.user.afterSave(['Name'], fn).find(id).insert(UserData);
      await q;

      expect(fn.mock.calls).toMatchObject([[[{ Name: UserData.Name }], q]]);
    });

    it('afterSaveCommit should be called properly when updating', async () => {
      const fn = jest.fn();
      const id = await db.user.get('Id').insert(UserData);

      const q = db.user.afterSaveCommit(['Name'], fn).find(id).insert(UserData);
      await q;

      expect(fn.mock.calls).toMatchObject([[[{ Name: UserData.Name }], q]]);
    });
  });

  describe('columns parsing', () => {
    it('should parse columns selected by hooks', async () => {
      const fn = jest.fn();

      const createdAt = new Date();

      const res = await db.user
        .afterCreate(['updatedAt'], fn)
        .insert({ ...UserData, createdAt })
        // selecting createdAt as updatedAt in attempt to confuse hook select
        .select({ updatedAt: 'createdAt' });

      const withoutQueryArg = fn.mock.calls.map((call) => call[0]);
      expect(withoutQueryArg).toMatchObject([
        [{ updatedAt: expect.any(Date) }],
      ]);

      // record has updatedAt = createdAt from above
      expect(res.updatedAt.getTime()).toBe(createdAt.getTime());

      // hookSelect was not confused: it received updatedAt
      expect(createdAt.getTime()).not.toBe(
        withoutQueryArg[0][0].updatedAt.getTime(),
      );
    });
  });

  describe('set values in before hooks', () => {
    const UserTable = defineTable('user', { schema: () => 'schema' }, (t) => ({
      id: t.identity().primaryKey(),
      name: t.text().unique(),
      password: t
        .text()
        .readOnly()
        .default(() => 'password'),
    }));
    const localDb = testOrchidORMWithAdapter(
      { db: db.$qb },
      { user: UserTable },
    );
    const User = localDb.user;

    it('should set a readonly value in beforeCreate', async () => {
      let cols: string[] | undefined;

      const res = await User.beforeCreate(({ columns, set }) => {
        cols = columns;
        set({ password: 'from hook' });
      }).create({ name: 'name' });

      expect(res.password).toBe('from hook');
      expect(cols).toEqual(['name']);
    });

    it('should set a readonly value in beforeUpdate', async () => {
      const { id } = await User.create({ name: 'name' });
      let cols: string[] | undefined;

      const res = await User.beforeUpdate(({ columns, set }) => {
        cols = columns;
        set({ password: 'from hook' });
      })
        .find(id)
        .update({ name: 'name' })
        .select('password');

      expect(res.password).toBe('from hook');
      expect(cols).toEqual(['name']);
    });

    it('should set a readonly value in beforeSave', async () => {
      let cols: string[] | undefined;

      const res = await User.beforeSave(({ columns, set }) => {
        cols = columns;
        set({ password: 'from hook' });
      }).create({ name: 'name' });

      expect(res.password).toBe('from hook');
      expect(cols).toEqual(['name']);
    });
  });

  describe('select', () => {
    it('should remove duplicated selects', async () => {
      const q = User.select('Id')
        .afterUpdate(['Id', 'Name', 'Age'], noop)
        .afterUpdate(['Id', 'Name', 'Password'], noop)
        .all()
        .update({ Name: 'new name' });

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."user" "User"
          SET "name" = $1, "updated_at" = now()
          RETURNING "User"."id" "Id", "User"."name" "Name",
          "User"."age" "Age", "User"."password" "Password"
        `,
        ['new name'],
      );
    });

    it('should work for any query', async () => {
      await User;

      assert.queryHooksBeingCalled({ data: [] });
    });
  });

  describe('cte', () => {
    it('supports nesting cte queries one in another', async () => {
      const [updateId, deleteId] = await db.user
        .pluck('Id')
        .insertMany([UserData, { ...UserData, Name: 'deleted' }]);

      await db.user
        .with(
          'cte',
          User.get('Id').whereNot({
            Id: () =>
              User.get('Id').insert({
                ...UserData,
                Name: 'created',
                Age: () =>
                  User.get('Age')
                    .find(updateId)
                    .update({ Name: 'updated', Age: 123 })
                    .whereNot({
                      Name: () => User.find(deleteId).get('Name').delete(),
                    }),
              }),
          }),
        )
        .from('cte');

      const created = [{ Name: 'created', Age: 123 }];
      const updated = [{ Name: 'updated', Age: 123 }];
      const deleted = [{ Name: 'deleted', Age: null }];
      assert.hooksBeingCalledV2({
        beforeCreate: 1,
        beforeUpdate: 1,
        beforeDelete: 1,
        beforeSave: 2,
        afterCreate: [created],
        afterUpdate: [updated],
        afterSave: [[...updated, ...created]],
        afterDelete: [deleted],
        afterCreateCommit: [created],
        afterUpdateCommit: [updated],
        afterSaveCommit: [[...updated, ...created]],
        afterDeleteCommit: [deleted],
      });
    });

    it('supports having multiple cte-hook queries in a select query', async () => {
      await db.user.getOptional('Id').where({
        Id: () => User.get('Id').insert(UserData),
        Name: () => User.get('Name').insert(UserData),
      });

      assert.createHooksBeingCalled({
        data: [depData, depData],
        cte: true,
      });
    });

    it('properly separates data of different hooks, combines data for afterSave hook', async () => {
      const userId = await db.user.get('Id').insert(UserData);

      await db.user.getOptional('Id').where({
        Id: () => User.get('Id').insert({ ...UserData, Name: 'created' }),
        Name: () =>
          User.get('Name')
            .find(userId)
            .update({ ...UserData, Name: 'updated' }),
      });

      assert.hooksBeingCalledV2({
        beforeCreate: 1,
        beforeUpdate: 1,
        beforeSave: 2,
        afterCreate: [[{ ...depData, Name: 'created' }]],
        afterUpdate: [[{ ...depData, Name: 'updated' }]],
        afterSave: [
          [
            { ...depData, Name: 'created' },
            { ...depData, Name: 'updated' },
          ],
        ],
        afterCreateCommit: [[{ ...depData, Name: 'created' }]],
        afterUpdateCommit: [[{ ...depData, Name: 'updated' }]],
        afterSaveCommit: [
          [
            { ...depData, Name: 'created' },
            { ...depData, Name: 'updated' },
          ],
        ],
      });
    });

    it('should support cte-hook queries nested inside a select query', async () => {
      await db.user.getOptional('Id').where({
        Id: () =>
          User.get('Id').insert({
            ...UserData,
            Name: 'created',
          }),
      });

      assert.createHooksBeingCalled({
        data: [{ ...depData, Name: 'created' }],
        cte: true,
      });
    });

    it('automatic cte in `select`', async () => {
      await db.user.select({
        Id: () => User.get('Id').insert(UserData),
      });

      assert.createHooksBeingCalled({
        data: [depData],
        cte: true,
      });
    });

    it('automatic cte in `where` for key-value callback', async () => {
      await db.user.where({
        Id: () => User.get('Id').insert(UserData),
      });

      assert.createHooksBeingCalled({
        data: [depData],
        cte: true,
      });
    });

    it('automatic cte in `where` for a function arg', async () => {
      await db.user.where(() => User.get('Active').insert(UserData));

      assert.createHooksBeingCalled({
        data: [depData],
        cte: true,
      });
    });

    it('automatic cte for a query in expression', async () => {
      await db.user.where((q) =>
        q.or(User.get('Active').insert(UserData)).equals(false),
      );

      assert.createHooksBeingCalled({
        data: [depData],
        cte: true,
      });
    });

    it('supports nested expressions with cte query', async () => {
      await db.user.where((q) =>
        sql(() => q.or(User.get('Active').insert(UserData)).equals(false)),
      );

      assert.createHooksBeingCalled({
        data: [depData],
        cte: true,
      });
    });
  });

  describe('create', () => {
    it('should handle various create return types', async () => {
      const queries = [
        User.count().create(UserData),
        User.create(UserData).take(),
        User.create(UserData).takeOptional(),
        User.createMany([UserData]),
        User.create(UserData).get('Id'),
        User.create(UserData).getOptional('Id'),
        User.createMany([UserData]).pluck('Id'),
        User.createMany([UserData]).select('Id').rows(),
        User.create(UserData).exec(),
      ];

      for (const query of queries) {
        jest.clearAllMocks();

        await query;

        assert.createHooksBeingCalled({ data: [depData] });
      }
    });

    it.each(['create', 'insert'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        const res = await User[method](UserData).select('*', 'Password');
        expect(res).toMatchObject(hookSetCreateValues);

        assert.createHooksBeingCalled({ data: [depData] });
      },
    );

    it.each(['create', 'insert'] as const)(
      'should work for %s with empty set',
      async (method) => {
        const res = await db.user
          .beforeSave(({ set }) => {
            set(UserData);
          })
          [method]({} as never)
          .select('Name', 'Password');

        expect(res).toMatchObject({
          Name: UserData.Name,
          Password: UserData.Password,
        });
      },
    );

    it.each(['createMany', 'insertMany'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        const res = await User[method]([UserData, UserData]).select(
          '*',
          'Password',
        );
        expect(res).toMatchObject([hookSetCreateValues, hookSetCreateValues]);

        assert.createHooksBeingCalled({ data: [depData, depData] });
      },
    );

    it.each(['createOneFrom', 'insertOneFrom'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        await User.insert(UserData);
        jest.clearAllMocks();

        const res = await User[method](
          User.select('Name', 'Password').take(),
        ).select('*', 'Password');

        expect(res).toMatchObject(hookSetCreateValues);

        assert.createHooksBeingCalled({ data: [depData] });
      },
    );

    it.each(['createOneFrom', 'insertOneFrom'] as const)(
      'should work for %s with a custom key',
      async (method) => {
        tested[method] = true;

        await User.insert(UserData);
        jest.clearAllMocks();

        const res = await User[method](
          User.select('Name', 'UserKey', 'Password').take(),
          {
            Age: 42,
            Picture: 'Picture',
          },
        ).select('*', 'Password');
        expect(res).toMatchObject(hookSetCreateValues);

        assert.createHooksBeingCalled({ data: [{ ...depData, Age: 42 }] });
      },
    );

    it.each(['createManyFrom', 'insertManyFrom'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        await User.insert(UserData);
        jest.clearAllMocks();

        const res = await User[method](
          User.select('Name', 'UserKey', 'Password').take(),
          [
            {
              Age: 42,
              Picture: 'Picture',
            },
            {
              Age: 42,
              Picture: 'Picture',
            },
          ],
        ).select('*', 'Password');

        expect(res).toMatchObject([hookSetCreateValues, hookSetCreateValues]);

        assert.createHooksBeingCalled({
          data: [
            { ...depData, Age: 42 },
            { ...depData, Age: 42 },
          ],
        });
      },
    );

    it.each(['createForEachFrom', 'insertForEachFrom'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        await User.insertMany([
          { ...UserData, Name: 'one' },
          { ...UserData, Name: 'two' },
        ]);
        jest.clearAllMocks();

        const res = await User[method](User.select('Name', 'Password')).select(
          '*',
          'Password',
        );

        expect(res).toMatchObject([hookSetCreateValues, hookSetCreateValues]);

        assert.createHooksBeingCalled({
          data: [{ Name: 'one' }, { Name: 'two' }],
        });
      },
    );

    describe('cte', () => {
      describe('create methods in cte', () => {
        it('insert', async () => {
          await db.user
            .with('cte', User.insert({ ...UserData, Age: 123 }))
            .from('cte');

          assert.createHooksBeingCalled({
            data: [{ Name: UserData.Name, Age: 123 }],
            cte: true,
          });
        });

        it('create', async () => {
          const createQuery = User.create({ ...UserData, Age: 1 }).select('Id');

          const res = await db.user
            .with('Name', createQuery)
            .from('Name')
            .select({ Name: 'Id' });

          expect(res).toEqual([{ Name: expect.any(Number) }]);

          assert.createHooksBeingCalled({
            data: [{ Name: UserData.Name, Age: 1 }],
            cte: true,
          });
        });

        it('createMany', async () => {
          const createQuery = User.createMany([
            { ...UserData, Age: 1 },
            { ...UserData, Age: 1 },
          ]).select('Id');

          const res = await db.user
            .with('Name', createQuery)
            .from('Name')
            .select({ Name: 'Id' });

          expect(res).toEqual([
            { Name: expect.any(Number) },
            { Name: expect.any(Number) },
          ]);

          assert.createHooksBeingCalled({
            data: [
              { Name: UserData.Name, Age: 1 },
              { Name: UserData.Name, Age: 1 },
            ],
            cte: true,
          });
        });

        it('createOneFrom', async () => {
          await db.user.insert({ ...UserData, Age: 123 });

          const res = await db.user
            .with(
              'cte',
              User.createOneFrom(User.select('Name', 'Password', 'Age').take()),
            )
            .from('cte')
            .select('Name', 'Age');

          expect(res).toMatchObject([{ Name: UserData.Name, Age: 123 }]);

          assert.createHooksBeingCalled({
            data: [{ Name: UserData.Name, Age: 123 }],
            cte: true,
          });
        });

        it('createOneFrom create', async () => {
          await db.user.createOneFrom(
            User.create(UserData).select('Name', 'Password'),
          );

          assert.createHooksBeingCalled({
            data: [depData],
            cte: true,
          });
        });

        it('createManyFrom', async () => {
          await db.user.insert(UserData);

          const res = await db.user
            .with(
              'cte',
              User.createManyFrom(
                User.select('Name', 'UserKey', 'Password').take(),
                [{ Age: 1 }, { Age: 2 }],
              ),
            )
            .from('cte')
            .select('Name', 'Age');

          expect(res).toMatchObject([
            { Name: UserData.Name, Age: 1 },
            { Name: UserData.Name, Age: 2 },
          ]);

          assert.createHooksBeingCalled({
            data: [
              { Name: UserData.Name, Age: 1 },
              { Name: UserData.Name, Age: 2 },
            ],
            cte: true,
          });
        });

        it('createManyFrom create', async () => {
          await db.user.createManyFrom(
            User.create(UserData).select('Name', 'UserKey', 'Password'),
            [{ Age: 1 }, { Age: 2 }],
          );

          assert.createHooksBeingCalled({
            data: [depData],
            cte: true,
          });
        });

        it('createForEachFrom', async () => {
          await db.user.insertMany([
            { ...UserData, Age: 1 },
            { ...UserData, Age: 2 },
          ]);

          const res = await db.user
            .with(
              'cte',
              User.createForEachFrom(
                User.select('Name', 'UserKey', 'Password', 'Age'),
              ),
            )
            .from('cte')
            .select('Name', 'Age');

          expect(res).toMatchObject([
            { Name: UserData.Name, Age: 1 },
            { Name: UserData.Name, Age: 2 },
          ]);

          assert.createHooksBeingCalled({
            data: [
              { Name: UserData.Name, Age: 1 },
              { Name: UserData.Name, Age: 2 },
            ],
            cte: true,
          });
        });
      });

      describe('nested create methods', () => {
        it('create in create', async () => {
          const res = await db.profile.create({
            Bio: ProfileData.Bio,
            ProfileKey: 'key',
            UserId: () => User.create({ ...UserData, Age: 123 }).get('Id'),
          });

          expect(res).toMatchObject({
            Bio: ProfileData.Bio,
            UserId: expect.any(Number),
          });

          assert.createHooksBeingCalled({
            data: [{ Name: UserData.Name, Age: 123 }],
            cte: true,
          });
        });

        it('create in createMany', async () => {
          const res = await db.profile.createMany([
            {
              Bio: ProfileData.Bio,
              ProfileKey: 'key',
              UserId: () => User.create({ ...UserData, Age: 20 }).get('Id'),
            },
            {
              Bio: ProfileData.Bio,
              ProfileKey: 'key2',
              UserId: () => User.create({ ...UserData, Age: 30 }).get('Id'),
            },
          ]);

          expect(res).toMatchObject([
            { Bio: ProfileData.Bio, UserId: expect.any(Number) },
            { Bio: ProfileData.Bio, UserId: expect.any(Number) },
          ]);

          assert.createHooksBeingCalled({
            data: [
              { Name: UserData.Name, Age: 20 },
              { Name: UserData.Name, Age: 30 },
            ],
            cte: true,
          });
        });
      });

      it('should have empty returning if has no hooks and moved to CTE', async () => {
        await db.user.insert({
          ...UserData,
          Name: () => User.get('Name').insert({ ...UserData, Name: 'inner' }),
        });

        assert.createHooksBeingCalled({
          data: [{ Name: 'inner' }],
          cte: true,
        });
      });
    });
  });

  describe('update', () => {
    it('should handle various update return types', async () => {
      const Id = await User.get('Id').create(UserData);

      const queries = [
        User.find(Id).update(UserData),
        User.find(Id).update(UserData).take(),
        User.find(Id).update(UserData).takeOptional(),
        User.where({ Id }).update(UserData),
        User.find(Id).update(UserData).get('Id'),
        User.find(Id).update(UserData).getOptional('Id'),
        User.where({ Id }).update(UserData).pluck('Id'),
        User.where({ Id }).update(UserData).select('Id').rows(),
        User.find(Id).update(UserData).exec(),
      ];

      for (const query of queries) {
        jest.clearAllMocks();

        await query;

        assert.updateHooksBeingCalled({ data: [depData] });
      }
    });

    it('should not select the same column twice when using get', async () => {
      const q = User.find(0).get('Age').update({ Name: 'updated' });

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."user" "User" SET "name" = $1, "updated_at" = now()
          WHERE "User"."id" = $2
          RETURNING "User"."age", "User"."name" "Name"
        `,
        ['updated', 0],
      );
    });

    it('should not call afterUpdate hooks when did not update', async () => {
      await User.find(0).update({ Name: 'new name' });

      assert.hooksBeingCalledV2({
        beforeQuery: 1,
        beforeUpdate: 1,
        beforeSave: 1,
        afterQuery: 1,
      });
    });

    it.each(['update', 'updateOrThrow'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        const Id = await User.get('Id').create(UserData);
        jest.clearAllMocks();

        const res = await User.find(Id)
          [method]({
            Name: 'new name',
            Active: true,
          })
          .selectAll();
        expect(res).toMatchObject(hookSetUpdateValues);

        assert.updateHooksBeingCalled({
          data: [{ Name: 'new name' }],
        });
      },
    );

    it.each(['increment', 'decrement'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        const Id = await User.get('Id').create({ ...UserData, Age: 20 });
        jest.clearAllMocks();

        const res = await User.find(Id)[method]('Age').selectAll();
        expect(res).toMatchObject(hookSetUpdateValues);

        assert.updateHooksBeingCalled({
          data: [
            {
              Name: UserData.Name,
              Age: method === 'increment' ? 21 : 19,
            },
          ],
        });
      },
    );

    describe('updateFrom', () => {
      tested.updateFrom = tested.set = true;

      it('should not call afterUpdate hooks when did not update', async () => {
        await User.updateFrom(() => User.as('u').findOptional(0)).set({
          Name: 'new name',
        });

        assert.hooksBeingCalledV2({
          beforeQuery: 1,
          beforeUpdate: 1,
          beforeSave: 1,
          afterQuery: 1,
        });
      });

      it('should work', async () => {
        const Id = await User.get('Id').create(UserData);
        jest.clearAllMocks();

        const res = await User.updateFrom(
          () => User.as('u').find(Id),
          (q) => q.on('u.Id', 'User.Id'),
        )
          .set({
            Name: 'new name',
            Active: true,
          })
          .selectAll();

        expect(res).toMatchObject([hookSetUpdateValues]);

        assert.updateHooksBeingCalled({
          data: [{ Name: 'new name' }],
        });
      });
    });

    describe('updateMany', () => {
      it.each(['updateMany', 'updateManyOptional'] as const)(
        'should fire update hooks for %s',
        async (method) => {
          tested[method] = true;

          const ids = await Promise.all([
            User.get('Id').create({ ...UserData, Name: 'um1' }),
            User.get('Id').create({ ...UserData, Name: 'um2' }),
          ]);
          jest.clearAllMocks();

          await User[method]([
            { Id: ids[0], Name: 'new1' },
            { Id: ids[1], Name: 'new2' },
          ]);

          assert.updateHooksBeingCalled({
            data: [{ Name: 'new1' }, { Name: 'new2' }],
          });
        },
      );

      it.each(['updateManyBy', 'updateManyByOptional'] as const)(
        'should fire update hooks for %s',
        async (method) => {
          tested[method] = true;

          const ids = await Promise.all([
            User.get('Id').create({ ...UserData, Name: 'umby1' }),
            User.get('Id').create({ ...UserData, Name: 'umby2' }),
          ]);
          jest.clearAllMocks();

          await User[method]('Id', [
            { Id: ids[0], Name: 'umby3', Password: 'pw1' },
            { Id: ids[1], Name: 'umby4', Password: 'pw2' },
          ]);

          assert.updateHooksBeingCalled({
            data: [{ Name: 'umby3' }, { Name: 'umby4' }],
          });
        },
      );

      it('should apply hookSet values from beforeUpdate', async () => {
        const Id = await User.get('Id').create({
          ...UserData,
          Name: 'hook-test',
        });
        jest.clearAllMocks();

        const result = await User.selectAll().updateMany([
          { Id, Name: 'hook-updated' },
        ]);

        // hookSet.beforeUpdate sets Active: false
        // hookSet.beforeSave sets Picture: 'Picture from beforeSave'
        expect(result[0]).toMatchObject(hookSetUpdateValues);
      });

      it('should expose per-row setColumns in beforeUpdate columns', async () => {
        const Id = await User.get('Id').create({
          ...UserData,
          Name: 'cols-test',
        });

        let cols: string[] | undefined;

        await User.beforeUpdate(({ columns }) => {
          cols = columns;
        }).updateMany([{ Id, Name: 'cols-updated' }]);

        expect(cols).toEqual(['Name']);
      });

      it('should merge per-row and .set() columns in beforeUpdate', async () => {
        const Id = await User.get('Id').create({
          ...UserData,
          Name: 'merge-test',
        });

        let cols: string[] | undefined;

        await User.beforeUpdate(({ columns }) => {
          cols = columns;
        })
          .updateMany([{ Id, Name: 'merge-updated' }])
          .set({ Password: 'shared' });

        // 'Password' from .set(), 'Name' from per-row setColumns
        expect(cols).toEqual(['Password', 'Name']);
      });

      it('should not duplicate columns when .set() overlaps per-row', async () => {
        const Id = await User.get('Id').create({
          ...UserData,
          Name: 'dedup-test',
        });
        jest.clearAllMocks();

        let cols: string[] | undefined;

        await User.beforeUpdate(({ columns }) => {
          cols = columns;
        })
          .updateMany([{ Id, Name: 'dedup-updated' }])
          .set({ Name: 'ignored-shared' });

        // 'Name' appears in both .set() and per-row — must appear only once
        expect(cols).toEqual(['Name']);

        assert.updateHooksBeingCalled({
          data: [{ Name: 'ignored-shared' }],
        });
      });
    });

    describe('cte', () => {
      describe('update methods in cte', () => {
        it('update', async () => {
          const Id = await User.get('Id').insert(UserData);
          jest.clearAllMocks();

          await db.user
            .with('cte', User.find(Id).update({ Name: 'new name', Age: 123 }))
            .from('cte');

          assert.updateHooksBeingCalled({
            data: [{ Name: 'new name', Age: 123 }],
            cte: true,
          });
        });

        it('updateFrom', async () => {
          await User.get('Id').insert(UserData);
          jest.clearAllMocks();

          await db.user
            .with(
              'cte',
              User.updateFrom(() => User.as('u').take()).set({
                Name: 'new name',
                Age: 123,
              }),
            )
            .from('cte');

          assert.updateHooksBeingCalled({
            data: [{ Name: 'new name', Age: 123 }],
            cte: true,
          });
        });

        it.each(['increment', 'decrement'] as const)('%s', async (method) => {
          const Id = await User.get('Id').insert({ ...UserData, Age: 20 });
          jest.clearAllMocks();

          await db.user.with('cte', User.find(Id)[method]('Age')).from('cte');

          assert.updateHooksBeingCalled({
            data: [
              {
                Name: UserData.Name,
                Age: method === 'increment' ? 21 : 19,
              },
            ],
            cte: true,
          });
        });
      });
    });
  });

  describe('upsert', () => {
    it('should work for upsert create', async () => {
      tested.upsert = true;

      const res = await User.find(1)
        .upsert({
          update: { Name: 'new name' },
          create: { ...UserData, Name: 'created' },
        })
        .select('*', 'Password');

      expect(res).toMatchObject({ Name: 'created' });
      expect(res).toMatchObject(hookSetCreateValues);

      assert.upsertCreateHookBeingCalled({
        data: [{ ...depData, Name: 'created' }],
      });
    });

    it('should work for upsert update', async () => {
      const Id = await db.user.get('Id').create(UserData);
      jest.clearAllMocks();

      const res = await User.find(Id)
        .upsert({
          update: { Name: 'new name' },
          create: UserData,
        })
        .select('*', 'Password');
      expect(res).toMatchObject(hookSetUpdateValues);

      assert.upsertUpdateHookBeingCalled({ data: [{ Name: 'new name' }] });
    });

    it('should properly update and not call after create hooks if it was updated in 2nd query', async () => {
      const Id = await db.user.get('Id').create(UserData);
      jest.clearAllMocks();

      const q = User.find(Id)
        .upsert({
          update: { Name: 'new name' },
          create: UserData,
        })
        .select('*', 'Password');

      emulateReturnNoRowsOnce();

      const res = await q;

      expect(res).toMatchObject(hookSetUpdateValues);

      assert.upsertUpdateIn2ndQueryHooksBeingCalled({
        data: [{ Name: 'new name' }],
      });
    });

    describe('cte', () => {
      it('should update existing record', async () => {
        const Id = await db.user.get('Id').create(UserData);
        jest.clearAllMocks();

        const res = await db.user
          .with(
            'cte',
            User.find(Id)
              .upsert({
                update: { Name: 'new name' },
                create: UserData,
              })
              .select('*', 'Password'),
          )
          .from('cte');

        expect(res).toMatchObject([hookSetUpdateValues]);

        assert.upsertUpdateHookBeingCalled({
          data: [{ Name: 'new name' }],
          cte: true,
        });
      });

      it('should create a new record', async () => {
        const res = await db.user
          .with(
            'cte',
            User.find(0)
              .upsert({
                update: { Name: 'updated' },
                create: { ...UserData, Name: 'created' },
              })
              .select('*', 'Password'),
          )
          .from('cte');

        expect(res).toMatchObject([{ Name: 'created' }]);
        expect(res).toMatchObject([hookSetCreateValues]);

        assert.upsertCreateHookBeingCalled({
          data: [{ Name: 'created' }],
          cte: true,
        });
      });
    });
  });

  describe('orCreate', () => {
    tested.orCreate = true;

    it('should work for orCreate when the record is found', async () => {
      const Id = await db.user.get('Id').create(UserData);

      const res = await User.find(Id)
        .orCreate(UserData)
        .select('*', 'Password');

      expect(res).not.toMatchObject(hookSetCreateValues);

      assert.queryHooksBeingCalled({ data: [depData] });
    });

    it('should work for orCreate when the record is not found', async () => {
      const res = await User.find(1).orCreate(UserData).select('*', 'Password');

      expect(res).toMatchObject(hookSetCreateValues);

      assert.orCreateCreateHooksBeingCalled({ data: [depData] });
    });

    describe('cte', () => {
      it('should find existing record', async () => {
        const existing = await db.user.create(UserData);

        const [res] = await db.user
          .with('cte', User.find(existing.Id).orCreate(UserData).selectAll())
          .from('cte')
          .selectAll();

        expect(res).toEqual(existing);

        assert.orCreateFindCteHooksBeingCalled({ data: [depData] });
      });

      it('should create a record', async () => {
        const [res] = await db.user
          .with('cte', User.find(0).orCreate(UserData).select('*', 'Password'))
          .from('cte')
          .selectAll();

        expect(res).toMatchObject(hookSetCreateValues);

        assert.orCreateCreateCteHooksBeingCalled({ data: [depData] });
      });
    });
  });

  describe('delete', () => {
    tested.delete = true;

    it('should work for delete', async () => {
      const Id = await User.get('Id').create(UserData);
      jest.clearAllMocks();

      await User.find(Id).delete();

      assert.hooksBeingCalledV2({
        data: [depData],
        beforeQuery: 1,
        beforeDelete: 1,
        afterQuery: 1,
        afterDelete: 1,
        afterDeleteCommit: 1,
      });
    });

    describe('cte', () => {
      it('should delete a record', async () => {
        const Id = await User.get('Id').create(UserData);
        jest.clearAllMocks();

        await db.user.with('cte', User.find(Id).delete()).from('cte');

        assert.deleteHooksCteBeingCalled({
          data: [depData],
        });
      });
    });
  });

  describe('_appendQuery', () => {
    it('should call hooks for the appended create', async () => {
      await _appendQuery(
        db.user.as('main').create(UserData),
        User.create(UserData),
        noop,
      );

      assert.createHooksBeingCalled({ data: [depData], cte: true });
    });

    it('should call hooks for the appended update', async () => {
      const Id = await User.get('Id').create(UserData);
      jest.clearAllMocks();

      await _appendQuery(
        db.user.as('main').create(UserData),
        User.find(Id).update({ Name: 'new name', Age: 123 }),
        noop,
      );

      assert.updateHooksBeingCalled({
        data: [{ Name: 'new name', Age: 123 }],
        cte: true,
      });
    });

    it('should call hooks for the appended delete', async () => {
      const Id = await User.get('Id').create(UserData);
      jest.clearAllMocks();

      await _appendQuery(
        db.user.as('main').create(UserData),
        User.find(Id).delete(),
        noop,
      );

      assert.deleteHooksCteBeingCalled({
        data: [depData],
      });
    });

    it('should call hooks for the appended upsert', async () => {
      jest.clearAllMocks();

      await _appendQuery(
        db.user.as('main').create(UserData),
        User.find(0).upsert({
          update: { Name: 'new name' },
          create: UserData,
        }),
        noop,
      );

      assert.upsertCreateHookBeingCalled({
        data: [depData],
        cte: true,
      });
    });
  });

  it('should cover all cases', () => {
    const createExclude = [
      'constructor',
      'defaults',
      'onConflict',
      'onConflictDoNothing',
    ];

    const constructorExclude = ['constructor'];

    expect(Object.keys(tested).sort()).toEqual(
      [
        ...[
          ...Object.getOwnPropertyNames(QueryCreate.prototype),
          ...Object.getOwnPropertyNames(QueryCreateFrom.prototype),
        ].filter((key) => !createExclude.includes(key)),
        ...Object.getOwnPropertyNames(QueryUpdate.prototype).filter(
          (key) => !constructorExclude.includes(key),
        ),
        ...Object.getOwnPropertyNames(QueryUpsert.prototype).filter(
          (key) => !constructorExclude.includes(key),
        ),
        ...Object.getOwnPropertyNames(QueryOrCreate.prototype).filter(
          (key) => !constructorExclude.includes(key),
        ),
        ...Object.getOwnPropertyNames(QueryDelete.prototype).filter(
          (key) => !constructorExclude.includes(key),
        ),
      ].sort(),
    );
  });
});
