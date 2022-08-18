import {
  User,
  expectQueryNotMutated,
  expectSql,
  AssertEqual,
  useTestDatabase,
  insertUser,
  insertUsers,
} from '../test-utils';
import { raw } from '../common';

describe('aggregate', () => {
  useTestDatabase();

  describe('aggregate options', () => {
    test('without options', async () => {
      expectSql(User.count('*').toSql(), 'SELECT count(*) FROM "user"');
    });

    test('as', () => {
      const q = User.count('*', { as: 'a' });
      expectSql(q.toSql(), 'SELECT count(*) AS "a" FROM "user"');
    });

    test('distinct', () => {
      expectSql(
        User.count('name', { distinct: true }).toSql(),
        'SELECT count(DISTINCT "user"."name") FROM "user"',
      );
    });

    test('order', () => {
      expectSql(
        User.count('name', { order: { name: 'DESC' } }).toSql(),
        'SELECT count("user"."name" ORDER BY "user"."name" DESC) FROM "user"',
      );
    });

    test('filter', () => {
      expectSql(
        User.count('name', { filter: { age: { not: null } } }).toSql(),
        'SELECT count("user"."name") FILTER (WHERE "user"."age" IS NOT NULL) FROM "user"',
      );
    });

    describe('over', () => {
      test('with column partitionBy', () => {
        expectSql(
          User.count('name', {
            over: {
              partitionBy: 'id',
              order: {
                id: 'DESC',
              },
            },
          }).toSql(),
          `
            SELECT count("user"."name") OVER (PARTITION BY "user"."id" ORDER BY "user"."id" DESC)
            FROM "user"
          `,
        );
      });

      test('with columns array partitionBy', () => {
        expectSql(
          User.count('name', {
            over: {
              partitionBy: ['id', 'name'],
              order: {
                id: 'DESC',
              },
            },
          }).toSql(),
          `
            SELECT count("user"."name") OVER (PARTITION BY "user"."id", "user"."name" ORDER BY "user"."id" DESC)
            FROM "user"
          `,
        );
      });
    });

    test('all options', () => {
      expectSql(
        User.count('name', {
          as: 'a',
          distinct: true,
          order: { name: 'DESC' },
          filter: { age: { not: null } },
          over: {
            partitionBy: 'id',
            order: {
              id: 'DESC',
            },
          },
        }).toSql(),
        `
          SELECT
            count(DISTINCT "user"."name" ORDER BY "user"."name" DESC)
              FILTER (WHERE "user"."age" IS NOT NULL)
              OVER (
                PARTITION BY "user"."id"
                ORDER BY "user"."id" DESC
              ) AS "a"
          FROM "user"
        `,
      );
    });

    test('withinGroup', () => {
      expectSql(
        User.count('name', {
          distinct: true,
          order: { name: 'DESC' },
          filter: { age: { not: null } },
          withinGroup: true,
        }).toSql(),
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

      const eq: AssertEqual<typeof count, number> = true;
      expect(eq).toBe(true);

      expect(typeof count).toBe('number');
    });

    describe('selectCount', () => {
      it('should select number', async () => {
        await insertUser();

        const user = await User.selectCount().takeOrThrow();
        expect(user.count).toBe(1);

        const eq: AssertEqual<typeof user.count, number> = true;
        expect(eq).toBe(true);
      });
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
  `('$method', ({ method, functionName }) => {
    it('should return null when no records', async () => {
      const value = await User[method as 'avg']('id');

      const eq: AssertEqual<typeof value, number | null> = true;
      expect(eq).toBe(true);

      expect(value).toBe(null);
    });

    it('should return number when have records', async () => {
      await insertUser();

      const value = await User[method as 'avg']('id');

      const eq: AssertEqual<typeof value, number | null> = true;
      expect(eq).toBe(true);

      expect(typeof value).toBe('number');
    });

    const selectMethod = `select${method[0].toUpperCase()}${method.slice(
      1,
    )}` as 'selectAvg';
    describe(selectMethod, () => {
      it('should select null when no record', async () => {
        const value = await User[selectMethod]('id').takeOrThrow();

        const eq: AssertEqual<typeof value, { avg: number | null }> = true;
        expect(eq).toBe(true);

        expect(value).toEqual({ [functionName]: null });
      });

      it('should return number when have records', async () => {
        await insertUser();

        const value = await User[selectMethod]('id').takeOrThrow();

        const eq: AssertEqual<typeof value, { avg: number | null }> = true;
        expect(eq).toBe(true);

        expect(value).toEqual({ [functionName]: 1 });
      });
    });
  });

  describe.each`
    method       | functionName
    ${'boolAnd'} | ${'bool_and'}
    ${'boolOr'}  | ${'bool_or'}
    ${'every'}   | ${'every'}
  `('$method', ({ method, functionName }) => {
    it('should return null when no records', async () => {
      const value = await User[method as 'boolAnd']('active');

      const eq: AssertEqual<typeof value, boolean | null> = true;
      expect(eq).toBe(true);

      expect(value).toBe(null);
    });

    it('should return boolean when have records', async () => {
      await insertUser();

      const value = await User[method as 'boolAnd']('active');

      const eq: AssertEqual<typeof value, boolean | null> = true;
      expect(eq).toBe(true);

      expect(typeof value).toBe('boolean');
    });

    const selectMethod = `select${method[0].toUpperCase()}${method.slice(
      1,
    )}` as 'selectBoolAnd';
    describe(selectMethod, () => {
      it('should select null when no record', async () => {
        const value = await User[selectMethod]('active').takeOrThrow();

        const eq: AssertEqual<typeof value, { bool_and: boolean | null }> =
          true;
        expect(eq).toBe(true);

        expect(value).toEqual({ [functionName]: null });
      });

      it('should return boolean when have records', async () => {
        await insertUser();

        const value = await User[selectMethod]('active').takeOrThrow();

        const eq: AssertEqual<typeof value, { bool_and: boolean | null }> =
          true;
        expect(eq).toBe(true);

        expect(value).toEqual({ [functionName]: true });
      });
    });
  });

  describe.each`
    method        | functionName
    ${'jsonAgg'}  | ${'json_agg'}
    ${'jsonbAgg'} | ${'jsonb_agg'}
  `('$method', ({ method, functionName }) => {
    const data = { name: 'name', tags: [] };

    it('should return null when no records', async () => {
      const value = await User[method as 'jsonAgg']('data');

      const eq: AssertEqual<
        typeof value,
        ({ name: string; tags: string[] } | null)[] | null
      > = true;
      expect(eq).toBe(true);

      expect(value).toBe(null);
    });

    it('should return json array when have records', async () => {
      await insertUser({ data });

      const value = await User[method as 'jsonAgg']('data');

      const eq: AssertEqual<
        typeof value,
        ({ name: string; tags: string[] } | null)[] | null
      > = true;
      expect(eq).toBe(true);

      expect(value).toEqual([data]);
    });

    const selectMethod = `select${method[0].toUpperCase()}${method.slice(
      1,
    )}` as 'selectJsonAgg';
    describe(selectMethod, () => {
      it('should select null when no record', async () => {
        const value = await User[selectMethod]('data').takeOrThrow();

        const eq: AssertEqual<
          typeof value,
          { json_agg: ({ name: string; tags: string[] } | null)[] | null }
        > = true;
        expect(eq).toBe(true);

        expect(value).toEqual({ [functionName]: null });
      });

      it('should return json array when have records', async () => {
        await insertUser({ data });

        const value = await User[selectMethod]('data').takeOrThrow();

        const eq: AssertEqual<
          typeof value,
          { json_agg: ({ name: string; tags: string[] } | null)[] | null }
        > = true;
        expect(eq).toBe(true);

        expect(value).toEqual({ [functionName]: [data] });
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

      if (as) select += ` AS "${as}"`;

      return `SELECT ${select} FROM "user"`;
    };

    it(`should perform ${method} query for a column`, () => {
      const q = User.all();

      const expectedSql = getSql('"user"."name"');
      expectSql(q[method as 'count']('name').toSql(), expectedSql);
      expectQueryNotMutated(q);

      q[`_${method}` as `_count`]('name');
      expectSql(q.toSql(), expectedSql);
    });

    it('should support raw sql parameter', () => {
      const q = User.all();
      expectSql(q[method as 'count'](raw('name')).toSql(), getSql('name'));
      expectQueryNotMutated(q);
    });

    const selectMethod = `select${method[0].toUpperCase()}${method.slice(1)}`;
    it(`.${selectMethod} should select aggregated value`, () => {
      const q = User.all();
      const expectedSql = getSql('"user"."name"', 'name');
      expectSql(
        q[selectMethod as 'selectCount']('name', { as: 'name' }).toSql(),
        expectedSql,
      );
      expectQueryNotMutated(q);
    });

    it(`.${selectMethod} supports raw sql`, () => {
      const q = User.all();
      const expectedSql = getSql('name', 'name');
      expectSql(
        q[selectMethod as 'selectCount'](raw('name'), { as: 'name' }).toSql(),
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
    it('should return null when no records', async () => {
      const value = await User[method as 'jsonObjectAgg']({ alias: 'name' });

      const eq: AssertEqual<typeof value, { alias: string } | null> = true;
      expect(eq).toBe(true);

      expect(value).toBe(null);
    });

    it('should return json object when have records', async () => {
      await insertUser();

      const value = await User[method as 'jsonObjectAgg']({ alias: 'name' });

      const eq: AssertEqual<typeof value, { alias: string } | null> = true;
      expect(eq).toBe(true);

      expect(value).toEqual({ alias: 'name' });
    });

    const selectMethod = `select${method[0].toUpperCase()}${method.slice(
      1,
    )}` as 'selectJsonObjectAgg';
    describe(selectMethod, () => {
      it('should select null when no record', async () => {
        const value = await User[selectMethod]({ alias: 'name' }).takeOrThrow();

        const eq: AssertEqual<
          typeof value,
          { json_object_agg: { alias: string } | null }
        > = true;
        expect(eq).toBe(true);

        expect(value).toEqual({ [functionName]: null });
      });

      it('should return json object when have records', async () => {
        await insertUser();

        const value = await User[selectMethod]({ alias: 'name' }).takeOrThrow();

        const eq: AssertEqual<
          typeof value,
          { json_object_agg: { alias: string } | null }
        > = true;
        expect(eq).toBe(true);

        expect(value).toEqual({ [functionName]: { alias: 'name' } });
      });
    });

    it(`should perform ${method} query for a column`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}($1::text, "user"."name") FROM "user"`;
      expectSql(
        q[method as 'jsonObjectAgg']({ alias: 'name' }).toSql(),
        expectedSql,
        ['alias'],
      );
      expectQueryNotMutated(q);

      q[`_${method}` as '_jsonObjectAgg']({ alias: 'name' });
      expectSql(q.toSql(), expectedSql, ['alias']);
    });

    it('should support raw sql parameter', () => {
      const q = User.all();
      expectSql(
        q[method as 'jsonObjectAgg']({
          alias: raw('name'),
        }).toSql(),
        `SELECT ${functionName}($1::text, name) FROM "user"`,
        ['alias'],
      );
      expectQueryNotMutated(q);
    });

    it(`.${selectMethod} should select aggregated value`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}($1::text, "user"."name") AS "name" FROM "user"`;
      expectSql(
        q[selectMethod as 'jsonObjectAgg'](
          { alias: 'name' },
          { as: 'name' },
        ).toSql(),
        expectedSql,
        ['alias'],
      );
      expectQueryNotMutated(q);
    });

    it(`.${selectMethod} supports raw sql`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}($1::text, name) AS "name" FROM "user"`;
      expectSql(
        q[selectMethod as 'jsonObjectAgg'](
          { alias: raw('name') },
          { as: 'name' },
        ).toSql(),
        expectedSql,
        ['alias'],
      );
      expectQueryNotMutated(q);
    });
  });

  describe('stringAgg', () => {
    it('should return null when no records', async () => {
      const value = await User.stringAgg('name', ', ');

      const eq: AssertEqual<typeof value, string | null> = true;
      expect(eq).toBe(true);

      expect(value).toBe(null);
    });

    it('should return json object when have records', async () => {
      await insertUsers(2);

      const value = await User.stringAgg('name', ', ');

      const eq: AssertEqual<typeof value, string | null> = true;
      expect(eq).toBe(true);

      expect(value).toEqual('name, name');
    });

    describe('selectStringAgg', () => {
      it('should select null when no record', async () => {
        const value = await User.selectStringAgg('name', ', ').takeOrThrow();

        const eq: AssertEqual<typeof value, { string_agg: string | null }> =
          true;
        expect(eq).toBe(true);

        expect(value).toEqual({ string_agg: null });
      });

      it('should return json object when have records', async () => {
        await insertUsers(2);

        const value = await User.selectStringAgg('name', ', ').takeOrThrow();

        const eq: AssertEqual<typeof value, { string_agg: string | null }> =
          true;
        expect(eq).toBe(true);

        expect(value).toEqual({ string_agg: 'name, name' });
      });
    });

    it('makes stringAgg query', () => {
      const q = User.all();
      const expectedSql = `SELECT string_agg("user"."name", $1) FROM "user"`;
      expectSql(q.stringAgg('name', ' & ').toSql(), expectedSql, [' & ']);
      expectQueryNotMutated(q);

      q._stringAgg('name', ' & ');
      expectSql(q.toSql(), expectedSql, [' & ']);
    });

    it('should support raw sql parameter', async () => {
      const q = User.all();
      expectSql(
        q.stringAgg(raw('name'), ' & ').toSql(),
        `SELECT string_agg(name, $1) FROM "user"`,
        [' & '],
      );
      expectQueryNotMutated(q);
    });

    it(`.stringAgg should select aggregated value`, () => {
      const q = User.all();
      const expectedSql = `SELECT string_agg("user"."name", $1) AS "name" FROM "user"`;
      expectSql(
        q.stringAgg('name', ' & ', { as: 'name' }).toSql(),
        expectedSql,
        [' & '],
      );
      expectQueryNotMutated(q);
    });

    it(`.stringAgg supports raw sql`, () => {
      const q = User.all();
      const expectedSql = `SELECT string_agg(name, $1) AS "name" FROM "user"`;
      expectSql(
        q.stringAgg(raw('name'), ' & ', { as: 'name' }).toSql(),
        expectedSql,
        [' & '],
      );
      expectQueryNotMutated(q);
    });
  });

  describe.each`
    method           | functionName
    ${'rowNumber'}   | ${'row_number'}
    ${'rank'}        | ${'rank'}
    ${'denseRank'}   | ${'dense_rank'}
    ${'percentRank'} | ${'percent_rank'}
    ${'cumeDust'}    | ${'cume_dust'}
  `('$method', ({ method, functionName }) => {
    it(`should perform ${method} query`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}() OVER (PARTITION BY "user"."name" ORDER BY "user"."createdAt" DESC) AS "as" FROM "user"`;
      expectSql(
        q[method as 'rank']({
          as: 'as',
          partitionBy: 'name',
          order: { createdAt: 'DESC' },
        }).toSql(),
        expectedSql,
      );
      expectQueryNotMutated(q);

      q[`_${method}` as '_rank']({
        as: 'as',
        partitionBy: 'name',
        order: { createdAt: 'DESC' },
      });
      expectSql(q.toSql(), expectedSql);
    });
  });
});
