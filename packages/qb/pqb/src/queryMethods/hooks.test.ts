import { expectSql, useTestDatabase } from 'test-utils';
import { User as UserTable, userData } from '../test-utils/test-utils';
import { Create } from './create';
import { Update } from './update';
import { QueryUpsertOrCreate } from './upsertOrCreate';
import { Delete } from './delete';
import { noop } from 'orchid-core';

const hooksWithNoDeps = {
  beforeQuery: { fn: jest.fn() },
  beforeCreate: { fn: jest.fn() },
  beforeUpdate: { fn: jest.fn() },
  beforeSave: { fn: jest.fn() },
  beforeDelete: { fn: jest.fn() },
  afterQuery: { fn: jest.fn() },
};

const deps: ('name' | 'age')[] = ['name', 'age'];
const depData = { name: 'name', age: null };

const hooksWithDeps = {
  afterCreate: { deps, fn: jest.fn() },
  afterUpdate: { deps, fn: jest.fn() },
  afterSave: { deps, fn: jest.fn() },
  afterDelete: { deps, fn: jest.fn() },
  afterCreateCommit: { deps, fn: jest.fn() },
  afterUpdateCommit: { deps, fn: jest.fn() },
  afterSaveCommit: { deps, fn: jest.fn() },
  afterDeleteCommit: { deps, fn: jest.fn() },
};

const hookMap = { ...hooksWithNoDeps, ...hooksWithDeps };

let User = UserTable;

for (const k in hookMap) {
  const key = k as keyof typeof hookMap;
  const hook = hookMap[key];
  if ('deps' in hook) {
    User = User[key as keyof typeof hooksWithDeps](hook.deps, hook.fn);
  } else {
    User = User[key as keyof typeof hooksWithNoDeps](hook.fn);
  }
}

const assert = {
  hooksBeingCalled({
    noDepsHooks,
    noDepsHooksCalledTwice,
    depsHooks,
    depsHooksCalledTwice,
    data,
  }: {
    noDepsHooks: (keyof typeof hookMap)[];
    noDepsHooksCalledTwice?: (keyof typeof hookMap)[];
    depsHooks: (keyof typeof hookMap)[];
    depsHooksCalledTwice?: (keyof typeof hookMap)[];
    data: unknown[];
  }) {
    for (const key of noDepsHooks) {
      const calls = hookMap[key].fn.mock.calls;
      expect(calls).toEqual([[expect.any(Object)]]);
    }

    if (noDepsHooksCalledTwice) {
      for (const key of noDepsHooksCalledTwice) {
        const calls = hookMap[key].fn.mock.calls;
        expect(calls).toEqual([[expect.any(Object)], [expect.any(Object)]]);
      }
    }

    for (const key of depsHooks) {
      const calls = hookMap[key].fn.mock.calls;
      expect(calls).toEqual([
        [data.map((x) => expect.objectContaining(x)), expect.any(Object)],
      ]);
    }

    if (depsHooksCalledTwice) {
      for (const _key of depsHooksCalledTwice) {
        const key = 'afterQuery';
        const calls = hookMap[key].fn.mock.calls;
        expect(calls).toEqual([
          [data.map((x) => expect.objectContaining(x)), expect.any(Object)],
          [data.map((x) => expect.objectContaining(x)), expect.any(Object)],
        ]);
      }
    }

    for (const k in hookMap) {
      const key = k as keyof typeof hookMap;
      if (
        !noDepsHooks.includes(key) &&
        !depsHooks.includes(key) &&
        !noDepsHooksCalledTwice?.includes(key)
      ) {
        expect(hookMap[key].fn).not.toBeCalled();
      }
    }
  },
  createHooksBeingCalled({ data }: { data: unknown[] }) {
    assert.hooksBeingCalled({
      noDepsHooks: ['beforeQuery', 'beforeCreate', 'beforeSave'],
      depsHooks: [
        'afterQuery',
        'afterCreate',
        'afterSave',
        'afterCreateCommit',
        'afterSaveCommit',
      ],
      data,
    });
  },
  updateHooksBeingCalled({ data }: { data: unknown[] }) {
    assert.hooksBeingCalled({
      noDepsHooks: ['beforeQuery', 'beforeUpdate', 'beforeSave'],
      depsHooks: [
        'afterQuery',
        'afterUpdate',
        'afterSave',
        'afterUpdateCommit',
        'afterSaveCommit',
      ],
      data,
    });
  },
  upsertCreateHookBeingCalled({ data }: { data: unknown[] }) {
    assert.hooksBeingCalled({
      noDepsHooks: ['beforeQuery', 'beforeUpdate', 'beforeCreate'],
      noDepsHooksCalledTwice: ['beforeSave'],
      depsHooks: [
        'afterQuery',
        'afterCreate',
        'afterSave',
        'afterCreateCommit',
        'afterSaveCommit',
      ],
      data,
    });
  },
  upsertUpdateHookBeingCalled({ data }: { data: unknown[] }) {
    assert.hooksBeingCalled({
      noDepsHooks: ['beforeUpdate', 'beforeQuery', 'beforeSave'],
      depsHooks: [
        'afterQuery',
        'afterUpdate',
        'afterSave',
        'afterUpdateCommit',
        'afterSaveCommit',
      ],
      data,
    });
  },
  queryHooksBeingCalled({ data }: { data: unknown[] }) {
    assert.hooksBeingCalled({
      noDepsHooks: ['beforeQuery'],
      depsHooks: ['afterQuery'],
      data,
    });
  },
};

