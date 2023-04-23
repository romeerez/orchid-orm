import { User, userData } from '../test-utils/test-utils';
import { useTestDatabase } from 'test-utils';

describe('callbacks', () => {
  useTestDatabase();

  describe('beforeQuery', () => {
    it('should run callback before query', async () => {
      const fn = jest.fn();
      const query = User.beforeQuery(fn);
      await query;

      expect(fn.mock.calls[0]).toEqual([query]);
    });
  });

  describe('afterQuery', () => {
    it('should run callback after query', async () => {
      const fn = jest.fn();
      const query = User.afterQuery(fn).count();
      const result = await query;

      expect(fn.mock.calls[0]).toEqual([query, result]);
    });
  });

  describe('beforeCreate', () => {
    it('should run callback before create', async () => {
      const fn = jest.fn();
      const query = User.beforeCreate(fn).create(userData);
      await query;

      expect(fn.mock.calls[0]).toEqual([query]);
    });
  });

  describe('afterCreate', () => {
    it('should run callback after create', async () => {
      const fn = jest.fn();
      const query = User.afterCreate(fn).select('id').create(userData);
      const result = await query;

      expect(fn.mock.calls[0]).toEqual([query, result]);
    });
  });

  describe('beforeUpdate', () => {
    it('should run callback before update', async () => {
      const fn = jest.fn();
      const query = User.beforeUpdate(fn)
        .where({ id: 1 })
        .update({ name: 'name' });
      await query;

      expect(fn.mock.calls[0]).toEqual([query]);
    });
  });

  describe('afterUpdate', () => {
    it('should run callback after update', async () => {
      const fn = jest.fn();
      const query = User.afterUpdate(fn)
        .where({ id: 1 })
        .update({ name: 'name' });
      const result = await query;

      expect(fn.mock.calls[0]).toEqual([query, result]);
    });
  });

  describe('beforeDelete', () => {
    it('should run callback before delete', async () => {
      const fn = jest.fn();
      const query = User.beforeDelete(fn).where({ id: 1 }).delete();
      await query;

      expect(fn.mock.calls[0]).toEqual([query]);
    });
  });

  describe('afterDelete', () => {
    it('should run callback after delete', async () => {
      const fn = jest.fn();
      const query = User.afterDelete(fn).where({ id: 1 }).delete();
      const result = await query;

      expect(fn.mock.calls[0]).toEqual([query, result]);
    });
  });
});
