import { testDb } from './test-utils';

describe('aggregate', () => {
  it('return sql for aggregate function', () => {
    expect(testDb.model.aggregateSql('count', '*')).toBe('count(*)')
  })

  it('has distinct option', () => {
    expect(testDb.model.aggregateSql('count', 'name', {distinct: true}))
      .toBe('count(DISTINCT name)')
  })

  it('has order option', () => {
    expect(testDb.model.aggregateSql('count', 'name', {order: 'name DESC'}))
      .toBe('count(name ORDER BY name DESC)')
  })

  it('has filter option', () => {
    expect(testDb.model.aggregateSql('count', 'name', {filter: 'name IS NOT NULL'}))
      .toBe('count(name) FILTER (WHERE name IS NOT NULL)')
  })

  it('gives appropriate sql with all options', () => {
    expect(testDb.model.aggregateSql('count', 'name', {
      distinct: true,
      order: 'name DESC',
      filter: 'name IS NOT NULL'
    }))
      .toBe('count(DISTINCT name ORDER BY name DESC) FILTER (WHERE name IS NOT NULL)')
  })

  it('gives appropriate sql with all options WITHIN GROUP mode', () => {
    expect(testDb.model.aggregateSql('count', 'name', {
      distinct: true,
      order: 'name DESC',
      filter: 'name IS NOT NULL',
      withinGroup: true
    }))
      .toBe('count(name) WITHIN GROUP (ORDER BY name DESC) FILTER (WHERE name IS NOT NULL)')
  })
})

describe('count', () => {
  it('makes count query', async () => {
    expect(await testDb.model.count().toSql()).toBe('SELECT count(*) FROM "sample"')
  })

  it('has modifier', async () => {
    expect(await testDb.model._count().toSql()).toBe('SELECT count(*) FROM "sample"')
  })
})

describe('avg', () => {
  it('makes avg query', async () => {
    expect(await testDb.model.avg('age').toSql()).toBe('SELECT avg(age) FROM "sample"')
  })

  it('has modifier', async () => {
    expect(await testDb.model._avg('age').toSql()).toBe('SELECT avg(age) FROM "sample"')
  })
})

describe('min', () => {
  it('makes min query', async () => {
    expect(await testDb.model.min('age').toSql()).toBe('SELECT min(age) FROM "sample"')
  })

  it('has modifier', async () => {
    expect(await testDb.model._min('age').toSql()).toBe('SELECT min(age) FROM "sample"')
  })
})

describe('max', () => {
  it('makes max query', async () => {
    expect(await testDb.model.max('age').toSql()).toBe('SELECT max(age) FROM "sample"')
  })

  it('has modifier', async () => {
    expect(await testDb.model._max('age').toSql()).toBe('SELECT max(age) FROM "sample"')
  })
})

describe('sum', () => {
  it('makes sum query', async () => {
    expect(await testDb.model.sum('age').toSql()).toBe('SELECT sum(age) FROM "sample"')
  })

  it('has modifier', async () => {
    expect(await testDb.model._sum('age').toSql()).toBe('SELECT sum(age) FROM "sample"')
  })
})