describe('hooks', () => {
  useTestDatabase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const tested: Record<string, boolean> = {};

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
          UPDATE "user"
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

        await User[method](userData);

        assert.createHooksBeingCalled({ data: [depData] });
      },
    );

    it.each(['createMany', 'insertMany'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        await User[method]([userData, userData]);

        assert.createHooksBeingCalled({ data: [depData, depData] });
      },
    );

    it.each(['createFrom', 'insertFrom'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        await User.insert(userData);
        jest.clearAllMocks();

        await User[method](User.select('name', 'password').take());

        assert.createHooksBeingCalled({ data: [depData] });
      },
    );

    it.each(['createFrom', 'insertFrom'] as const)(
      'should work for %s with a custom key',
      async (method) => {
        tested[method] = true;

        await User.insert(userData);
        jest.clearAllMocks();

        await User[method](User.select('password').take(), { name: 'name' });

        assert.createHooksBeingCalled({ data: [depData] });
      },
    );

    it.each(['createManyFrom', 'insertManyFrom'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        await User.insertMany([
          { ...userData, name: 'one' },
          { ...userData, name: 'two' },
        ]);
        jest.clearAllMocks();

        await User[method](User.select('name', 'password'));

        assert.createHooksBeingCalled({
          data: [{ name: 'one' }, { name: 'two' }],
        });
      },
    );
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

    it('should not call afterUpdate hooks when did not update', async () => {
      await User.find(0).update({ name: 'new name' });

      assert.hooksBeingCalled({
        noDepsHooks: ['beforeQuery', 'beforeUpdate', 'beforeSave'],
        depsHooks: ['afterQuery'],
        data: [],
      });
    });

    it.each(['update', 'updateOrThrow'] as const)(
      'should work for %s',
      async (method) => {
        tested[method] = true;

        const id = await User.get('id').create(userData);
        jest.clearAllMocks();

        await User.find(id)[method]({ name: 'new name' });

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

        await User.find(id)[method]('age');

        assert.updateHooksBeingCalled({
          data: [{ name: 'name', age: method === 'increment' ? 21 : 19 }],
        });
      },
    );
  });

  describe('upsert', () => {
    it('should work for upsert create', async () => {
      tested.upsert = true;

      await User.find(1).upsert({
        update: { name: 'new name' },
        create: userData,
      });

      assert.upsertCreateHookBeingCalled({ data: [depData] });
    });

    it('should work for upsert update', async () => {
      const id = await User.get('id').create(userData);
      jest.clearAllMocks();

      await User.find(id).upsert({
        update: { name: 'new name' },
        create: userData,
      });

      assert.upsertUpdateHookBeingCalled({ data: [{ name: 'new name' }] });
    });

    it('should work for orCreate when the record is found', async () => {
      const id = await User.get('id').create(userData);
      jest.clearAllMocks();

      await User.find(id).orCreate(userData);

      assert.queryHooksBeingCalled({ data: [depData] });
    });

    it('should work for orCreate when the record is found', async () => {
      tested.orCreate = true;

      await User.find(1).orCreate(userData);

      assert.createHooksBeingCalled({ data: [depData] });
    });
  });

  describe('delete', () => {
    it('should work for delete', async () => {
      tested.delete = true;

      const id = await User.get('id').create(userData);
      jest.clearAllMocks();

      await User.find(id).delete();

      assert.hooksBeingCalled({
        noDepsHooks: ['beforeQuery', 'beforeDelete'],
        depsHooks: ['afterQuery', 'afterDelete', 'afterDeleteCommit'],
        data: [depData],
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
        ...Object.getOwnPropertyNames(Create.prototype).filter(
          (key) => !createExclude.includes(key),
        ),
        ...Object.getOwnPropertyNames(Update.prototype).filter(
          (key) => !constructorExclude.includes(key),
        ),
        ...Object.getOwnPropertyNames(QueryUpsertOrCreate.prototype).filter(
          (key) => !constructorExclude.includes(key),
        ),
        ...Object.getOwnPropertyNames(Delete.prototype).filter(
          (key) => !constructorExclude.includes(key),
        ),
      ].sort(),
    );
  });
});
