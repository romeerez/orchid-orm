import { testDb } from './test-utils';

describe('postgres model', () => {
  afterAll(() => {
    testDb.destroy()
  })

  describe('.table', () => {
    it('should contain table name', () => {
      expect(testDb.model.table).toBe('sample')
    })
  })

  describe('.schema', () => {
    it('should contain schema of columns', () => {
      expect(Object.keys(testDb.model.schema.shape)).toEqual(['id', 'name', 'description'])
    })
  })

  describe('.primaryKeys', () => {
    it('should return array of primary keys', () => {
      expect(testDb.model.primaryKeys).toEqual(['id'])
    })
  })

  describe('await model', () => {
    it('should return promise to load records', async () => {
      const expected = await testDb.adapter.query('SELECT * FROM sample').then(res => res.rows)
      const received = await testDb.model.all()
      expect(received).toEqual(expected)
    })
  })
})