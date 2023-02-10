import { db, expectSql, User } from '../test-utils/test-utils';

describe('operators', () => {
  describe('equals', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { equals: 'name' } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" = $1
        `,
        ['name'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { equals: User.select('name').take() } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" = (SELECT "user"."name" FROM "user" LIMIT $1)
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { equals: db.raw("'name'") } }).toSql(),
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
        User.where({ name: { not: 'name' } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" <> $1
        `,
        ['name'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { not: User.select('name').take() } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" <> (SELECT "user"."name" FROM "user" LIMIT $1)
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { not: db.raw("'name'") } }).toSql(),
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
        User.where({ name: { in: ['a', 'b'] } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" IN ($1, $2)
        `,
        ['a', 'b'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { in: User.select('name') } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" IN (SELECT "user"."name" FROM "user")
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { in: db.raw("('a', 'b')") } }).toSql(),
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
        User.where({ name: { notIn: ['a', 'b'] } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE NOT "user"."name" IN ($1, $2)
        `,
        ['a', 'b'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { notIn: User.select('name') } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE NOT "user"."name" IN (SELECT "user"."name" FROM "user")
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { notIn: db.raw("('a', 'b')") } }).toSql(),
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
        User.where({ id: { lt: 5 } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" < $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: { lt: User.select('id').take() } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" < (SELECT "user"."id" FROM "user" LIMIT $1)
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { lt: db.raw('5') } }).toSql(),
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
        User.where({ id: { lte: 5 } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" <= $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: { lte: User.select('id').take() } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" <= (SELECT "user"."id" FROM "user" LIMIT $1)
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { lte: db.raw('5') } }).toSql(),
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
        User.where({ id: { gt: 5 } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" > $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: { gt: User.select('id').take() } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" > (SELECT "user"."id" FROM "user" LIMIT $1)
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { gt: db.raw('5') } }).toSql(),
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
        User.where({ id: { gte: 5 } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" >= $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: { gte: User.select('id').take() } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" >= (SELECT "user"."id" FROM "user" LIMIT $1)
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { gte: db.raw('5') } }).toSql(),
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
        User.where({ name: { contains: 'ko' } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE '%' || $1 || '%'
        `,
        ['ko'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { contains: User.select('name').take() } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE '%' || (SELECT "user"."name" FROM "user" LIMIT $1) || '%'
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { contains: db.raw("'ko'") } }).toSql(),
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
        User.where({ name: { containsSensitive: 'ko' } }).toSql(),
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
        }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" LIKE '%' || (SELECT "user"."name" FROM "user" LIMIT $1) || '%'
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { containsSensitive: db.raw("'ko'") } }).toSql(),
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
        User.where({ name: { startsWith: 'ko' } }).toSql(),
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
        }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE (SELECT "user"."name" FROM "user" LIMIT $1) || '%'
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { startsWith: db.raw("'ko'") } }).toSql(),
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
        User.where({ name: { startsWithSensitive: 'ko' } }).toSql(),
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
        }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" LIKE (SELECT "user"."name" FROM "user" LIMIT $1) || '%'
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { startsWithSensitive: db.raw("'ko'") } }).toSql(),
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
        User.where({ name: { endsWith: 'ko' } }).toSql(),
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
        }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" ILIKE '%' || (SELECT "user"."name" FROM "user" LIMIT $1)
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { endsWith: db.raw("'ko'") } }).toSql(),
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
        User.where({ name: { endsWithSensitive: 'ko' } }).toSql(),
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
        }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."name" LIKE '%' || (SELECT "user"."name" FROM "user" LIMIT $1)
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { endsWithSensitive: db.raw("'ko'") } }).toSql(),
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
        User.where({ id: { between: [1, 10] } }).toSql(),
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
        }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."id"
          BETWEEN (SELECT "user"."id" FROM "user" LIMIT $1)
              AND (SELECT "user"."id" FROM "user" LIMIT $2)
        `,
        [1, 1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { between: [db.raw('1'), db.raw('10')] } }).toSql(),
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
        User.where({ data: { jsonPath: ['$.name', '=', 'name'] } }).toSql(),
        `
          SELECT * FROM "user"
          WHERE jsonb_path_query_first("user"."data", '$.name') #>> '{}' = $1
        `,
        ['name'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          data: { jsonPath: ['$.name', '=', User.select('name').take()] },
        }).toSql(),
        `
          SELECT * FROM "user"
          WHERE jsonb_path_query_first("user"."data", '$.name') #>> '{}' = (
            SELECT "user"."name" FROM "user" LIMIT $1
          )
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({
          data: { jsonPath: ['$.name', '=', db.raw("'name'")] },
        }).toSql(),
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
        User.where({ data: { [method]: { a: 'b' } } }).toSql(),
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
        }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."data" ${sql} (SELECT "user"."data" FROM "user" LIMIT $1)
        `,
        [1],
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({
          data: { [method]: db.raw(`'{"a":"b"}'`) },
        }).toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."data" ${sql} '{"a":"b"}'
        `,
      );
    });
  });
});
