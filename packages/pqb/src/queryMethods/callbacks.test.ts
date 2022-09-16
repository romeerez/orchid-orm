import { User, userData, useTestDatabase } from '../test-utils';

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

  describe('beforeInsert', () => {
    it('should run callback before insert', async () => {
      const fn = jest.fn();
      const query = User.beforeInsert(fn).insert(userData);
      await query;

      expect(fn.mock.calls[0]).toEqual([query]);
    });
  });

  describe('afterInsert', () => {
    it('should run callback after insert', async () => {
      const fn = jest.fn();
      const query = User.afterInsert(fn).select('id').insert(userData);
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
});
