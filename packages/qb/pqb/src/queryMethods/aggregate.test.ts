import {
  User,
  expectQueryNotMutated,
  userData,
  Message,
  Product,
} from '../test-utils/test-utils';
import { assertType, expectSql, testDb, useTestDatabase } from 'test-utils';
import { Operators } from '../columns/operators';
import {
  BooleanColumn,
  IntegerColumn,
  JSONTextColumn,
  RealColumn,
  TextColumn,
  XMLColumn,
} from 'pqb';

describe('aggregate', () => {
  useTestDatabase();

  it('should discard previous query extension when extending query with other type', () => {
    const int = User.count();
    assertType<typeof int.gt, typeof Operators.number.gt>();
    expect(int.gt).toEqual(expect.any(Function));

    const bool = int.gt(5);
    // @ts-expect-error bool should not have gt method
    bool.gt;

    // let number methods to remain in runtime,
    // because it's fewer things to perform and simplifies the internal logic
    //
    // expect((bool as unknown as { gt: unknown }).gt).toBe(undefined);
  });

  describe('chaining with operators', () => {
    it('should allow to chain agg method with operators', () => {
      const q = User.count().gt(3);

      assertType<Awaited<typeof q>, boolean>();

      expectSql(
        q.toSQL(),
        `
          SELECT count(*) > $1 FROM "user"
        `,
        [3],
      );
    });
  });

  describe('aggregate options', () => {
    it('should work without options', async () => {
      expectSql(User.count('*').toSQL(), 'SELECT count(*) FROM "user"');
    });

    it('should support a column with name', () => {
      expectSql(
        User.count('createdAt').toSQL(),
        'SELECT count("user"."created_at") FROM "user"',
      );
    });

    it('should support distinct option', () => {
      expectSql(
        User.count('name', { distinct: true }).toSQL(),
        'SELECT count(DISTINCT "user"."name") FROM "user"',
      );
    });

    it('should support order', () => {
      expectSql(
        User.count('name', { order: { name: 'DESC' } }).toSQL(),
        'SELECT count("user"."name" ORDER BY "user"."name" DESC) FROM "user"',
      );
    });

    it('should support order by column with name', () => {
      expectSql(
        User.count('createdAt', { order: { createdAt: 'DESC' } }).toSQL(),
        'SELECT count("user"."created_at" ORDER BY "user"."created_at" DESC) FROM "user"',
      );
    });

    it('should support filter', () => {
      expectSql(
        User.count('name', { filter: { age: { not: null } } }).toSQL(),
        'SELECT count("user"."name") FILTER (WHERE "user"."age" IS NOT NULL) FROM "user"',
      );
    });

    it('should support filter by column with name', () => {
      expectSql(
        User.count('createdAt', {
          filter: { createdAt: { not: 'Bob' } },
        }).toSQL(),
        'SELECT count("user"."created_at") FILTER (WHERE "user"."created_at" <> $1) FROM "user"',
        ['Bob'],
      );
    });

    describe('over', () => {
      it('should support partitionBy', () => {
        expectSql(
          User.count('name', {
            over: {
              partitionBy: 'id',
              order: {
                id: 'DESC',
              },
            },
          }).toSQL(),
          `
            SELECT count("user"."name") OVER (PARTITION BY "user"."id" ORDER BY "user"."id" DESC)
            FROM "user"
          `,
        );
      });

      it('should support partitionBy column with name', () => {
        expectSql(
          User.count('createdAt', {
            over: {
              partitionBy: 'createdAt',
              order: {
                createdAt: 'DESC',
              },
            },
          }).toSQL(),
          `
            SELECT count("user"."created_at") OVER (PARTITION BY "user"."created_at" ORDER BY "user"."created_at" DESC)
            FROM "user"
          `,
        );
      });

      it('should support columns array partitionBy', () => {
        expectSql(
          User.count('name', {
            over: {
              partitionBy: ['id', 'name'],
              order: {
                id: 'DESC',
              },
            },
          }).toSQL(),
          `
            SELECT count("user"."name") OVER (PARTITION BY "user"."id", "user"."name" ORDER BY "user"."id" DESC)
            FROM "user"
          `,
        );
      });

      it('should support partitionBy array of columns with names', () => {
        expectSql(
          User.count('createdAt', {
            over: {
              partitionBy: ['createdAt', 'updatedAt'],
              order: {
                updatedAt: 'DESC',
              },
            },
          }).toSQL(),
          `
            SELECT count("user"."created_at") OVER (PARTITION BY "user"."created_at", "user"."updated_at" ORDER BY "user"."updated_at" DESC)
            FROM "user"
          `,
        );
      });
    });

    it('should support all options', () => {
      expectSql(
        User.count('name', {
          distinct: true,
          order: { name: 'DESC' },
          filter: { age: { not: null } },
          over: {
            partitionBy: 'id',
            order: {
              id: 'DESC',
            },
          },
        }).toSQL(),
        `
          SELECT
            count(DISTINCT "user"."name" ORDER BY "user"."name" DESC)
              FILTER (WHERE "user"."age" IS NOT NULL)
              OVER (
                PARTITION BY "user"."id"
                ORDER BY "user"."id" DESC
              )
          FROM "user"
        `,
      );
    });

    it('should support withinGroup', () => {
      expectSql(
        User.count('name', {
          distinct: true,
          order: { name: 'DESC' },
          filter: { age: { not: null } },
          withinGroup: true,
        }).toSQL(),
        `
          SELECT count("user"."name")
          WITHIN GROUP (ORDER BY "user"."name" DESC)
          FILTER (WHERE "user"."age" IS NOT NULL) FROM "user"
        `,
      );
    });
  });

  describe('count', () => {
    it('should return a number', async () => {
      const count = await User.count();

      assertType<typeof count, number>();

      expect(typeof count).toBe('number');
    });

    it('should select number', async () => {
      await User.create(userData);

      const q = User.select({
        count: (q) => q.count(),
      }).take();

      expectSql(
        q.toSQL(),
        `
            SELECT count(*) "count" FROM "user" LIMIT 1
          `,
      );

      const user = await q;
      expect(user.count).toBe(1);

      assertType<typeof user.count, number>();
    });

    it('should correctly select a count of joined records', () => {
      const q = User.join(Message, 'authorId', 'id').select({
        messagesCount: (q) => q.count('message.*'),
      });

      assertType<Awaited<typeof q>, { messagesCount: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT count("message".*) "messagesCount"
          FROM "user"
          JOIN "message" ON "message"."author_id" = "user"."id"
        `,
      );
    });
  });

  describe('numeric aggregations', () => {
    it('should return number for numeric types returning a number', async () => {
      await Product.insertMany([{ priceAmount: '1' }, { priceAmount: '2' }]);

      const value = await Product.sum('id');

      assertType<typeof value, number | null>();

      expect(typeof value).toBe('number');
    });

    it('should return string for precise numeric types', async () => {
      await Product.insertMany([
        { priceAmount: '111111111111111.111111111111111' },
        { priceAmount: '222222222222222.222222222222222' },
      ]);

      const value = await Product.sum('priceAmount');

      assertType<typeof value, string | null>();

      expect(typeof value).toBe('string');
    });
  });

  describe.each`
    method      | functionName
    ${'avg'}    | ${'avg'}
    ${'min'}    | ${'min'}
    ${'max'}    | ${'max'}
    ${'sum'}    | ${'sum'}
    ${'bitAnd'} | ${'bit_and'}
    ${'bitOr'}  | ${'bit_or'}
  `('$method', ({ method }) => {
    it('should return null when no records', async () => {
      const value = await User[method as 'avg']('id');

      assertType<typeof value, number | null>();

      expect(value).toBe(null);
    });

    it('should return number when have records', async () => {
      await User.create(userData);

      const value = await User[method as 'avg']('id');

      assertType<typeof value, number | null>();

      expect(typeof value).toBe('number');
    });

    describe(`select ${method}`, () => {
      it('should select null when no record', async () => {
        const value = await User.select({
          result: (q) => q[method as 'avg']('id'),
        }).take();

        assertType<typeof value, { result: number | null }>();

        expect(value).toEqual({ result: null });
      });

      it('should return number when have records', async () => {
        const id = await User.get('id').create(userData);

        const value = await User.select({
          result: (q) => q[method as 'avg']('id'),
        }).take();

        assertType<typeof value, { result: number | null }>();

        expect(value).toEqual({ result: id });
      });
    });
  });

  describe.each`
    method       | functionName
    ${'boolAnd'} | ${'bool_and'}
    ${'boolOr'}  | ${'bool_or'}
    ${'every'}   | ${'every'}
  `('$method', ({ method }) => {
    it('should return null when no records', async () => {
      const value = await User[method as 'boolAnd']('active');

      assertType<typeof value, boolean | null>();

      expect(value).toBe(null);
    });

    it('should return boolean when have records', async () => {
      await User.create({ ...userData, active: true });

      const value = await User[method as 'boolAnd']('active');

      assertType<typeof value, boolean | null>();

      expect(typeof value).toBe('boolean');
    });

    describe(`select ${method}`, () => {
      it('should select null when no record', async () => {
        const value = await User.select({
          result: (q) => q[method as 'boolAnd']('active'),
        }).take();

        assertType<typeof value, { result: boolean | null }>();

        expect(value).toEqual({ result: null });
      });

      it('should return boolean when have records', async () => {
        await User.create({ ...userData, active: true });

        const value = await User.select({
          result: (q) => q[method as 'boolAnd']('active'),
        }).take();

        assertType<typeof value, { result: boolean | null }>();

        expect(value).toEqual({ result: true });
      });
    });
  });

  describe.each`
    method        | functionName
    ${'jsonAgg'}  | ${'json_agg'}
    ${'jsonbAgg'} | ${'jsonb_agg'}
  `('$method', ({ method }) => {
    const data = { name: 'name', tags: [] };

    it('should return null when no records', async () => {
      const value = await User[method as 'jsonAgg']('data');

      assertType<
        typeof value,
        ({ name: string; tags: string[] } | null)[] | null
      >();

      expect(value).toBe(null);
    });

    it('should return json array when have records', async () => {
      await User.create({ ...userData, data });

      const value = await User[method as 'jsonAgg']('data');

      assertType<
        typeof value,
        ({ name: string; tags: string[] } | null)[] | null
      >();

      expect(value).toEqual([data]);
    });

    describe(`select ${method}`, () => {
      it('should select null when no record', async () => {
        const value = await User.select({
          result: (q) => q[method as 'jsonAgg']('data'),
        }).take();

        assertType<
          typeof value,
          { result: ({ name: string; tags: string[] } | null)[] | null }
        >();

        expect(value).toEqual({ result: null });
      });

      it('should return json array when have records', async () => {
        await User.create({ ...userData, data });

        const value = await User.select({
          result: (q) => q[method as 'jsonAgg']('data'),
        }).take();

        assertType<
          typeof value,
          { result: ({ name: string; tags: string[] } | null)[] | null }
        >();

        expect(value).toEqual({ result: [data] });
      });
    });
  });

  describe.each`
    method        | functionName
    ${'count'}    | ${'count'}
    ${'avg'}      | ${'avg'}
    ${'min'}      | ${'min'}
    ${'max'}      | ${'max'}
    ${'sum'}      | ${'sum'}
    ${'bitAnd'}   | ${'bit_and'}
    ${'bitOr'}    | ${'bit_or'}
    ${'boolAnd'}  | ${'bool_and'}
    ${'boolOr'}   | ${'bool_or'}
    ${'every'}    | ${'every'}
    ${'jsonAgg'}  | ${'json_agg'}
    ${'jsonbAgg'} | ${'jsonb_agg'}
    ${'xmlAgg'}   | ${'xmlagg'}
  `('$method', ({ method, functionName }) => {
    const getSql = (arg: string, as?: string) => {
      let select = `${functionName}(${arg})`;

      if (as) select += ` "${as}"`;

      return `SELECT ${select} FROM "user"`;
    };

    it('should have a column type', () => {
      const q = User[method as 'avg']('id');

      const columnType =
        method === 'count'
          ? IntegerColumn
          : ['avg', 'min', 'max', 'sum', 'bitAnd', 'bitOr'].includes(method)
          ? RealColumn
          : ['boolAnd', 'boolOr', 'every'].includes(method)
          ? BooleanColumn
          : ['jsonAgg', 'jsonbAgg'].includes(method)
          ? JSONTextColumn
          : method === 'xmlAgg'
          ? XMLColumn
          : undefined;
      if (!columnType) {
        throw new Error(`Unhandled type for ${method}`);
      }

      expect(q.q.getColumn).toBeInstanceOf(columnType);
    });

    it(`should perform ${method} query for a column`, () => {
      const q = User.clone();

      const expectedSql = getSql('"user"."id"');
      expectSql(q[method as 'avg']('id').toSQL(), expectedSql);
      expectQueryNotMutated(q);
    });

    it('should support raw sql parameter', () => {
      const q = User.all();
      expectSql(q[method as 'count'](testDb.sql`name`).toSQL(), getSql('name'));
      expectQueryNotMutated(q);
    });

    it(`should select aggregated value`, () => {
      const q = User.all();
      const expectedSql = getSql('"user"."name"', 'count');
      expectSql(
        q.select({ count: (q) => q[method as 'count']('name') }).toSQL(),
        expectedSql,
      );
      expectQueryNotMutated(q);
    });

    it(`should support raw sql in select`, () => {
      const q = User.all();
      const expectedSql = getSql('name', 'count');
      expectSql(
        q
          .select({
            count: (q) => q[method as 'count'](testDb.sql`name`),
          })
          .toSQL(),
        expectedSql,
      );
      expectQueryNotMutated(q);
    });
  });

  describe.each`
    method              | functionName
    ${'jsonObjectAgg'}  | ${'json_object_agg'}
    ${'jsonbObjectAgg'} | ${'jsonb_object_agg'}
  `('$method', ({ method, functionName }) => {
    it('should have a column type', () => {
      const q = User[method as 'jsonObjectAgg']({ alias: 'name' });

      expect(q.q.getColumn).toBeInstanceOf(JSONTextColumn);
    });

    it('should return null when no records', async () => {
      const value = await User[method as 'jsonObjectAgg']({ alias: 'name' });

      assertType<typeof value, { alias: string } | null>();

      expect(value).toBe(null);
    });

    it('should return json object when have records', async () => {
      await User.create(userData);

      const value = await User[method as 'jsonObjectAgg']({ alias: 'name' });

      assertType<typeof value, { alias: string } | null>();

      expect(value).toEqual({ alias: 'name' });
    });

    describe('should be selectable', () => {
      it('should select null when no record', async () => {
        const value = await User.select({
          result: (q) => q[method as 'jsonObjectAgg']({ alias: 'name' }),
        }).take();

        assertType<typeof value, { result: { alias: string } | null }>();

        expect(value).toEqual({ result: null });
      });

      it('should return json object when have records', async () => {
        await User.create(userData);

        const value = await User.select({
          result: (q) => q[method as 'jsonObjectAgg']({ alias: 'name' }),
        }).take();

        assertType<typeof value, { result: { alias: string } | null }>();

        expect(value).toEqual({ result: { alias: 'name' } });
      });
    });

    it(`should perform ${method} query for a column`, () => {
      const q = User.clone();
      expectSql(
        q[method as 'jsonObjectAgg']({ alias: 'name' }).toSQL(),
        `SELECT ${functionName}($1::text, "user"."name") FROM "user"`,
        ['alias'],
      );
      expectQueryNotMutated(q);
    });

    it('should support raw sql parameter', () => {
      const q = User.clone();
      expectSql(
        q[method as 'jsonObjectAgg']({
          alias: testDb.sql`name`,
        }).toSQL(),
        `SELECT ${functionName}($1::text, name) FROM "user"`,
        ['alias'],
      );
      expectQueryNotMutated(q);
    });

    it(`should select aggregated value`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}($1::text, "user"."name") "result" FROM "user"`;
      expectSql(
        q
          .select({
            result: (q) => q[method as 'jsonObjectAgg']({ alias: 'name' }),
          })
          .toSQL(),
        expectedSql,
        ['alias'],
      );
      expectQueryNotMutated(q);
    });

    it(`should select aggregated value with raw sql`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}($1::text, name) "result" FROM "user"`;
      expectSql(
        q
          .select({
            result: (q) =>
              q[method as 'jsonObjectAgg']({ alias: testDb.sql`name` }),
          })
          .toSQL(),
        expectedSql,
        ['alias'],
      );
      expectQueryNotMutated(q);
    });
  });

  describe('stringAgg', () => {
    it('should have a column type', () => {
      const q = User.stringAgg('name', ', ');

      expect(q.q.getColumn).toBeInstanceOf(TextColumn);
    });

    it('should return null when no records', async () => {
      const value = await User.stringAgg('name', ', ');

      assertType<typeof value, string | null>();

      expect(value).toBe(null);
    });

    it('should return json object when have records', async () => {
      await User.createMany([userData, userData]);

      const value = await User.stringAgg('name', ', ');

      assertType<typeof value, string | null>();

      expect(value).toEqual('name, name');
    });

    describe('select stringAgg', () => {
      it('should select null when no record', async () => {
        const value = await User.select({
          result: (q) => q.stringAgg('name', ', '),
        }).take();

        assertType<typeof value, { result: string | null }>();

        expect(value).toEqual({ result: null });
      });

      it('should return json object when have records', async () => {
        await User.createMany([userData, userData]);

        const value = await User.select({
          result: (q) => q.stringAgg('name', ', '),
        }).take();

        assertType<typeof value, { result: string | null }>();

        expect(value).toEqual({ result: 'name, name' });
      });
    });

    it('makes stringAgg query', () => {
      const q = User.clone();
      expectSql(
        q.stringAgg('name', ' & ').toSQL(),
        `SELECT string_agg("user"."name", $1) FROM "user"`,
        [' & '],
      );
      expectQueryNotMutated(q);
    });

    it('should support raw sql parameter', async () => {
      const q = User.all();
      expectSql(
        q
          .stringAgg(
            testDb.sql`name`.type((t) => t.text()),
            ' & ',
          )
          .toSQL(),
        `SELECT string_agg(name, $1) FROM "user"`,
        [' & '],
      );
      expectQueryNotMutated(q);
    });

    it(`.stringAgg should select aggregated value`, () => {
      const q = User.all();
      const expectedSql = `SELECT string_agg("user"."name", $1) FROM "user"`;
      expectSql(q.stringAgg('name', ' & ').toSQL(), expectedSql, [' & ']);
      expectQueryNotMutated(q);
    });

    it(`.stringAgg supports raw sql`, () => {
      const q = User.all();
      const expectedSql = `SELECT string_agg(name, $1) FROM "user"`;
      expectSql(
        q
          .stringAgg(
            testDb.sql`name`.type((t) => t.text()),
            ' & ',
          )
          .toSQL(),
        expectedSql,
        [' & '],
      );
      expectQueryNotMutated(q);
    });
  });

  describe('window function', () => {
    describe.each`
      method           | functionName      | results
      ${'rowNumber'}   | ${'row_number'}   | ${[1, 2, 1, 2]}
      ${'rank'}        | ${'rank'}         | ${[1, 1, 1, 1]}
      ${'denseRank'}   | ${'dense_rank'}   | ${[1, 1, 1, 1]}
      ${'percentRank'} | ${'percent_rank'} | ${[0, 0, 0, 0]}
      ${'cumeDist'}    | ${'cume_dist'}    | ${[1, 1, 1, 1]}
    `('$method', ({ method, functionName, results }) => {
      it('should return array of objects with number value', async () => {
        await User.createMany([
          { ...userData, age: 20 },
          { ...userData, age: 20 },
        ]);
        await User.createMany([
          { ...userData, age: 30 },
          { ...userData, age: 30 },
        ]);

        const q = User.select({
          result: (q) =>
            q[method as 'rowNumber']({
              partitionBy: 'age',
              order: { createdAt: 'DESC' },
            }),
        });

        const value = await q;

        assertType<typeof value, { result: number | null }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT ${functionName}() OVER (
              PARTITION BY "user"."age"
              ORDER BY "user"."created_at" DESC
            ) "result" FROM "user"
          `,
          [],
        );

        expect(value).toEqual(
          (results as number[]).map((item) => ({ result: item })),
        );
      });
    });
  });
});
