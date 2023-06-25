import {
  expectQueryNotMutated,
  User,
  Profile,
  userData,
  UserRecord,
  Snake,
  snakeSelectAll,
} from '../test-utils/test-utils';
import { NotFoundError } from '../errors';
import {
  assertType,
  expectSql,
  now,
  testAdapter,
  testDb,
  useTestDatabase,
} from 'test-utils';

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

  describe('toSql', () => {
    it('generates sql', () => {
      const sql = User.toSql();

      expectSql(sql, `SELECT * FROM "user"`);

      assertType<typeof sql, { text: string; values: unknown[] }>();
    });
  });

  describe('.all', () => {
    it('should produce correct sql', () => {
      expectSql(User.all().toSql(), `SELECT * FROM "user"`);
    });
  });

  describe('take', () => {
    it('limits to one and returns only one', async () => {
      await User.create(userData);

      const q = User.all();

      expectSql(q.take().toSql(), `SELECT * FROM "user" LIMIT 1`);
      expectQueryNotMutated(q);

      const expected = await testAdapter
        .query('SELECT * FROM "user" LIMIT 1')
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
  });

  describe('takeOptional', () => {
    it('limits to one and returns only one', async () => {
      await User.create(userData);

      const q = User.all();

      expectSql(q.takeOptional().toSql(), `SELECT * FROM "user" LIMIT 1`);
      expectQueryNotMutated(q);

      const expected = await testAdapter
        .query('SELECT * FROM "user" LIMIT 1')
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
  });

  describe('rows', () => {
    it('returns array of rows', async () => {
      const { rows: expected } = await testAdapter.arrays({
        text: 'SELECT * FROM "user"',
      });

      const received = await User.rows();

      expect(received).toEqual(expected);
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

      expectSql(q.distinct().toSql(), 'SELECT DISTINCT * FROM "user"');

      expectQueryNotMutated(q);
    });

    it('should add distinct on columns', () => {
      const q = User.all();

      expectSql(
        q.distinct('id', 'user.name').toSql(),
        `
          SELECT DISTINCT ON ("user"."id", "user"."name") *
          FROM "user"
        `,
      );

      expectQueryNotMutated(q);
    });

    it('should add distinct on named columns', () => {
      const q = Snake.distinct('snakeName', 'snake.tailLength');

      expectSql(
        q.toSql(),
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
          .toSql(),
        `
          SELECT DISTINCT ON ("user"."id", "profile"."userId") "user".*
          FROM "user"
          JOIN "profile" ON "profile"."userId" = "user"."id"
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
        q.toSql(),
        `
          SELECT DISTINCT ON ("user"."id", "snake"."tail_length") "user".*
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
          .toSql(),
        `
          SELECT DISTINCT ON ("user"."id", "p"."userId") "user".*
          FROM "user"
          JOIN "profile" AS "p" ON "p"."userId" = "user"."id"
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
        q.toSql(),
        `
          SELECT DISTINCT ON ("user"."id", "s"."tail_length") "user".*
          FROM "user"
          JOIN "snake" AS "s" ON "s"."tail_length" = "user"."id"
        `,
      );
    });

    it('should add distinct on raw sql', () => {
      const q = User.all();
      expectSql(
        q.distinct(testDb.sql`"user".id`).toSql(),
        `
          SELECT DISTINCT ON ("user".id) * FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });
  });

  describe('find', () => {
    it('should find one by primary key', () => {
      const q = User.all();
      const query = q.find(1);

      assertType<Awaited<typeof query>, UserRecord>();

      expectSql(
        query.toSql(),
        `
            SELECT * FROM "user"
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
        q.toSql(),
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
        query.toSql(),
        `
          SELECT * FROM "user"
          WHERE "user"."id" = $1 + $2
          LIMIT 1
        `,
        [1, 2],
      );
      expectQueryNotMutated(q);
    });

    it('should accept raw sql with template literal', () => {
      const q = User.all();
      const query = q.find`${1} + ${2}`;

      assertType<Awaited<typeof query>, UserRecord>();

      expectSql(
        query.toSql(),
        `
          SELECT * FROM "user"
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
        query.toSql(),
        `
            SELECT * FROM "user"
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
        q.toSql(),
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
        query.toSql(),
        `
          SELECT * FROM "user"
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
        query.toSql(),
        `
          SELECT * FROM "user"
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
      expectSql(
        q.findBy({ name: 's' }).toSql(),
        `SELECT * FROM "user" WHERE "user"."name" = $1 LIMIT 1`,
        ['s'],
      );
      expectQueryNotMutated(q);
    });

    it('should accept raw', () => {
      const q = User.all();
      expectSql(
        q.findBy({ name: testDb.sql`'string'` }).toSql(),
        `SELECT * FROM "user" WHERE "user"."name" = 'string' LIMIT 1`,
      );
      expectQueryNotMutated(q);
    });
  });

  describe('findByOptional', () => {
    it('like where but with take', () => {
      const q = User.all();
      const query = q.findByOptional({ name: 's' });

      assertType<Awaited<typeof query>, UserRecord | undefined>();

      expectSql(
        query.toSql(),
        `SELECT * FROM "user" WHERE "user"."name" = $1 LIMIT 1`,
        ['s'],
      );
      expectQueryNotMutated(q);
    });

    it('should accept raw', () => {
      const q = User.all();
      const query = q.findByOptional({ name: testDb.sql`'string'` });

      assertType<Awaited<typeof query>, UserRecord | undefined>();

      expectSql(
        query.toSql(),
        `SELECT * FROM "user" WHERE "user"."name" = 'string' LIMIT 1`,
      );
      expectQueryNotMutated(q);
    });
  });

  describe('as', () => {
    it('sets table alias', () => {
      const q = User.all();
      expectSql(
        q.select('id').as('as').toSql(),
        'SELECT "as"."id" FROM "user" AS "as"',
      );
      expectQueryNotMutated(q);
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
          .toSql(),
        `
          SELECT "city"."name", "country"."name" AS "countryName"
          FROM "geo"."city"
          JOIN "geo"."country" ON "country"."id" = "city"."countryId"
        `,
      );

      expectQueryNotMutated(q);
    });
  });

  describe('wrap', () => {
    it('should wrap query with another', () => {
      const q = User.all();

      expectSql(
        q.select('id').wrap(User.select('id')).toSql(),
        'SELECT "t"."id" FROM (SELECT "user"."id" FROM "user") AS "t"',
      );

      expectQueryNotMutated(q);
    });

    it('should accept `as` parameter', () => {
      const q = User.all();

      expectSql(
        q.select('id').wrap(User.select('id'), 'wrapped').toSql(),
        'SELECT "wrapped"."id" FROM (SELECT "user"."id" FROM "user") AS "wrapped"',
      );

      expectQueryNotMutated(q);
    });

    it('should wrap query with named columns', () => {
      const q = Snake.select('snakeName').wrap(Snake.select('snakeName'));

      expectSql(
        q.toSql(),
        `
          SELECT "t"."snakeName"
          FROM (
            SELECT "snake"."snake_name" AS "snakeName"
            FROM "snake"
          ) AS "t"
        `,
      );
    });
  });

  describe('group', () => {
    it('should group by columns', () => {
      const q = User.all();

      expectSql(
        q.group('id', 'name').toSql(),
        `
          SELECT * FROM "user"
          GROUP BY "user"."id", "user"."name"
        `,
      );

      expectQueryNotMutated(q);
    });

    it('should group by named columns', () => {
      const q = Snake.group('snakeName', 'tailLength');

      expectSql(
        q.toSql(),
        `
          SELECT ${snakeSelectAll} FROM "snake"
          GROUP BY "snake"."snake_name", "snake"."tail_length"
        `,
      );
    });

    it('should group by raw sql', () => {
      const q = User.clone();
      const expectedSql = `
        SELECT * FROM "user"
        GROUP BY id, name
      `;
      expectSql(q.group(testDb.sql`id`, testDb.sql`name`).toSql(), expectedSql);
      expectQueryNotMutated(q);

      q._group(testDb.sql`id`, testDb.sql`name`);
      expectSql(q.toSql({ clearCache: true }), expectedSql);
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
          .selectAvg('id', {
            over: 'w',
          })
          .toSql(),
        `
          SELECT avg("user"."id") OVER "w" FROM "user"
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
      }).selectAvg('tailLength', { over: 'w' });

      expectSql(
        q.toSql(),
        `
          SELECT avg("snake"."tail_length") OVER "w" FROM "snake"
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
          .selectAvg('id', {
            over: 'w',
          })
          .toSql(),
        `
        SELECT avg("user"."id") OVER "w" FROM "user"
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
        q.order('id', 'name').toSql(),
        `
          SELECT * FROM "user"
          ORDER BY "user"."id" ASC, "user"."name" ASC
        `,
      );

      expectQueryNotMutated(q);
    });

    it('should order by named columns', () => {
      const q = Snake.order('snakeName', 'tailLength');

      expectSql(
        q.toSql(),
        `
          SELECT ${snakeSelectAll} FROM "snake"
          ORDER BY "snake"."snake_name" ASC, "snake"."tail_length" ASC
        `,
      );
    });

    it('should handle object parameter', () => {
      const q = User.all();

      expectSql(
        q.order({ id: 'ASC', name: 'DESC' }).toSql(),
        `
          SELECT * FROM "user"
          ORDER BY "user"."id" ASC, "user"."name" DESC
        `,
      );

      expectSql(
        q
          .order({
            id: 'ASC NULLS FIRST',
            name: 'DESC NULLS LAST',
          })
          .toSql(),
        `
          SELECT * FROM "user"
          ORDER BY "user"."id" ASC NULLS FIRST, "user"."name" DESC NULLS LAST
        `,
      );

      expectQueryNotMutated(q);
    });

    it('should order by object with named columns', () => {
      expectSql(
        Snake.order({ snakeName: 'ASC', tailLength: 'DESC' }).toSql(),
        `
          SELECT ${snakeSelectAll} FROM "snake"
          ORDER BY "snake"."snake_name" ASC, "snake"."tail_length" DESC
        `,
      );

      expectSql(
        Snake.order({
          snakeName: 'ASC NULLS FIRST',
          tailLength: 'DESC NULLS LAST',
        }).toSql(),
        `
          SELECT ${snakeSelectAll} FROM "snake"
          ORDER BY "snake"."snake_name" ASC NULLS FIRST, "snake"."tail_length" DESC NULLS LAST
        `,
      );
    });

    it('adds order with raw sql', () => {
      const q = User.all();
      expectSql(
        q.order(testDb.sql`id ASC NULLS FIRST`).toSql(),
        `
        SELECT * FROM "user"
        ORDER BY id ASC NULLS FIRST
      `,
      );
      expectQueryNotMutated(q);
    });

    it('adds order with raw sql template literal', () => {
      const q = User.all();
      expectSql(
        q.order`id ASC NULLS FIRST`.toSql(),
        `
        SELECT * FROM "user"
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
        q.toSql(),
        `
          SELECT (SELECT count(*) FROM "user") AS "count"
          FROM "user"
          ORDER BY "count" ASC
        `,
      );
    });

    it('should disallow ordering by sub-selected json object or arrays', () => {
      User.select({
        obj: () => User.take(),
        // @ts-expect-error should disallow ordering by object
      }).order('obj');

      User.select({
        arr: () => User.all(),
        // @ts-expect-error should disallow ordering by array
      }).order('arr');
    });
  });

  describe('limit', () => {
    it('should set limit', () => {
      const q = User.all();
      expectSql(q.limit(5).toSql(), 'SELECT * FROM "user" LIMIT $1', [5]);
      expectQueryNotMutated(q);
    });

    it('should reset limit', () => {
      const q = User.all();
      expectSql(q.limit(undefined).toSql(), 'SELECT * FROM "user"');
      expectQueryNotMutated(q);
    });
  });

  describe('offset', () => {
    it('should set offset', () => {
      const q = User.all();
      expectSql(q.offset(5).toSql(), 'SELECT * FROM "user" OFFSET $1', [5]);
      expectQueryNotMutated(q);
    });

    it('should reset offset', () => {
      const q = User.all();
      expectSql(q.offset(undefined).toSql(), 'SELECT * FROM "user"');
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

      expectSql(query.toSql(), 'SELECT true FROM "user" LIMIT 1');

      expectQueryNotMutated(q);
    });
  });

  describe('truncate', () => {
    it('should truncate table', () => {
      const q = User.all();
      expectSql(q.truncate().toSql(), 'TRUNCATE "user"');
      expectQueryNotMutated(q);
    });

    it('should handle restart identity and cascade options', () => {
      const q = User.all();
      expectSql(
        q.truncate({ restartIdentity: true, cascade: true }).toSql(),
        'TRUNCATE "user" RESTART IDENTITY CASCADE',
      );
      expectQueryNotMutated(q);
    });
  });

  describe('makeHelper', () => {
    it('should make a query helper', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const fn = User.makeHelper((q, _: boolean) => q.select('id'));
      const q = fn(User.select('name'), true);

      assertType<Awaited<typeof q>, { id: number; name: string }[]>();
    });
  });
});
