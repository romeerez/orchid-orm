import { expectQueryNotMutated} from '../test-utils/test-utils';
import { raw } from './common';
import { testDb } from '../test-utils/test-db';

const User = testDb.user

describe('aggregate', () => {
  describe('aggregate options', () => {
    test('without options', () => {
      expect(User.count('*').toSql())
        .toBe('SELECT count(*) FROM "user"')
    })

    test('distinct', () => {
      expect(User.count('name', { distinct: true }).toSql())
        .toBe('SELECT count(DISTINCT "user"."name") FROM "user"')
    })

    test('order', () => {
      expect(User.count('name', { order: '"user"."name" DESC' }).toSql())
        .toBe('SELECT count("user"."name" ORDER BY "user"."name" DESC) FROM "user"')
    })

    test('filter', () => {
      expect(User.count('name', { filter: 'name IS NOT NULL' }).toSql())
        .toBe('SELECT count("user"."name") FILTER (WHERE name IS NOT NULL) FROM "user"')
    })

    test('all options', () => {
      expect(User.count('name', {
        distinct: true,
        order: 'name DESC',
        filter: 'name IS NOT NULL'
      }).toSql())
        .toBe('SELECT count(DISTINCT "user"."name" ORDER BY name DESC) FILTER (WHERE name IS NOT NULL) FROM "user"')
    })

    test('withinGroup', () => {
      expect(User.count('name', {
        distinct: true,
        order: 'name DESC',
        filter: 'name IS NOT NULL',
        withinGroup: true
      }).toSql())
        .toBe('SELECT count("user"."name") WITHIN GROUP (ORDER BY name DESC) FILTER (WHERE name IS NOT NULL) FROM "user"')
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
      const q = User.all()
      const expectedSql = `SELECT ${functionName}("user"."name") FROM "user"`
      expect(q[method as 'count']('name').toSql()).toBe(expectedSql)
      expectQueryNotMutated(q)

      q[`_${method}` as `_count`]('name')
      expect(q.toSql()).toBe(expectedSql)
    })

    it('should support raw sql parameter', () => {
      const q = User.all()
      expect(q[method as 'count'](raw('SQL')).toSql()).toBe(
        `SELECT ${functionName}(SQL) FROM "user"`
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
      const q = User.all()
      const expectedSql = `SELECT ${functionName}('alias', "user"."name") FROM "user"`
      expect(q[method as 'jsonObjectAgg']({ alias: 'name' }).toSql()).toBe(expectedSql)
      expectQueryNotMutated(q)

      q[`_${method}` as '_jsonObjectAgg']({ alias: 'name' })
      expect(q.toSql()).toBe(expectedSql)
    })

    it('should support raw sql parameter', () => {
      const q = User.all()
      expect(q[method as 'jsonObjectAgg']({
        alias: raw('SQL')
      }).toSql()).toBe(
        `SELECT ${functionName}('alias', SQL) FROM "user"`
      )
      expectQueryNotMutated(q)
    })
  })

  describe('stringAgg', () => {
    it('makes stringAgg query', () => {
      const q = User.all()
      const expectedSql = `SELECT string_agg("user"."name", ' & ') FROM "user"`
      expect(q.stringAgg('name', ' & ').toSql())
        .toBe(expectedSql)
      expectQueryNotMutated(q)

      q._stringAgg('name', ' & ')
      expect(q.toSql()).toBe(expectedSql)
    })

    it('should support raw sql parameter', async () => {
      const q = User.all()
      expect(q.stringAgg(raw('pum'), ' & ').toSql()).toBe(
        `SELECT string_agg(pum, ' & ') FROM "user"`
      )
      expectQueryNotMutated(q)
    })
  })
})
