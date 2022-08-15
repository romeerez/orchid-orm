import { User, expectQueryNotMutated, expectSql } from '../test-utils';
import { raw } from '../common';

describe('aggregate', () => {
  describe('aggregate options', () => {
    test('without options', () => {
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

  describe.each`
    method        | functionName
    ${'count'}    | ${'count'}
    ${'avg'}      | ${'avg'}
    ${'min'}      | ${'min'}
    ${'max'}      | ${'max'}
    ${'sum'}      | ${'sum'}
    ${'arrayAgg'} | ${'array_agg'}
    ${'bitAnd'}   | ${'bit_and'}
    ${'bitOr'}    | ${'bit_or'}
    ${'boolAnd'}  | ${'bool_and'}
    ${'boolOr'}   | ${'bool_or'}
    ${'every'}    | ${'every'}
    ${'jsonAgg'}  | ${'json_agg'}
    ${'jsonbAgg'} | ${'jsonb_agg'}
    ${'xmlAgg'}   | ${'xmlagg'}
  `('$method', ({ method, functionName }) => {
    it(`should perform ${method} query for a column`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}("user"."name") FROM "user"`;
      expectSql(q[method as 'count']('name').toSql(), expectedSql);
      expectQueryNotMutated(q);

      q[`_${method}` as `_count`]('name');
      expectSql(q.toSql(), expectedSql);
    });

    it('should support raw sql parameter', () => {
      const q = User.all();
      expectSql(
        q[method as 'count'](raw('name')).toSql(),
        `SELECT ${functionName}(name) FROM "user"`,
      );
      expectQueryNotMutated(q);
    });

    const selectMethod = `select${method[0].toUpperCase()}${method.slice(1)}`;
    it(`.${selectMethod} should select aggregated value`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}("user"."name") AS "name" FROM "user"`;
      expectSql(
        q[selectMethod as 'selectCount']('name', { as: 'name' }).toSql(),
        expectedSql,
      );
      expectQueryNotMutated(q);
    });

    it(`.${selectMethod} supports raw sql`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}(name) AS "name" FROM "user"`;
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
    it(`should perform ${method} query for a column`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}($1, "user"."name") FROM "user"`;
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
        `SELECT ${functionName}($1, name) FROM "user"`,
        ['alias'],
      );
      expectQueryNotMutated(q);
    });

    const selectMethod = `select${method[0].toUpperCase()}${method.slice(1)}`;
    it(`.${selectMethod} should select aggregated value`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}($1, "user"."name") AS "name" FROM "user"`;
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
      const expectedSql = `SELECT ${functionName}($1, name) AS "name" FROM "user"`;
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
