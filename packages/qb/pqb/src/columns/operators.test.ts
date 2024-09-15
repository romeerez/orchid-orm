import {
  Snake,
  snakeData,
  SnakeData,
  snakeSelectAll,
  User,
  userColumnsSql,
} from '../test-utils/test-utils';
import { assertType, expectSql, testDb, useTestDatabase } from 'test-utils';

describe('operators', () => {
  it('should ignore undefined values', () => {
    const q = User.where({ name: { equals: undefined } });
    expectSql(q.toSQL(), `SELECT ${userColumnsSql} FROM "user"`);
  });

  describe('equals', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { equals: 'name' } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" = $1
        `,
        ['name'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { equals: User.select('name').take() } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" = (SELECT "user"."name" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { equals: testDb.sql`'name'` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
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
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" <> $1
        `,
        ['name'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { not: User.select('name').take() } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" <> (SELECT "user"."name" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { not: testDb.sql`'name'` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
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
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" IN ($1, $2)
        `,
        ['a', 'b'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { in: User.select('name') } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" IN (SELECT "user"."name" FROM "user")
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { in: testDb.sql`('a', 'b')` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
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
          SELECT ${userColumnsSql} FROM "user"
          WHERE NOT "user"."name" IN ($1, $2)
        `,
        ['a', 'b'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { notIn: User.select('name') } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE NOT "user"."name" IN (SELECT "user"."name" FROM "user")
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { notIn: testDb.sql`('a', 'b')` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
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
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" < $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: { lt: User.select('id').take() } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" < (SELECT "user"."id" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { lt: testDb.sql`5` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
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
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" <= $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: { lte: User.select('id').take() } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" <= (SELECT "user"."id" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { lte: testDb.sql`5` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
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
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" > $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: { gt: User.select('id').take() } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" > (SELECT "user"."id" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { gt: testDb.sql`5` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
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
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" >= $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ id: { gte: User.select('id').take() } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" >= (SELECT "user"."id" FROM "user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ id: { gte: testDb.sql`5` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" >= 5
        `,
      );
    });
  });

  describe('contains', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { contains: 'ko%' } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" ILIKE '%' || $1 || '%'
        `,
        ['ko\\%'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({ name: { contains: User.select('name').take() } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" ILIKE '%' || replace(replace((SELECT "user"."name" FROM "user" LIMIT 1), '%', '\\\\%'), '_', '\\\\_') || '%'
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { contains: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" ILIKE '%' || 'ko' || '%'
        `,
      );
    });
  });

  describe('containsSensitive', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { containsSensitive: 'ko%' } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" LIKE '%' || $1 || '%'
        `,
        ['ko\\%'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          name: { containsSensitive: User.select('name').take() },
        }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" LIKE '%' || replace(replace((SELECT "user"."name" FROM "user" LIMIT 1), '%', '\\\\%'), '_', '\\\\_') || '%'
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { containsSensitive: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" LIKE '%' || 'ko' || '%'
        `,
      );
    });
  });

  describe('startsWith', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { startsWith: 'ko%' } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" ILIKE $1 || '%'
        `,
        ['ko\\%'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          name: { startsWith: User.select('name').take() },
        }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" ILIKE replace(replace((SELECT "user"."name" FROM "user" LIMIT 1), '%', '\\\\%'), '_', '\\\\_') || '%'
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { startsWith: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" ILIKE 'ko' || '%'
        `,
      );
    });
  });

  describe('startsWithSensitive', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { startsWithSensitive: 'ko%' } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" LIKE $1 || '%'
        `,
        ['ko\\%'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          name: { startsWithSensitive: User.select('name').take() },
        }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" LIKE replace(replace((SELECT "user"."name" FROM "user" LIMIT 1), '%', '\\\\%'), '_', '\\\\_') || '%'
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({
          name: { startsWithSensitive: testDb.sql`'ko'` },
        }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" LIKE 'ko' || '%'
        `,
      );
    });
  });

  describe('endsWith', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { endsWith: 'ko%' } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" ILIKE '%' || $1
        `,
        ['ko\\%'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          name: { endsWith: User.select('name').take() },
        }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" ILIKE '%' || replace(replace((SELECT "user"."name" FROM "user" LIMIT 1), '%', '\\\\%'), '_', '\\\\_')
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { endsWith: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" ILIKE '%' || 'ko'
        `,
      );
    });
  });

  describe('endsWithSensitive', () => {
    it('should handle value', () => {
      expectSql(
        User.where({ name: { endsWithSensitive: 'ko%' } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" LIKE '%' || $1
        `,
        ['ko\\%'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        User.where({
          name: { endsWithSensitive: User.select('name').take() },
        }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."name" LIKE '%' || replace(replace((SELECT "user"."name" FROM "user" LIMIT 1), '%', '\\\\%'), '_', '\\\\_')
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        User.where({ name: { endsWithSensitive: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
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
          SELECT ${userColumnsSql} FROM "user"
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
          SELECT ${userColumnsSql} FROM "user"
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
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" BETWEEN 1 AND 10
        `,
      );
    });
  });

  describe('json operators', () => {
    describe('jsonSet', () => {
      it('should select jsonSet', () => {
        const q = Snake.get('snakeData').jsonSet('key', 'value');

        assertType<Awaited<typeof q>, SnakeData | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_set("snake"."snake_data", $1, $2)
            FROM "snake"
            LIMIT 1
          `,
          ['{key}', '"value"'],
        );
      });

      it('should update with jsonSet', () => {
        const q = Snake.find(1).update({
          snakeData: (q) => q.get('snakeData').jsonSet('key', 'value'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "snake"
            SET
              "snake_data" = jsonb_set("snake"."snake_data", $1, $2),
              "updated_at" = now()
            WHERE "snake"."snake_id" = $3
          `,
          ['{key}', '"value"', 1],
        );
      });

      it('should work with untyped json', () => {
        const table = testDb(
          'table',
          (t) => ({
            id: t.identity().primaryKey(),
            daTa: t.json(),
          }),
          undefined,
          {
            snakeCase: true,
          },
        );

        const q = table.find(1).update({
          daTa: (q) => q.get('daTa').jsonSet('key', 'value'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "table"
            SET "da_ta" = jsonb_set("table"."da_ta", $1, $2)
            WHERE "table"."id" = $3
          `,
          ['{key}', '"value"', 1],
        );
      });
    });

    describe('jsonReplace', () => {
      it('should select jsonReplace to do json_set with false to only replace existing', () => {
        const q = Snake.get('snakeData').jsonReplace('key', 'value');

        assertType<Awaited<typeof q>, SnakeData | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_set("snake"."snake_data", $1, $2, false)
            FROM "snake"
            LIMIT 1
          `,
          ['{key}', '"value"'],
        );
      });

      it('should update with jsonReplace', () => {
        const q = Snake.find(1).update({
          snakeData: (q) => q.get('snakeData').jsonReplace('key', 'value'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "snake"
            SET
              "snake_data" = jsonb_set("snake"."snake_data", $1, $2, false),
              "updated_at" = now()
            WHERE "snake"."snake_id" = $3
          `,
          ['{key}', '"value"', 1],
        );
      });
    });

    describe('jsonInsert', () => {
      it('should select jsonInsert', () => {
        const q = Snake.get('snakeData').jsonInsert('key', 'value');

        assertType<Awaited<typeof q>, SnakeData | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_insert("snake"."snake_data", $1, $2)
            FROM "snake"
            LIMIT 1
          `,
          ['{key}', '"value"'],
        );
      });

      it('should update with jsonInsert', () => {
        const q = Snake.find(1).update({
          snakeData: (q) => q.get('snakeData').jsonInsert('key', 'value'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "snake"
            SET
              "snake_data" = jsonb_insert("snake"."snake_data", $1, $2),
              "updated_at" = now()
            WHERE "snake"."snake_id" = $3
          `,
          ['{key}', '"value"', 1],
        );
      });

      it('should select jsonInsert with after: true', () => {
        const q = Snake.get('snakeData').jsonInsert('key', 'value', {
          after: true,
        });

        assertType<Awaited<typeof q>, SnakeData | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_insert("snake"."snake_data", $1, $2, true)
            FROM "snake"
            LIMIT 1
          `,
          ['{key}', '"value"'],
        );
      });

      it('should update with jsonInsert with after: true', () => {
        const q = Snake.find(1).update({
          snakeData: (q) =>
            q.get('snakeData').jsonInsert('key', 'value', { after: true }),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "snake"
            SET
              "snake_data" = jsonb_insert("snake"."snake_data", $1, $2, true),
              "updated_at" = now()
            WHERE "snake"."snake_id" = $3
          `,
          ['{key}', '"value"', 1],
        );
      });
    });

    describe('jsonRemove', () => {
      it('should select jsonRemove', () => {
        const q = Snake.get('snakeData').jsonRemove('key');

        assertType<Awaited<typeof q>, SnakeData | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT ("snake"."snake_data" #- $1)
            FROM "snake"
            LIMIT 1
          `,
          ['{key}'],
        );
      });

      it('should update with jsonRemove', () => {
        const q = Snake.find(1).update({
          snakeData: (q) => q.get('snakeData').jsonRemove('key'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "snake"
            SET
              "snake_data" = ("snake"."snake_data" #- $1),
              "updated_at" = now()
            WHERE "snake"."snake_id" = $2
          `,
          ['{key}', 1],
        );
      });
    });

    describe('jsonPathQueryFirst', () => {
      describe('using test db', () => {
        useTestDatabase();

        it('should select json property', async () => {
          await Snake.create({
            ...snakeData,
            snakeData: { name: new Date().toISOString(), tags: ['one'] },
          });

          const q = Snake.get('snakeData').jsonPathQueryFirst('$.name', {
            type: (q) => q.date().asDate(),
          });

          expectSql(
            q.toSQL(),
            `
            SELECT jsonb_path_query_first("snake"."snake_data", $1)
            FROM "snake"
            LIMIT 1
          `,
            ['$.name'],
          );

          const result = await q;

          assertType<typeof result, Date>();

          expect(result).toBeInstanceOf(Date);
        });
      });

      it('should support `vars`', () => {
        const q = Snake.get('snakeData').jsonPathQueryFirst('$.name', {
          vars: { key: 'value' },
        });

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_path_query_first("snake"."snake_data", $1, $2)
            FROM "snake"
            LIMIT 1
          `,
          ['$.name', '{"key":"value"}'],
        );
      });

      it('should support `silent`', () => {
        const q = Snake.get('snakeData').jsonPathQueryFirst('$.name', {
          silent: true,
        });

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_path_query_first("snake"."snake_data", $1, NULL, true)
            FROM "snake"
            LIMIT 1
          `,
          ['$.name'],
        );
      });

      it('should support `vars` and `silent`', () => {
        const q = Snake.get('snakeData').jsonPathQueryFirst('$.name', {
          vars: { key: 'value' },
          silent: true,
        });

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_path_query_first("snake"."snake_data", $1, $2, true)
            FROM "snake"
            LIMIT 1
          `,
          ['$.name', '{"key":"value"}'],
        );
      });

      it('should be usable in where', () => {
        const q = Snake.where((q) =>
          q.get('snakeData').jsonPathQueryFirst('$.name').equals('name'),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${snakeSelectAll} FROM "snake"
            WHERE jsonb_path_query_first("snake"."snake_data", $1) = $2
          `,
          ['$.name', 'name'],
        );
      });

      it('should be usable in where with null value', () => {
        const q = Snake.where((q) =>
          q.get('snakeData').jsonPathQueryFirst('$.name').equals(null),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${snakeSelectAll} FROM "snake"
            WHERE jsonb_path_query_first("snake"."snake_data", $1) IS NULL
          `,
          ['$.name'],
        );
      });

      it('should be usable in where with a sub query', () => {
        const q = Snake.where((q) =>
          q
            .get('snakeData')
            .jsonPathQueryFirst('$.name')
            .equals(Snake.select('snakeName').get('snakeName')),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${snakeSelectAll} FROM "snake"
            WHERE jsonb_path_query_first("snake"."snake_data", $1) = (
              SELECT "snake"."snake_name" FROM "snake" LIMIT 1
            )
          `,
          ['$.name'],
        );
      });

      it('should be usable in where with raw sql', () => {
        const q = Snake.where((q) =>
          q
            .get('snakeData')
            .jsonPathQueryFirst('$.name')
            .equals(testDb.sql`'name'`),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${snakeSelectAll} FROM "snake"
            WHERE jsonb_path_query_first("snake"."snake_data", $1) = 'name'
          `,
          ['$.name'],
        );
      });

      it('should allow to use an arbitrary operator on a jsonb column', () => {
        const q = Snake.where((q) =>
          q
            .get('snakeData')
            .jsonPathQueryFirst('$.name', { type: (t) => t.text() })
            .contains('string'),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${snakeSelectAll} FROM "snake"
            WHERE jsonb_path_query_first("snake"."snake_data", $1)::text ILIKE '%' || $2 || '%'
          `,
          ['$.name', 'string'],
        );
      });
    });

    describe('json operators chaining', () => {
      it('should select a chain of json operators', () => {
        const q = Snake.get('snakeData')
          .jsonSet('a', 1)
          .jsonReplace('b', 2)
          .jsonInsert('c', 3)
          .jsonInsert('d', 4, { after: true })
          .jsonRemove('e');

        assertType<Awaited<typeof q>, SnakeData | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT (
              jsonb_insert(
                jsonb_insert(
                  jsonb_set(
                    jsonb_set(
                      "snake"."snake_data",
                      $1,
                      $2
                    ),
                    $3,
                    $4,
                    false
                  ),
                  $5,
                  $6
                ),
                $7,
                $8,
                true
              ) #- $9
            )
            FROM "snake"
            LIMIT 1
          `,
          ['{a}', '1', '{b}', '2', '{c}', '3', '{d}', '4', '{e}'],
        );
      });

      it('should update record with a chain of json operators', () => {
        const q = Snake.find(1).update({
          snakeData: (q) =>
            q
              .get('snakeData')
              .jsonSet('a', 1)
              .jsonReplace('b', 2)
              .jsonInsert('c', 3)
              .jsonInsert('d', 4, { after: true })
              .jsonRemove('e'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "snake"
            SET "snake_data" = (
              jsonb_insert(
                jsonb_insert(
                  jsonb_set(
                    jsonb_set(
                      "snake"."snake_data",
                      $1,
                      $2
                    ),
                    $3,
                    $4,
                    false
                  ),
                  $5,
                  $6
                ),
                $7,
                $8,
                true
              ) #- $9
            ), "updated_at" = now()
            WHERE "snake"."snake_id" = $10
          `,
          ['{a}', '1', '{b}', '2', '{c}', '3', '{d}', '4', '{e}', 1],
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
          Snake.where({ snakeData: { [method]: { a: 'b' } } }).toSQL(),
          `
            SELECT ${snakeSelectAll} FROM "snake"
            WHERE "snake"."snake_data" ${sql} $1
          `,
          [{ a: 'b' }],
        );
      });

      it('should handle sub query', () => {
        expectSql(
          Snake.where({
            snakeData: { [method]: Snake.select('snakeData').take() },
          }).toSQL(),
          `
            SELECT ${snakeSelectAll} FROM "snake"
            WHERE "snake"."snake_data" ${sql} (SELECT "snake"."snake_data" "snakeData" FROM "snake" LIMIT 1)
          `,
        );
      });

      it('should handle raw query', () => {
        expectSql(
          Snake.where({
            snakeData: { [method]: testDb.sql`'{"a":"b"}'` },
          }).toSQL(),
          `
            SELECT ${snakeSelectAll} FROM "snake"
            WHERE "snake"."snake_data" ${sql} '{"a":"b"}'
          `,
        );
      });
    });
  });

  describe('date operators', () => {
    it('should accept Date object', () => {
      const now = new Date();

      const q = User.where({ createdAt: { gt: now } });

      expectSql(
        q.toSQL(),
        `SELECT ${userColumnsSql} FROM "user" WHERE "user"."createdAt" > $1
        `,
        [now],
      );
    });

    it('should accept string', () => {
      const now = new Date().toISOString();

      const q = User.where({ createdAt: { gt: now } });

      expectSql(
        q.toSQL(),
        `SELECT ${userColumnsSql} FROM "user" WHERE "user"."createdAt" > $1
        `,
        [now],
      );
    });
  });
});
