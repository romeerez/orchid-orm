import { ColumnType, instantiateColumn } from './columnType';
import { User, userData } from '../test-utils/test-utils';
import { createDb } from '../query/db';
import { columnTypes } from './columnTypes';
import { IntegerColumn } from './number';
import { columnCode } from './code';
import { Code } from 'orchid-core';
import {
  assertType,
  expectSql,
  testAdapter,
  testDb,
  useTestDatabase,
} from 'test-utils';
import { raw } from '../sql/rawSql';
import { Operators } from './operators';
import { UUIDColumn } from './string';

describe('column type', () => {
  useTestDatabase();
  afterAll(testDb.close);

  class Column extends ColumnType {
    dataType = 'test';
    operators = Operators.any;
    toCode(t: string): Code {
      return columnCode(this, t, 'column()');
    }
  }
  const column = new Column();

  describe('.primaryKey', () => {
    it('should mark column as a primary key', () => {
      expect(column.data.isPrimaryKey).toBe(undefined);
      expect(column.primaryKey().data.isPrimaryKey).toBe(true);
    });

    it('should have toCode', () => {
      expect(column.primaryKey().toCode('t')).toBe('t.column().primaryKey()');
    });
  });

  describe('.foreignKey', () => {
    it('should have toCode', () => {
      class Table {
        readonly table = 'table';
        columns = { column: new IntegerColumn() };
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
      expect(column.data.isHidden).toBe(undefined);
      expect(column.hidden().data.isHidden).toBe(true);
    });

    it('should have toCode', () => {
      expect(column.hidden().toCode('t')).toBe('t.column().hidden()');
    });

    test('table with hidden column should omit from select it by default', () => {
      const User = testDb('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text().hidden(),
      }));

      const q = User.all();
      expectSql(
        q.toSQL(),
        `
          SELECT
            "user"."id",
            "user"."name"
          FROM "user"
        `,
      );
    });

    test('table with hidden column still allows to select it', () => {
      const User = testDb('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text().hidden(),
      }));

      const q = User.select('id', 'name', 'password');
      expectSql(
        q.toSQL(),
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
      assertType<typeof withEncode.outputType, number>();
    });

    it('should not override the type to search records with', () => {
      const table = testDb('table', (t) => ({
        id: t.serial().primaryKey(),
        column: t.text().parse(parseInt),
      }));

      const q = table.findBy({ column: 'text' });
      assertType<Awaited<typeof q>, { id: number; column: number }>();
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
        const db = createDb({ adapter: testAdapter });

        const UserWithPlainTimestamp = db('user', (t) => ({
          id: t.serial().primaryKey(),
          createdAt: t.timestampNoTZ(),
        }));

        expect(typeof (await UserWithPlainTimestamp.take()).createdAt).toBe(
          'string',
        );
      });

      it('should parse all columns', async () => {
        expect((await User.all())[0].createdAt instanceof Date).toBe(true);
        expect((await User.take()).createdAt instanceof Date).toBe(true);
        const idx = Object.keys(User.q.shape).indexOf('createdAt');
        expect((await User.rows())[0][idx] instanceof Date).toBe(true);
      });
    });
  });

  describe('as', () => {
    const numberTimestamp = columnTypes
      .timestampNoTZ()
      .encode((input: number) => new Date(input))
      .parse(Date.parse)
      .as(columnTypes.integer());

    const dateTimestamp = columnTypes
      .timestampNoTZ()
      .parse((input) => new Date(input));

    const db = createDb({
      adapter: testAdapter,
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

    it('should return same column with `as` property in data', () => {
      const timestamp = columnTypes
        .timestampNoTZ()
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
        query.toSQL(),
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
        query.toSQL(),
        `
          UPDATE "user"
          SET "createdAt" = $1, "updatedAt" = $2
          WHERE "user"."id" = $3
        `,
        [new Date(createdAt), updatedAt, id],
      );
    });
  });

  describe('.asType', () => {
    type Type = 'foo' | 'bar';
    it('should use custom type', () => {
      const withType = column.asType((t) => t<Type>());
      assertType<typeof withType.type, Type>();
      assertType<typeof withType.inputType, Type>();
      assertType<typeof withType.outputType, Type>();
      assertType<typeof withType.queryType, Type>();
    });
    it('should use custom type along with parse', () => {
      const withType = column.asType((t) => t<Type>()).parse(() => 123);
      assertType<typeof withType.type, Type>();
      assertType<typeof withType.inputType, Type>();
      assertType<typeof withType.outputType, number>();
      assertType<typeof withType.queryType, Type>();
    });
    it('should use custom type along with encode', () => {
      const withType = column
        .asType((t) => t<Type>())
        .encode((value: number) => '' + value);
      assertType<typeof withType.type, Type>();
      assertType<typeof withType.inputType, number>();
      assertType<typeof withType.outputType, Type>();
      assertType<typeof withType.queryType, Type>();
    });
    it('should use individual custom types', () => {
      const withType = column.asType((t) =>
        t<'type', 'input', 'output', 'query'>(),
      );
      assertType<typeof withType.type, 'type'>();
      assertType<typeof withType.inputType, 'input'>();
      assertType<typeof withType.outputType, 'output'>();
      assertType<typeof withType.queryType, 'query'>();
    });
  });

  describe('.default', () => {
    it('should have toCode', () => {
      expect(column.default(123).toCode('t')).toBe(`t.column().default(123)`);

      expect(column.default('hello').toCode('t')).toBe(
        `t.column().default('hello')`,
      );

      expect(
        column.default(raw`sql`.values({ key: 'value' })).toCode('t'),
      ).toBe(`t.column().default(t.sql\`sql\`.values({"key":"value"}))`);
    });

    describe('value is null', () => {
      it('should not be added by toCode', () => {
        const uuid = new UUIDColumn().primaryKey();
        expect(uuid.default(null).toCode('t')).toBe(
          `t.uuid().primaryKey().default(null)`,
        );
      });
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

    it('should handle options', () => {
      expect(
        column
          .unique({
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
        't.column().unique({',
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
      expect(
        column
          .refine((s) => (s as string).length > 0, 'refine message')
          .toCode('t'),
      ).toBe(`t.column().refine((s)=>s.length > 0, 'refine message')`);
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
