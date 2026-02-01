import { expectSql, sql, testDb, useTestDatabase } from 'test-utils';
import {
  emulateReturnNoRowsOnce,
  Profile,
  profileData,
  User as UserNoHooks,
  userData,
} from '../../../test-utils/pqb.test-utils';
import { QueryCreate } from '../../basic-features/mutate/create';
import { Update } from '../../basic-features/mutate/update';
import { QueryUpsert } from '../../basic-features/mutate/upsert';
import { Delete } from '../../basic-features/mutate/delete';
import { QueryOrCreate } from '../../basic-features/mutate/or-create';
import { QueryCreateFrom } from '../../basic-features/mutate/create-from';
import { noop } from '../../../utils';
import { _appendQuery } from '../append-query/append-query';

const hookSet = {
  beforeCreate: {
    password: 'password from beforeCreate',
  },
  beforeUpdate: {
    active: false,
  },
  beforeSave: {
    picture: 'picture from beforeSave',
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

const deps: ('name' | 'age')[] = ['name', 'age'];
const depData = { name: 'name', age: null };

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

let User = UserNoHooks;

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
  useTestDatabase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const tested: Record<string, boolean> = {};

  describe('columns parsing', () => {
    it('should parse columns selected by hooks', async () => {
      const fn = jest.fn();

      const createdAt = new Date();

      const res = await UserNoHooks.afterCreate(['updatedAt'], fn)
        .insert({ ...userData, createdAt })
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
    const User = testDb(
      'user',
      (t) => ({
        id: t.identity().primaryKey(),
        name: t.text().unique(),
        password: t
          .text()
          .readOnly()
          .default(() => 'password'),
      }),
      undefined,
      {
        schema: () => 'schema',
      },
    );

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
      const q = User.select('id')
        .afterUpdate(['id', 'name', 'age'], noop)
        .afterUpdate(['id', 'name', 'password'], noop)
        .all()
        .update({ name: 'new name' });

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."user"
          SET "name" = $1, "updated_at" = now()
          RETURNING "user"."id", "user"."name", "user"."age", "user"."password"
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
      const [updateId, deleteId] = await UserNoHooks.pluck('id').insertMany([
        userData,
        { ...userData, name: 'deleted' },
      ]);

      await testDb
        .with(
          'cte',
          User.get('id').whereNot({
            id: () =>
              User.get('id').insert({
                ...userData,
                name: 'created',
                age: () =>
                  User.get('age')
                    .find(updateId)
                    .update({ name: 'updated', age: 123 })
                    .whereNot({
                      name: () => User.find(deleteId).get('name').delete(),
                    }),
              }),
          }),
        )
        .from('cte');

      const created = [{ name: 'created', age: 123 }];
      const updated = [{ name: 'updated', age: 123 }];
      const deleted = [{ name: 'deleted', age: null }];
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
      await UserNoHooks.getOptional('id').where({
        id: () => User.get('id').insert(userData),
        name: () => User.get('name').insert(userData),
      });

      assert.createHooksBeingCalled({
        data: [depData, depData],
        cte: true,
      });
    });

    it('properly separates data of different hooks, combines data for afterSave hook', async () => {
      const userId = await UserNoHooks.get('id').insert(userData);

      await UserNoHooks.getOptional('id').where({
        id: () => User.get('id').insert({ ...userData, name: 'created' }),
        name: () =>
          User.get('name')
            .find(userId)
            .update({ ...userData, name: 'updated' }),
      });

      assert.hooksBeingCalledV2({
        beforeCreate: 1,
        beforeUpdate: 1,
        beforeSave: 2,
        afterCreate: [[{ ...depData, name: 'created' }]],
        afterUpdate: [[{ ...depData, name: 'updated' }]],
        afterSave: [
          [
            { ...depData, name: 'created' },
            { ...depData, name: 'updated' },
          ],
        ],
        afterCreateCommit: [[{ ...depData, name: 'created' }]],
        afterUpdateCommit: [[{ ...depData, name: 'updated' }]],
        afterSaveCommit: [
          [
            { ...depData, name: 'created' },
            { ...depData, name: 'updated' },
          ],
        ],
      });
    });

    it('should support cte-hook queries nested inside a select query', async () => {
      await UserNoHooks.getOptional('id').where({
        id: () =>
          User.get('id').insert({
            ...userData,
            name: 'created',
          }),
      });

      assert.createHooksBeingCalled({
        data: [{ ...depData, name: 'created' }],
        cte: true,
      });
    });

    it('automatic cte in `select`', async () => {
      await UserNoHooks.select({
        id: () => User.get('id').insert(userData),
      });

      assert.createHooksBeingCalled({
        data: [depData],
        cte: true,
      });
    });

    it('automatic cte in `where` for key-value callback', async () => {
      await UserNoHooks.where({
        id: () => User.get('id').insert(userData),
      });

      assert.createHooksBeingCalled({
        data: [depData],
        cte: true,
      });
    });

    it('automatic cte in `where` for a function arg', async () => {
      await UserNoHooks.where(() => User.get('active').insert(userData));

      assert.createHooksBeingCalled({
        data: [depData],
        cte: true,
      });
    });

    it('automatic cte for a query in expression', async () => {
      await UserNoHooks.where((q) =>
        q.or(User.get('active').insert(userData)).equals(false),
      );

      assert.createHooksBeingCalled({
        data: [depData],
        cte: true,
      });
    });

    it('supports nested expressions with cte query', async () => {
      await UserNoHooks.where((q) =>
        sql(() => q.or(User.get('active').insert(userData)).equals(false)),
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
        User.count().create(userData),
        User.create(userData).take(),
        User.create(userData).takeOptional(),
        User.createMany([userData]),
        User.create(userData).get('id'),
        User.create(userData).getOptional('id'),
        User.createMany([userData]).pluck('id'),
        User.createMany([userData]).select('id').rows(),
        User.create(userData).exec(),
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

        const res = await User[method](userData).select('*', 'password');
        expect(res).toMatchObject(hookSetCreateValues);

        assert.createHooksBeingCalled({ data: [depData] });
      },
    );

    it.each(['create', 'insert'] as const)(
      'should work for %s with empty set',
      async (method) => {
        const res = await UserNoHooks.beforeSave(({ set }) => {
          set(userData);
        })
          [method]({} as never)
          .select('name', 'password');

        expect(res).toMatchObject(userData);
      },
    );

    it.each(['createMany', 'insertMany'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        const res = await User[method]([userData, userData]).select(
          '*',
          'password',
        );
        expect(res).toMatchObject([hookSetCreateValues, hookSetCreateValues]);

        assert.createHooksBeingCalled({ data: [depData, depData] });
      },
    );

    it.each(['createOneFrom', 'insertOneFrom'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        await User.insert(userData);
        jest.clearAllMocks();

        const res = await User[method](
          User.select('name', 'password').take(),
        ).select('*', 'password');

        expect(res).toMatchObject(hookSetCreateValues);

        assert.createHooksBeingCalled({ data: [depData] });
      },
    );

    it.each(['createOneFrom', 'insertOneFrom'] as const)(
      'should work for %s with a custom key',
      async (method) => {
        tested[method] = true;

        await User.insert(userData);
        jest.clearAllMocks();

        const res = await User[method](User.select('name', 'password').take(), {
          age: 42,
          picture: 'picture',
        }).select('*', 'password');
        expect(res).toMatchObject(hookSetCreateValues);

        assert.createHooksBeingCalled({ data: [{ ...depData, age: 42 }] });
      },
    );

    it.each(['createManyFrom', 'insertManyFrom'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        await User.insert(userData);
        jest.clearAllMocks();

        const res = await User[method](User.select('name', 'password').take(), [
          {
            age: 42,
            picture: 'picture',
          },
          {
            age: 42,
            picture: 'picture',
          },
        ]).select('*', 'password');

        expect(res).toMatchObject([hookSetCreateValues, hookSetCreateValues]);

        assert.createHooksBeingCalled({
          data: [
            { ...depData, age: 42 },
            { ...depData, age: 42 },
          ],
        });
      },
    );

    it.each(['createForEachFrom', 'insertForEachFrom'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        await User.insertMany([
          { ...userData, name: 'one' },
          { ...userData, name: 'two' },
        ]);
        jest.clearAllMocks();

        const res = await User[method](User.select('name', 'password')).select(
          '*',
          'password',
        );

        expect(res).toMatchObject([hookSetCreateValues, hookSetCreateValues]);

        assert.createHooksBeingCalled({
          data: [{ name: 'one' }, { name: 'two' }],
        });
      },
    );

    describe('cte', () => {
      describe('create methods in cte', () => {
        it('insert', async () => {
          await testDb
            .with('cte', User.insert({ ...userData, age: 123 }))
            .from('cte');

          assert.createHooksBeingCalled({
            data: [{ name: 'name', age: 123 }],
            cte: true,
          });
        });

        it('create', async () => {
          const createQuery = User.create({ ...userData, age: 1 }).select('id');

          const res = await UserNoHooks.with('name', createQuery)
            .from('name')
            .select({ name: 'id' });

          expect(res).toEqual([{ name: expect.any(Number) }]);

          assert.createHooksBeingCalled({
            data: [{ name: 'name', age: 1 }],
            cte: true,
          });
        });

        it('createMany', async () => {
          const createQuery = User.createMany([
            { ...userData, age: 1 },
            { ...userData, age: 1 },
          ]).select('id');

          const res = await UserNoHooks.with('name', createQuery)
            .from('name')
            .select({ name: 'id' });

          expect(res).toEqual([
            { name: expect.any(Number) },
            { name: expect.any(Number) },
          ]);

          assert.createHooksBeingCalled({
            data: [
              { name: 'name', age: 1 },
              { name: 'name', age: 1 },
            ],
            cte: true,
          });
        });

        it('createOneFrom', async () => {
          await UserNoHooks.insert({ ...userData, age: 123 });

          const res = await testDb
            .with(
              'cte',
              User.createOneFrom(User.select('name', 'password', 'age').take()),
            )
            .from('cte')
            .select('name', 'age');

          expect(res).toMatchObject([{ name: 'name', age: 123 }]);

          assert.createHooksBeingCalled({
            data: [{ name: 'name', age: 123 }],
            cte: true,
          });
        });

        it('createOneFrom create', async () => {
          await UserNoHooks.createOneFrom(
            User.create(userData).select('name', 'password'),
          );

          assert.createHooksBeingCalled({
            data: [depData],
            cte: true,
          });
        });

        it('createManyFrom', async () => {
          await UserNoHooks.insert(userData);

          const res = await testDb
            .with(
              'cte',
              User.createManyFrom(User.select('name', 'password').take(), [
                { age: 1 },
                { age: 2 },
              ]),
            )
            .from('cte')
            .select('name', 'age');

          expect(res).toMatchObject([
            { name: 'name', age: 1 },
            { name: 'name', age: 2 },
          ]);

          assert.createHooksBeingCalled({
            data: [
              { name: 'name', age: 1 },
              { name: 'name', age: 2 },
            ],
            cte: true,
          });
        });

        it('createManyFrom create', async () => {
          await UserNoHooks.createManyFrom(
            User.create(userData).select('name', 'password'),
            [{ age: 1 }, { age: 2 }],
          );

          assert.createHooksBeingCalled({
            data: [depData],
            cte: true,
          });
        });

        it('createForEachFrom', async () => {
          await UserNoHooks.insertMany([
            { ...userData, age: 1 },
            { ...userData, age: 2 },
          ]);

          const res = await testDb
            .with(
              'cte',
              User.createForEachFrom(User.select('name', 'password', 'age')),
            )
            .from('cte')
            .select('name', 'age');

          expect(res).toMatchObject([
            { name: 'name', age: 1 },
            { name: 'name', age: 2 },
          ]);

          assert.createHooksBeingCalled({
            data: [
              { name: 'name', age: 1 },
              { name: 'name', age: 2 },
            ],
            cte: true,
          });
        });
      });

      describe('nested create methods', () => {
        it('create in create', async () => {
          const res = await Profile.create({
            ...profileData,
            userId: () => User.create({ ...userData, age: 123 }).get('id'),
          });

          expect(res).toMatchObject({
            ...profileData,
            userId: expect.any(Number),
          });

          assert.createHooksBeingCalled({
            data: [{ name: 'name', age: 123 }],
            cte: true,
          });
        });

        it('create in createMany', async () => {
          const res = await Profile.createMany([
            {
              ...profileData,
              userId: () => User.create({ ...userData, age: 20 }).get('id'),
            },
            {
              ...profileData,
              userId: () => User.create({ ...userData, age: 30 }).get('id'),
            },
          ]);

          expect(res).toMatchObject([
            { ...profileData, userId: expect.any(Number) },
            { ...profileData, userId: expect.any(Number) },
          ]);

          assert.createHooksBeingCalled({
            data: [
              { name: 'name', age: 20 },
              { name: 'name', age: 30 },
            ],
            cte: true,
          });
        });
      });

      it('should have empty returning if has no hooks and moved to CTE', async () => {
        await UserNoHooks.insert({
          ...userData,
          name: () => User.get('name').insert({ ...userData, name: 'inner' }),
        });

        assert.createHooksBeingCalled({
          data: [{ name: 'inner' }],
          cte: true,
        });
      });
    });
  });

  describe('update', () => {
    it('should handle various update return types', async () => {
      const id = await User.get('id').create(userData);

      const queries = [
        User.find(id).update(userData),
        User.find(id).update(userData).take(),
        User.find(id).update(userData).takeOptional(),
        User.where({ id }).update(userData),
        User.find(id).update(userData).get('id'),
        User.find(id).update(userData).getOptional('id'),
        User.where({ id }).update(userData).pluck('id'),
        User.where({ id }).update(userData).select('id').rows(),
        User.find(id).update(userData).exec(),
      ];

      for (const query of queries) {
        jest.clearAllMocks();

        await query;

        assert.updateHooksBeingCalled({ data: [depData] });
      }
    });

    it('should not select the same column twice when using get', async () => {
      const q = User.find(0).get('age').update({ name: 'updated' });

      expectSql(
        q.toSQL(),
        `
          UPDATE "schema"."user" SET "name" = $1, "updated_at" = now()
          WHERE "user"."id" = $2
          RETURNING "user"."age", "user"."name"
        `,
        ['updated', 0],
      );
    });

    it('should not call afterUpdate hooks when did not update', async () => {
      await User.find(0).update({ name: 'new name' });

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

        const id = await User.get('id').create(userData);
        jest.clearAllMocks();

        const res = await User.find(id)
          [method]({
            name: 'new name',
            active: true,
          })
          .selectAll();
        expect(res).toMatchObject(hookSetUpdateValues);

        assert.updateHooksBeingCalled({
          data: [{ name: 'new name' }],
        });
      },
    );

    it.each(['increment', 'decrement'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        const id = await User.get('id').create({ ...userData, age: 20 });
        jest.clearAllMocks();

        const res = await User.find(id)[method]('age').selectAll();
        expect(res).toMatchObject(hookSetUpdateValues);

        assert.updateHooksBeingCalled({
          data: [{ name: 'name', age: method === 'increment' ? 21 : 19 }],
        });
      },
    );

    describe('updateFrom', () => {
      tested.updateFrom = tested.set = true;

      it('should not call afterUpdate hooks when did not update', async () => {
        await User.updateFrom(() => User.as('u').findOptional(0)).set({
          name: 'new name',
        });

        assert.hooksBeingCalledV2({
          beforeQuery: 1,
          beforeUpdate: 1,
          beforeSave: 1,
          afterQuery: 1,
        });
      });

      it('should work', async () => {
        const id = await User.get('id').create(userData);
        jest.clearAllMocks();

        const res = await User.updateFrom(
          () => User.as('u').find(id),
          (q) => q.on('u.id', 'user.id'),
        )
          .set({
            name: 'new name',
            active: true,
          })
          .selectAll();

        expect(res).toMatchObject([hookSetUpdateValues]);

        assert.updateHooksBeingCalled({
          data: [{ name: 'new name' }],
        });
      });
    });

    describe('cte', () => {
      describe('update methods in cte', () => {
        it('update', async () => {
          const id = await User.get('id').insert(userData);
          jest.clearAllMocks();

          await testDb
            .with('cte', User.find(id).update({ name: 'new name', age: 123 }))
            .from('cte');

          assert.updateHooksBeingCalled({
            data: [{ name: 'new name', age: 123 }],
            cte: true,
          });
        });

        it('updateFrom', async () => {
          await User.get('id').insert(userData);
          jest.clearAllMocks();

          await testDb
            .with(
              'cte',
              User.updateFrom(() => User.as('u').take()).set({
                name: 'new name',
                age: 123,
              }),
            )
            .from('cte');

          assert.updateHooksBeingCalled({
            data: [{ name: 'new name', age: 123 }],
            cte: true,
          });
        });

        it.each(['increment', 'decrement'] as const)('%s', async (method) => {
          const id = await User.get('id').insert({ ...userData, age: 20 });
          jest.clearAllMocks();

          await testDb.with('cte', User.find(id)[method]('age')).from('cte');

          assert.updateHooksBeingCalled({
            data: [{ name: 'name', age: method === 'increment' ? 21 : 19 }],
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
          update: { name: 'new name' },
          create: { ...userData, name: 'created' },
        })
        .select('*', 'password');

      expect(res).toMatchObject({ name: 'created' });
      expect(res).toMatchObject(hookSetCreateValues);

      assert.upsertCreateHookBeingCalled({
        data: [{ ...depData, name: 'created' }],
      });
    });

    it('should work for upsert update', async () => {
      const id = await UserNoHooks.get('id').create(userData);
      jest.clearAllMocks();

      const res = await User.find(id)
        .upsert({
          update: { name: 'new name' },
          create: userData,
        })
        .select('*', 'password');
      expect(res).toMatchObject(hookSetUpdateValues);

      assert.upsertUpdateHookBeingCalled({ data: [{ name: 'new name' }] });
    });

    it('should properly update and not call after create hooks if it was updated in 2nd query', async () => {
      const id = await UserNoHooks.get('id').create(userData);
      jest.clearAllMocks();

      const q = User.find(id)
        .upsert({
          update: { name: 'new name' },
          create: userData,
        })
        .select('*', 'password');

      emulateReturnNoRowsOnce();

      const res = await q;

      expect(res).toMatchObject(hookSetUpdateValues);

      assert.upsertUpdateIn2ndQueryHooksBeingCalled({
        data: [{ name: 'new name' }],
      });
    });

    describe('cte', () => {
      it('should update existing record', async () => {
        const id = await UserNoHooks.get('id').create(userData);
        jest.clearAllMocks();

        const res = await testDb
          .with(
            'cte',
            User.find(id)
              .upsert({
                update: { name: 'new name' },
                create: userData,
              })
              .select('*', 'password'),
          )
          .from('cte');

        expect(res).toMatchObject([hookSetUpdateValues]);

        assert.upsertUpdateHookBeingCalled({
          data: [{ name: 'new name' }],
          cte: true,
        });
      });

      it('should create a new record', async () => {
        const res = await testDb
          .with(
            'cte',
            User.find(0)
              .upsert({
                update: { name: 'updated' },
                create: { ...userData, name: 'created' },
              })
              .select('*', 'password'),
          )
          .from('cte');

        expect(res).toMatchObject([{ name: 'created' }]);
        expect(res).toMatchObject([hookSetCreateValues]);

        assert.upsertCreateHookBeingCalled({
          data: [{ name: 'created' }],
          cte: true,
        });
      });
    });
  });

  describe('orCreate', () => {
    tested.orCreate = true;

    it('should work for orCreate when the record is found', async () => {
      const id = await UserNoHooks.get('id').create(userData);

      const res = await User.find(id)
        .orCreate(userData)
        .select('*', 'password');

      expect(res).not.toMatchObject(hookSetCreateValues);

      assert.queryHooksBeingCalled({ data: [depData] });
    });

    it('should work for orCreate when the record is not found', async () => {
      const res = await User.find(1).orCreate(userData).select('*', 'password');

      expect(res).toMatchObject(hookSetCreateValues);

      assert.orCreateCreateHooksBeingCalled({ data: [depData] });
    });

    describe('cte', () => {
      it('should find existing record', async () => {
        const existing = await UserNoHooks.create(userData);

        const [res] = await testDb
          .with('cte', User.find(existing.id).orCreate(userData).selectAll())
          .from('cte')
          .selectAll();

        expect(res).toEqual(existing);

        assert.orCreateFindCteHooksBeingCalled({ data: [depData] });
      });

      it('should create a record', async () => {
        const [res] = await testDb
          .with('cte', User.find(0).orCreate(userData).select('*', 'password'))
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
      const id = await User.get('id').create(userData);
      jest.clearAllMocks();

      await User.find(id).delete();

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
        const id = await User.get('id').create(userData);
        jest.clearAllMocks();

        await testDb.with('cte', User.find(id).delete()).from('cte');

        assert.deleteHooksCteBeingCalled({
          data: [depData],
        });
      });
    });
  });

  describe('_appendQuery', () => {
    it('should call hooks for the appended create', async () => {
      await _appendQuery(
        UserNoHooks.as('main').create(userData),
        User.create(userData),
        noop,
      );

      assert.createHooksBeingCalled({ data: [depData], cte: true });
    });

    it('should call hooks for the appended update', async () => {
      const id = await User.get('id').create(userData);
      jest.clearAllMocks();

      await _appendQuery(
        UserNoHooks.as('main').create(userData),
        User.find(id).update({ name: 'new name', age: 123 }),
        noop,
      );

      assert.updateHooksBeingCalled({
        data: [{ name: 'new name', age: 123 }],
        cte: true,
      });
    });

    it('should call hooks for the appended delete', async () => {
      const id = await User.get('id').create(userData);
      jest.clearAllMocks();

      await _appendQuery(
        UserNoHooks.as('main').create(userData),
        User.find(id).delete(),
        noop,
      );

      assert.deleteHooksCteBeingCalled({
        data: [depData],
      });
    });

    it('should call hooks for the appended upsert', async () => {
      jest.clearAllMocks();

      await _appendQuery(
        UserNoHooks.as('main').create(userData),
        User.find(0).upsert({
          update: { name: 'new name' },
          create: userData,
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
        ...Object.getOwnPropertyNames(Update.prototype).filter(
          (key) => !constructorExclude.includes(key),
        ),
        ...Object.getOwnPropertyNames(QueryUpsert.prototype).filter(
          (key) => !constructorExclude.includes(key),
        ),
        ...Object.getOwnPropertyNames(QueryOrCreate.prototype).filter(
          (key) => !constructorExclude.includes(key),
        ),
        ...Object.getOwnPropertyNames(Delete.prototype).filter(
          (key) => !constructorExclude.includes(key),
        ),
      ].sort(),
    );
  });
});
