import { testDb } from './test-utils';

describe('postgres model', () => {
  afterAll(() => {
    testDb.destroy()
  })

  test('.table', () => {
    expect(testDb.model.table).toBe('sample')
  })

  test('.schema', () => {
    expect(Object.keys(testDb.model.schema.shape)).toEqual(['id', 'name'])
  })

  test('.clone', () => {
    const cloned = testDb.model.clone()
    expect(cloned).not.toBe(testDb.model)
    expect(cloned.adapter).toBe(testDb.model.adapter)
    expect(cloned.table).toBe(testDb.model.table)
    expect(cloned.schema).toBe(testDb.model.schema)
  })

  describe('.all', () => {
    it('should return the same model', () => {
      expect(testDb.model.all()).toBe(testDb.model)
    })
  })

  describe('await model', () => {
    it('should return promise to load records', async () => {
      const expected = await testDb.adapter.query('SELECT * FROM sample').then(res => res.rows)
      expect(await testDb.model).toEqual(expected)
    })
  })

  describe('select', () => {
    it('should return selected columns', async () => {
      const expected = await testDb.adapter.query('SELECT name FROM sample').then(res => res.rows)
      expect(await testDb.model.select('name')).toEqual(expected)
    })
  })
})