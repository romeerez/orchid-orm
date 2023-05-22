import { User, userData } from '../test-utils/test-utils';
import { useTestDatabase } from 'test-utils';

describe('hooks', () => {
  useTestDatabase();

  describe('beforeQuery', () => {
    it('should run a hook before query', async () => {
      const fn = jest.fn();
      const query = User.beforeQuery(fn);
      await query;

      expect(fn.mock.calls[0]).toEqual([query]);
    });
  });

  describe('afterQuery', () => {
    it('should run a hook after query', async () => {
      const fn = jest.fn();
      const query = User.afterQuery(fn).count();
      const result = await query;

      expect(fn.mock.calls[0]).toEqual([query, result]);
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
    it('should run a hook after create', async () => {
      const fn = jest.fn();
      const query = User.afterCreate(fn).select('id').create(userData);
      const result = await query;

      expect(fn.mock.calls[0]).toEqual([query, result]);
    });
  });

  describe('beforeUpdate', () => {
    it('should run a hook before update', async () => {
      const fn = jest.fn();
      const query = User.beforeUpdate(fn)
        .where({ id: 1 })
        .update({ name: 'name' });
      await query;

      expect(fn.mock.calls[0]).toEqual([query]);
    });
  });

  describe('afterUpdate', () => {
    it('should run a hook after update', async () => {
      const fn = jest.fn();
      const query = User.afterUpdate(fn)
        .where({ id: 1 })
        .update({ name: 'name' });
      const result = await query;

      expect(fn.mock.calls[0]).toEqual([query, result]);
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

      expect(fn.mock.calls).toEqual([[update], [create]]);
    });
  });

  describe('afterSave', () => {
    it('should run a hook after update and create', async () => {
      const fn = jest.fn();
      const q = User.afterSave(fn);

      const update = q.where({ id: 1 }).update({ name: 'name' });
      const updateResult = await update;

      const create = q.create(userData);
      const createResult = await create;

      expect(fn.mock.calls).toEqual([
        [update, updateResult],
        [create, createResult],
      ]);
    });
  });

  describe('beforeDelete', () => {
    it('should run a hook before delete', async () => {
      const fn = jest.fn();
      const query = User.beforeDelete(fn).where({ id: 1 }).delete();
      await query;

      expect(fn.mock.calls[0]).toEqual([query]);
    });
  });

  describe('afterDelete', () => {
    it('should run a hook after delete', async () => {
      const fn = jest.fn();
      const query = User.afterDelete(fn).where({ id: 1 }).delete();
      const result = await query;

      expect(fn.mock.calls[0]).toEqual([query, result]);
    });
  });
});
