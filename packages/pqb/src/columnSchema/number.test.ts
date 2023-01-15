import { assertType, db } from '../test-utils/test-utils';
import {
  BigIntColumn,
  BigSerialColumn,
  DecimalColumn,
  DoublePrecisionColumn,
  IntegerColumn,
  RealColumn,
  SerialColumn,
  SmallIntColumn,
  SmallSerialColumn,
} from './number';

describe('number columns', () => {
  describe('smallint', () => {
    it('should output number', async () => {
      const result = await db.get(
        db.raw(() => new SmallIntColumn(), '1::smallint'),
      );
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });
  });

  describe('integer', () => {
    it('should output number', async () => {
      const result = await db.get(
        db.raw(() => new IntegerColumn(), '1::integer'),
      );
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });
  });

  describe('bigint', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(() => new BigIntColumn(), '1::bigint'),
      );
      expect(result).toBe('1');

      assertType<typeof result, string>();
    });
  });

  describe('numeric', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(() => new DecimalColumn(), '1::numeric'),
      );
      expect(result).toBe('1');

      assertType<typeof result, string>();
    });
  });

  describe('decimal', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(() => new DecimalColumn(), '1::decimal'),
      );
      expect(result).toBe('1');

      assertType<typeof result, string>();
    });
  });

  describe('real', () => {
    it('should output number', async () => {
      const result = await db.get(db.raw(() => new RealColumn(), '1::real'));
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });
  });

  describe('doublePrecision', () => {
    it('should output number', async () => {
      const result = await db.get(
        db.raw(() => new DoublePrecisionColumn(), '1::double precision'),
      );
      expect(result).toBe(1);

      assertType<typeof result, string>();
    });
  });

  describe('smallSerial', () => {
    it('should output number', async () => {
      const result = await db.get(
        db.raw(() => new SmallSerialColumn(), '1::smallint'),
      );
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });
  });

  describe('serial', () => {
    it('should output number', async () => {
      const result = await db.get(
        db.raw(() => new SerialColumn(), '1::integer'),
      );
      expect(result).toBe(1);

      assertType<typeof result, number>();
    });
  });

  describe('bigSerial', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(() => new BigSerialColumn(), '1::bigint'),
      );
      expect(result).toBe('1');

      assertType<typeof result, string>();
    });
  });
});
