import {
  expectQueryNotMutated,
  User,
  Profile,
  userData,
  UserRecord,
  Snake,
  snakeSelectAll,
  userColumnsSql,
} from '../test-utils/pqb.test-utils';
import {
  assertType,
  expectSql,
  now,
  sql,
  testAdapter,
  testDb,
  useTestDatabase,
} from 'test-utils';
import { NotFoundError } from './errors';
import { QueryHelperResult } from './query-methods';
import { Sql } from './sql/sql';

describe('queryMethods', () => {
  useTestDatabase();

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
