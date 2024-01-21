import { NumberBaseColumn } from './number';
import {
  assertType,
  expectSql,
  testColumnTypes as t,
  testDb,
  TestSchemaConfig,
} from 'test-utils';

const testNumberColumnMethods = (
  type: NumberBaseColumn<TestSchemaConfig, TestSchemaConfig['type']> &
    TestSchemaConfig['numberMethods'],
  name: string,
) => {
  expect(
    type
      .lt(1, 'lt message')
      .lte(2, 'lte message')
      .gt(3, 'gt message')
      .gte(4, 'gte message')
      .step(5, 'step message')
      .finite('finite message')
      .safe('safe message')
      .toCode('t'),
  ).toBe(
    `t.${name}()` +
      ".gt(3, 'gt message')" +
      ".min(4, 'gte message')" +
      ".lt(1, 'lt message')" +
      ".max(2, 'lte message')" +
      ".step(5, 'step message')" +
      ".finite('finite message')" +
      ".safe('safe message')",
  );

  expect(type.positive().toCode('t')).toBe(`t.${name}().gt(0)`);
  expect(type.nonNegative().toCode('t')).toBe(`t.${name}().min(0)`);
  expect(type.negative().toCode('t')).toBe(`t.${name}().lt(0)`);
  expect(type.nonPositive().toCode('t')).toBe(`t.${name}().max(0)`);

  expect(type.min(1).max(2).step(3).toCode('t')).toBe(
    `t.${name}().min(1).max(2).step(3)`,
  );
};

describe('number columns', () => {
  afterAll(testDb.close);

  describe('smallint', () => {
    it('should output number', async () => {
      const result = await testDb.get(
        testDb.sql`1::smallint`.type((t) => t.smallint()),
      );
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(t.smallint().toCode('t')).toBe('t.smallint()');

      testNumberColumnMethods(t.smallint(), 'smallint');
    });

    it('should have toCode with identity', () => {
      const code = t.smallint().identity({ always: true }).toCode('t');

      expect(code).toEqual([
        't.smallint().identity({',
        ['always: true,'],
        '})',
      ]);
    });
  });

  describe('integer', () => {
    it('should output number', async () => {
      const result = await testDb.get(
        testDb.sql`1::integer`.type(() => t.integer()),
      );
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(t.integer().toCode('t')).toBe('t.integer()');

      testNumberColumnMethods(t.integer(), 'integer');
    });

    it('should have toCode with identity', () => {
      const code = t.identity({ always: true }).toCode('t');

      expect(code).toEqual(['t.identity({', ['always: true,'], '})']);
    });
  });

  describe('bigint', () => {
    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`1::bigint`.type(() => t.bigint()),
      );
      expect(result).toBe('1');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(t.bigint().toCode('t')).toBe('t.bigint()');
    });

    it('should have toCode with identity', () => {
      const code = t.bigint().identity({ always: true }).toCode('t');

      expect(code).toEqual(['t.bigint().identity({', ['always: true,'], '})']);
    });
  });

  describe('identity', () => {
    it('should be optional when creating a record', () => {
      const table = testDb(
        'table',
        (t) => ({
          one: t.smallint().identity(),
          two: t.identity(),
          three: t.bigint().identity(),
        }),
        {
          noPrimaryKey: 'ignore',
        },
      );

      const q = table.create({});
      expectSql(
        q.toSQL(),
        `
          INSERT INTO "table"("one") VALUES (DEFAULT) RETURNING *
        `,
      );
    });
  });

  describe('decimal', () => {
    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`1::decimal`.type(() => t.decimal()),
      );
      expect(result).toBe('1');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(t.decimal().toCode('t')).toBe('t.decimal()');
      expect(t.decimal(1).toCode('t')).toBe('t.decimal(1)');
      expect(t.decimal(1, 2).toCode('t')).toBe('t.decimal(1, 2)');
    });
  });

  describe('real', () => {
    it('should output number', async () => {
      const result = await testDb.get(testDb.sql`1::real`.type(() => t.real()));
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(t.real().toCode('t')).toBe('t.real()');

      testNumberColumnMethods(t.real(), 'real');
    });
  });

  describe('doublePrecision', () => {
    it('should output number', async () => {
      const result = await testDb.get(
        testDb.sql`1::double precision`.type(() => t.doublePrecision()),
      );
      expect(result).toBe(1);

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(t.doublePrecision().toCode('t')).toBe('t.doublePrecision()');
    });
  });

  describe('smallSerial', () => {
    it('should output number', async () => {
      const result = await testDb.get(
        testDb.sql`1::smallint`.type(() => t.smallSerial()),
      );
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(t.smallSerial().toCode('t')).toBe('t.smallSerial()');

      testNumberColumnMethods(t.smallSerial(), 'smallSerial');
    });
  });

  describe('serial', () => {
    it('should output number', async () => {
      const result = await testDb.get(
        testDb.sql`1::integer`.type(() => t.serial()),
      );
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(t.serial().toCode('t')).toBe('t.serial()');

      testNumberColumnMethods(t.serial(), 'serial');
    });
  });

  describe('bigSerial', () => {
    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`1::bigint`.type(() => t.bigSerial()),
      );
      expect(result).toBe('1');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(t.bigSerial().toCode('t')).toBe('t.bigSerial()');
    });
  });
});
