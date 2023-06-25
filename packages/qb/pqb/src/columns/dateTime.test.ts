import { userData } from '../test-utils/test-utils';
import {
  DateColumn,
  IntervalColumn,
  TimeColumn,
  TimeInterval,
  TimestampColumn,
  TimestampTZColumn,
} from './dateTime';
import { columnTypes } from './columnTypes';
import { ColumnType } from './columnType';
import { assertType, expectSql, testDb, useTestDatabase } from 'test-utils';

const t = columnTypes;

const testTimestampInput = (column: ColumnType) => {
  const date = new Date();
  const string = date.toISOString();
  expect((column.encodeFn?.(string) as Date).toISOString()).toBe(string);

  const number = date.getTime();
  expect((column.encodeFn?.(number) as Date).getTime()).toBe(number);

  expect(column.encodeFn?.(date) as Date).toBe(date);
};

describe('date time columns', () => {
  useTestDatabase();
  afterAll(testDb.close);

  describe('date', () => {
    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`'1999-01-08'::date`.type(() => new DateColumn()),
      );
      expect(result).toBe('1999-01-08');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      const column = new DateColumn();
      expect(column.toCode('t')).toBe('t.date()');

      const now = new Date();
      const s = now.toISOString();
      expect(
        column.min(now, 'min message').max(now, 'max message').toCode('t'),
      ).toBe(
        `t.date()` +
          `.min(new Date('${s}'), 'min message')` +
          `.max(new Date('${s}'), 'max message')`,
      );
    });
  });

  describe('timestamp without time zone', () => {
    it('should accept string, number, and Date', async () => {
      testTimestampInput(t.timestampNoTZ());
    });

    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`'1999-01-08 04:05:06'::timestamp`.type(() =>
          t.timestampNoTZ(),
        ),
      );
      expect(result).toBe('1999-01-08 04:05:06');

      assertType<typeof result, string>();
    });

    it('should have toCode, ignore default precision', () => {
      expect(new TimestampColumn().toCode('t')).toBe('t.timestampNoTZ()');

      expect(new TimestampColumn(10).toCode('t')).toBe('t.timestampNoTZ(10)');

      expect(new TimestampColumn(6).toCode('t')).toBe('t.timestampNoTZ()');

      const now = new Date();
      const s = now.toISOString();
      expect(
        new TimestampColumn()
          .min(now, 'min message')
          .max(now, 'max message')
          .toCode('t'),
      ).toBe(
        `t.timestampNoTZ()` +
          `.min(new Date('${s}'), 'min message')` +
          `.max(new Date('${s}'), 'max message')`,
      );
    });
  });

  describe('timestamp with time zone', () => {
    it('should accept string, number, and Date', async () => {
      testTimestampInput(t.timestamp());
    });

    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`'1999-01-08 04:05:06 +0'::timestamptz AT TIME ZONE 'UTC'`.type(
          () => new TimestampTZColumn(),
        ),
      );
      expect(result).toBe('1999-01-08 04:05:06');

      assertType<typeof result, string>();
    });

    it('should have toCode, ignore default precision', () => {
      expect(new TimestampTZColumn().toCode('t')).toBe('t.timestamp()');

      expect(new TimestampTZColumn(6).toCode('t')).toBe('t.timestamp()');

      expect(new TimestampTZColumn(10).toCode('t')).toBe('t.timestamp(10)');

      const now = new Date();
      const s = now.toISOString();
      expect(
        new TimestampTZColumn()
          .min(now, 'min message')
          .max(now, 'max message')
          .toCode('t'),
      ).toBe(
        `t.timestamp()` +
          `.min(new Date('${s}'), 'min message')` +
          `.max(new Date('${s}'), 'max message')`,
      );
    });
  });

  describe('time', () => {
    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`'12:00'::time`.type(() => new TimeColumn()),
      );
      expect(result).toBe('12:00:00');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(new TimeColumn().toCode('t')).toBe('t.time()');
      expect(new TimeColumn(10).toCode('t')).toBe('t.time(10)');

      const now = new Date();
      const s = now.toISOString();
      expect(
        new TimeColumn()
          .min(now, 'min message')
          .max(now, 'max message')
          .toCode('t'),
      ).toBe(
        `t.time()` +
          `.min(new Date('${s}'), 'min message')` +
          `.max(new Date('${s}'), 'max message')`,
      );
    });
  });

  describe('interval', () => {
    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`'1 year 2 months 3 days 4 hours 5 minutes 6 seconds'::interval`.type(
          () => new IntervalColumn(),
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

    it('should have toCode', () => {
      expect(new IntervalColumn().toCode('t')).toBe('t.interval()');
      expect(new IntervalColumn('fields').toCode('t')).toBe(
        "t.interval('fields')",
      );
      expect(new IntervalColumn('fields', 10).toCode('t')).toBe(
        "t.interval('fields', 10)",
      );
    });
  });

  describe('asNumber', () => {
    it('should accept string, number, and Date', () => {
      const { inputType } = t.timestamp().asNumber();
      assertType<typeof inputType, string | number | Date>();
    });

    it('should parse and encode timestamp as a number', async () => {
      const UserWithNumberTimestamp = testDb('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text(),
        createdAt: t.timestamp().asNumber(),
        updatedAt: t.timestamp().asNumber(),
      }));

      const now = Date.now();

      const createQuery = UserWithNumberTimestamp.create({
        ...userData,
        createdAt: now,
        updatedAt: now,
      });

      expectSql(
        createQuery.toSql(),
        `
          INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [userData.name, userData.password, new Date(now), new Date(now)],
      );

      const { id } = await createQuery;
      const user = await UserWithNumberTimestamp.select(
        'createdAt',
        'updatedAt',
      ).find(id);

      assertType<typeof user, { createdAt: number; updatedAt: number }>();

      expect(typeof user.createdAt).toBe('number');
      expect(typeof user.updatedAt).toBe('number');

      const updateQuery = UserWithNumberTimestamp.find(id).update({
        createdAt: now,
        updatedAt: now,
      });

      expectSql(
        updateQuery.toSql(),
        `
          UPDATE "user"
          SET "createdAt" = $1, "updatedAt" = $2
          WHERE "user"."id" = $3
        `,
        [new Date(now), new Date(now), id],
      );
    });
  });

  describe('asDate', () => {
    it('should accept string, number, and Date', () => {
      const { inputType } = t.timestamp().asDate();
      assertType<typeof inputType, string | number | Date>();
    });

    it('should parse and encode timestamp as a number', async () => {
      t.text(0, 100)
        .encode((input: number) => input)
        .parse((text) => parseInt(text))
        .as(t.integer());

      const UserWithNumberTimestamp = testDb('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text(),
        createdAt: t.timestampNoTZ().asDate(),
        updatedAt: t.timestampNoTZ().asDate(),
      }));

      const now = new Date();

      const createQuery = UserWithNumberTimestamp.create({
        ...userData,
        createdAt: now,
        updatedAt: now,
      });

      expectSql(
        createQuery.toSql(),
        `
          INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [userData.name, userData.password, new Date(now), new Date(now)],
      );

      const { id } = await createQuery;
      const user = await UserWithNumberTimestamp.select(
        'createdAt',
        'updatedAt',
      ).find(id);

      assertType<typeof user, { createdAt: Date; updatedAt: Date }>();

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);

      const updateQuery = UserWithNumberTimestamp.find(id).update({
        createdAt: now,
        updatedAt: now,
      });

      expectSql(
        updateQuery.toSql(),
        `
          UPDATE "user"
          SET "createdAt" = $1, "updatedAt" = $2
          WHERE "user"."id" = $3
        `,
        [now, now, id],
      );
    });
  });
});
