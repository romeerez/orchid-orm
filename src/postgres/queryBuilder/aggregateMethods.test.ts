import { expectQueryNotMutated, line } from '../common/test-utils/test-utils';
import { raw } from './common';
import { db } from '../common/test-utils/test-db';

const User = db.user;

describe('aggregate', () => {
  describe('aggregate options', () => {
    test('without options', () => {
      expect(User.count('*').toSql()).toBe('SELECT count(*) FROM "user"');
    });

    test('distinct', () => {
      expect(User.count('name', { distinct: true }).toSql()).toBe(
        'SELECT count(DISTINCT "user"."name") FROM "user"',
      );
    });

    test('order', () => {
      expect(User.count('name', { order: '"user"."name" DESC' }).toSql()).toBe(
        'SELECT count("user"."name" ORDER BY "user"."name" DESC) FROM "user"',
      );
    });

    test('filter', () => {
      expect(User.count('name', { filter: 'name IS NOT NULL' }).toSql()).toBe(
        'SELECT count("user"."name") FILTER (WHERE name IS NOT NULL) FROM "user"',
      );
    });

    test('over', () => {
      expect(
        User.count('name', {
          over: {
            partitionBy: 'id',
            order: {
              id: 'DESC',
            },
          },
        }).toSql(),
      ).toBe(
        line(`
        SELECT count("user"."name") OVER (PARTITION BY "user"."id" ORDER BY "user"."id" DESC)
        FROM "user"
      `),
      );
    });

    test('all options', () => {
      expect(
        User.count('name', {
          distinct: true,
          order: 'name DESC',
          filter: 'name IS NOT NULL',
          over: {
            partitionBy: 'id',
            order: {
              id: 'DESC',
            },
          },
        }).toSql(),
      ).toBe(
        line(`
        SELECT
          count(DISTINCT "user"."name" ORDER BY name DESC)
            FILTER (WHERE name IS NOT NULL)
            OVER (
              PARTITION BY "user"."id"
              ORDER BY "user"."id" DESC
            )
        FROM "user"
      `),
      );
    });

    test('withinGroup', () => {
      expect(
        User.count('name', {
          distinct: true,
          order: 'name DESC',
          filter: 'name IS NOT NULL',
          withinGroup: true,
        }).toSql(),
      ).toBe(
        'SELECT count("user"."name") WITHIN GROUP (ORDER BY name DESC) FILTER (WHERE name IS NOT NULL) FROM "user"',
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
      expect(q[method as 'count']('name').toSql()).toBe(expectedSql);
      expectQueryNotMutated(q);

      q[`_${method}` as `_count`]('name');
      expect(q.toSql()).toBe(expectedSql);
    });

    it('should support raw sql parameter', () => {
      const q = User.all();
      expect(q[method as 'count'](raw('name')).toSql()).toBe(
        `SELECT ${functionName}(name) FROM "user"`,
      );
      expectQueryNotMutated(q);
    });

    const selectMethod = `select${method[0].toUpperCase()}${method.slice(1)}`;
    it(`.${selectMethod} should select aggregated value`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}("user"."name") AS "name" FROM "user"`;
      expect(
        q[selectMethod as 'selectCount']('name', { as: 'name' }).toSql(),
      ).toBe(expectedSql);
      expectQueryNotMutated(q);
    });

    it(`.${selectMethod} supports raw sql`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}(name) AS "name" FROM "user"`;
      expect(
        q[selectMethod as 'selectCount'](raw('name'), { as: 'name' }).toSql(),
      ).toBe(expectedSql);
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
      const expectedSql = `SELECT ${functionName}('alias', "user"."name") FROM "user"`;
      expect(q[method as 'jsonObjectAgg']({ alias: 'name' }).toSql()).toBe(
        expectedSql,
      );
      expectQueryNotMutated(q);

      q[`_${method}` as '_jsonObjectAgg']({ alias: 'name' });
      expect(q.toSql()).toBe(expectedSql);
    });

    it('should support raw sql parameter', () => {
      const q = User.all();
      expect(
        q[method as 'jsonObjectAgg']({
          alias: raw('name'),
        }).toSql(),
      ).toBe(`SELECT ${functionName}('alias', name) FROM "user"`);
      expectQueryNotMutated(q);
    });

    const selectMethod = `select${method[0].toUpperCase()}${method.slice(1)}`;
    it(`.${selectMethod} should select aggregated value`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}('alias', "user"."name") AS "name" FROM "user"`;
      expect(
        q[selectMethod as 'jsonObjectAgg'](
          { alias: 'name' },
          { as: 'name' },
        ).toSql(),
      ).toBe(expectedSql);
      expectQueryNotMutated(q);
    });

    it(`.${selectMethod} supports raw sql`, () => {
      const q = User.all();
      const expectedSql = `SELECT ${functionName}('alias', name) AS "name" FROM "user"`;
      expect(
        q[selectMethod as 'jsonObjectAgg'](
          { alias: raw('name') },
          { as: 'name' },
        ).toSql(),
      ).toBe(expectedSql);
      expectQueryNotMutated(q);
    });
  });

  describe('stringAgg', () => {
    it('makes stringAgg query', () => {
      const q = User.all();
      const expectedSql = `SELECT string_agg("user"."name", ' & ') FROM "user"`;
      expect(q.stringAgg('name', ' & ').toSql()).toBe(expectedSql);
      expectQueryNotMutated(q);

      q._stringAgg('name', ' & ');
      expect(q.toSql()).toBe(expectedSql);
    });

    it('should support raw sql parameter', async () => {
      const q = User.all();
      expect(q.stringAgg(raw('name'), ' & ').toSql()).toBe(
        `SELECT string_agg(name, ' & ') FROM "user"`,
      );
      expectQueryNotMutated(q);
    });

    it(`.stringAgg should select aggregated value`, () => {
      const q = User.all();
      const expectedSql = `SELECT string_agg("user"."name", ' & ') AS "name" FROM "user"`;
      expect(q.stringAgg('name', ' & ', { as: 'name' }).toSql()).toBe(
        expectedSql,
      );
      expectQueryNotMutated(q);
    });

    it(`.stringAgg supports raw sql`, () => {
      const q = User.all();
      const expectedSql = `SELECT string_agg(name, ' & ') AS "name" FROM "user"`;
      expect(q.stringAgg(raw('name'), ' & ', { as: 'name' }).toSql()).toBe(
        expectedSql,
      );
      expectQueryNotMutated(q);
    });
  });
});
