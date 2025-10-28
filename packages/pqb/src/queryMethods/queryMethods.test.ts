import {
  expectQueryNotMutated,
  User,
  Profile,
  userData,
  UserRecord,
  Snake,
  snakeSelectAll,
  userColumnsSql,
  userTableColumnsSql,
} from '../test-utils/test-utils';
import {
  assertType,
  db,
  expectSql,
  now,
  sql,
  testAdapter,
  testDb,
  useTestDatabase,
} from 'test-utils';
import { Sql, NotFoundError } from '../core';
import { QueryHelperResult } from './queryMethods';

describe('queryMethods', () => {
  useTestDatabase();

  describe('.clone', () => {
    it('should return new object with the same data structures', async () => {
      const cloned = User.clone();
      expect(cloned).not.toBe(User);
      expect(cloned.table).toBe(User.table);
      expect(cloned.shape).toBe(User.shape);

      assertType<typeof User, typeof cloned>();
    });
  });

  describe('toSQL', () => {
    it('generates sql', () => {
      const sql = User.toSQL();

      assertType<typeof sql, Sql>();

      expectSql(sql, `SELECT ${userColumnsSql} FROM "user"`);
    });
  });

  describe('.all', () => {
    it('should produce correct sql', () => {
      expectSql(User.all().toSQL(), `SELECT ${userColumnsSql} FROM "user"`);
    });
  });

  describe('take', () => {
    it('limits to one and returns only one', async () => {
      await User.create(userData);

      const q = User.all();

      expectSql(
        q.take().toSQL(),
        `SELECT ${userColumnsSql} FROM "user" LIMIT 1`,
      );
      expectQueryNotMutated(q);

      const expected = await testAdapter
        .query(`SELECT ${userColumnsSql} FROM "user" LIMIT 1`)
        .then((res) => res.rows[0]);

      const user = await q.take();
      assertType<typeof user, UserRecord>();

      expect(user).toEqual({
        ...expected,
        createdAt: new Date(expected.createdAt),
        updatedAt: new Date(expected.updatedAt),
      });
    });

    it('should throw if not found', async () => {
      await expect(() => User.take()).rejects.toThrowError(NotFoundError);
    });

    it('should change value to valueOrThrow', async () => {
      await User.insert(userData);

      const q = User.getOptional('id').take();
      const result = await q;

      assertType<typeof result, number>();

      expect(result).toEqual(expect.any(Number));
    });

    it('should leave valueOrThrow as is', async () => {
      await User.insert(userData);

      const q = User.get('id').take();
      const result = await q;

      assertType<typeof result, number>();

      expect(result).toEqual(expect.any(Number));
    });

    it('should change rows to oneOrThrow', async () => {
      await User.insert(userData);

      const q = User.select('id', 'name').rows().take();
      const result = await q;

      assertType<typeof result, { id: number; name: string }>();

      expect(result).toEqual({ id: expect.any(Number), name: 'name' });
    });

    it('should leave void as is', async () => {
      await User.insert(userData);

      const q = User.select('id', 'name').exec().take();
      const result = await q;

      assertType<typeof result, void>();

      expect(result).toBe(undefined);
    });
  });

  describe('takeOptional', () => {
    it('limits to one and returns only one', async () => {
      await User.create(userData);

      const q = User.all();

      expectSql(
        q.takeOptional().toSQL(),
        `SELECT ${userColumnsSql} FROM "user" LIMIT 1`,
      );
      expectQueryNotMutated(q);

      const expected = await testAdapter
        .query(`SELECT ${userColumnsSql} FROM "user" LIMIT 1`)
        .then((res) => res.rows[0]);

      const user = await q.takeOptional();
      assertType<typeof user, UserRecord | undefined>();

      expect(user).toEqual({
        ...expected,
        createdAt: new Date(expected.createdAt),
        updatedAt: new Date(expected.updatedAt),
      });
    });

    it('should return undefined if not found', async () => {
      const user = await User.takeOptional();

      assertType<typeof user, UserRecord | undefined>();

      expect(user).toBe(undefined);
    });

    it('should change valueOrThrow to value', async () => {
      const q = User.get('id').takeOptional();
      const result = await q;

      assertType<typeof result, number | undefined>();

      expect(result).toBe(undefined);
    });

    it('should leave value as is', async () => {
      const q = User.getOptional('id').takeOptional();
      const result = await q;

      assertType<typeof result, number | undefined>();

      expect(result).toBe(undefined);
    });

    it('should change rows to one', async () => {
      const q = User.select('id', 'name').rows().takeOptional();
      const result = await q;

      assertType<typeof result, { id: number; name: string } | undefined>();

      expect(result).toBe(undefined);
    });

    it('should leave void as is', async () => {
      const q = User.select('id', 'name').exec().takeOptional();
      const result = await q;

      assertType<typeof result, void>();

      expect(result).toBe(undefined);
    });
  });

  describe('rows', () => {
    it('returns array of rows', async () => {
      const { rows: expected } = await testAdapter.arrays(
        `SELECT ${userColumnsSql} FROM "user"`,
      );

      const received = await User.rows();

      expect(received).toEqual(expected);
    });

    it('should be disabled in a sub-query', () => {
      const q = User.select({
        x: () => User.rows(),
      });

      assertType<typeof q, 'Invalid return type of x'>();
    });
  });

  describe('pluck', () => {
    beforeEach(async () => {
      for (let i = 0; i < 3; i++) {
        await User.create({ ...userData, createdAt: now });
      }
    });

    it('should return array of column values, properly parsed', async () => {
      const result = await User.pluck('createdAt');

      expect(result).toEqual([now, now, now]);

      assertType<typeof result, Date[]>();
    });

    it('should support raw expression', async () => {
      const result = await User.pluck(testDb.sql`123`.type((t) => t.integer()));

      expect(result).toEqual([123, 123, 123]);

      assertType<typeof result, number[]>();
    });
  });

  describe('exec', () => {
    it('returns nothing', async () => {
      const received = await User.exec();

      expect(received).toEqual(undefined);
    });
  });

  describe('distinct', () => {
    it('should add distinct without specifying columns', () => {
      const q = User.all();

      expectSql(
        q.distinct().toSQL(),
        `SELECT DISTINCT ${userColumnsSql} FROM "user"`,
      );

      expectQueryNotMutated(q);
    });

    it('should add distinct on columns', () => {
      const q = User.all();

      expectSql(
        q.distinct('id', 'user.name').toSQL(),
        `
          SELECT DISTINCT ON ("user"."id", "user"."name") ${userColumnsSql}
          FROM "user"
        `,
      );

      expectQueryNotMutated(q);
    });

    it('should add distinct on named columns', () => {
      const q = Snake.distinct('snakeName', 'snake.tailLength');

      expectSql(
        q.toSQL(),
        `
          SELECT DISTINCT ON ("snake"."snake_name", "snake"."tail_length") ${snakeSelectAll}
          FROM "snake"
        `,
      );
    });

    it('should add distinct on joined columns', () => {
      const q = User.all();

      expectSql(
        q
          .join(Profile, 'profile.userId', '=', 'user.id')
          .distinct('user.id', 'profile.userId')
          .toSQL(),
        `
          SELECT DISTINCT ON ("user"."id", "profile"."user_id") ${userTableColumnsSql}
          FROM "user"
          JOIN "profile" ON "profile"."user_id" = "user"."id"
        `,
      );

      expectQueryNotMutated(q);
    });

    it('should add distinct on joined named columns', () => {
      const q = User.join(Snake, 'snake.tailLength', 'user.id').distinct(
        'user.id',
        'snake.tailLength',
      );

      expectSql(
        q.toSQL(),
        `
          SELECT DISTINCT ON ("user"."id", "snake"."tail_length") ${userTableColumnsSql}
          FROM "user"
          JOIN "snake" ON "snake"."tail_length" = "user"."id"
        `,
      );
    });

    it('should add distinct on joined columns with alias', () => {
      const q = User.all();

      expectSql(
        q
          .join(Profile.as('p'), 'p.userId', '=', 'user.id')
          .distinct('user.id', 'p.userId')
          .toSQL(),
        `
          SELECT DISTINCT ON ("user"."id", "p"."user_id") ${userTableColumnsSql}
          FROM "user"
          JOIN "profile" "p" ON "p"."user_id" = "user"."id"
        `,
      );

      expectQueryNotMutated(q);
    });

    it('should add distinct on joined columns with named with alias', () => {
      const q = User.join(Snake.as('s'), 's.tailLength', 'user.id').distinct(
        'user.id',
        's.tailLength',
      );

      expectSql(
        q.toSQL(),
        `
          SELECT DISTINCT ON ("user"."id", "s"."tail_length") ${userTableColumnsSql}
          FROM "user"
          JOIN "snake" "s" ON "s"."tail_length" = "user"."id"
        `,
      );
    });

    it('should add distinct on raw sql', () => {
      const q = User.all();
      expectSql(
        q.distinct(testDb.sql`"user".id`).toSQL(),
        `
          SELECT DISTINCT ON ("user".id) ${userColumnsSql} FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });
  });

  describe('find', () => {
    it('should be disabled when no primary key', () => {
      const table = testDb('table', () => ({}), undefined, {
        noPrimaryKey: 'ignore',
      });

      // @ts-expect-error no primary key
      table.find(1);
    });

    it('should be disabled when multiple primary keys', () => {
      const table = testDb('table', (t) => ({
        a: t.integer().primaryKey(),
        b: t.integer().primaryKey(),
      }));

      // @ts-expect-error composite primary key
      table.find(1);
    });

    it('should find one by primary key', () => {
      const q = User.all();
      const query = q.find(1);

      assertType<Awaited<typeof query>, UserRecord>();

      expectSql(
        query.toSQL(),
        `
            SELECT ${userColumnsSql} FROM "user"
            WHERE "user"."id" = $1
            LIMIT 1
        `,
        [1],
      );
      expectQueryNotMutated(q);
    });

    it('should find one by named primary key', () => {
      const q = Snake.find(1);

      expectSql(
        q.toSQL(),
        `
          SELECT ${snakeSelectAll} FROM "snake"
          WHERE "snake"."snake_id" = $1
          LIMIT 1
        `,
        [1],
      );
    });

    it('should accept raw sql', () => {
      const q = User.all();
      const query = q.find(testDb.sql`$a + $b`.values({ a: 1, b: 2 }));

      assertType<Awaited<typeof query>, UserRecord>();

      expectSql(
        query.toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" = $1 + $2
          LIMIT 1
        `,
        [1, 2],
      );
      expectQueryNotMutated(q);
    });

    it.each([undefined, null])('should throw if %s is passed', (value) => {
      expect(() => User.find(value as unknown as number)).toThrow(
        `${value} is not allowed in the find method`,
      );
    });
  });

  describe('findOptional', () => {
    it('should find optional one by primary key', () => {
      const q = User.all();
      const query = q.findOptional(1);

      assertType<Awaited<typeof query>, UserRecord | undefined>();

      expectSql(
        query.toSQL(),
        `
            SELECT ${userColumnsSql} FROM "user"
            WHERE "user"."id" = $1
            LIMIT 1
        `,
        [1],
      );
      expectQueryNotMutated(q);
    });

    it('should find optional one by named primary key', () => {
      const q = Snake.findOptional(1);

      expectSql(
        q.toSQL(),
        `
          SELECT ${snakeSelectAll} FROM "snake"
          WHERE "snake"."snake_id" = $1
          LIMIT 1
        `,
        [1],
      );
    });

    it('should accept raw sql', () => {
      const q = User.all();
      const query = q.findOptional(testDb.sql`$a + $b`.values({ a: 1, b: 2 }));

      assertType<Awaited<typeof query>, UserRecord | undefined>();

      expectSql(
        query.toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" = $1 + $2
          LIMIT 1
        `,
        [1, 2],
      );
      expectQueryNotMutated(q);
    });

    it('should accept raw sql with template literal', () => {
      const q = User.all();
      const query = q.findOptional(testDb.sql`${1} + ${2}`);

      assertType<Awaited<typeof query>, UserRecord | undefined>();

      expectSql(
        query.toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          WHERE "user"."id" = $1 + $2
          LIMIT 1
        `,
        [1, 2],
      );
      expectQueryNotMutated(q);
    });
  });

  describe('findBy', () => {
    it('should be like where but with take', () => {
      const q = User.all();

      const query = q.findBy({ name: 's' });

      assertType<Awaited<typeof query>, UserRecord>();

      expectSql(
        query.toSQL(),
        `SELECT ${userColumnsSql} FROM "user" WHERE "user"."name" = $1 LIMIT 1`,
        ['s'],
      );

      expectQueryNotMutated(q);
    });

    it('should accept raw', () => {
      const q = User.all();

      const query = q.findBy({ name: testDb.sql<string>`'string'` });

      assertType<Awaited<typeof query>, UserRecord>();

      expectSql(
        query.toSQL(),
        `SELECT ${userColumnsSql} FROM "user" WHERE "user"."name" = 'string' LIMIT 1`,
      );

      expectQueryNotMutated(q);
    });

    it('should throw on empty object', () => {
      expect(() => User.findBy({} as never)).toThrow(
        'findBy was called with empty object',
      );
    });

    it('should throw on undefined', () => {
      expect(() => User.findBy({ name: undefined as never })).toThrow(
        'findBy was called with undefined value',
      );
    });
  });

  describe('findByOptional', () => {
    it('should be an optional `findBy`', () => {
      const q = User.all();
      const query = q.findByOptional({ id: 1 });

      assertType<Awaited<typeof query>, UserRecord | undefined>();

      expectSql(
        query.toSQL(),
        `SELECT ${userColumnsSql} FROM "user" WHERE "user"."id" = $1 LIMIT 1`,
        [1],
      );

      expectQueryNotMutated(q);
    });

    it('should accept raw', () => {
      const q = User.all();
      const query = q.findByOptional({ id: testDb.sql<number>`1` });

      assertType<Awaited<typeof query>, UserRecord | undefined>();

      expectSql(
        query.toSQL(),
        `SELECT ${userColumnsSql} FROM "user" WHERE "user"."id" = 1 LIMIT 1`,
      );

      expectQueryNotMutated(q);
    });

    it('should throw on empty object', () => {
      expect(() => User.findByOptional({} as never)).toThrow(
        'findByOptional was called with empty object',
      );
    });

    it('should throw on undefined', () => {
      expect(() => User.findByOptional({ name: undefined as never })).toThrow(
        'findByOptional was called with undefined value',
      );
    });
  });

  describe('findBySql', () => {
    it('should find one by sql', () => {
      const q = User.findBySql`sql`;

      assertType<Awaited<typeof q>, UserRecord>();

      expectSql(
        q.toSQL(),
        `SELECT ${userColumnsSql} FROM "user" WHERE (sql) LIMIT 1`,
      );
    });
  });

  describe('findBySqlOptional', () => {
    it('should find one optional by sql', () => {
      const q = User.findBySqlOptional`sql`;

      assertType<Awaited<typeof q>, UserRecord | undefined>();

      expectSql(
        q.toSQL(),
        `SELECT ${userColumnsSql} FROM "user" WHERE (sql) LIMIT 1`,
      );
    });
  });

  describe('as', () => {
    it('should set table alias', () => {
      const q = User.all();
      expectSql(
        q.select('id').as('as').toSQL(),
        'SELECT "as"."id" FROM "user" "as"',
      );
      expectQueryNotMutated(q);
    });

    it('should apply the latest table alias to SQL', () => {
      const q = User.as('u').select('u.id').as('user').select('user.name');

      expectSql(q.toSQL(), `SELECT "user"."id", "user"."name" FROM "user"`);
    });
  });

  describe('withSchema', () => {
    it('prefixes table with schema', () => {
      const Country = testDb(
        'country',
        (t) => ({
          id: t.serial().primaryKey(),
          name: t.text(),
        }),
        undefined,
        {
          schema: 'geo',
        },
      );

      const City = testDb('city', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        countryId: t.integer(),
      }));

      const q = City.all();

      expectSql(
        q
          .join(Country, 'country.id', '=', 'city.countryId')
          .select('name', { countryName: 'country.name' })
          .withSchema('geo')
          .toSQL(),
        `
          SELECT "city"."name", "country"."name" "countryName"
          FROM "geo"."city"
          JOIN "geo"."country" ON "country"."id" = "city"."country_id"
        `,
      );
    });
  });

  describe('wrap', () => {
    it('should wrap query with another', () => {
      const q = User.all();

      expectSql(
        q.select('id').wrap(User.select('id')).toSQL(),
        'SELECT "t"."id" FROM (SELECT "user"."id" FROM "user") "t"',
      );

      expectQueryNotMutated(q);
    });

    it('should accept `as` parameter', () => {
      const q = User.all();

      expectSql(
        q.select('id').wrap(User.select('id'), 'wrapped').toSQL(),
        'SELECT "wrapped"."id" FROM (SELECT "user"."id" FROM "user") "wrapped"',
      );

      expectQueryNotMutated(q);
    });

    it('should wrap query with named columns', () => {
      const q = Snake.select('snakeName').wrap(Snake.select('snakeName'));

      expectSql(
        q.toSQL(),
        `
          SELECT "t"."snakeName"
          FROM (
            SELECT "snake"."snake_name" "snakeName"
            FROM "snake"
          ) "t"
        `,
      );
    });
  });

  describe('group', () => {
    it('should group by columns', () => {
      const q = User.all();

      expectSql(
        q.select('id', 'name').group('id', 'name').toSQL(),
        `
          SELECT "user"."id", "user"."name" FROM "user"
          GROUP BY "user"."id", "user"."name"
        `,
      );

      expectQueryNotMutated(q);
    });

    it('should group by named columns', () => {
      const q = Snake.select('snakeName', 'tailLength').group(
        'snakeName',
        'tailLength',
      );

      expectSql(
        q.toSQL(),
        `
          SELECT "snake"."snake_name" "snakeName", "snake"."tail_length" "tailLength" FROM "snake"
          GROUP BY "snake"."snake_name", "snake"."tail_length"
        `,
      );
    });

    it('should group by raw sql', () => {
      const q = User.clone();
      const expectedSql = `
        SELECT "user"."id", "user"."name" FROM "user"
        GROUP BY id, name
      `;
      expectSql(
        q
          .select('id', 'name')
          .group(testDb.sql`id`, testDb.sql`name`)
          .toSQL(),
        expectedSql,
      );
      expectQueryNotMutated(q);
    });

    it('should group by selected value', () => {
      const q = User.select({
        month: sql<string>`extract(month from "created_at)`,
      }).group('month');

      assertType<Awaited<typeof q>, { month: string }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT extract(month from "created_at) "month"
          FROM "user"
          GROUP BY 1
        `,
      );
    });

    it('should use positional reference when grouping by selected column', () => {
      const q = User.select({ name: 'id' }).group('name');

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id" "name" FROM "user"
          GROUP BY 1
        `,
      );
    });
  });

  describe('window', () => {
    it('should add window which can be used in `over`', () => {
      const q = User.all();

      expectSql(
        q
          .window({
            w: {
              partitionBy: 'id',
              order: {
                id: 'DESC',
              },
            },
          })
          .select({
            avg: (q) =>
              q.avg('id', {
                over: 'w',
              }),
          })
          .toSQL(),
        `
          SELECT avg("user"."id") OVER "w" "avg" FROM "user"
          WINDOW "w" AS (PARTITION BY "user"."id" ORDER BY "user"."id" DESC)
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should add window partitioned by named columns', () => {
      const q = Snake.window({
        w: {
          partitionBy: 'snakeName',
          order: {
            tailLength: 'DESC',
          },
        },
      }).select({ avg: (q) => q.avg('tailLength', { over: 'w' }) });

      expectSql(
        q.toSQL(),
        `
          SELECT avg("snake"."tail_length") OVER "w" "avg" FROM "snake"
          WINDOW "w" AS (PARTITION BY "snake"."snake_name" ORDER BY "snake"."tail_length" DESC)
        `,
      );
    });

    it('adds window with raw sql', () => {
      const q = User.all();

      const windowSql = 'PARTITION BY id ORDER BY name DESC';
      expectSql(
        q
          .window({ w: testDb.sql({ raw: windowSql }) })
          .select({
            avg: (q) =>
              q.avg('id', {
                over: 'w',
              }),
          })
          .toSQL(),
        `
        SELECT avg("user"."id") OVER "w" "avg" FROM "user"
        WINDOW "w" AS (PARTITION BY id ORDER BY name DESC)
      `,
      );
      expectQueryNotMutated(q);
    });
  });

  describe('order', () => {
    it('should add order by column ASC when string is provided', () => {
      const q = User.all();

      expectSql(
        q.order('id', 'name').toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          ORDER BY "user"."id" ASC, "user"."name" ASC
        `,
      );

      expectQueryNotMutated(q);
    });

    it('should order by named columns', () => {
      const q = Snake.order('snakeName', 'tailLength');

      expectSql(
        q.toSQL(),
        `
          SELECT ${snakeSelectAll} FROM "snake"
          ORDER BY "snake"."snake_name" ASC, "snake"."tail_length" ASC
        `,
      );
    });

    it('should handle object parameter', () => {
      const q = User.all();

      expectSql(
        q.order({ id: 'ASC', name: 'DESC' }).toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          ORDER BY "user"."id" ASC, "user"."name" DESC
        `,
      );

      expectSql(
        q
          .order({
            id: 'ASC NULLS FIRST',
            name: 'DESC NULLS LAST',
          })
          .toSQL(),
        `
          SELECT ${userColumnsSql} FROM "user"
          ORDER BY "user"."id" ASC NULLS FIRST, "user"."name" DESC NULLS LAST
        `,
      );

      expectQueryNotMutated(q);
    });

    it('should order by object with named columns', () => {
      expectSql(
        Snake.order({ snakeName: 'ASC', tailLength: 'DESC' }).toSQL(),
        `
          SELECT ${snakeSelectAll} FROM "snake"
          ORDER BY "snake"."snake_name" ASC, "snake"."tail_length" DESC
        `,
      );

      expectSql(
        Snake.order({
          snakeName: 'ASC NULLS FIRST',
          tailLength: 'DESC NULLS LAST',
        }).toSQL(),
        `
          SELECT ${snakeSelectAll} FROM "snake"
          ORDER BY "snake"."snake_name" ASC NULLS FIRST, "snake"."tail_length" DESC NULLS LAST
        `,
      );
    });

    it('adds order with raw sql', () => {
      const q = User.all();
      expectSql(
        q.order(testDb.sql`id ASC NULLS FIRST`).toSQL(),
        `
        SELECT ${userColumnsSql} FROM "user"
        ORDER BY id ASC NULLS FIRST
      `,
      );
      expectQueryNotMutated(q);
    });

    it('should be able to order by a selected value in a sub-query', () => {
      const q = User.select({
        count: () => User.count(),
      }).order('count');

      expectSql(
        q.toSQL(),
        `
          SELECT (SELECT count(*) FROM "user") "count"
          FROM "user"
          ORDER BY "count" ASC
        `,
      );
    });

    it('should disallow ordering by sub-selected json object or arrays', () => {
      User.select({
        obj: () => User.take(),
      })
        // @ts-expect-error should disallow ordering by object
        .order('obj.name')
        // @ts-expect-error should disallow ordering by object
        .order('obj');

      User.select({
        arr: () => User.all(),
        // @ts-expect-error should disallow ordering by array
      }).order('arr');
    });

    it('should not prefix the column when it is customly selected', () => {
      const q = User.select({ name: 'id' }).order('name');

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id" "name" FROM "user"
          ORDER BY "name" ASC
        `,
      );
    });

    it('should order by relation single record column, it is implicitly joined', () => {
      const q = db.user
        .select({
          profile: (q) => q.profile.select('Bio'),
        })
        .order('profile.Bio');

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json("profile".*) "profile"
          FROM "user"
          LEFT JOIN LATERAL (
            SELECT "profile"."bio" "Bio"
            FROM "profile"
            WHERE "profile"."user_id" = "user"."id"
              AND "profile"."profile_key" = "user"."user_key"
          ) "profile" ON true
          ORDER BY "profile"."Bio" ASC
        `,
      );
    });
  });

  describe('orderSql', () => {
    it('adds order with raw sql template literal', () => {
      const q = User.all();

      expectSql(
        q.orderSql`id ASC NULLS FIRST`.toSQL(),
        `
        SELECT ${userColumnsSql} FROM "user"
        ORDER BY id ASC NULLS FIRST
      `,
      );
      expectQueryNotMutated(q);
    });
  });

  describe('limit', () => {
    it('should set limit', () => {
      const q = User.all();
      expectSql(
        q.limit(5).toSQL(),
        `SELECT ${userColumnsSql} FROM "user" LIMIT $1`,
        [5],
      );
      expectQueryNotMutated(q);
    });

    it('should reset limit', () => {
      const q = User.all();
      expectSql(
        q.limit(undefined).toSQL(),
        `SELECT ${userColumnsSql} FROM "user"`,
      );
      expectQueryNotMutated(q);
    });
  });

  describe('offset', () => {
    it('should set offset', () => {
      const q = User.all();
      expectSql(
        q.offset(5).toSQL(),
        `SELECT ${userColumnsSql} FROM "user" OFFSET $1`,
        [5],
      );
      expectQueryNotMutated(q);
    });

    it('should reset offset', () => {
      const q = User.all();
      expectSql(
        q.offset(undefined).toSQL(),
        `SELECT ${userColumnsSql} FROM "user"`,
      );
      expectQueryNotMutated(q);
    });
  });

  describe('exists', () => {
    it('should discard previous select, select 1 and transform to boolean', async () => {
      const q = User.all();
      const query = q.select('id').exists();
      assertType<Awaited<typeof query>, boolean>();

      expect(await query).toBe(false);

      await User.create(userData);

      expect(await query).toBe(true);

      expectSql(query.toSQL(), 'SELECT true FROM "user" LIMIT 1');

      expectQueryNotMutated(q);
    });
  });

  describe('truncate', () => {
    it('should truncate table', () => {
      const q = User.all();
      expectSql(q.truncate().toSQL(), 'TRUNCATE "user"');
      expectQueryNotMutated(q);
    });

    it('should handle restart identity and cascade options', () => {
      const q = User.all();
      expectSql(
        q.truncate({ restartIdentity: true, cascade: true }).toSQL(),
        'TRUNCATE "user" RESTART IDENTITY CASCADE',
      );
      expectQueryNotMutated(q);
    });
  });

  describe('useHelper', () => {
    it('should have type error when applying a function for a wrong table', async () => {
      const modifier = User.makeHelper((q) => q.select('name'));

      // @ts-expect-error wrong table
      Profile.useHelper(modifier);
    });

    it('should modify a query by using a helper', () => {
      const modifier = User.makeHelper((q) =>
        q.select('name').where({ name: 'name' }),
      );

      const q = User.select('id').useHelper(modifier);

      assertType<Awaited<typeof q>, { id: number; name: string }[]>();
      assertType<typeof q.meta.hasWhere, true>();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id", "user"."name"
          FROM "user"
          WHERE "user"."name" = $1
        `,
        ['name'],
      );
    });

    it('should be able to return a union type of query', async () => {
      const modifier = User.makeHelper((q, param: boolean) => {
        if (param) {
          return q.select('name');
        } else {
          return q.select('age');
        }
      });

      const q = User.select('id').useHelper(modifier, true);

      assertType<
        Awaited<typeof q>,
        ({ id: number; name: string } | { id: number; age: number | null })[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id", "user"."name"
          FROM "user"
        `,
      );
    });

    it('should work inside a where function', async () => {
      const a = User.makeHelper((q) => q.where({ id: 1 }));
      const b = User.makeHelper((q) => q.where({ name: 'name' }));

      const q = a(User.select('id')).where((q) => q.useHelper(b));

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id"
          FROM "user"
          WHERE "user"."id" = $1 AND ("user"."name" = $2)
        `,
        [1, 'name'],
      );
    });
  });

  describe('modify', () => {
    it('should modify a query', () => {
      const q = User.select('id').modify((q) =>
        q.select('name').where({ name: 'name' }),
      );

      assertType<Awaited<typeof q>, { id: number; name: string }[]>();
      assertType<typeof q.meta.hasWhere, true>();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id", "user"."name"
          FROM "user"
          WHERE "user"."name" = $1
        `,
        ['name'],
      );
    });

    it('should be able to return a union type of query', async () => {
      const param = true;

      const q = User.select('id').modify((q) => {
        if (param) {
          return q.select('name');
        } else {
          return q.select('age');
        }
      });

      q.then((res) => res);

      assertType<
        Awaited<typeof q>,
        { id: number; name: string }[] | { id: number; age: number | null }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id", "user"."name"
          FROM "user"
        `,
      );
    });

    it('should work inside a where function', async () => {
      const q = User.select('id').modify((q) =>
        q
          .where({ id: 1 })
          .modify((q) => q.modify((q) => q.where({ name: 'name' }))),
      );

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."id"
          FROM "user"
          WHERE "user"."id" = $1 AND "user"."name" = $2
        `,
        [1, 'name'],
      );
    });
  });

  describe('narrowType', () => {
    it('should narrow the type of selection', () => {
      const q = User.select('name').narrowType()<{ name: 'name' }>();

      assertType<Awaited<typeof q>, { name: 'name' }[]>();
    });

    it('should fail to narrow if the type does not match', () => {
      const q = User.select('name').narrowType()<{ id: 1; name: 2 }>();

      assertType<
        typeof q,
        | `narrowType() error: provided type does not extend the 'name' column type`
        | `narrowType() error: provided type does not extend the 'id' column type`
      >();
    });

    it('should narrow the type of `get`', () => {
      const q = User.get('name').narrowType()<'name'>();

      assertType<Awaited<typeof q>, 'name'>();
    });

    it('should fail to narrow `get` if the type does not match', () => {
      const q = User.get('name').narrowType()<1>();

      assertType<
        Awaited<typeof q>,
        'narrowType() error: provided type does not extend the returning column column type'
      >();
    });

    it('should narrow the type of `pluck`', () => {
      const q = User.pluck('name').narrowType()<'name'[]>();

      assertType<Awaited<typeof q>, 'name'[]>();
    });

    it('should fail to narrow `get` if the type does not match', () => {
      const q = User.pluck('name').narrowType()<1[]>();

      assertType<
        Awaited<typeof q>,
        'narrowType() error: provided type does not extend the returning column column type'
      >();
    });
  });

  describe('makeHelper', () => {
    it('should make a query helper', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const fn = User.makeHelper((q, _: boolean) => q.select('id'));
      const q = fn(User.select('name'), true);

      assertType<Awaited<typeof q>, { id: number; name: string }[]>();
    });

    it('QueryHelperResult type should be fine', () => {
      const helper = User.makeHelper((q, param?: string) =>
        q.where({ name: param }),
      );

      assertType<Awaited<QueryHelperResult<typeof helper>>, UserRecord[]>();
    });
  });

  describe('narrowType', () => {
    it('should narrow a result type', () => {
      const q = User.select('id').where({ id: 123 }).narrowType()<{
        id: 123;
      }>();

      assertType<Awaited<typeof q>, { id: 123 }[]>();
    });
  });

  describe('if', () => {
    it('should execute callback based on the condition', () => {
      const q1 = User.select('id').if(false, (q) => q.select('name'));

      expectSql(q1.toSQL(), `SELECT "user"."id" FROM "user"`);

      const q2 = User.select('id').if(true, (q) => q.select('name'));

      expectSql(q2.toSQL(), `SELECT "user"."id", "user"."name" FROM "user"`);
    });

    it('should add optional selection', () => {
      const q = User.select('id', 'name').if(true, (q) =>
        q.select('name', 'password', 'active'),
      );

      assertType<
        Awaited<typeof q>,
        {
          id: number;
          name: string;
          password?: string;
          active?: boolean | null;
        }[]
      >();
    });

    it('should handle a query returning a plain value', () => {
      const q = User.get('id').if(true, (q) => q.get('name'));

      assertType<Awaited<typeof q>, number | string>();

      const q2 = q.if(true, (q) => q.get('active'));

      assertType<Awaited<typeof q2>, number | string | boolean | null>();
    });
  });
});
