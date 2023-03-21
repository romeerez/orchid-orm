import { assertType, db } from '../test-utils/test-utils';
import {
  BigIntColumn,
  BigSerialColumn,
  DecimalColumn,
  DoublePrecisionColumn,
  IntegerColumn,
  NumberBaseColumn,
  RealColumn,
  SerialColumn,
  SmallIntColumn,
  SmallSerialColumn,
} from './number';

const testNumberColumnMethods = (type: NumberBaseColumn, name: string) => {
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
  afterAll(db.close);

  describe('smallint', () => {
    it('should output number', async () => {
      const result = await db.get(
        db.raw(() => new SmallIntColumn({}), '1::smallint'),
      );
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(new SmallIntColumn({}).toCode('t')).toBe('t.smallint()');

      testNumberColumnMethods(new SmallIntColumn({}), 'smallint');
    });
  });

  describe('integer', () => {
    it('should output number', async () => {
      const result = await db.get(
        db.raw(() => new IntegerColumn({}), '1::integer'),
      );
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(new IntegerColumn({}).toCode('t')).toBe('t.integer()');

      testNumberColumnMethods(new IntegerColumn({}), 'integer');
    });
  });

  describe('bigint', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(() => new BigIntColumn({}), '1::bigint'),
      );
      expect(result).toBe('1');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(new BigIntColumn({}).toCode('t')).toBe('t.bigint()');
    });
  });

  describe('decimal', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(() => new DecimalColumn({}), '1::decimal'),
      );
      expect(result).toBe('1');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(new DecimalColumn({}).toCode('t')).toBe('t.decimal()');
      expect(new DecimalColumn({}, 1).toCode('t')).toBe('t.decimal(1)');
      expect(new DecimalColumn({}, 1, 2).toCode('t')).toBe('t.decimal(1, 2)');
    });
  });

  describe('real', () => {
    it('should output number', async () => {
      const result = await db.get(db.raw(() => new RealColumn({}), '1::real'));
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(new RealColumn({}).toCode('t')).toBe('t.real()');

      testNumberColumnMethods(new RealColumn({}), 'real');
    });
  });

  describe('doublePrecision', () => {
    it('should output number', async () => {
      const result = await db.get(
        db.raw(() => new DoublePrecisionColumn({}), '1::double precision'),
      );
      expect(result).toBe(1);

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(new DoublePrecisionColumn({}).toCode('t')).toBe(
        't.doublePrecision()',
      );
    });
  });

  describe('smallSerial', () => {
    it('should output number', async () => {
      const result = await db.get(
        db.raw(() => new SmallSerialColumn({}), '1::smallint'),
      );
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(new SmallSerialColumn({}).toCode('t')).toBe('t.smallSerial()');

      testNumberColumnMethods(new SmallSerialColumn({}), 'smallSerial');
    });
  });

  describe('serial', () => {
    it('should output number', async () => {
      const result = await db.get(
        db.raw(() => new SerialColumn({}), '1::integer'),
      );
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });

    it('should have toCode', () => {
      expect(new SerialColumn({}).toCode('t')).toBe('t.serial()');

      testNumberColumnMethods(new SerialColumn({}), 'serial');
    });
  });

  describe('bigSerial', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(() => new BigSerialColumn({}), '1::bigint'),
      );
      expect(result).toBe('1');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(new BigSerialColumn({}).toCode('t')).toBe('t.bigSerial()');
    });
  });
});
