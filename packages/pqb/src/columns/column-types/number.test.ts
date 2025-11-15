import {
  assertType,
  expectSql,
  testZodColumnTypes as t,
  testDb,
  TestSchemaConfig,
  useTestDatabase,
} from 'test-utils';
import { ColumnToCodeCtx } from '../../core';

const ctx: ColumnToCodeCtx = {
  t: 't',
  table: 'table',
  currentSchema: 'public',
};

const testNumberColumnMethods = (
  type: ReturnType<
    TestSchemaConfig['smallint' | 'integer' | 'real' | 'smallSerial' | 'serial']
  >,
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
      .toCode(ctx, 'key'),
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

  expect(type.positive().toCode(ctx, 'key')).toBe(`t.${name}().gt(0)`);
  expect(type.nonNegative().toCode(ctx, 'key')).toBe(`t.${name}().min(0)`);
  expect(type.negative().toCode(ctx, 'key')).toBe(`t.${name}().lt(0)`);
  expect(type.nonPositive().toCode(ctx, 'key')).toBe(`t.${name}().max(0)`);

  expect(type.min(1).max(2).step(3).toCode(ctx, 'key')).toBe(
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
      expect(t.smallint().toCode(ctx, 'key')).toBe('t.smallint()');

      testNumberColumnMethods(t.smallint(), 'smallint');
    });

    it('should have toCode with identity', () => {
      const code = t.smallint().identity({ always: true }).toCode(ctx, 'key');

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
      expect(t.integer().toCode(ctx, 'key')).toBe('t.integer()');

      testNumberColumnMethods(t.integer(), 'integer');
    });

    it('should have toCode with identity', () => {
      const code = t.identity({ always: true }).toCode(ctx, 'key');

      expect(code).toEqual(['t.identity({', ['always: true,'], '})']);
    });
  });

  describe('bigint', () => {
    useTestDatabase();

    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`1::bigint`.type(() => t.bigint()),
      );
      expect(result).toBe('1');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(t.bigint().toCode(ctx, 'key')).toBe('t.bigint()');
    });

    it('should have toCode with identity', () => {
      const code = t.bigint().identity({ always: true }).toCode(ctx, 'key');

      expect(code).toEqual(['t.bigint().identity({', ['always: true,'], '})']);
    });

    it('should encode JS BigInt', () => {
      const { inputType } = t.bigint();

      assertType<typeof inputType, string | number | bigint>();
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
        undefined,
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
      expect(t.decimal().toCode(ctx, 'key')).toBe('t.decimal()');
      expect(t.decimal(1).toCode(ctx, 'key')).toBe('t.decimal(1)');
      expect(t.decimal(1, 2).toCode(ctx, 'key')).toBe('t.decimal(1, 2)');
    });
  });

  describe('real', () => {
    it('should output number', async () => {
      const result = await testDb.get(testDb.sql`1::real`.type(() => t.real()));
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(t.real().toCode(ctx, 'key')).toBe('t.real()');

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
      expect(t.doublePrecision().toCode(ctx, 'key')).toBe(
        't.doublePrecision()',
      );
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
      expect(t.smallSerial().toCode(ctx, 'key')).toBe('t.smallSerial()');

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
      expect(t.serial().toCode(ctx, 'key')).toBe('t.serial()');

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
      expect(t.bigSerial().toCode(ctx, 'key')).toBe('t.bigSerial()');
    });
  });
});
