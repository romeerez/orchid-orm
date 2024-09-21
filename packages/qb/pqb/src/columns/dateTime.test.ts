import { userData } from '../test-utils/test-utils';
import { TimestampColumn, TimestampTZColumn } from './dateTime';
import {
  assertType,
  expectSql,
  testColumnTypes,
  testZodColumnTypes as t,
  testDb,
  testSchemaConfig,
  useTestDatabase,
} from 'test-utils';
import { ColumnToCodeCtx, ColumnTypeBase, TimeInterval } from 'orchid-core';
import { z } from 'zod';

const ctx: ColumnToCodeCtx = { t: 't', table: 'table' };

const testTimestampInput = (column: ColumnTypeBase) => {
  const date = new Date();
  const string = date.toISOString();
  expect(column.encodeFn?.(string) as Date).toBe(string);

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
        testDb.sql`'1999-01-08'::date`.type(() => t.date()),
      );

      expect(result).toBe('1999-01-08');

      assertType<typeof result, string>();
    });

    it('should encode number, but not encode string and date', () => {
      const num = new Date().getTime();
      expect(t.date().encodeFn?.(num)).toEqual(new Date(num));

      const string = '2000-10-20';
      expect(t.date().encodeFn?.(string)).toBe(string);

      const date = new Date();
      expect(t.date().encodeFn?.(date)).toBe(date);
    });

    it('should have toCode', () => {
      const column = t.date();
      expect(column.toCode(ctx, 'key')).toBe('t.date()');

      const now = new Date();
      const s = now.toISOString();
      expect(
        column
          .min(now, 'min message')
          .max(now, 'max message')
          .toCode(ctx, 'key'),
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
        testDb.sql`'1999-01-08 04:05:06'::timestamp`.type(
          () => new TimestampTZColumn(testSchemaConfig),
        ),
      );
      expect(result).toBe('1999-01-08 04:05:06');

      assertType<typeof result, string>();
    });

    it('should encode number, but not encode string and Date', () => {
      const num = new Date().getTime();
      expect(t.timestampNoTZ().encodeFn?.(num)).toEqual(new Date(num));

      const string = new Date().toISOString();
      expect(t.timestampNoTZ().encodeFn?.(string)).toBe(string);

      const date = new Date();
      expect(t.timestampNoTZ().encodeFn?.(date)).toBe(date);
    });

    it('should have toCode, ignore default precision', () => {
      expect(new TimestampColumn(testSchemaConfig).toCode(ctx, 'key')).toBe(
        't.timestampNoTZ()',
      );

      expect(new TimestampColumn(testSchemaConfig, 10).toCode(ctx, 'key')).toBe(
        't.timestampNoTZ(10)',
      );

      expect(new TimestampColumn(testSchemaConfig, 6).toCode(ctx, 'key')).toBe(
        't.timestampNoTZ()',
      );

      const now = new Date();
      const s = now.toISOString();
      const timestamp = t.timestampNoTZ();
      delete timestamp.parseFn;

      expect(
        timestamp
          .min(now, 'min message')
          .max(now, 'max message')
          .toCode(ctx, 'key'),
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
          () => new TimestampTZColumn(testSchemaConfig),
        ),
      );
      expect(result).toBe('1999-01-08 04:05:06');

      assertType<typeof result, string>();
    });

    it('should encode number, but not encode string and Date', () => {
      const num = new Date().getTime();
      expect(t.timestamp().encodeFn?.(num)).toEqual(new Date(num));

      const string = new Date().toISOString();
      expect(t.timestamp().encodeFn?.(string)).toBe(string);

      const date = new Date();
      expect(t.timestamp().encodeFn?.(date)).toBe(date);
    });

    it('should have toCode, ignore default precision', () => {
      expect(new TimestampTZColumn(testSchemaConfig).toCode(ctx, 'key')).toBe(
        't.timestamp()',
      );

      expect(
        new TimestampTZColumn(testSchemaConfig, 6).toCode(ctx, 'key'),
      ).toBe('t.timestamp()');

      expect(
        new TimestampTZColumn(testSchemaConfig, 10).toCode(ctx, 'key'),
      ).toBe('t.timestamp(10)');

      const now = new Date();
      const s = now.toISOString();

      const timestamp = t.timestamp();
      delete timestamp.parseFn;

      expect(
        timestamp
          .min(now, 'min message')
          .max(now, 'max message')
          .toCode(ctx, 'key'),
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
        testDb.sql`'12:00'::time`.type(() => t.time()),
      );
      expect(result).toBe('12:00:00');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      expect(t.time().toCode(ctx, 'key')).toBe('t.time()');
      expect(t.time(10).toCode(ctx, 'key')).toBe('t.time(10)');
    });
  });

  describe('interval', () => {
    it('should output string', async () => {
      const result = await testDb.get(
        testDb.sql`'1 year 2 months 3 days 4 hours 5 minutes 6 seconds'::interval`.type(
          () => t.interval(),
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
      expect(t.interval().toCode(ctx, 'key')).toBe('t.interval()');
      expect(t.interval('fields').toCode(ctx, 'key')).toBe(
        "t.interval('fields')",
      );
      expect(t.interval('fields', 10).toCode(ctx, 'key')).toBe(
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

      const userColumnsSql =
        UserWithNumberTimestamp.q.selectAllColumns!.join(', ');

      const now = Date.now();

      const createQuery = UserWithNumberTimestamp.create({
        ...userData,
        createdAt: now,
        updatedAt: now,
      });

      expectSql(
        createQuery.toSQL(),
        `
          INSERT INTO "user"("name", "password", "created_at", "updated_at")
          VALUES ($1, $2, $3, $4)
          RETURNING ${userColumnsSql}
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
        updateQuery.toSQL(),
        `
          UPDATE "user"
          SET "created_at" = $1, "updated_at" = $2
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

    it('should keep the default type', () => {
      const column = testColumnTypes.timestamp().default(() => new Date());
      const asDate = column.asDate();

      assertType<typeof column.data.default, typeof asDate.data.default>();
    });

    it('should parse and encode timestamp as a number', async () => {
      t.text()
        .encode(z.number(), (input: number) => input)
        .parse(z.number(), (text) => parseInt(text))
        .as(t.integer());

      const UserWithNumberTimestamp = testDb('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text(),
        createdAt: t.timestampNoTZ().asDate(),
        updatedAt: t.timestampNoTZ().asDate(),
      }));

      const userColumnsSql =
        UserWithNumberTimestamp.q.selectAllColumns!.join(', ');

      const now = new Date();

      const createQuery = UserWithNumberTimestamp.create({
        ...userData,
        createdAt: now,
        updatedAt: now,
      });

      expectSql(
        createQuery.toSQL(),
        `
          INSERT INTO "user"("name", "password", "created_at", "updated_at")
          VALUES ($1, $2, $3, $4)
          RETURNING ${userColumnsSql}
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
        updateQuery.toSQL(),
        `
          UPDATE "user"
          SET "created_at" = $1, "updated_at" = $2
          WHERE "user"."id" = $3
        `,
        [now, now, id],
      );
    });
  });
});
