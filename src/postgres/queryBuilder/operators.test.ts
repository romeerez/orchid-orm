import { line } from '../test-utils/test-utils';
import { db } from '../test-utils/test-db';

const User = db.user;

describe('operators', () => {
  test('equals', () => {
    expect(User.where({ name: { equals: 'ko' } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."name" = 'ko'
    `),
    );
  });

  test('not', () => {
    expect(User.where({ name: { not: 'ko' } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."name" <> 'ko'
    `),
    );
  });

  test('in', () => {
    expect(User.where({ name: { in: ['a', 'b'] } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."name" IN ('a', 'b')
    `),
    );
  });

  test('notIn', () => {
    expect(User.where({ name: { notIn: ['a', 'b'] } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."name" NOT IN ('a', 'b')
    `),
    );
  });

  test('lt', () => {
    expect(User.where({ id: { lt: 5 } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."id" < 5
    `),
    );
  });

  test('lte', () => {
    expect(User.where({ id: { lte: 5 } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."id" <= 5
    `),
    );
  });

  test('gt', () => {
    expect(User.where({ id: { gt: 5 } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."id" > 5
    `),
    );
  });

  test('gte', () => {
    expect(User.where({ id: { gte: 5 } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."id" >= 5
    `),
    );
  });

  test('contains', () => {
    expect(User.where({ name: { contains: 'ko' } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."name" LIKE '%ko%'
    `),
    );
  });

  test('containsInsensitive', () => {
    expect(User.where({ name: { containsInsensitive: 'ko' } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."name" ILIKE '%ko%'
    `),
    );
  });

  test('startsWith', () => {
    expect(User.where({ name: { startsWith: 'ko' } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."name" LIKE 'ko%'
    `),
    );
  });

  test('startsWithInsensitive', () => {
    expect(User.where({ name: { startsWithInsensitive: 'ko' } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."name" ILIKE 'ko%'
    `),
    );
  });

  test('endsWith', () => {
    expect(User.where({ name: { endsWith: 'ko' } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."name" LIKE '%ko'
    `),
    );
  });

  test('endsWithInsensitive', () => {
    expect(User.where({ name: { endsWithInsensitive: 'ko' } }).toSql()).toBe(
      line(`
      SELECT "user".* FROM "user"
      WHERE "user"."name" ILIKE '%ko'
    `),
    );
  });
});
