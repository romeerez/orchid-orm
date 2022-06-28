import { testDb } from './test-utils/test-db';

const User = testDb.user;

describe('postgres model', () => {
  afterAll(() => {
    testDb.destroy();
  });

  describe('.table', () => {
    it('should contain table name', () => {
      expect(User.table).toBe('user');
    });
  });

  describe('.schema', () => {
    it('should contain schema of columns', () => {
      expect(Object.keys(User.schema.shape)).toEqual([
        'id',
        'name',
        'password',
        'picture',
        'createdAt',
        'updatedAt',
      ]);
    });
  });

  describe('.primaryKeys', () => {
    it('should return array of primary keys', () => {
      expect(User.primaryKeys).toEqual(['id']);
    });
  });

  describe('await model', () => {
    it('should return promise to load records', async () => {
      const expected = await testDb.adapter
        .query('SELECT * FROM "user"')
        .then((res) => res.rows);
      const received = await User.all();
      expect(received).toEqual(expected);
    });
  });
});
