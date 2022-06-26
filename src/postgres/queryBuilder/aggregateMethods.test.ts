import { testDb } from '../test-utils';

describe('aggregate', () => {
  describe('aggregate options', () => {
    test('without options', () => {
      expect(testDb.model.count('*').toSql())
        .toBe('SELECT count(*) FROM "sample"')
    })

    test('distinct', () => {
      expect(testDb.model.count('name', { distinct: true }).toSql())
        .toBe('SELECT count(DISTINCT "sample"."name") FROM "sample"')
    })

    test('order', () => {
      expect(testDb.model.count('name', { order: '"sample"."name" DESC' }).toSql())
        .toBe('SELECT count("sample"."name" ORDER BY "sample"."name" DESC) FROM "sample"')
    })

    test('filter', () => {
      expect(testDb.model.count('name', { filter: 'name IS NOT NULL' }).toSql())
        .toBe('SELECT count("sample"."name") FILTER (WHERE name IS NOT NULL) FROM "sample"')
    })

    test('all options', () => {
      expect(testDb.model.count('name', {
        distinct: true,
        order: 'name DESC',
        filter: 'name IS NOT NULL'
      }).toSql())
        .toBe('SELECT count(DISTINCT "sample"."name" ORDER BY name DESC) FILTER (WHERE name IS NOT NULL) FROM "sample"')
    })

    test('withinGroup', () => {
      expect(testDb.model.count('name', {
        distinct: true,
        order: 'name DESC',
        filter: 'name IS NOT NULL',
        withinGroup: true
      }).toSql())
        .toBe('SELECT count("sample"."name") WITHIN GROUP (ORDER BY name DESC) FILTER (WHERE name IS NOT NULL) FROM "sample"')
    })
  })

  describe.each`
    method        | functionName
    ${'count'}    | ${'count'}
    ${'avg'}      | ${'avg'}
    ${'min'}      | ${'min'}
    ${'max'}      | ${'max'}
    ${'sum'}      | ${'sum'}
    ${'arrayAgg'} | ${'array_agg'}
    ${'bitAnd'}   | ${'bit_and'}
    ${'bitOr'}    | ${'bit_or'}
    ${'boolAnd'}  | ${'bool_and'}
    ${'boolOr'}   | ${'bool_or'}
    ${'every'}    | ${'every'}
    ${'jsonAgg'}  | ${'json_agg'}
    ${'jsonbAgg'} | ${'jsonb_agg'}
    ${'xmlAgg'}   | ${'xmlagg'}
  `('$method', ({ method, functionName }) => {
    it(`makes ${method} query`, () => {
      expect(testDb.model[method as 'count']('name').toSql()).toBe(`SELECT ${functionName}("sample"."name") FROM "sample"`)
    })

    it('has modifier', () => {
      expect(testDb.model[`_${method}` as `_count`]('name').toSql()).toBe(`SELECT ${functionName}("sample"."name") FROM "sample"`)
    })
  })

  describe.each`
    method         | functionName
    ${'jsonObjectAgg'}  | ${'json_object_agg'}
    ${'jsonbObjectAgg'} | ${'jsonb_object_agg'}
  `('$method', ({ method, functionName }) => {
    it(`makes ${method} query`, () => {
      expect(testDb.model[method as 'jsonObjectAgg']({
        alias: 'name',
      }).toSql()).toBe(`SELECT ${functionName}('alias', "sample"."name") FROM "sample"`)
    })
  })

  describe('stringAgg', () => {
    it('makes stringAgg query', () => {
      expect(testDb.model.stringAgg('name', ' & ').toSql())
        .toBe(`SELECT string_agg("sample"."name", ' & ') FROM "sample"`)
    })
  })
})
