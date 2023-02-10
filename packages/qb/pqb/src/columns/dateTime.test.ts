import {
  assertType,
  db,
  expectSql,
  userData,
  useTestDatabase,
} from '../test-utils/test-utils';
import {
  DateColumn,
  IntervalColumn,
  TimeColumn,
  TimeInterval,
  TimestampColumn,
  TimestampWithTimeZoneColumn,
  TimeWithTimeZoneColumn,
} from './dateTime';
import { columnTypes } from './columnTypes';

describe('date time columns', () => {
  useTestDatabase();
  afterAll(db.close);

  describe('date', () => {
    it('should output string', async () => {
      const result = await db.get(
        db.raw(() => new DateColumn(), `'1999-01-08'::date`),
      );
      expect(result).toBe('1999-01-08');

      assertType<typeof result, string>();
    });

    it('should have toCode', () => {
      const column = new DateColumn();
      expect(column.toCode('t')).toBe('t.date()');

      const now = new Date();
      const s = now.toISOString();
      expect(column.min(now).max(now).toCode('t')).toBe(
        `t.date().min(new Date('${s}')).max(new Date('${s}'))`,
      );
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

    it('should have toCode, ignore default precision', () => {
      expect(new TimestampColumn().toCode('t')).toBe('t.timestamp()');

      expect(new TimestampColumn(10).toCode('t')).toBe('t.timestamp(10)');

      expect(new TimestampColumn(6).toCode('t')).toBe('t.timestamp()');

      const now = new Date();
      const s = now.toISOString();
      expect(new TimestampColumn().min(now).max(now).toCode('t')).toBe(
        `t.timestamp().min(new Date('${s}')).max(new Date('${s}'))`,
      );
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

    it('should have toCode, ignore default precision', () => {
      expect(new TimestampWithTimeZoneColumn().toCode('t')).toBe(
        't.timestampWithTimeZone()',
      );

      expect(new TimestampWithTimeZoneColumn(6).toCode('t')).toBe(
        't.timestampWithTimeZone()',
      );

      expect(new TimestampWithTimeZoneColumn(10).toCode('t')).toBe(
        't.timestampWithTimeZone(10)',
      );

      const now = new Date();
      const s = now.toISOString();
      expect(
        new TimestampWithTimeZoneColumn().min(now).max(now).toCode('t'),
      ).toBe(
        `t.timestampWithTimeZone().min(new Date('${s}')).max(new Date('${s}'))`,
      );
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

    it('should have toCode', () => {
      expect(new TimeColumn().toCode('t')).toBe('t.time()');
      expect(new TimeColumn(10).toCode('t')).toBe('t.time(10)');

      const now = new Date();
      const s = now.toISOString();
      expect(new TimeColumn().min(now).max(now).toCode('t')).toBe(
        `t.time().min(new Date('${s}')).max(new Date('${s}'))`,
      );
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

    it('should have toCode', () => {
      expect(new TimeWithTimeZoneColumn().toCode('t')).toBe(
        't.timeWithTimeZone()',
      );
      expect(new TimeWithTimeZoneColumn(10).toCode('t')).toBe(
        't.timeWithTimeZone(10)',
      );

      const now = new Date();
      const s = now.toISOString();
      expect(new TimeWithTimeZoneColumn().min(now).max(now).toCode('t')).toBe(
        `t.timeWithTimeZone().min(new Date('${s}')).max(new Date('${s}'))`,
      );
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
    it('should parse and encode timestamp as a number', async () => {
      const UserWithNumberTimestamp = db('user', (t) => ({
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
    it('should parse and encode timestamp as a number', async () => {
      columnTypes
        .text(0, 100)
        .encode((input: number) => input)
        .parse((text) => parseInt(text))
        .as(columnTypes.integer());

      const UserWithNumberTimestamp = db('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text(),
        createdAt: columnTypes.timestamp().asDate(),
        updatedAt: columnTypes.timestamp().asDate(),
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
