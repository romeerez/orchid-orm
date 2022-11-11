import { ColumnType } from './columnType';
import { Operators } from '../columnsOperators';
import {
  adapter,
  assertType,
  db,
  expectSql,
  User,
  userData,
  useTestDatabase,
} from '../test-utils';
import { createDb } from '../db';
import { columnTypes } from './columnTypes';

describe('column base', () => {
  useTestDatabase();

  class Column extends ColumnType {
    dataType = 'test';
    operators = Operators.any;
  }
  const column = new Column();

  describe('.primaryKey', () => {
    it('should mark column as a primary key', () => {
      expect(column.isPrimaryKey).toBe(false);
      expect(column.primaryKey().isPrimaryKey).toBe(true);
    });
  });

  describe('.hidden', () => {
    it('should mark column as hidden', () => {
      expect(column.isHidden).toBe(false);
      expect(column.hidden().isHidden).toBe(true);
    });

    test('model with hidden column should omit from select it by default', () => {
      const User = db('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text().hidden(),
      }));

      const q = User.all();
      expectSql(
        q.toSql(),
        `
          SELECT
            "user"."id",
            "user"."name"
          FROM "user"
        `,
      );
    });

    test('model with hidden column still allows to select it', () => {
      const User = db('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text().hidden(),
      }));

      const q = User.select('id', 'name', 'password');
      expectSql(
        q.toSql(),
        `
          SELECT
            "user"."id",
            "user"."name",
            "user"."password"
          FROM "user"
        `,
      );
    });
  });

  describe('.nullable', () => {
    it('should mark column as nullable', () => {
      expect(column.isNullable).toBe(false);
      expect(column.nullable().isNullable).toBe(true);
    });
  });

  describe('.encodeFn', () => {
    it('should set a function to encode value for this column', () => {
      expect(column.encodeFn).toBe(undefined);
      const fn = (input: number) => input.toString();
      const withEncode = column.encode(fn);
      expect(withEncode.encodeFn).toBe(fn);
      assertType<typeof withEncode.inputType, number>();
    });
  });

  describe('.parseFn', () => {
    it('should set a function to encode value for this column', () => {
      expect(column.parseFn).toBe(undefined);
      const fn = () => 123;
      const withEncode = column.parse(fn);
      expect(withEncode.parseFn).toBe(fn);
      assertType<typeof withEncode.type, number>();
    });

    describe('parsing columns', () => {
      beforeEach(async () => {
        await User.create(userData);
      });

      it('should return column data as returned from db if not set', async () => {
        const db = createDb({ adapter, columnTypes });

        const UserWithPlainTimestamp = db('user', (t) => ({
          createdAt: t.timestamp(),
        }));

        expect(typeof (await UserWithPlainTimestamp.take()).createdAt).toBe(
          'string',
        );
      });

      it('should parse all columns', async () => {
        expect((await User.all())[0].createdAt instanceof Date).toBe(true);
        expect((await User.take()).createdAt instanceof Date).toBe(true);
        const idx = Object.keys(User.shape).indexOf('createdAt');
        expect((await User.rows())[0][idx] instanceof Date).toBe(true);
      });
    });
  });

  describe('as', () => {
    const numberTimestamp = columnTypes
      .timestamp()
      .encode((input: number) => new Date(input))
      .parse(Date.parse)
      .as(columnTypes.integer());

    const dateTimestamp = columnTypes
      .timestamp()
      .parse((input) => new Date(input));

    const db = createDb({
      adapter,
      columnTypes: {
        ...columnTypes,
        numberTimestamp: () => numberTimestamp,
        dateTimestamp: () => dateTimestamp,
      },
    });

    const UserWithCustomTimestamps = db('user', (t) => ({
      id: t.serial().primaryKey(),
      name: t.text(),
      password: t.text(),
      createdAt: t.numberTimestamp(),
      updatedAt: t.dateTimestamp(),
    }));

    it('should accept only column of same type and input type', () => {
      columnTypes
        .timestamp()
        .encode((input: number) => input.toString())
        // @ts-expect-error should have both encode and parse with matching types
        .as(columnTypes.integer());

      // @ts-expect-error should have both encode and parse with matching types
      columnTypes.timestamp().parse(Date.parse).as(columnTypes.integer());
    });

    it('should return same column with overridden type', () => {
      const timestamp = columnTypes
        .timestamp()
        .encode((input: number) => new Date(input))
        .parse(Date.parse);

      const column = timestamp.as(columnTypes.integer());

      expect(column).toBe(timestamp);
    });

    it('should parse correctly', async () => {
      const id = await User.get('id').create(userData);

      const user = await UserWithCustomTimestamps.find(id);

      expect(typeof user.createdAt).toBe('number');
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should encode columns when creating', () => {
      const createdAt = Date.now();
      const updatedAt = new Date();

      const query = UserWithCustomTimestamps.create({
        ...userData,
        createdAt,
        updatedAt,
      });

      expectSql(
        query.toSql(),
        `
          INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [userData.name, userData.password, new Date(createdAt), updatedAt],
      );
    });

    it('should encode columns when update', async () => {
      const id = await User.get('id').create(userData);
      const createdAt = Date.now();
      const updatedAt = new Date();

      const query = UserWithCustomTimestamps.find(id).update({
        createdAt,
        updatedAt,
      });

      expectSql(
        query.toSql(),
        `
          UPDATE "user"
          SET "createdAt" = $1, "updatedAt" = $2
          WHERE "user"."id" = $3
        `,
        [new Date(createdAt), updatedAt, id],
      );
    });
  });

  describe('timestamp().asNumber()', () => {
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

  describe('timestamp().asDate()', () => {
    it('should parse and encode timestamp as a number', async () => {
      columnTypes
        .text()
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
