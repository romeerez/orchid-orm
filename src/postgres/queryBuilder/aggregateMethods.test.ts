import { expectQueryNotMutated, testDb } from '../test-utils';
import { raw } from './common';

const { model } = testDb

describe('aggregate', () => {
  describe('aggregate options', () => {
    test('without options', () => {
      expect(model.count('*').toSql())
        .toBe('SELECT count(*) FROM "sample"')
    })

    test('distinct', () => {
      expect(model.count('name', { distinct: true }).toSql())
        .toBe('SELECT count(DISTINCT "sample"."name") FROM "sample"')
    })

    test('order', () => {
      expect(model.count('name', { order: '"sample"."name" DESC' }).toSql())
        .toBe('SELECT count("sample"."name" ORDER BY "sample"."name" DESC) FROM "sample"')
    })

    test('filter', () => {
      expect(model.count('name', { filter: 'name IS NOT NULL' }).toSql())
        .toBe('SELECT count("sample"."name") FILTER (WHERE name IS NOT NULL) FROM "sample"')
    })

    test('all options', () => {
      expect(model.count('name', {
        distinct: true,
        order: 'name DESC',
        filter: 'name IS NOT NULL'
      }).toSql())
        .toBe('SELECT count(DISTINCT "sample"."name" ORDER BY name DESC) FILTER (WHERE name IS NOT NULL) FROM "sample"')
    })

    test('withinGroup', () => {
      expect(model.count('name', {
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
    it(`should perform ${method} query for a column`, () => {
      const q = model.all()
      const expectedSql = `SELECT ${functionName}("sample"."name") FROM "sample"`
      expect(q[method as 'count']('name').toSql()).toBe(expectedSql)
      expectQueryNotMutated(q)

      q[`_${method}` as `_count`]('name')
      expect(q.toSql()).toBe(expectedSql)
    })

    it('should support raw sql parameter', () => {
      const q = model.all()
      expect(q[method as 'count'](raw('SQL')).toSql()).toBe(
        `SELECT ${functionName}(SQL) FROM "sample"`
      )
      expectQueryNotMutated(q)
    })
  })

  describe.each`
    method         | functionName
    ${'jsonObjectAgg'}  | ${'json_object_agg'}
    ${'jsonbObjectAgg'} | ${'jsonb_object_agg'}
  `('$method', ({ method, functionName }) => {
    it(`should perform ${method} query for a column`, () => {
      const q = model.all()
      const expectedSql = `SELECT ${functionName}('alias', "sample"."name") FROM "sample"`
      expect(q[method as 'jsonObjectAgg']({ alias: 'name' }).toSql()).toBe(expectedSql)
      expectQueryNotMutated(q)

      q[`_${method}` as '_jsonObjectAgg']({ alias: 'name' })
      expect(q.toSql()).toBe(expectedSql)
    })

    it('should support raw sql parameter', () => {
      const q = model.all()
      expect(q[method as 'jsonObjectAgg']({
        alias: raw('SQL')
      }).toSql()).toBe(
        `SELECT ${functionName}('alias', SQL) FROM "sample"`
      )
      expectQueryNotMutated(q)
    })
  })

  describe('stringAgg', () => {
    it('makes stringAgg query', () => {
      const q = model.all()
      const expectedSql = `SELECT string_agg("sample"."name", ' & ') FROM "sample"`
      expect(q.stringAgg('name', ' & ').toSql())
        .toBe(expectedSql)
      expectQueryNotMutated(q)

      q._stringAgg('name', ' & ')
      expect(q.toSql()).toBe(expectedSql)
    })

    it('should support raw sql parameter', async () => {
      const q = model.all()
      expect(q.stringAgg(raw('pum'), ' & ').toSql()).toBe(
        `SELECT string_agg(pum, ' & ') FROM "sample"`
      )
      expectQueryNotMutated(q)
    })
  })
})
