import { User } from '../test-utils/test-utils';
import { expectSql, testDb } from 'test-utils';

describe('operators', () => {
  it('should ignore undefined values', () => {
    const q = User.where({ name: { equals: undefined } });
    expectSql(q.toSQL(), `SELECT * FROM "user"`);
  });

  describe('equals', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { equals: 'name' } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" = $1
        `,
        ['name'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { equals: User.select('name').take() } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" = (SELECT "user"."name" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { equals: testDb.sql`'name'` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" = 'name'
        `,
      );
    });
  });

  describe('not', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { not: 'name' } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" <> $1
        `,
        ['name'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { not: User.select('name').take() } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" <> (SELECT "user"."name" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { not: testDb.sql`'name'` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" <> 'name'
        `,
      );
    });
  });

  describe('in', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { in: ['a', 'b'] } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" IN ($1, $2)
        `,
        ['a', 'b'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { in: User.select('name') } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" IN (SELECT "user"."name" FROM "user")
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { in: testDb.sql`('a', 'b')` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" IN ('a', 'b')
        `,
      );
    });
  });

  describe('notIn', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { notIn: ['a', 'b'] } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE NOT "user"."name" IN ($1, $2)
        `,
        ['a', 'b'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { notIn: User.select('name') } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE NOT "user"."name" IN (SELECT "user"."name" FROM "user")
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { notIn: testDb.sql`('a', 'b')` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE NOT "user"."name" IN ('a', 'b')
        `,
      );
    });
  });

  describe('lt', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ id: { lt: 5 } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" < $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: { lt: User.select('id').take() } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" < (SELECT "user"."id" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { lt: testDb.sql`5` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" < 5
        `,
      );
    });
  });

  describe('lte', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ id: { lte: 5 } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" <= $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: { lte: User.select('id').take() } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" <= (SELECT "user"."id" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { lte: testDb.sql`5` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" <= 5
        `,
      );
    });
  });

  describe('gt', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ id: { gt: 5 } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" > $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: { gt: User.select('id').take() } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" > (SELECT "user"."id" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { gt: testDb.sql`5` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" > 5
        `,
      );
    });
  });

  describe('gte', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ id: { gte: 5 } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" >= $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: { gte: User.select('id').take() } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" >= (SELECT "user"."id" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { gte: testDb.sql`5` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" >= 5
        `,
      );
    });
  });

  describe('contains', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { contains: 'ko' } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE '%' || $1 || '%'
        `,
        ['ko'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { contains: User.select('name').take() } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE '%' || (SELECT "user"."name" FROM "user" LIMIT 1) || '%'
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { contains: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE '%' || 'ko' || '%'
        `,
      );
    });
  });

  describe('containsSensitive', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { containsSensitive: 'ko' } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" LIKE '%' || $1 || '%'
        `,
        ['ko'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          name: { containsSensitive: User.select('name').take() },
        }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" LIKE '%' || (SELECT "user"."name" FROM "user" LIMIT 1) || '%'
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { containsSensitive: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" LIKE '%' || 'ko' || '%'
        `,
      );
    });
  });

  describe('startsWith', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { startsWith: 'ko' } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE $1 || '%'
        `,
        ['ko'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          name: { startsWith: User.select('name').take() },
        }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE (SELECT "user"."name" FROM "user" LIMIT 1) || '%'
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { startsWith: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE 'ko' || '%'
        `,
      );
    });
  });

  describe('startsWithSensitive', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { startsWithSensitive: 'ko' } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" LIKE $1 || '%'
        `,
        ['ko'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          name: { startsWithSensitive: User.select('name').take() },
        }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" LIKE (SELECT "user"."name" FROM "user" LIMIT 1) || '%'
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({
          name: { startsWithSensitive: testDb.sql`'ko'` },
        }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" LIKE 'ko' || '%'
        `,
      );
    });
  });

  describe('endsWith', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { endsWith: 'ko' } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE '%' || $1
        `,
        ['ko'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          name: { endsWith: User.select('name').take() },
        }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE '%' || (SELECT "user"."name" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { endsWith: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE '%' || 'ko'
        `,
      );
    });
  });

  describe('endsWithSensitive', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { endsWithSensitive: 'ko' } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" LIKE '%' || $1
        `,
        ['ko'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          name: { endsWithSensitive: User.select('name').take() },
        }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" LIKE '%' || (SELECT "user"."name" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { endsWithSensitive: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" LIKE '%' || 'ko'
        `,
      );
    });
  });

  describe('between', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ id: { between: [1, 10] } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" BETWEEN $1 AND $2
        `,
        [1, 10],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          id: { between: [User.select('id').take(), User.select('id').take()] },
        }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id"
          BETWEEN (SELECT "user"."id" FROM "user" LIMIT 1)
              AND (SELECT "user"."id" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({
          id: { between: [testDb.sql`1`, testDb.sql`10`] },
        }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" BETWEEN 1 AND 10
        `,
      );
    });
  });

  describe('jsonPath', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ data: { jsonPath: ['$.name', '=', 'name'] } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE jsonb_path_query_first("user"."data", '$.name') #>> '{}' = $1
        `,
        ['name'],
      );
    });

    it('should handle null value', () => {
      expectSql(
        User.where({ data: { jsonPath: ['$.name', 'is', null] } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE jsonb_path_query_first("user"."data", '$.name') #>> '{}' is null
        `,
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          data: { jsonPath: ['$.name', '=', User.select('name').take()] },
        }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE jsonb_path_query_first("user"."data", '$.name') #>> '{}' = (
            SELECT "user"."name" FROM "user" LIMIT 1
          )
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({
          data: { jsonPath: ['$.name', '=', testDb.sql`'name'`] },
        }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE jsonb_path_query_first("user"."data", '$.name') #>> '{}' = 'name'
        `,
      );
    });
  });

  describe.each`
    method              | sql
    ${'jsonSupersetOf'} | ${'@>'}
    ${'jsonSubsetOf'}   | ${'<@'}
  `('$method', ({ method, sql }) => {
    it('should handle value', () => {
      expectSql(
        User.where({ data: { [method]: { a: 'b' } } }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."data" ${sql} $1
        `,
        [{ a: 'b' }],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          data: { [method]: User.select('data').take() },
        }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."data" ${sql} (SELECT "user"."data" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({
          data: { [method]: testDb.sql`'{"a":"b"}'` },
        }).toSQL(),
        `
          SELECT * FROM "user"
          WHERE "user"."data" ${sql} '{"a":"b"}'
        `,
      );
    });
  });

  describe('date operators', () => {
    it('should accept Date object', () => {
      const now = new Date();

      const q = User.where({ createdAt: { gt: now } });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "user" WHERE "user"."createdAt" > $1
        `,
        [now],
      );
    });

    it('should accept string', () => {
      const now = new Date().toISOString();

      const q = User.where({ createdAt: { gt: now } });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "user" WHERE "user"."createdAt" > $1
        `,
        [now],
      );
    });
  });
});
