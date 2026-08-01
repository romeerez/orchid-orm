import { expectQueryNotMutated } from '../../../test-utils/pqb.test-utils';
import {
  assertType,
  ChatData,
  db,
  expectSql,
  MessageData,
  testDb,
  UserData,
  useTestDatabase,
} from 'test-utils';
import { Operators } from '../../../columns/operators';
import {
  BooleanColumn,
  IntegerColumn,
  JSONTextColumn,
  RealColumn,
  TextColumn,
  XMLColumn,
} from '../../../columns';

describe('aggregate', () => {
  useTestDatabase();

  it('should discard previous query extension when extending query with other type', () => {
    const int = db.user.get('Data');
    assertType<typeof int.gt, typeof Operators.json.gt>();
    expect(int.gt).toEqual(expect.any(Function));

    const bool = int.gt(5);
    // @ts-expect-error bool should not have json methods
    bool.jsonSet;

    // let number methods to remain in runtime,
    // because it's fewer things to perform and simplifies the internal logic
    //
    // expect((bool as unknown as { gt: unknown }).gt).toBe(undefined);
  });

  describe('chaining with operators', () => {
    it('should allow to chain agg method with operators', () => {
      const q = db.user.count().gt(3);

      assertType<Awaited<typeof q>, boolean>();

      expectSql(
        q.toSQL(),
        `
          SELECT count(*) > $1 FROM "schema"."user" "User"
        `,
        [3],
      );
    });

    it('should allow to chain agg method with base operators', () => {
      const q = db.user.count().isNotDistinctFrom(3);

      assertType<Awaited<typeof q>, boolean>();

      expectSql(
        q.toSQL(),
        `
          SELECT count(*) IS NOT DISTINCT FROM $1 FROM "schema"."user" "User"
        `,
        [3],
      );
    });
  });

  describe('aggregate options', () => {
    it('should work without options', async () => {
      expectSql(
        db.user.count('*').toSQL(),
        'SELECT count(*) FROM "schema"."user" "User"',
      );
    });

    it('should support a column with name', () => {
      expectSql(
        db.user.count('createdAt').toSQL(),
        'SELECT count("User"."created_at") FROM "schema"."user" "User"',
      );
    });

    it('should support distinct option', () => {
      expectSql(
        db.user.count('Name', { distinct: true }).toSQL(),
        'SELECT count(DISTINCT "User"."name") FROM "schema"."user" "User"',
      );
    });

    it('should support order', () => {
      expectSql(
        db.user.count('Name', { order: { Name: 'DESC' } }).toSQL(),
        'SELECT count("User"."name" ORDER BY "User"."name" DESC) FROM "schema"."user" "User"',
      );
    });

    it('should support order by column with name', () => {
      expectSql(
        db.user.count('createdAt', { order: { createdAt: 'DESC' } }).toSQL(),
        'SELECT count("User"."created_at" ORDER BY "User"."created_at" DESC) FROM "schema"."user" "User"',
      );
    });

    it('should support filter', () => {
      expectSql(
        db.user.count('Name', { filter: { Age: { not: null } } }).toSQL(),
        'SELECT count("User"."name") FILTER (WHERE "User"."age" IS NOT NULL) FROM "schema"."user" "User"',
      );
    });

    it('should support base operators in filter', () => {
      expectSql(
        db.user
          .count('Name', {
            filter: { Id: { isDistinctFrom: 10 } },
          })
          .toSQL(),
        'SELECT count("User"."name") FILTER (WHERE "User"."id" IS DISTINCT FROM $1) FROM "schema"."user" "User"',
        [10],
      );
    });

    it('should support filter by column with name', () => {
      expectSql(
        db.user
          .count('createdAt', {
            filter: { createdAt: { not: 'Bob' } },
          })
          .toSQL(),
        'SELECT count("User"."created_at") FILTER (WHERE "User"."created_at" <> $1) FROM "schema"."user" "User"',
        ['Bob'],
      );
    });

    describe('over', () => {
      it('should support partitionBy', () => {
        expectSql(
          db.user
            .count('Name', {
              over: {
                partitionBy: 'Id',
                order: {
                  Id: 'DESC',
                },
              },
            })
            .toSQL(),
          `
            SELECT count("User"."name") OVER (PARTITION BY "User"."id" ORDER BY "User"."id" DESC)
            FROM "schema"."user" "User"
          `,
        );
      });

      it('should support partitionBy column with name', () => {
        expectSql(
          db.user
            .count('createdAt', {
              over: {
                partitionBy: 'createdAt',
                order: {
                  createdAt: 'DESC',
                },
              },
            })
            .toSQL(),
          `
            SELECT count("User"."created_at") OVER (PARTITION BY "User"."created_at" ORDER BY "User"."created_at" DESC)
            FROM "schema"."user" "User"
          `,
        );
      });

      it('should support columns array partitionBy', () => {
        expectSql(
          db.user
            .count('Name', {
              over: {
                partitionBy: ['Id', 'Name'],
                order: {
                  Id: 'DESC',
                },
              },
            })
            .toSQL(),
          `
            SELECT count("User"."name") OVER (PARTITION BY "User"."id", "User"."name" ORDER BY "User"."id" DESC)
            FROM "schema"."user" "User"
          `,
        );
      });

      it('should support partitionBy array of columns with names', () => {
        expectSql(
          db.user
            .count('createdAt', {
              over: {
                partitionBy: ['createdAt', 'updatedAt'],
                order: {
                  updatedAt: 'DESC',
                },
              },
            })
            .toSQL(),
          `
            SELECT count("User"."created_at") OVER (PARTITION BY "User"."created_at", "User"."updated_at" ORDER BY "User"."updated_at" DESC)
            FROM "schema"."user" "User"
          `,
        );
      });
    });

    it('should support all options', () => {
      expectSql(
        db.user
          .count('Name', {
            distinct: true,
            order: { Name: 'DESC' },
            filter: { Age: { not: null } },
            over: {
              partitionBy: 'Id',
              order: {
                Id: 'DESC',
              },
            },
          })
          .toSQL(),
        `
          SELECT
            count(DISTINCT "User"."name" ORDER BY "User"."name" DESC)
              FILTER (WHERE "User"."age" IS NOT NULL)
              OVER (
                PARTITION BY "User"."id"
                ORDER BY "User"."id" DESC
              )
          FROM "schema"."user" "User"
        `,
      );
    });

    it('should support withinGroup', () => {
      expectSql(
        db.user
          .count('Name', {
            distinct: true,
            order: { Name: 'DESC' },
            filter: { Age: { not: null } },
            withinGroup: true,
          })
          .toSQL(),
        `
          SELECT count("User"."name")
          WITHIN GROUP (ORDER BY "User"."name" DESC)
          FILTER (WHERE "User"."age" IS NOT NULL) FROM "schema"."user" "User"
        `,
      );
    });
  });

  describe('count', () => {
    it('should return a number', async () => {
      const count = await db.user.count();

      assertType<typeof count, number>();

      expect(typeof count).toBe('number');
    });

    it('should select number', async () => {
      await db.user.create(UserData);

      const q = db.user
        .select({
          count: (q) => q.count(),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
            SELECT count(*) "count" FROM "schema"."user" "User" LIMIT 1
          `,
      );

      const user = await q;
      expect(user.count).toBe(1);

      assertType<typeof user.count, number>();
    });

    it('should correctly select a count of joined records', () => {
      const q = db.user.join(db.message, 'AuthorId', 'Id').select({
        messagesCount: (q) => q.count('Message.*'),
      });

      assertType<Awaited<typeof q>, { messagesCount: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT count("Message".*) "messagesCount"
          FROM "schema"."user" "User"
          JOIN "schema"."message" "Message" ON "Message"."author_id" = "User"."id" AND ("Message"."deleted_at" IS NULL)
        `,
      );
    });

    it('should select a number from a sub-query with a column data type appropriate for the following `sum` aggregation', async () => {
      const AuthorId = await db.user.get('Id').insert(UserData);
      const ChatId = await db.chat.get('IdOfChat').insert(ChatData);
      await db.message.insert({ ...MessageData, AuthorId, ChatId });

      const q = db.user
        .select({
          first: (q) => q.messages.count(),
          messagesCount: (q) => q.messages.count(),
        })
        .sum('messagesCount');

      expectSql(
        q.toSQL(),
        `
          SELECT sum("first"."messagesCount")
          FROM "schema"."user" "User"
          LEFT JOIN LATERAL (
            SELECT count(*) "first", count(*) "messagesCount"
            FROM "schema"."message" "messages"
            WHERE ("messages"."author_id" = "User"."id" AND "messages"."message_key" = "User"."user_key")
              AND ("messages"."deleted_at" IS NULL)
          ) "first" ON true
        `,
      );

      const res = await q;
      assertType<typeof res, number | null>();

      expect(res).toBe(1);
    });
  });

  describe('numeric aggregations', () => {
    it('should return number for numeric types returning a number', async () => {
      await db.product.insertMany([{ priceAmount: '1' }, { priceAmount: '2' }]);

      const value = await db.product.sum('id');

      assertType<typeof value, number | null>();

      expect(typeof value).toBe('number');
    });

    it('should return string for precise numeric types', async () => {
      await db.product.insertMany([
        { priceAmount: '111111111111111.111111111111111' },
        { priceAmount: '222222222222222.222222222222222' },
      ]);

      const value = await db.product.sum('priceAmount');

      assertType<typeof value, string | null>();

      expect(typeof value).toBe('string');
    });

    it('should select a number from a sub-query with a column data type appropriate for the following `sum` aggregation', async () => {
      const AuthorId = await db.user.get('Id').insert(UserData);
      const ChatId = await db.chat.get('IdOfChat').insert(ChatData);
      await db.message.insert({ ...MessageData, AuthorId, ChatId });

      const q = db.user
        .select({
          first: (q) => q.messages.sum('Id'),
          messagesSum: (q) => q.messages.sum('Id'),
        })
        .sum('messagesSum');

      expectSql(
        q.toSQL(),
        `
          SELECT sum("first"."messagesSum")
          FROM "schema"."user" "User"
          LEFT JOIN LATERAL (
            SELECT sum("messages"."id") "first", sum("messages"."id") "messagesSum"
            FROM "schema"."message" "messages"
            WHERE ("messages"."author_id" = "User"."id" AND "messages"."message_key" = "User"."user_key")
              AND ("messages"."deleted_at" IS NULL)
          ) "first" ON true
        `,
      );

      const res = await q;
      assertType<typeof res, number | null>();

      expect(typeof res).toBe('number');
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
      const value = await db.user[method as 'avg']('Id');

      assertType<typeof value, number | null>();

      expect(value).toBe(null);
    });

    it('should return number when have records', async () => {
      await db.user.create(UserData);

      const value = await db.user[method as 'avg']('Id');

      assertType<typeof value, number | null>();

      expect(typeof value).toBe('number');
    });

    describe(`select ${method}`, () => {
      it('should select null when no record', async () => {
        const value = await db.user
          .select({
            result: (q) => q[method as 'avg']('Id'),
          })
          .take();

        assertType<typeof value, { result: number | null }>();

        expect(value).toEqual({ result: null });
      });

      it('should return number when have records', async () => {
        const id = await db.user.get('Id').create(UserData);

        const value = await db.user
          .select({
            result: (q) => q[method as 'avg']('Id'),
          })
          .take();

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
      const value = await db.user[method as 'boolAnd']('Active');

      assertType<typeof value, boolean | null>();

      expect(value).toBe(null);
    });

    it('should return boolean when have records', async () => {
      await db.user.create({ ...UserData, Active: true });

      const value = await db.user[method as 'boolAnd']('Active');

      assertType<typeof value, boolean | null>();

      expect(typeof value).toBe('boolean');
    });

    describe(`select ${method}`, () => {
      it('should select null when no record', async () => {
        const value = await db.user
          .select({
            result: (q) => q[method as 'boolAnd']('Active'),
          })
          .take();

        assertType<typeof value, { result: boolean | null }>();

        expect(value).toEqual({ result: null });
      });

      it('should return boolean when have records', async () => {
        await db.user.create({ ...UserData, Active: true });

        const value = await db.user
          .select({
            result: (q) => q[method as 'boolAnd']('Active'),
          })
          .take();

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
      const value = await db.user[method as 'jsonAgg']('Data');

      assertType<
        typeof value,
        ({ name: string; tags: string[] } | null)[] | null
      >();

      expect(value).toBe(null);
    });

    it('should return json array when have records', async () => {
      await db.user.create({ ...UserData, Data: data });

      const value = await db.user[method as 'jsonAgg']('Data');

      assertType<
        typeof value,
        ({ name: string; tags: string[] } | null)[] | null
      >();

      expect(value).toEqual([data]);
    });

    describe(`select ${method}`, () => {
      it('should select null when no record', async () => {
        const value = await db.user
          .select({
            result: (q) => q[method as 'jsonAgg']('Data'),
          })
          .take();

        assertType<
          typeof value,
          { result: ({ name: string; tags: string[] } | null)[] | null }
        >();

        expect(value).toEqual({ result: null });
      });

      it('should return json array when have records', async () => {
        await db.user.create({ ...UserData, Data: data });

        const value = await db.user
          .select({
            result: (q) => q[method as 'jsonAgg']('Data'),
          })
          .take();

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

      return `SELECT ${select} FROM "schema"."user" "User"`;
    };

    it('should have a column type', () => {
      const q = db.user[method as 'avg']('Id');

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
      const q = db.user.clone();

      const expectedSql = getSql('"User"."id"');
      expectSql(q[method as 'avg']('Id').toSQL(), expectedSql);
      expectQueryNotMutated(q);
    });

    it('should support raw sql parameter', () => {
      const q = db.user.all();
      expectSql(q[method as 'count'](testDb.sql`name`).toSQL(), getSql('name'));
      expectQueryNotMutated(q);
    });

    it(`should select aggregated value`, () => {
      const q = db.user.all();
      const expectedSql = getSql('"User"."name"', 'count');
      expectSql(
        q.select({ count: (q) => q[method as 'count']('Name') }).toSQL(),
        expectedSql,
      );
      expectQueryNotMutated(q);
    });

    it(`should support raw sql in select`, () => {
      const q = db.user.all();
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
      const q = db.user[method as 'jsonObjectAgg']({ alias: 'Name' });

      expect(q.q.getColumn).toBeInstanceOf(JSONTextColumn);
    });

    it('should return null when no records', async () => {
      const value = await db.user[method as 'jsonObjectAgg']({ alias: 'Name' });

      assertType<typeof value, { alias: string } | null>();

      expect(value).toBe(null);
    });

    it('should return json object when have records', async () => {
      await db.user.create(UserData);

      const value = await db.user[method as 'jsonObjectAgg']({ alias: 'Name' });

      assertType<typeof value, { alias: string } | null>();

      expect(value).toEqual({ alias: 'name' });
    });

    describe('should be selectable', () => {
      it('should select null when no record', async () => {
        const value = await db.user
          .select({
            result: (q) => q[method as 'jsonObjectAgg']({ alias: 'Name' }),
          })
          .take();

        assertType<typeof value, { result: { alias: string } | null }>();

        expect(value).toEqual({ result: null });
      });

      it('should return json object when have records', async () => {
        await db.user.create(UserData);

        const value = await db.user
          .select({
            result: (q) => q[method as 'jsonObjectAgg']({ alias: 'Name' }),
          })
          .take();

        assertType<typeof value, { result: { alias: string } | null }>();

        expect(value).toEqual({ result: { alias: 'name' } });
      });
    });

    it(`should perform ${method} query for a column`, () => {
      const q = db.user.clone();
      expectSql(
        q[method as 'jsonObjectAgg']({ alias: 'Name' }).toSQL(),
        `SELECT ${functionName}($1::text, "User"."name") FROM "schema"."user" "User"`,
        ['alias'],
      );
      expectQueryNotMutated(q);
    });

    it('should support raw sql parameter', () => {
      const q = db.user.clone();
      expectSql(
        q[method as 'jsonObjectAgg']({
          alias: testDb.sql`name`,
        }).toSQL(),
        `SELECT ${functionName}($1::text, name) FROM "schema"."user" "User"`,
        ['alias'],
      );
      expectQueryNotMutated(q);
    });

    it(`should select aggregated value`, () => {
      const q = db.user.all();
      const expectedSql = `SELECT ${functionName}($1::text, "User"."name") "result" FROM "schema"."user" "User"`;
      expectSql(
        q
          .select({
            result: (q) => q[method as 'jsonObjectAgg']({ alias: 'Name' }),
          })
          .toSQL(),
        expectedSql,
        ['alias'],
      );
      expectQueryNotMutated(q);
    });

    it(`should select aggregated value with raw sql`, () => {
      const q = db.user.all();
      const expectedSql = `SELECT ${functionName}($1::text, name) "result" FROM "schema"."user" "User"`;
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
      const q = db.user.stringAgg('Name', ', ');

      expect(q.q.getColumn).toBeInstanceOf(TextColumn);
    });

    it('should return null when no records', async () => {
      const value = await db.user.stringAgg('Name', ', ');

      assertType<typeof value, string | null>();

      expect(value).toBe(null);
    });

    it('should return json object when have records', async () => {
      await db.user.createMany([UserData, UserData]);

      const value = await db.user.stringAgg('Name', ', ');

      assertType<typeof value, string | null>();

      expect(value).toEqual('name, name');
    });

    describe('select stringAgg', () => {
      it('should select null when no record', async () => {
        const value = await db.user
          .select({
            result: (q) => q.stringAgg('Name', ', '),
          })
          .take();

        assertType<typeof value, { result: string | null }>();

        expect(value).toEqual({ result: null });
      });

      it('should return json object when have records', async () => {
        await db.user.createMany([UserData, UserData]);

        const value = await db.user
          .select({
            result: (q) => q.stringAgg('Name', ', '),
          })
          .take();

        assertType<typeof value, { result: string | null }>();

        expect(value).toEqual({ result: 'name, name' });
      });
    });

    it('makes stringAgg query', () => {
      const q = db.user.clone();
      expectSql(
        q.stringAgg('Name', ' & ').toSQL(),
        `SELECT string_agg("User"."name", $1) FROM "schema"."user" "User"`,
        [' & '],
      );
      expectQueryNotMutated(q);
    });

    it('should support raw sql parameter', async () => {
      const q = db.user.all();
      expectSql(
        q
          .stringAgg(
            testDb.sql`name`.type((t) => t.text()),
            ' & ',
          )
          .toSQL(),
        `SELECT string_agg(name, $1) FROM "schema"."user" "User"`,
        [' & '],
      );
      expectQueryNotMutated(q);
    });

    it(`.stringAgg should select aggregated value`, () => {
      const q = db.user.all();
      const expectedSql = `SELECT string_agg("User"."name", $1) FROM "schema"."user" "User"`;
      expectSql(q.stringAgg('Name', ' & ').toSQL(), expectedSql, [' & ']);
      expectQueryNotMutated(q);
    });

    it(`.stringAgg supports raw sql`, () => {
      const q = db.user.all();
      const expectedSql = `SELECT string_agg(name, $1) FROM "schema"."user" "User"`;
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
        await db.user.createMany([
          { ...UserData, Age: 20 },
          { ...UserData, Age: 20 },
        ]);
        await db.user.createMany([
          { ...UserData, Age: 30 },
          { ...UserData, Age: 30 },
        ]);

        const q = db.user.select({
          result: (q) =>
            q[method as 'rowNumber']({
              partitionBy: 'Age',
              order: { createdAt: 'DESC' },
            }),
        });

        const value = await q;

        assertType<typeof value, { result: number | null }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT ${functionName}() OVER (
              PARTITION BY "User"."age"
              ORDER BY "User"."created_at" DESC
            ) "result" FROM "schema"."user" "User"
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
