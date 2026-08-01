import {
  expectQueryNotMutated,
  Snake,
  snakeSelectAll,
} from '../test-utils/pqb.test-utils';
import {
  assertType,
  db,
  expectSql,
  sql,
  testAdapter,
  testDb,
  useTestDatabase,
  UserData,
  UserDefaultSelect,
  UserSelectAll,
} from 'test-utils';
import { NotFoundError } from './errors';
import { QueryHelperResult } from './query-methods';
import { Sql } from './sql/sql';

describe('queryMethods', () => {
  useTestDatabase();

  describe('toSQL', () => {
    it('generates sql', () => {
      const sql = db.user.toSQL();

      assertType<typeof sql, Sql>();

      expectSql(sql, `SELECT ${UserSelectAll} FROM "schema"."user" "User"`);
    });
  });

  describe('.all', () => {
    it('should produce correct sql', () => {
      expectSql(
        db.user.all().toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User"`,
      );
    });
  });

  describe('take', () => {
    it('limits to one and returns only one', async () => {
      await db.user.create(UserData);

      const q = db.user.all();

      expectSql(
        q.take().toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" LIMIT 1`,
      );
      expectQueryNotMutated(q);

      const expected = await testAdapter
        .query(`SELECT ${UserSelectAll} FROM "schema"."user" LIMIT 1`)
        .then((res) => res.rows[0]);

      const user = await q.take();
      assertType<typeof user, UserDefaultSelect>();

      expect(user).toEqual({
        ...expected,
        createdAt: new Date(expected.createdAt),
        updatedAt: new Date(expected.updatedAt),
      });
    });

    it('should throw if not found', async () => {
      await expect(() => db.user.take()).rejects.toThrow(NotFoundError);
    });

    it('should change value to valueOrThrow', async () => {
      await db.user.insert(UserData);

      const q = db.user.getOptional('Id').take();
      const result = await q;

      assertType<typeof result, number>();

      expect(result).toEqual(expect.any(Number));
    });

    it('should leave valueOrThrow as is', async () => {
      await db.user.insert(UserData);

      const q = db.user.get('Id').take();
      const result = await q;

      assertType<typeof result, number>();

      expect(result).toEqual(expect.any(Number));
    });

    it('should change rows to oneOrThrow', async () => {
      await db.user.insert(UserData);

      const q = db.user.select('Id', 'Name').rows().take();
      const result = await q;

      assertType<typeof result, { Id: number; Name: string }>();

      expect(result).toEqual({ Id: expect.any(Number), Name: 'name' });
    });

    it('should leave void as is', async () => {
      await db.user.insert(UserData);

      const q = db.user.select('Id', 'Name').exec().take();
      const result = await q;

      assertType<typeof result, void>();

      expect(result).toBe(undefined);
    });
  });

  describe('takeOptional', () => {
    it('limits to one and returns only one', async () => {
      await db.user.create(UserData);

      const q = db.user.all();

      expectSql(
        q.takeOptional().toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" LIMIT 1`,
      );
      expectQueryNotMutated(q);

      const expected = await testAdapter
        .query(`SELECT ${UserSelectAll} FROM "schema"."user" LIMIT 1`)
        .then((res) => res.rows[0]);

      const user = await q.takeOptional();
      assertType<typeof user, UserDefaultSelect | undefined>();

      expect(user).toEqual({
        ...expected,
        createdAt: new Date(expected.createdAt),
        updatedAt: new Date(expected.updatedAt),
      });
    });

    it('should return undefined if not found', async () => {
      const user = await db.user.takeOptional();

      assertType<typeof user, UserDefaultSelect | undefined>();

      expect(user).toBe(undefined);
    });

    it('should change valueOrThrow to value', async () => {
      const q = db.user.get('Id').takeOptional();
      const result = await q;

      assertType<typeof result, number | undefined>();

      expect(result).toBe(undefined);
    });

    it('should leave value as is', async () => {
      const q = db.user.getOptional('Id').takeOptional();
      const result = await q;

      assertType<typeof result, number | undefined>();

      expect(result).toBe(undefined);
    });

    it('should change rows to one', async () => {
      const q = db.user.select('Id', 'Name').rows().takeOptional();
      const result = await q;

      assertType<typeof result, { Id: number; Name: string } | undefined>();

      expect(result).toBe(undefined);
    });

    it('should leave void as is', async () => {
      const q = db.user.select('Id', 'Name').exec().takeOptional();
      const result = await q;

      assertType<typeof result, void>();

      expect(result).toBe(undefined);
    });
  });

  describe('rows', () => {
    it('returns array of rows', async () => {
      await db.user.insert(UserData);

      const { rows: expected } = await testAdapter.arrays(
        `SELECT "id", "name" FROM "schema"."user"`,
      );

      const received = await db.user.select('Id', 'Name').rows();

      expect(received).toEqual(expected);
    });

    it('should be disabled in a sub-query', () => {
      const q = db.user.select({
        x: () => db.user.rows(),
      });

      assertType<typeof q, 'Invalid return type of x'>();
    });
  });

  describe('exec', () => {
    it('returns nothing', async () => {
      const received = await db.user.exec();

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
      const q = db.user.all();
      const query = q.find(1);

      assertType<Awaited<typeof query>, UserDefaultSelect>();

      expectSql(
        query.toSQL(),
        `
            SELECT ${UserSelectAll} FROM "schema"."user" "User"
            WHERE "User"."id" = $1
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
          SELECT ${snakeSelectAll} FROM "schema"."snake" "Snake"
          WHERE "Snake"."snake_id" = $1
          LIMIT 1
        `,
        [1],
      );
    });

    it('should accept raw sql', () => {
      const q = db.user.all();
      const query = q.find(testDb.sql`$a + $b`.values({ a: 1, b: 2 }));

      assertType<Awaited<typeof query>, UserDefaultSelect>();

      expectSql(
        query.toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user" "User"
          WHERE "User"."id" = $1 + $2
          LIMIT 1
        `,
        [1, 2],
      );
      expectQueryNotMutated(q);
    });

    it.each([undefined, null])('should throw if %s is passed', (value) => {
      expect(() => db.user.find(value as unknown as number)).toThrow(
        `${value} is not allowed in the find method`,
      );
    });
  });

  describe('findOptional', () => {
    it('should find optional one by primary key', () => {
      const q = db.user.all();
      const query = q.findOptional(1);

      assertType<Awaited<typeof query>, UserDefaultSelect | undefined>();

      expectSql(
        query.toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user" "User"
          WHERE "User"."id" = $1
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
          SELECT ${snakeSelectAll} FROM "schema"."snake" "Snake"
          WHERE "Snake"."snake_id" = $1
          LIMIT 1
        `,
        [1],
      );
    });

    it('should accept raw sql', () => {
      const q = db.user.all();
      const query = q.findOptional(testDb.sql`$a + $b`.values({ a: 1, b: 2 }));

      assertType<Awaited<typeof query>, UserDefaultSelect | undefined>();

      expectSql(
        query.toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user" "User"
          WHERE "User"."id" = $1 + $2
          LIMIT 1
        `,
        [1, 2],
      );
      expectQueryNotMutated(q);
    });

    it('should accept raw sql with template literal', () => {
      const q = db.user.all();
      const query = q.findOptional(testDb.sql`${1} + ${2}`);

      assertType<Awaited<typeof query>, UserDefaultSelect | undefined>();

      expectSql(
        query.toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user" "User"
          WHERE "User"."id" = $1 + $2
          LIMIT 1
        `,
        [1, 2],
      );
      expectQueryNotMutated(q);
    });
  });

  describe('findBy', () => {
    it('should be like where but with take', () => {
      const q = db.user.all();

      const query = q.findBy({ Id: 1 });

      assertType<Awaited<typeof query>, UserDefaultSelect>();

      expectSql(
        query.toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" WHERE "User"."id" = $1 LIMIT 1`,
        [1],
      );

      expectQueryNotMutated(q);
    });

    it('should accept raw', () => {
      const q = db.user.all();

      const query = q.findBy({ Id: testDb.sql<number>`1` });

      assertType<Awaited<typeof query>, UserDefaultSelect>();

      expectSql(
        query.toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" WHERE "User"."id" = 1 LIMIT 1`,
      );

      expectQueryNotMutated(q);
    });

    it('should throw on empty object', () => {
      expect(() => db.user.findBy({} as never)).toThrow(
        'findBy was called with empty object',
      );
    });

    it('should throw on undefined', () => {
      expect(() => db.user.findBy({ Id: undefined as never })).toThrow(
        'findBy was called with undefined value',
      );
    });
  });

  describe('findByOptional', () => {
    it('should be an optional `findBy`', () => {
      const q = db.user.all();
      const query = q.findByOptional({ Id: 1 });

      assertType<Awaited<typeof query>, UserDefaultSelect | undefined>();

      expectSql(
        query.toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" WHERE "User"."id" = $1 LIMIT 1`,
        [1],
      );

      expectQueryNotMutated(q);
    });

    it('should accept raw', () => {
      const q = db.user.all();
      const query = q.findByOptional({ Id: testDb.sql<number>`1` });

      assertType<Awaited<typeof query>, UserDefaultSelect | undefined>();

      expectSql(
        query.toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" WHERE "User"."id" = 1 LIMIT 1`,
      );

      expectQueryNotMutated(q);
    });

    it('should throw on empty object', () => {
      expect(() => db.user.findByOptional({} as never)).toThrow(
        'findByOptional was called with empty object',
      );
    });

    it('should throw on undefined', () => {
      expect(() => db.user.findByOptional({ Id: undefined as never })).toThrow(
        'findByOptional was called with undefined value',
      );
    });
  });

  describe('findBySql', () => {
    it('should find one by sql', () => {
      const q = db.user.findBySql`sql`;

      assertType<Awaited<typeof q>, UserDefaultSelect>();

      expectSql(
        q.toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" WHERE (sql) LIMIT 1`,
      );
    });
  });

  describe('findBySqlOptional', () => {
    it('should find one optional by sql', () => {
      const q = db.user.findBySqlOptional`sql`;

      assertType<Awaited<typeof q>, UserDefaultSelect | undefined>();

      expectSql(
        q.toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User" WHERE (sql) LIMIT 1`,
      );
    });
  });

  describe('as', () => {
    it('should set table alias', () => {
      const q = db.user.all();
      expectSql(
        q.select('Id').as('as').toSQL(),
        'SELECT "as"."id" "Id" FROM "schema"."user" "as"',
      );
      expectQueryNotMutated(q);
    });

    it('should apply the latest table alias to SQL', () => {
      const q = db.user.as('u').select('u.Id').as('user').select('user.Name');

      expectSql(
        q.toSQL(),
        `SELECT "user"."id" "Id", "user"."name" "Name" FROM "schema"."user"`,
      );
    });
  });

  describe('group', () => {
    it('should group by columns', () => {
      const q = db.user.all();

      expectSql(
        q.select('Id', 'Name').group('Id', 'Name').toSQL(),
        `
          SELECT "User"."id" "Id", "User"."name" "Name" FROM "schema"."user" "User"
          GROUP BY "User"."id", "User"."name"
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
          SELECT "Snake"."snake_name" "snakeName", "Snake"."tail_length" "tailLength" FROM "schema"."snake" "Snake"
          GROUP BY "Snake"."snake_name", "Snake"."tail_length"
        `,
      );
    });

    it('should group by raw sql', () => {
      const q = db.user.clone();
      const expectedSql = `
        SELECT "User"."id" "Id", "User"."name" "Name" FROM "schema"."user" "User"
        GROUP BY id, name
      `;
      expectSql(
        q
          .select('Id', 'Name')
          .group(testDb.sql`id`, testDb.sql`name`)
          .toSQL(),
        expectedSql,
      );
      expectQueryNotMutated(q);
    });

    it('should group by selected value', () => {
      const q = db.user
        .select({
          month: sql<string>`extract(month from "created_at")`,
        })
        .group('month');

      assertType<Awaited<typeof q>, { month: string }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT extract(month from "created_at") "month"
          FROM "schema"."user" "User"
          GROUP BY 1
        `,
      );
    });

    it('should use positional reference when grouping by selected column', () => {
      const q = db.user.select({ name: 'Id' }).group('name');

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "name" FROM "schema"."user" "User"
          GROUP BY 1
        `,
      );
    });
  });

  describe('useHelper', () => {
    it('should have type error when applying a function for a wrong table', async () => {
      const modifier = db.user.makeHelper((q) => q.select('Name'));

      // @ts-expect-error wrong table
      db.profile.useHelper(modifier);
    });

    it('should modify a query by using a helper', () => {
      const modifier = db.user.makeHelper((q) =>
        q.select('Name').where({ Name: 'name' }),
      );

      const q = db.user.select('Id').useHelper(modifier);

      assertType<Awaited<typeof q>, { Id: number; Name: string }[]>();
      assertType<typeof q.__hasWhere, true>();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id", "User"."name" "Name"
          FROM "schema"."user" "User"
          WHERE "User"."name" = $1
        `,
        ['name'],
      );
    });

    it('should be able to return a union type of query', async () => {
      const modifier = db.user.makeHelper((q, param: boolean) => {
        if (param) {
          return q.select('Name');
        } else {
          return q.select('Age');
        }
      });

      const q = db.user.select('Id').useHelper(modifier, true);

      assertType<
        Awaited<typeof q>,
        ({ Id: number; Name: string } | { Id: number; Age: string | null })[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id", "User"."name" "Name"
          FROM "schema"."user" "User"
        `,
      );
    });

    it('should work inside a where function', async () => {
      const a = db.user.makeHelper((q) => q.where({ Id: 1 }));
      const b = db.user.makeHelper((q) => q.where({ Name: 'name' }));

      const q = a(db.user.select('Id')).where((q) => q.useHelper(b));

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id"
          FROM "schema"."user" "User"
          WHERE "User"."id" = $1 AND ("User"."name" = $2)
        `,
        [1, 'name'],
      );
    });
  });

  describe('modify', () => {
    it('should modify a query', () => {
      const q = db.user
        .select('Id')
        .modify((q) => q.select('Name').where({ Name: 'name' }));

      assertType<Awaited<typeof q>, { Id: number; Name: string }[]>();
      assertType<typeof q.__hasWhere, true>();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id", "User"."name" "Name"
          FROM "schema"."user" "User"
          WHERE "User"."name" = $1
        `,
        ['name'],
      );
    });

    it('should be able to return a union type of query', async () => {
      const param = true;

      const q = db.user.select('Id').modify((q) => {
        if (param) {
          return q.select('Name');
        } else {
          return q.select('Age');
        }
      });

      q.then((res) => res);

      assertType<
        Awaited<typeof q>,
        { Id: number; Name: string }[] | { Id: number; Age: string | null }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id", "User"."name" "Name"
          FROM "schema"."user" "User"
        `,
      );
    });

    it('should work inside a where function', async () => {
      const q = db.user
        .select('Id')
        .modify((q) =>
          q
            .where({ Id: 1 })
            .modify((q) => q.modify((q) => q.where({ Name: 'name' }))),
        );

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id"
          FROM "schema"."user" "User"
          WHERE "User"."id" = $1 AND "User"."name" = $2
        `,
        [1, 'name'],
      );
    });
  });

  describe('narrowType', () => {
    it('should narrow the type of selection', () => {
      const q = db.user.select('Name').narrowType()<{ Name: 'name' }>();

      assertType<Awaited<typeof q>, { Name: 'name' }[]>();
    });

    it('should fail to narrow if the type does not match', () => {
      const q = db.user.select('Name').narrowType()<{ Id: 1; Name: 2 }>();

      assertType<
        typeof q,
        | `narrowType() error: provided type does not extend the 'Name' column type`
        | `narrowType() error: provided type does not extend the 'Id' column type`
      >();
    });

    it('should narrow the type of `get`', () => {
      const q = db.user.get('Name').narrowType()<'name'>();

      assertType<Awaited<typeof q>, 'name'>();
    });

    it('should fail to narrow `get` if the type does not match', () => {
      const q = db.user.get('Name').narrowType()<1>();

      assertType<
        Awaited<typeof q>,
        'narrowType() error: provided type does not extend the returning column column type'
      >();
    });

    it('should narrow the type of `pluck`', () => {
      const q = db.user.pluck('Name').narrowType()<'name'[]>();

      assertType<Awaited<typeof q>, 'name'[]>();
    });

    it('should fail to narrow `get` if the type does not match', () => {
      const q = db.user.pluck('Name').narrowType()<1[]>();

      assertType<
        Awaited<typeof q>,
        'narrowType() error: provided type does not extend the returning column column type'
      >();
    });
  });

  describe('makeHelper', () => {
    it('should make a query helper', () => {
      const fn = db.user.makeHelper((q, _: boolean) => q.select('Id'));
      const q = fn(db.user.select('Name'), true);

      assertType<Awaited<typeof q>, { Id: number; Name: string }[]>();
    });

    it('QueryHelperResult type should be fine', () => {
      const helper = db.user.makeHelper((q, param?: string) =>
        q.where({ Name: param }),
      );

      assertType<
        Awaited<QueryHelperResult<typeof helper>>,
        UserDefaultSelect[]
      >();
    });

    it('should have table property available at runtime', () => {
      const helper = db.user.makeHelper((q) => q.select('Id'));

      expect(helper.table).toBe('User');
    });

    it('should support returning an expression', () => {
      const helper = db.user.makeHelper(() => sql<number>`1`);

      const q = db.user.get((q) => helper(q));

      assertType<Awaited<typeof q>, number>();
    });
  });

  describe('narrowType', () => {
    it('should narrow a result type', () => {
      const q = db.user.select('Id').where({ Id: 123 }).narrowType()<{
        Id: 123;
      }>();

      assertType<Awaited<typeof q>, { Id: 123 }[]>();
    });
  });

  describe('if', () => {
    it('should execute callback based on the condition', () => {
      const q1 = db.user.select('Id').if(false, (q) => q.select('Name'));

      expectSql(
        q1.toSQL(),
        `SELECT "User"."id" "Id" FROM "schema"."user" "User"`,
      );

      const q2 = db.user.select('Id').if(true, (q) => q.select('Name'));

      expectSql(
        q2.toSQL(),
        `SELECT "User"."id" "Id", "User"."name" "Name" FROM "schema"."user" "User"`,
      );
    });

    it('should add optional selection', () => {
      const q = db.user
        .select('Id', 'Name')
        .if(true, (q) => q.select('Name', 'Password', 'Active'));

      assertType<
        Awaited<typeof q>,
        {
          Id: number;
          Name: string;
          Password?: string;
          Active?: boolean | null;
        }[]
      >();
    });

    it('should handle a query returning a plain value', () => {
      const q = db.user.get('Id').if(true, (q) => q.get('Name'));

      assertType<Awaited<typeof q>, number | string>();

      const q2 = q.if(true, (q) => q.get('Active'));

      assertType<Awaited<typeof q2>, number | string | boolean | null>();
    });

    it('should have a proper type for conditionally selected relation', async () => {
      const q = db.post
        .select('Id')
        .if(true, (q) =>
          q.select({
            user: (q) => q.user.select('Name'),
          }),
        )
        .take();

      assertType<
        Awaited<typeof q>,
        { Id: number; user: { Name: string } | undefined }
      >();
    });
  });
});
