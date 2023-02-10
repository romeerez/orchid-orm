import { ColumnType, instantiateColumn } from './columnType';
import { Operators } from './operators';
import {
  adapter,
  assertType,
  db,
  expectSql,
  User,
  userData,
  useTestDatabase,
} from '../test-utils/test-utils';
import { createDb } from '../db';
import { columnTypes } from './columnTypes';
import { IntegerColumn } from './number';
import { Code, columnCode } from './code';
import { raw } from '../raw';

describe('column base', () => {
  useTestDatabase();
  afterAll(db.close);

  class Column extends ColumnType {
    dataType = 'test';
    operators = Operators.any;
    toCode(t: string): Code {
      return columnCode(this, t, `${t}.column()`);
    }
  }
  const column = new Column();

  describe('.primaryKey', () => {
    it('should mark column as a primary key', () => {
      expect(column.isPrimaryKey).toBe(false);
      expect(column.primaryKey().isPrimaryKey).toBe(true);
    });

    it('should have toCode', () => {
      expect(column.primaryKey().toCode('t')).toBe('t.column().primaryKey()');
    });
  });

  describe('.foreignKey', () => {
    it('should have toCode', () => {
      class Table {
        table = 'table';
        columns = { shape: { column: new IntegerColumn() } };
      }

      expect(column.foreignKey(() => Table, 'column').toCode('t')).toBe(
        `t.column().foreignKey(()=>Table, 'column')`,
      );

      expect(column.foreignKey('table', 'column').toCode('t')).toBe(
        `t.column().foreignKey('table', 'column')`,
      );

      expect(
        column
          .foreignKey('table', 'column', {
            name: 'name',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          })
          .toCode('t'),
      ).toEqual([
        `t.column().foreignKey('table', 'column', {`,
        [
          `name: 'name',`,
          `match: 'FULL',`,
          `onUpdate: 'CASCADE',`,
          `onDelete: 'CASCADE',`,
        ],
        '})',
      ]);
    });
  });

  describe('.hidden', () => {
    it('should mark column as hidden', () => {
      expect(column.isHidden).toBe(false);
      expect(column.hidden().isHidden).toBe(true);
    });

    it('should have toCode', () => {
      expect(column.hidden().toCode('t')).toBe('t.column().hidden()');
    });

    test('table with hidden column should omit from select it by default', () => {
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

    test('table with hidden column still allows to select it', () => {
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
      expect(column.data.isNullable).toBe(undefined);
      expect(column.nullable().data.isNullable).toBe(true);
    });

    it('should have toCode', () => {
      expect(column.nullable().toCode('t')).toEqual('t.column().nullable()');
    });
  });

  describe('.encode', () => {
    it('should set a function to encode value for this column', () => {
      expect(column.encodeFn).toBe(undefined);
      const fn = (input: number) => input.toString();
      const withEncode = column.encode(fn);
      expect(withEncode.encodeFn).toBe(fn);
      assertType<typeof withEncode.inputType, number>();
    });

    it('should have toCode', () => {
      expect(
        column.encode((input: number) => input.toString()).toCode('t'),
      ).toBe('t.column().encode((input)=>input.toString())');
    });
  });

  describe('.parse', () => {
    it('should set a function to encode value for this column', () => {
      expect(column.parseFn).toBe(undefined);
      const fn = () => 123;
      const withEncode = column.parse(fn);
      expect(withEncode.parseFn).toBe(fn);
      assertType<typeof withEncode.type, number>();
    });

    it('should have toCode', () => {
      expect(column.parse((v) => parseInt(v as string)).toCode('t')).toBe(
        't.column().parse((v)=>parseInt(v))',
      );
    });

    describe('parsing columns', () => {
      beforeEach(async () => {
        await User.create(userData);
      });

      it('should return column data as returned from db if not set', async () => {
        const db = createDb({ adapter });

        const UserWithPlainTimestamp = db('user', (t) => ({
          id: t.serial().primaryKey(),
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
      columnTypes: (t) => ({
        ...t,
        text: (min = 0, max = Infinity) => t.text(min, max),
        numberTimestamp: () => numberTimestamp,
        dateTimestamp: () => dateTimestamp,
      }),
    });

    const UserWithCustomTimestamps = db('user', (t) => ({
      id: t.serial().primaryKey(),
      name: t.text(),
      password: t.text(),
      createdAt: t.numberTimestamp(),
      updatedAt: t.dateTimestamp(),
    }));

    it('should have toCode', () => {
      expect(column.as(columnTypes.integer()).toCode('t')).toEqual(
        't.column().as(t.integer())',
      );
    });

    it('should accept only column of same type and input type', () => {
      columnTypes
        .timestamp()
        .encode((input: number) => input.toString())
        // @ts-expect-error should have both encode and parse with matching types
        .as(columnTypes.integer());

      // @ts-expect-error should have both encode and parse with matching types
      columnTypes.timestamp().parse(Date.parse).as(columnTypes.integer());
    });

    it('should return same column with `as` property in data', () => {
      const timestamp = columnTypes
        .timestamp()
        .encode((input: number) => new Date(input))
        .parse(Date.parse);

      const integer = columnTypes.integer();

      const column = timestamp.as(integer);

      expect(column.dataType).toBe(timestamp.dataType);
      expect(column.data.as).toBe(integer);
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

  describe('.default', () => {
    it('should have toCode', () => {
      expect(column.default(123).toCode('t')).toBe(`t.column().default(123)`);

      expect(column.default(raw('sql', { key: 'value' })).toCode('t')).toBe(
        `t.column().default('sql', {"key":"value"})`,
      );
    });
  });

  describe('.index', () => {
    it('should have toCode', () => {
      expect(
        column
          .index({
            collate: 'collate',
            opclass: 'opclass',
            order: 'order',
            name: 'name',
            using: 'using',
            include: 'include',
            with: 'with',
            tablespace: 'tablespace',
            where: 'where',
          })
          .toCode('t'),
      ).toEqual([
        't.column().index({',
        [
          `collate: 'collate',`,
          `opclass: 'opclass',`,
          `order: 'order',`,
          `name: 'name',`,
          `using: 'using',`,
          `include: 'include',`,
          `with: 'with',`,
          `tablespace: 'tablespace',`,
          `where: 'where',`,
        ],
        '})',
      ]);
    });
  });

  describe('unique', () => {
    it('should have toCode', () => {
      expect(column.unique().toCode('t')).toBe('t.column().unique()');
    });
  });

  describe('comment', () => {
    it('should have toCode', () => {
      expect(column.comment('comment').toCode('t')).toBe(
        `t.column().comment('comment')`,
      );
    });
  });

  describe('validationDefault', () => {
    it('should have toCode', () => {
      expect(column.validationDefault('value').toCode('t')).toBe(
        `t.column().validationDefault('value')`,
      );

      expect(column.validationDefault(123).toCode('t')).toBe(
        `t.column().validationDefault(123)`,
      );

      expect(column.validationDefault(() => 'value').toCode('t')).toBe(
        `t.column().validationDefault(()=>'value')`,
      );
    });
  });

  describe('compression', () => {
    it('should have toCode', () => {
      expect(column.compression('compression').toCode('t')).toBe(
        `t.column().compression('compression')`,
      );
    });
  });

  describe('collate', () => {
    it('should have toCode', () => {
      expect(column.collate('collate').toCode('t')).toBe(
        `t.column().collate('collate')`,
      );
    });
  });

  describe('modifyQuery', () => {
    it('should have toCode', () => {
      expect(column.modifyQuery((table) => table).toCode('t')).toBe(
        't.column().modifyQuery((table)=>table)',
      );
    });
  });

  describe('transform', () => {
    it('should have toCode', () => {
      expect(column.transform((s) => s).toCode('t')).toBe(
        't.column().transform((s)=>s)',
      );
    });
  });

  describe('to', () => {
    it('should have toCode', () => {
      expect(
        column
          .to((s) => parseInt(s as string), new IntegerColumn())
          .toCode('t'),
      ).toEqual('t.column().to((s)=>parseInt(s), t.integer())');
    });
  });

  describe('refine', () => {
    it('should have toCode', () => {
      expect(column.refine((s) => (s as string).length > 0).toCode('t')).toBe(
        't.column().refine((s)=>s.length > 0)',
      );
    });
  });

  describe('superRefine', () => {
    it('should have toCode', () => {
      expect(column.superRefine((s) => s).toCode('t')).toBe(
        't.column().superRefine((s)=>s)',
      );
    });
  });

  describe('fromDb', () => {
    it('should instantiate a column', () => {
      const params = {
        maxChars: 1,
        numericPrecision: 2,
        numericScale: 3,
        dateTimePrecision: 4,
      };
      const column = instantiateColumn(Column, params);
      expect(column).toBeInstanceOf(Column);
      expect(column.data).toMatchObject(params);
    });
  });
});
