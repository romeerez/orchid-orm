import { line, User } from './test-utils';
import { raw } from './common';

describe('operators', () => {
  describe('equals', () => {
    it('should handle value', () => {
      expect(User.where({ name: { equals: 'name' } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" = 'name'
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({ name: { equals: User.select('name').take() } }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" = (SELECT "user"."name" FROM "user" LIMIT 1)
        `),
      );
    });

    it('should handle raw query', () => {
      expect(User.where({ name: { equals: raw("'name'") } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" = 'name'
        `),
      );
    });
  });

  describe('not', () => {
    it('should handle value', () => {
      expect(User.where({ name: { not: 'name' } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" <> 'name'
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({ name: { not: User.select('name').take() } }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" <> (SELECT "user"."name" FROM "user" LIMIT 1)
        `),
      );
    });

    it('should handle raw query', () => {
      expect(User.where({ name: { not: raw("'name'") } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" <> 'name'
        `),
      );
    });
  });

  describe('in', () => {
    it('should handle value', () => {
      expect(User.where({ name: { in: ['a', 'b'] } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" IN ('a', 'b')
        `),
      );
    });

    it('should handle sub query', () => {
      expect(User.where({ name: { in: User.select('name') } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" IN (SELECT "user"."name" FROM "user")
        `),
      );
    });

    it('should handle raw query', () => {
      expect(User.where({ name: { in: raw("('a', 'b')") } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" IN ('a', 'b')
        `),
      );
    });
  });

  describe('notIn', () => {
    it('should handle value', () => {
      expect(User.where({ name: { notIn: ['a', 'b'] } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" NOT IN ('a', 'b')
        `),
      );
    });

    it('should handle sub query', () => {
      expect(User.where({ name: { notIn: User.select('name') } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" NOT IN (SELECT "user"."name" FROM "user")
        `),
      );
    });

    it('should handle raw query', () => {
      expect(User.where({ name: { notIn: raw("('a', 'b')") } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" NOT IN ('a', 'b')
        `),
      );
    });
  });

  describe('lt', () => {
    it('should handle value', () => {
      expect(User.where({ id: { lt: 5 } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" < 5
        `),
      );
    });

    it('should handle sub query', () => {
      expect(User.where({ id: { lt: User.select('id').take() } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" < (SELECT "user"."id" FROM "user" LIMIT 1)
        `),
      );
    });

    it('should handle raw query', () => {
      expect(User.where({ id: { lt: raw('5') } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" < 5
        `),
      );
    });
  });

  describe('lte', () => {
    it('should handle value', () => {
      expect(User.where({ id: { lte: 5 } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" <= 5
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({ id: { lte: User.select('id').take() } }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" <= (SELECT "user"."id" FROM "user" LIMIT 1)
        `),
      );
    });

    it('should handle raw query', () => {
      expect(User.where({ id: { lte: raw('5') } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" <= 5
        `),
      );
    });
  });

  describe('gt', () => {
    it('should handle value', () => {
      expect(User.where({ id: { gt: 5 } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" > 5
        `),
      );
    });

    it('should handle sub query', () => {
      expect(User.where({ id: { gt: User.select('id').take() } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" > (SELECT "user"."id" FROM "user" LIMIT 1)
        `),
      );
    });

    it('should handle raw query', () => {
      expect(User.where({ id: { gt: raw('5') } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" > 5
        `),
      );
    });
  });

  describe('gte', () => {
    it('should handle value', () => {
      expect(User.where({ id: { gte: 5 } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" >= 5
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({ id: { gte: User.select('id').take() } }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" >= (SELECT "user"."id" FROM "user" LIMIT 1)
        `),
      );
    });

    it('should handle raw query', () => {
      expect(User.where({ id: { gte: raw('5') } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" >= 5
        `),
      );
    });
  });

  describe('contains', () => {
    it('should handle value', () => {
      expect(User.where({ name: { contains: 'ko' } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" LIKE '%' || 'ko' || '%'
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({ name: { contains: User.select('name').take() } }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" LIKE '%' || (SELECT "user"."name" FROM "user" LIMIT 1) || '%'
        `),
      );
    });

    it('should handle raw query', () => {
      expect(User.where({ name: { contains: raw("'ko'") } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" LIKE '%' || 'ko' || '%'
        `),
      );
    });
  });

  describe('containsInsensitive', () => {
    it('should handle value', () => {
      expect(User.where({ name: { containsInsensitive: 'ko' } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" ILIKE '%' || 'ko' || '%'
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({
          name: { containsInsensitive: User.select('name').take() },
        }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" ILIKE '%' || (SELECT "user"."name" FROM "user" LIMIT 1) || '%'
        `),
      );
    });

    it('should handle raw query', () => {
      expect(
        User.where({ name: { containsInsensitive: raw("'ko'") } }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" ILIKE '%' || 'ko' || '%'
        `),
      );
    });
  });

  describe('startsWith', () => {
    it('should handle value', () => {
      expect(User.where({ name: { startsWith: 'ko' } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" LIKE 'ko' || '%'
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({
          name: { startsWith: User.select('name').take() },
        }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" LIKE (SELECT "user"."name" FROM "user" LIMIT 1) || '%'
        `),
      );
    });

    it('should handle raw query', () => {
      expect(User.where({ name: { startsWith: raw("'ko'") } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" LIKE 'ko' || '%'
        `),
      );
    });
  });

  describe('startsWithInsensitive', () => {
    it('should handle value', () => {
      expect(
        User.where({ name: { startsWithInsensitive: 'ko' } }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" ILIKE 'ko' || '%'
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({
          name: { startsWithInsensitive: User.select('name').take() },
        }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" ILIKE (SELECT "user"."name" FROM "user" LIMIT 1) || '%'
        `),
      );
    });

    it('should handle raw query', () => {
      expect(
        User.where({ name: { startsWithInsensitive: raw("'ko'") } }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" ILIKE 'ko' || '%'
        `),
      );
    });
  });

  describe('endsWith', () => {
    it('should handle value', () => {
      expect(User.where({ name: { endsWith: 'ko' } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" LIKE '%' || 'ko'
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({
          name: { endsWith: User.select('name').take() },
        }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" LIKE '%' || (SELECT "user"."name" FROM "user" LIMIT 1)
        `),
      );
    });

    it('should handle raw query', () => {
      expect(User.where({ name: { endsWith: raw("'ko'") } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" LIKE '%' || 'ko'
        `),
      );
    });
  });

  describe('endsWithInsensitive', () => {
    it('should handle value', () => {
      expect(User.where({ name: { endsWithInsensitive: 'ko' } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" ILIKE '%' || 'ko'
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({
          name: { endsWithInsensitive: User.select('name').take() },
        }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" ILIKE '%' || (SELECT "user"."name" FROM "user" LIMIT 1)
        `),
      );
    });

    it('should handle raw query', () => {
      expect(
        User.where({ name: { endsWithInsensitive: raw("'ko'") } }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."name" ILIKE '%' || 'ko'
        `),
      );
    });
  });

  describe('between', () => {
    it('should handle value', () => {
      expect(User.where({ id: { between: [1, 10] } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" BETWEEN 1 AND 10
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({
          id: { between: [User.select('id').take(), User.select('id').take()] },
        }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id"
          BETWEEN (SELECT "user"."id" FROM "user" LIMIT 1)
              AND (SELECT "user"."id" FROM "user" LIMIT 1)
        `),
      );
    });

    it('should handle raw query', () => {
      expect(
        User.where({ id: { between: [raw('1'), raw('10')] } }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" BETWEEN 1 AND 10
        `),
      );
    });
  });

  describe('jsonPath', () => {
    it('should handle value', () => {
      expect(
        User.where({ data: { jsonPath: ['$.name', '=', 'name'] } }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE jsonb_path_query_first("user"."data", '$.name') #>> '{}' = 'name'
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({
          data: { jsonPath: ['$.name', '=', User.select('name').take()] },
        }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE jsonb_path_query_first("user"."data", '$.name') #>> '{}' = (
            SELECT "user"."name" FROM "user" LIMIT 1
          )
        `),
      );
    });

    it('should handle raw query', () => {
      expect(
        User.where({
          data: { jsonPath: ['$.name', '=', raw("'name'")] },
        }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE jsonb_path_query_first("user"."data", '$.name') #>> '{}' = 'name'
        `),
      );
    });
  });

  describe.each`
    method              | sql
    ${'jsonSupersetOf'} | ${'@>'}
    ${'jsonSubsetOf'}   | ${'<@'}
  `('$method', ({ method, sql }) => {
    it('should handle value', () => {
      expect(User.where({ data: { [method]: { a: 'b' } } }).toSql()).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."data" ${sql} '{"a":"b"}'
        `),
      );
    });

    it('should handle sub query', () => {
      expect(
        User.where({
          data: { [method]: User.select('data').take() },
        }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."data" ${sql} (SELECT "user"."data" FROM "user" LIMIT 1)
        `),
      );
    });

    it('should handle raw query', () => {
      expect(
        User.where({
          data: { [method]: raw(`'{"a":"b"}'`) },
        }).toSql(),
      ).toBe(
        line(`
          SELECT "user".* FROM "user"
          WHERE "user"."data" ${sql} '{"a":"b"}'
        `),
      );
    });
  });
});
