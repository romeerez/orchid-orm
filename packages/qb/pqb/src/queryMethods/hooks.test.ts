import { User, userData } from '../test-utils/test-utils';
import { expectSql, testDb, useTestDatabase } from 'test-utils';
import { NotFoundError } from '../errors';
import { noop, TransactionState } from 'orchid-core';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Query } from '../query/query';

// make query ignore the transaction that is injected by `useTestDatabase`
const ignoreTestTransactionOnce = (q: Query) => {
  const original = q.internal.transactionStorage;
  q.internal.transactionStorage = {
    getStore: () => {
      q.internal.transactionStorage = original;
    },
  } as unknown as AsyncLocalStorage<TransactionState>;
};

describe('hooks', () => {
  useTestDatabase();

  describe('beforeQuery', () => {
    it('should run a hook before query', async () => {
      const fn = jest.fn();
      const q = User.beforeQuery(fn);
      await q;

      expect(fn).toBeCalledWith(q);
    });
  });

  describe('afterQuery', () => {
    it('should run a hook after query', async () => {
      const fn = jest.fn();
      const q = User.afterQuery(fn).count();

      const result = await q;

      expect(fn.mock.calls[0]).toEqual([result, q]);
    });
  });

  describe('beforeCreate', () => {
    it('should run a hook before create', async () => {
      const fn = jest.fn();
      const query = User.beforeCreate(fn).create(userData);
      await query;

      expect(fn.mock.calls[0]).toEqual([query]);
    });
  });

  describe('afterCreate', () => {
    it('should run inside transaction', async () => {
      const fn = jest.fn();
      const q = User.afterCreate([], fn).insert(userData);
      ignoreTestTransactionOnce(q);

      q.transaction = jest.fn(() => Promise.resolve());

      await q;

      expect(q.transaction).toBeCalled();
    });

    it('should run a hook after create', async () => {
      const fn = jest.fn();
      const q = User.afterCreate(['id'], fn).select('name').create(userData);

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, $2)
          RETURNING "user"."name", "user"."id"
        `,
        ['name', 'password'],
      );

      const result = await q;

      expect(fn).toBeCalledWith([{ id: expect.any(Number), name: 'name' }], q);
      expect(result).toEqual({ name: 'name' });
    });
  });

  describe('beforeUpdate', () => {
    it('should run a hook before update', async () => {
      const fn = jest.fn();
      const q = User.beforeUpdate(fn).where({ id: 1 }).update({ name: 'name' });

      await q;

      expect(fn).toBeCalledWith(q);
    });
  });

  describe('afterUpdate', () => {
    it('should run inside transaction', async () => {
      const fn = jest.fn();
      const q = User.afterUpdate([], fn).all().update({});
      ignoreTestTransactionOnce(q);

      q.transaction = jest.fn(() => Promise.resolve());

      await q;

      expect(q.transaction).toBeCalled();
    });

    it('should run a hook after update', async () => {
      const id = await User.get('id').create(userData);

      const fn = jest.fn();
      const q = User.afterUpdate(['id'], fn)
        .find(id)
        .select('name')
        .update({ name: 'new name' });

      const result = await q;

      expect(fn).toBeCalledWith([{ id, name: 'new name' }], q);
      expect(result).toEqual({ name: 'new name' });
    });
  });

  describe('beforeSave', () => {
    it('should run a hook before update and create', async () => {
      const fn = jest.fn();
      const q = User.beforeSave(fn);

      const update = q.where({ id: 1 }).update({ name: 'name' });
      await update;

      const create = q.create(userData);
      await create;

      expect(fn).toBeCalledWith(update);
      expect(fn).toBeCalledWith(create);
    });
  });

  describe('afterSave', () => {
    it('should run a hook after update and create', async () => {
      const id = await User.get('id').create(userData);

      const fn = jest.fn();
      const q = User.afterSave(['id'], fn);

      const update = q.find(id).select('name').update({ name: 'new name' });
      const updateResult = await update;

      const create = q.select('name').create(userData);
      const createResult = await create;

      expect(fn).toBeCalledWith([{ id, name: 'new name' }], update);
      expect(updateResult).toEqual({ name: 'new name' });

      expect(fn).toBeCalledWith(
        [{ id: expect.any(Number), name: userData.name }],
        create,
      );
      expect(createResult).toEqual({ name: userData.name });
    });
  });

  describe('beforeDelete', () => {
    it('should run inside transaction', async () => {
      const fn = jest.fn();
      const q = User.afterDelete([], fn).all().delete();
      ignoreTestTransactionOnce(q);

      q.transaction = jest.fn(() => Promise.resolve());

      await q;

      expect(q.transaction).toBeCalled();
    });

    it('should run a hook before delete', async () => {
      const fn = jest.fn();
      const q = User.beforeDelete(fn).where({ id: 1 }).delete();

      await q;

      expect(fn).toBeCalledWith(q);
    });
  });

  describe('afterDelete', () => {
    it('should run a hook after delete', async () => {
      const id = await User.get('id').create(userData);

      const fn = jest.fn();
      const q = User.afterDelete(['id'], fn).select('name').find(id).delete();

      const result = await q;

      expect(fn).toBeCalledWith([{ id, name: userData.name }], q);
      expect(result).toEqual({ name: userData.name });
    });
  });

  it('should remove duplicated selects', async () => {
    const q = User.select('id')
      .afterUpdate(['id', 'name'], noop)
      .afterUpdate(['id', 'name', 'password'], noop)
      .all()
      .update({ name: 'new name' });

    expectSql(
      q.toSQL(),
      `
        UPDATE "user"
        SET "name" = $1, "updatedAt" = now()
        RETURNING "user"."id", "user"."name", "user"."password"
      `,
      ['new name'],
    );
  });

  describe('after commit hooks', () => {
    afterEach(() => {
      const t = testDb.internal.transactionStorage.getStore();
      if (t) delete t.afterCommit;
    });

    describe('afterCreateCommit', () => {
      it('should push query, result, and the hooks into `afterCommit` of the transaction', async () => {
        const q = User.afterCreateCommit(['id'], noop)
          .select('name')
          .create(userData);

        await q;

        const t = q.internal.transactionStorage.getStore();
        expect(t?.afterCommit).toEqual([
          [{ id: expect.any(Number), name: userData.name }],
          q,
          [noop],
        ]);
      });

      it('tmp', async () => {
        const callback = jest.fn(async () => {
          const count = await User.count();
          expect(count).toBe(1);
        });

        await User.transaction(async () => {
          await User.afterCreateCommit(['name'], callback).insert({
            name: 'name',
            password: 'password',
          });
        });

        expect(callback).toBeCalledWith([{ name: 'name' }], expect.any(Object));
      });
    });

    describe('afterUpdateCommit', () => {
      it('should push query, result, and the hooks into `afterCommit` of the transaction', async () => {
        const id = await User.get('id').create(userData);
        const q = User.afterUpdateCommit(['id'], noop)
          .select('name')
          .find(id)
          .update({});

        await q;

        const t = q.internal.transactionStorage.getStore();
        expect(t?.afterCommit).toEqual([
          [{ id: expect.any(Number), name: userData.name }],
          q,
          [noop],
        ]);
      });
    });

    describe('afterDeleteCommit', () => {
      it('should push query, result, and the hooks into `afterCommit` of the transaction', async () => {
        const id = await User.get('id').create(userData);
        const q = User.afterDeleteCommit(['id'], noop)
          .select('name')
          .find(id)
          .delete();

        await q;

        const t = q.internal.transactionStorage.getStore();
        expect(t?.afterCommit).toEqual([
          [{ id: expect.any(Number), name: userData.name }],
          q,
          [noop],
        ]);
      });
    });
  });

  describe('select manipulations', () => {
    it('should handle return type `all`', async () => {
      const fn = jest.fn();
      const q = User.afterCreate(['id'], fn)
        .select('name')
        .createMany([userData]);

      const result = await q;

      expect(fn).toBeCalledWith(
        [{ id: expect.any(Number), name: userData.name }],
        q,
      );
      expect(result).toEqual([{ name: userData.name }]);
    });

    it('should handle return type `one`', async () => {
      const fn = jest.fn();
      const q = User.afterCreate(['id'], fn)
        .select('name')
        .takeOptional()
        .create(userData);

      const result = await q;

      expect(fn).toBeCalledWith(
        [{ id: expect.any(Number), name: userData.name }],
        q,
      );
      expect(result).toEqual({ name: userData.name });
    });

    it('should not call hook when return type is `one` when returning `undefined`', async () => {
      const fn = jest.fn();
      const q = User.afterUpdate(['id'], fn)
        .select('name')
        .findOptional(1)
        .update(userData);

      const result = await q;

      expect(fn).not.toBeCalled();
      expect(result).toBe(undefined);
    });

    it('should handle return type `oneOrThrow`', async () => {
      const fn = jest.fn();
      const q = User.afterCreate(['id'], fn)
        .select('name')
        .take()
        .create(userData);

      const result = await q;

      expect(fn).toBeCalledWith(
        [{ id: expect.any(Number), name: userData.name }],
        q,
      );
      expect(result).toEqual({ name: userData.name });
    });

    it('should not call hook when return type is `oneOrThrow` when returning `undefined`', async () => {
      const fn = jest.fn();
      const q = User.afterUpdate(['id'], fn)
        .select('name')
        .find(1)
        .update(userData);

      await expect(q).rejects.toThrow(NotFoundError);

      expect(fn).not.toBeCalled();
    });

    it('should handle return type `value`', async () => {
      const fn = jest.fn();
      const q = User.afterCreate(['id'], fn)
        .getOptional('name')
        .create(userData);

      const result = await q;

      expect(fn).toBeCalledWith(
        [{ id: expect.any(Number), name: userData.name }],
        q,
      );
      expect(result).toEqual(userData.name);
    });

    it('should not call hook when return type is `value` when returning `undefined`', async () => {
      const fn = jest.fn();
      const q = User.afterUpdate(['id'], fn)
        .find(1)
        .getOptional('name')
        .update(userData);

      const result = await q;

      expect(fn).not.toBeCalled();
      expect(result).toBe(undefined);
    });

    it('should handle return type `valueOrThrow`', async () => {
      const fn = jest.fn();
      const q = User.afterCreate(['id'], fn).get('name').create(userData);

      const result = await q;

      expect(fn).toBeCalledWith(
        [{ id: expect.any(Number), name: userData.name }],
        q,
      );
      expect(result).toEqual(userData.name);
    });

    it('should not call hook when return type is `valueOrThrow` when returning `undefined`', async () => {
      const fn = jest.fn();
      const q = User.afterUpdate(['id'], fn)
        .find(1)
        .get('name')
        .update(userData);

      await expect(q).rejects.toThrow(NotFoundError);

      expect(fn).not.toBeCalled();
    });

    it('should handle return type `rowCount`', async () => {
      const fn = jest.fn();
      const q = User.afterCreate(['id'], fn).insert(userData);

      const result = await q;

      expect(fn).toBeCalledWith([{ id: expect.any(Number) }], q);
      expect(result).toBe(1);
    });

    it('should handle return type `pluck`', async () => {
      const fn = jest.fn();
      const q = User.afterCreate(['id'], fn)
        .pluck('name')
        .createMany([userData]);

      const result = await q;

      expect(fn).toBeCalledWith(
        [{ id: expect.any(Number), name: userData.name }],
        q,
      );
      expect(result).toEqual([userData.name]);
    });

    it('should handle return type `rows`', async () => {
      const fn = jest.fn();
      const q = User.afterCreate(['id'], fn)
        .select('name')
        .rows()
        .createMany([
          { ...userData, name: 'one' },
          { ...userData, name: 'two' },
        ]);

      const result = await q;

      expect(fn).toBeCalledWith(
        [
          { id: expect.any(Number), name: 'one' },
          { id: expect.any(Number), name: 'two' },
        ],
        q,
      );

      expect(result).toEqual([['one'], ['two']]);
    });

    it('should handle return type `void`', async () => {
      const fn = jest.fn();
      const q = User.afterCreate(['id'], fn)
        .exec()
        .createMany([
          { ...userData, name: 'one' },
          { ...userData, name: 'two' },
        ]);

      const result = await q;

      expect(fn).toBeCalledWith(
        [{ id: expect.any(Number) }, { id: expect.any(Number) }],
        q,
      );
      expect(result).toBe(undefined);
    });
  });
});
