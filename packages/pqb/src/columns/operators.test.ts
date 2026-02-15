import { UserDataType } from '../test-utils/pqb.test-utils';
import {
  assertType,
  columnTypes,
  db,
  expectSql,
  sql,
  testDb,
  UserData,
  UserSelectAll,
  useTestDatabase,
} from 'test-utils';

const t = columnTypes;

describe('operators', () => {
  it('should ignore undefined values', () => {
    const q = db.user.where({ Name: { equals: undefined } });
    expectSql(q.toSQL(), `SELECT ${UserSelectAll} FROM "schema"."user"`);
  });

  it('should use the cached values for a sub-query if query sql was cached', () => {
    const q = db.user.whereIn('Id', db.user.find(1).pluck('Id'));

    expect(q.count().toSQL()).toMatchObject({ values: [1] });
    expect(q.toSQL()).toMatchObject({ values: [1] });
  });

  describe('equals', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Name: { equals: 'name' } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" = $1
        `,
        ['name'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user
          .where({ Name: { equals: db.user.select('Name').take() } })
          .toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" = (SELECT "user"."name" "Name" FROM "schema"."user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user.where({ Name: { equals: testDb.sql`'name'` } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" = 'name'
        `,
      );
    });
  });

  describe('not', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Name: { not: 'name' } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" <> $1
        `,
        ['name'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user.where({ Name: { not: db.user.select('Name').take() } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" <> (SELECT "user"."name" "Name" FROM "schema"."user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user.where({ Name: { not: testDb.sql`'name'` } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" <> 'name'
        `,
      );
    });
  });

  describe('in', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Name: { in: ['a', 'b'] } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" IN ($1, $2)
        `,
        ['a', 'b'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user.where({ Name: { in: db.user.select('Name') } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" IN (SELECT "user"."name" "Name" FROM "schema"."user")
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user.where({ Name: { in: testDb.sql`('a', 'b')` } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" IN ('a', 'b')
        `,
      );
    });

    it('should use `WHERE false` for empty array', () => {
      expectSql(
        db.user.where({ Name: { in: [] } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE false
        `,
      );
    });
  });

  describe('notIn', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Name: { notIn: ['a', 'b'] } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE NOT "user"."name" IN ($1, $2)
        `,
        ['a', 'b'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user.where({ Name: { notIn: db.user.select('Name') } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE NOT "user"."name" IN (SELECT "user"."name" "Name" FROM "schema"."user")
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user.where({ Name: { notIn: testDb.sql`('a', 'b')` } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE NOT "user"."name" IN ('a', 'b')
        `,
      );
    });

    it('should use `WHERE true` for empty array', () => {
      expectSql(
        db.user.where({ Name: { notIn: [] } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE true
        `,
      );
    });
  });

  describe('lt', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Id: { lt: 5 } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" < $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user.where({ Id: { lt: db.user.select('Id').take() } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" < (SELECT "user"."id" "Id" FROM "schema"."user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user.where({ Id: { lt: testDb.sql`5` } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" < 5
        `,
      );
    });
  });

  describe('lte', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Id: { lte: 5 } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" <= $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user.where({ Id: { lte: db.user.select('Id').take() } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" <= (SELECT "user"."id" "Id" FROM "schema"."user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user.where({ Id: { lte: testDb.sql`5` } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" <= 5
        `,
      );
    });
  });

  describe('gt', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Id: { gt: 5 } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" > $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user.where({ Id: { gt: db.user.select('Id').take() } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" > (SELECT "user"."id" "Id" FROM "schema"."user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user.where({ Id: { gt: testDb.sql`5` } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" > 5
        `,
      );
    });
  });

  describe('gte', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Id: { gte: 5 } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" >= $1
        `,
        [5],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user.where({ Id: { gte: db.user.select('Id').take() } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" >= (SELECT "user"."id" "Id" FROM "schema"."user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user.where({ Id: { gte: testDb.sql`5` } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" >= 5
        `,
      );
    });
  });

  describe('contains', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Name: { contains: 'ko%' } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" ILIKE '%' || $1 || '%'
        `,
        ['ko\\%'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user
          .where({ Name: { contains: db.user.select('Name').take() } })
          .toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" ILIKE '%' || replace(replace((SELECT "user"."name" "Name" FROM "schema"."user" LIMIT 1), '%', '\\\\%'), '_', '\\\\_') || '%'
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user.where({ Name: { contains: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" ILIKE '%' || 'ko' || '%'
        `,
      );
    });
  });

  describe('containsSensitive', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Name: { containsSensitive: 'ko%' } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" LIKE '%' || $1 || '%'
        `,
        ['ko\\%'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user
          .where({
            Name: { containsSensitive: db.user.select('Name').take() },
          })
          .toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" LIKE '%' || replace(replace((SELECT "user"."name" "Name" FROM "schema"."user" LIMIT 1), '%', '\\\\%'), '_', '\\\\_') || '%'
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user
          .where({ Name: { containsSensitive: testDb.sql`'ko'` } })
          .toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" LIKE '%' || 'ko' || '%'
        `,
      );
    });
  });

  describe('startsWith', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Name: { startsWith: 'ko%' } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" ILIKE $1 || '%'
        `,
        ['ko\\%'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user
          .where({
            Name: { startsWith: db.user.select('Name').take() },
          })
          .toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" ILIKE replace(replace((SELECT "user"."name" "Name" FROM "schema"."user" LIMIT 1), '%', '\\\\%'), '_', '\\\\_') || '%'
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user.where({ Name: { startsWith: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" ILIKE 'ko' || '%'
        `,
      );
    });
  });

  describe('startsWithSensitive', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Name: { startsWithSensitive: 'ko%' } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" LIKE $1 || '%'
        `,
        ['ko\\%'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user
          .where({
            Name: { startsWithSensitive: db.user.select('Name').take() },
          })
          .toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" LIKE replace(replace((SELECT "user"."name" "Name" FROM "schema"."user" LIMIT 1), '%', '\\\\%'), '_', '\\\\_') || '%'
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user
          .where({
            Name: { startsWithSensitive: testDb.sql`'ko'` },
          })
          .toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" LIKE 'ko' || '%'
        `,
      );
    });
  });

  describe('endsWith', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Name: { endsWith: 'ko%' } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" ILIKE '%' || $1
        `,
        ['ko\\%'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user
          .where({
            Name: { endsWith: db.user.select('Name').take() },
          })
          .toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" ILIKE '%' || replace(replace((SELECT "user"."name" "Name" FROM "schema"."user" LIMIT 1), '%', '\\\\%'), '_', '\\\\_')
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user.where({ Name: { endsWith: testDb.sql`'ko'` } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" ILIKE '%' || 'ko'
        `,
      );
    });
  });

  describe('endsWithSensitive', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Name: { endsWithSensitive: 'ko%' } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" LIKE '%' || $1
        `,
        ['ko\\%'],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user
          .where({
            Name: { endsWithSensitive: db.user.select('Name').take() },
          })
          .toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" LIKE '%' || replace(replace((SELECT "user"."name" "Name" FROM "schema"."user" LIMIT 1), '%', '\\\\%'), '_', '\\\\_')
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user
          .where({ Name: { endsWithSensitive: testDb.sql`'ko'` } })
          .toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."name" LIKE '%' || 'ko'
        `,
      );
    });
  });

  describe('between', () => {
    it('should handle value', () => {
      expectSql(
        db.user.where({ Id: { between: [1, 10] } }).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" BETWEEN $1 AND $2
        `,
        [1, 10],
      );
    });

    it('should handle sub query', () => {
      expectSql(
        db.user
          .where({
            Id: {
              between: [
                db.user.select('Id').take(),
                db.user.select('Id').take(),
              ],
            },
          })
          .toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id"
          BETWEEN (SELECT "user"."id" "Id" FROM "schema"."user" LIMIT 1)
              AND (SELECT "user"."id" "Id" FROM "schema"."user" LIMIT 1)
        `,
      );
    });

    it('should handle raw query', () => {
      expectSql(
        db.user
          .where({
            Id: { between: [testDb.sql`1`, testDb.sql`10`] },
          })
          .toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user"
          WHERE "user"."id" BETWEEN 1 AND 10
        `,
      );
    });
  });

  describe('json operators', () => {
    describe('jsonSet', () => {
      it('should select jsonSet', () => {
        const q = db.user.get('Data').jsonSet('key', 'value');

        assertType<Awaited<typeof q>, UserDataType | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_set("user"."data", $1, $2)
            FROM "schema"."user"
            LIMIT 1
          `,
          ['{key}', '"value"'],
        );
      });

      it('should support sql', () => {
        const q = db.user.get('Data').jsonSet('name', sql`sql`);

        assertType<Awaited<typeof q>, UserDataType | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_set("user"."data", $1, to_jsonb(sql))
            FROM "schema"."user"
            LIMIT 1
          `,
          ['{name}'],
        );
      });

      it('should update with jsonSet', () => {
        const q = db.user.find(1).update({
          Data: (q) => q.get('Data').jsonSet('key', 'value'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "schema"."user"
            SET
              "data" = jsonb_set("user"."data", $1, $2),
              "updated_at" = now()
            WHERE "user"."id" = $3
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
            UPDATE "schema"."table"
            SET "da_ta" = jsonb_set("table"."da_ta", $1, $2)
            WHERE "table"."id" = $3
          `,
          ['{key}', '"value"', 1],
        );
      });
    });

    describe('jsonReplace', () => {
      it('should select jsonReplace to do json_set with false to only replace existing', () => {
        const q = db.user.get('Data').jsonReplace('key', 'value');

        assertType<Awaited<typeof q>, UserDataType | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_set("user"."data", $1, $2, false)
            FROM "schema"."user"
            LIMIT 1
          `,
          ['{key}', '"value"'],
        );
      });

      it('should support sql', () => {
        const q = db.user.get('Data').jsonReplace('name', sql`sql`);

        assertType<Awaited<typeof q>, UserDataType | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_set("user"."data", $1, to_jsonb(sql), false)
            FROM "schema"."user"
            LIMIT 1
          `,
          ['{name}'],
        );
      });

      it('should update with jsonReplace', () => {
        const q = db.user.find(1).update({
          Data: (q) => q.get('Data').jsonReplace('key', 'value'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "schema"."user"
            SET
              "data" = jsonb_set("user"."data", $1, $2, false),
              "updated_at" = now()
            WHERE "user"."id" = $3
          `,
          ['{key}', '"value"', 1],
        );
      });
    });

    describe('jsonInsert', () => {
      it('should select jsonInsert', () => {
        const q = db.user.get('Data').jsonInsert('key', 'value');

        assertType<Awaited<typeof q>, UserDataType | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_insert("user"."data", $1, $2)
            FROM "schema"."user"
            LIMIT 1
          `,
          ['{key}', '"value"'],
        );
      });

      it('should support sql', () => {
        const q = db.user.get('Data').jsonInsert('name', sql`sql`);

        assertType<Awaited<typeof q>, UserDataType | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_insert("user"."data", $1, to_jsonb(sql))
            FROM "schema"."user"
            LIMIT 1
          `,
          ['{name}'],
        );
      });

      it('should update with jsonInsert', () => {
        const q = db.user.find(1).update({
          Data: (q) => q.get('Data').jsonInsert('key', 'value'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "schema"."user"
            SET
              "data" = jsonb_insert("user"."data", $1, $2),
              "updated_at" = now()
            WHERE "user"."id" = $3
          `,
          ['{key}', '"value"', 1],
        );
      });

      it('should select jsonInsert with after: true', () => {
        const q = db.user.get('Data').jsonInsert('key', 'value', {
          after: true,
        });

        assertType<Awaited<typeof q>, UserDataType | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_insert("user"."data", $1, $2, true)
            FROM "schema"."user"
            LIMIT 1
          `,
          ['{key}', '"value"'],
        );
      });

      it('should update with jsonInsert with after: true', () => {
        const q = db.user.find(1).update({
          Data: (q) =>
            q.get('Data').jsonInsert('key', 'value', { after: true }),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "schema"."user"
            SET
              "data" = jsonb_insert("user"."data", $1, $2, true),
              "updated_at" = now()
            WHERE "user"."id" = $3
          `,
          ['{key}', '"value"', 1],
        );
      });
    });

    describe('jsonRemove', () => {
      it('should select jsonRemove', () => {
        const q = db.user.get('Data').jsonRemove('key');

        assertType<Awaited<typeof q>, UserDataType | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT ("user"."data" #- $1)
            FROM "schema"."user"
            LIMIT 1
          `,
          ['{key}'],
        );
      });

      it('should update with jsonRemove', () => {
        const q = db.user.find(1).update({
          Data: (q) => q.get('Data').jsonRemove('key'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "schema"."user"
            SET
              "data" = ("user"."data" #- $1),
              "updated_at" = now()
            WHERE "user"."id" = $2
          `,
          ['{key}', 1],
        );
      });
    });

    describe('jsonPathQueryFirst', () => {
      describe('using test db', () => {
        useTestDatabase();

        it('should select json property', async () => {
          await db.user.insert({
            ...UserData,
            Data: { name: new Date().toISOString(), tags: ['one'] },
          });

          const q = db.user.get('Data').jsonPathQueryFirst('$.name', {
            type: (q) => q.date().asDate(),
          });

          expectSql(
            q.toSQL(),
            `
            SELECT jsonb_path_query_first("user"."data", $1)
            FROM "schema"."user"
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
        const q = db.user.get('Data').jsonPathQueryFirst('$.name', {
          vars: { key: 'value' },
        });

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_path_query_first("user"."data", $1, $2)
            FROM "schema"."user"
            LIMIT 1
          `,
          ['$.name', '{"key":"value"}'],
        );
      });

      it('should support `silent`', () => {
        const q = db.user.get('Data').jsonPathQueryFirst('$.name', {
          silent: true,
        });

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_path_query_first("user"."data", $1, NULL, true)
            FROM "schema"."user"
            LIMIT 1
          `,
          ['$.name'],
        );
      });

      it('should support `vars` and `silent`', () => {
        const q = db.user.get('Data').jsonPathQueryFirst('$.name', {
          vars: { key: 'value' },
          silent: true,
        });

        expectSql(
          q.toSQL(),
          `
            SELECT jsonb_path_query_first("user"."data", $1, $2, true)
            FROM "schema"."user"
            LIMIT 1
          `,
          ['$.name', '{"key":"value"}'],
        );
      });

      it('should be usable in where', () => {
        const q = db.user.where((q) =>
          q.get('Data').jsonPathQueryFirst('$.name').equals('name'),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${UserSelectAll} FROM "schema"."user"
            WHERE jsonb_path_query_first("user"."data", $1) = $2::jsonb
          `,
          ['$.name', '"name"'],
        );
      });

      it('should be usable in where with a sub query', () => {
        const q = db.user.where((q) =>
          q
            .get('Data')
            .jsonPathQueryFirst('$.name')
            .equals(db.user.select('Name').get('Name')),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${UserSelectAll} FROM "schema"."user"
            WHERE jsonb_path_query_first("user"."data", $1) = to_jsonb((
              SELECT "user"."name" FROM "schema"."user" LIMIT 1
            ))
          `,
          ['$.name'],
        );
      });

      it('should be usable in where with raw sql', () => {
        const q = db.user.where((q) =>
          q
            .get('Data')
            .jsonPathQueryFirst('$.name')
            .equals(testDb.sql`'name'`),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${UserSelectAll} FROM "schema"."user"
            WHERE jsonb_path_query_first("user"."data", $1) = to_jsonb('name')
          `,
          ['$.name'],
        );
      });

      it('should allow to use an arbitrary operator on a jsonb column', () => {
        const q = db.user.where((q) =>
          q
            .get('Data')
            .jsonPathQueryFirst('$.name', { type: (t) => t.text() })
            .contains('string'),
        );

        expectSql(
          q.toSQL(),
          `
            SELECT ${UserSelectAll} FROM "schema"."user"
            WHERE jsonb_path_query_first("user"."data", $1)::text ILIKE '%' || $2 || '%'
          `,
          ['$.name', 'string'],
        );
      });
    });

    describe('operators on json', () => {
      describe('equals', () => {
        it('should cast param to jsonb', () => {
          const q = db.user
            .get('Data')
            .jsonPathQueryFirst('$.name')
            .equals('name');

          expectSql(
            q.toSQL(),
            `
                SELECT jsonb_path_query_first("user"."data", $1) = $2::jsonb
                FROM "schema"."user"
                LIMIT 1
              `,
            ['$.name', '"name"'],
          );
        });

        it('should account for json null and "not set" when comparing with null', () => {
          const q = db.user
            .get('Data')
            .jsonPathQueryFirst('$.name')
            .equals(null);

          expectSql(
            q.toSQL(),
            `
                SELECT nullif(jsonb_path_query_first("user"."data", $1), 'null'::jsonb) IS NULL
                FROM "schema"."user"
                LIMIT 1
              `,
            ['$.name'],
          );
        });
      });

      describe('not', () => {
        it('should cast param to jsonb', () => {
          const q = db.user
            .get('Data')
            .jsonPathQueryFirst('$.name')
            .not('name');

          expectSql(
            q.toSQL(),
            `
                SELECT jsonb_path_query_first("user"."data", $1) != $2::jsonb
                FROM "schema"."user"
                LIMIT 1
              `,
            ['$.name', '"name"'],
          );
        });

        it('should account for json null and "not set" when comparing with null', () => {
          const q = db.user.get('Data').jsonPathQueryFirst('$.name').not(null);

          expectSql(
            q.toSQL(),
            `
                SELECT nullif(jsonb_path_query_first("user"."data", $1), 'null'::jsonb) IS NOT NULL
                FROM "schema"."user"
                LIMIT 1
              `,
            ['$.name'],
          );
        });
      });

      describe('in', () => {
        it('should cast params to jsonb', () => {
          const q = db.user
            .get('Data')
            .jsonPathQueryFirst('$.name')
            .in(['name']);

          expectSql(
            q.toSQL(),
            `
                SELECT jsonb_path_query_first("user"."data", $1) IN ($2::jsonb)
                FROM "schema"."user"
                LIMIT 1
              `,
            ['$.name', '"name"'],
          );
        });

        it('should use `false` for empty array', () => {
          const q = db.user.get('Data').jsonPathQueryFirst('$.name').in([]);

          expectSql(
            q.toSQL(),
            `
                SELECT false
                FROM "schema"."user"
                LIMIT 1
              `,
            ['$.name'],
          );
        });
      });

      describe('notIn', () => {
        it('should cast params to jsonb', () => {
          const q = db.user
            .get('Data')
            .jsonPathQueryFirst('$.name')
            .notIn(['name']);

          expectSql(
            q.toSQL(),
            `
                SELECT NOT jsonb_path_query_first("user"."data", $1) IN ($2::jsonb)
                FROM "schema"."user"
                LIMIT 1
              `,
            ['$.name', '"name"'],
          );
        });

        it('should use `true` for empty array', () => {
          const q = db.user.get('Data').jsonPathQueryFirst('$.name').notIn([]);

          expectSql(
            q.toSQL(),
            `
                SELECT true
                FROM "schema"."user"
                LIMIT 1
              `,
            ['$.name'],
          );
        });
      });
    });

    describe('json operators chaining', () => {
      it('should select a chain of json operators', () => {
        const q = db.user
          .get('Data')
          .jsonSet('a', 1)
          .jsonReplace('b', 2)
          .jsonInsert('c', 3)
          .jsonInsert('d', 4, { after: true })
          .jsonRemove('e');

        assertType<Awaited<typeof q>, UserDataType | null>();

        expectSql(
          q.toSQL(),
          `
            SELECT (
              jsonb_insert(
                jsonb_insert(
                  jsonb_set(
                    jsonb_set(
                      "user"."data",
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
            FROM "schema"."user"
            LIMIT 1
          `,
          ['{a}', '1', '{b}', '2', '{c}', '3', '{d}', '4', '{e}'],
        );
      });

      it('should update record with a chain of json operators', () => {
        const q = db.user.find(1).update({
          Data: (q) =>
            q
              .get('Data')
              .jsonSet('a', 1)
              .jsonReplace('b', 2)
              .jsonInsert('c', 3)
              .jsonInsert('d', 4, { after: true })
              .jsonRemove('e'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "schema"."user"
            SET "data" = (
              jsonb_insert(
                jsonb_insert(
                  jsonb_set(
                    jsonb_set(
                      "user"."data",
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
            WHERE "user"."id" = $10
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
          db.user.where({ Data: { [method]: { a: 'b' } } }).toSQL(),
          `
            SELECT ${UserSelectAll} FROM "schema"."user"
            WHERE "user"."data" ${sql} $1
          `,
          [JSON.stringify({ a: 'b' })],
        );
      });

      it('should handle sub query', () => {
        expectSql(
          db.user
            .where({
              Data: { [method]: db.user.select('Data').take() },
            })
            .toSQL(),
          `
            SELECT ${UserSelectAll} FROM "schema"."user"
            WHERE "user"."data" ${sql} (SELECT "user"."data" "Data" FROM "schema"."user" LIMIT 1)
          `,
        );
      });

      it('should handle raw query', () => {
        expectSql(
          db.user
            .where({
              Data: { [method]: testDb.sql`'{"a":"b"}'` },
            })
            .toSQL(),
          `
            SELECT ${UserSelectAll} FROM "schema"."user"
            WHERE "user"."data" ${sql} '{"a":"b"}'
          `,
        );
      });
    });
  });

  describe('date operators', () => {
    it('should accept Date object', () => {
      const now = new Date();

      const q = db.user.where({ createdAt: { gt: now } });

      expectSql(
        q.toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" WHERE "user"."created_at" > $1
        `,
        [now],
      );
    });

    it('should accept string', () => {
      const now = new Date().toISOString();

      const q = db.user.where({ createdAt: { gt: now } });

      expectSql(
        q.toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" WHERE "user"."created_at" > $1
        `,
        [now],
      );
    });
  });

  describe('ordinal operators', () => {
    /**
     * To get a list of types that support `<`, `>`, `<=`, `>=`
     *
     * SELECT DISTINCT t.typname AS type_name
     * FROM pg_type t
     * JOIN pg_opclass c ON t.oid = c.opcintype
     * JOIN pg_am am ON am.oid = c.opcmethod
     * WHERE am.amname = 'btree'
     * ORDER BY t.typname;
     */
    it(`should be available for various types`, () => {
      for (const type of [
        t.bit(1),
        t.bitVarying(),
        t.boolean(),
        t.json(),
        // arrays
        t.array(t.string()),
        t.bytea(),
        // strings
        t.enum('enum', ['value']),
        t.citext(),
        t.uuid(),
        t.money(),
        t.inet(),
        t.macaddr(),
        t.macaddr8(),
        t.text(),
        t.string(),
        t.varchar(),
        // dates
        t.date(),
        t.interval(),
        t.time(),
        t.timestamp(),
        t.timestampNoTZ(),
        // numbers
        t.smallint(),
        t.integer(),
        t.bigint(),
        t.numeric(),
        t.decimal(),
        t.real(),
        t.doublePrecision(),
        t.smallSerial(),
        t.serial(),
        t.bigSerial(),
        // search
        t.tsvector(),
        t.tsquery(),
      ]) {
        expect(type.operators).toHaveProperty('lt');
      }
    });
  });
});
