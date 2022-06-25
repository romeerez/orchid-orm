import { line, testDb } from './test-utils';

const { model } = testDb

describe('operators', () => {
  test('equals', () => {
    expect(model.where({ name: { equals: 'ko' } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."name" = 'ko'
    `))
  })

  test('not', () => {
    expect(model.where({ name: { not: 'ko' } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."name" <> 'ko'
    `))
  })

  test('in', () => {
    expect(model.where({ name: { in: ['a', 'b'] } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."name" IN ('a', 'b')
    `))
  })

  test('notIn', () => {
    expect(model.where({ name: { notIn: ['a', 'b'] } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."name" NOT IN ('a', 'b')
    `))
  })

  test('lt', () => {
    expect(model.where({ id: { lt: 5 } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."id" < 5
    `))
  })

  test('lte', () => {
    expect(model.where({ id: { lte: 5 } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."id" <= 5
    `))
  })

  test('gt', () => {
    expect(model.where({ id: { gt: 5 } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."id" > 5
    `))
  })

  test('gte', () => {
    expect(model.where({ id: { gte: 5 } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."id" >= 5
    `))
  })

  test('contains', () => {
    expect(model.where({ name: { contains: 'ko' } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."name" LIKE '%ko%'
    `))
  })

  test('containsInsensitive', () => {
    expect(model.where({ name: { containsInsensitive: 'ko' } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."name" ILIKE '%ko%'
    `))
  })

  test('startsWith', () => {
    expect(model.where({ name: { startsWith: 'ko' } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."name" LIKE 'ko%'
    `))
  })

  test('startsWithInsensitive', () => {
    expect(model.where({ name: { startsWithInsensitive: 'ko' } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."name" ILIKE 'ko%'
    `))
  })

  test('endsWith', () => {
    expect(model.where({ name: { endsWith: 'ko' } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."name" LIKE '%ko'
    `))
  })

  test('endsWithInsensitive', () => {
    expect(model.where({ name: { endsWithInsensitive: 'ko' } }).toSql()).toBe(line(`
      SELECT "sample".* FROM "sample"
      WHERE "sample"."name" ILIKE '%ko'
    `))
  })
})