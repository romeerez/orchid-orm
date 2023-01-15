import { assertType, db } from '../test-utils/test-utils';
import {
  DateColumn,
  IntervalColumn,
  TimeColumn,
  TimeInterval,
  TimestampColumn,
  TimestampWithTimeZoneColumn,
  TimeWithTimeZoneColumn,
} from './dateTime';

describe('date time columns', () => {
  describe('date', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(() => new DateColumn(), `'1999-01-08'::date`),
      );
      expect(result).toBe('1999-01-08');

      assertType<typeof result, string>();
    });
  });

  describe('timestamp', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(() => new TimestampColumn(), `'1999-01-08 04:05:06'::timestamp`),
      );
      expect(result).toBe('1999-01-08 04:05:06');

      assertType<typeof result, string>();
    });
  });

  describe('timestamp with time zone', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(
          () => new TimestampWithTimeZoneColumn(),
          `'1999-01-08 04:05:06 +0'::timestamptz AT TIME ZONE 'UTC'`,
        ),
      );
      expect(result).toBe('1999-01-08 04:05:06');

      assertType<typeof result, string>();
    });
  });

  describe('time', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(() => new TimeColumn(), `'12:00'::time`),
      );
      expect(result).toBe('12:00:00');

      assertType<typeof result, string>();
    });
  });

  describe('time with time zone', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(
          () => new TimeWithTimeZoneColumn(),
          `'12:00 +0'::timetz AT TIME ZONE 'UTC'`,
        ),
      );
      expect(result).toBe('12:00:00+00');

      assertType<typeof result, string>();
    });
  });

  describe('interval', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(
          () => new IntervalColumn(),
          `'1 year 2 months 3 days 4 hours 5 minutes 6 seconds'::interval`,
        ),
      );
      expect(result).toEqual({
        years: 1,
        months: 2,
        days: 3,
        hours: 4,
        minutes: 5,
        seconds: 6,
      });

      assertType<typeof result, TimeInterval>();
    });
  });
});
