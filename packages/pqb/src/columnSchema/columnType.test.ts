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
        await User.insert(userData);
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
});
