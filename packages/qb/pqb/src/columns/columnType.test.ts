import { ColumnType } from './columnType';
import {
  profileData,
  User,
  userData,
  UserRecord,
} from '../test-utils/test-utils';
import { createDb } from '../query/db';
import { columnCode } from './code';
import { Code, ColumnSchemaConfig } from 'orchid-core';
import {
  assertType,
  expectSql,
  testAdapter,
  testColumnTypes as td,
  testZodColumnTypes as tz,
  testDb,
  testSchemaConfig,
  useTestDatabase,
} from 'test-utils';
import { raw } from '../sql/rawSql';
import { Operators } from './operators';
import { z, ZodLiteral, ZodNumber } from 'zod';
import { instantiateColumn } from './columnType.utils';
import { zodSchemaConfig } from 'schema-to-zod';

describe('column type', () => {
  useTestDatabase();
  afterAll(testDb.close);

  class Column<Schema extends ColumnSchemaConfig> extends ColumnType<Schema> {
    dataType = 'test';
    operators = Operators.any;

    constructor(schema: Schema) {
      super(schema, schema.unknown);
    }

    toCode(t: string, m?: boolean): Code {
      return columnCode(this, t, 'column()', m);
    }
  }
  const column = new Column(testSchemaConfig);

  describe('.primaryKey', () => {
    it('should mark column as a primary key', () => {
      expect(column.data.primaryKey).toBe(undefined);
      expect(column.primaryKey().data.primaryKey).toBe(true);
    });

    it('should have toCode', () => {
      expect(column.primaryKey().toCode('t')).toBe('t.column().primaryKey()');
    });
  });

  describe('.foreignKey', () => {
    it('should have toCode', () => {
      class Table {
        readonly table = 'table';
        columns = { column: td.integer() };
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
      const withEncode = column.encode(z.number(), fn);
      expect(withEncode.encodeFn).toBe(fn);
      assertType<typeof withEncode.inputType, number>();
    });
  });

  describe('.parse', () => {
    it('should set a function to encode value for this column', () => {
      expect(column.parseFn).toBe(undefined);
      const fn = () => 123;
      const withEncode = column.parse(z.number(), fn);
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

    describe('parsing columns', () => {
      let user = {} as UserRecord;
      beforeEach(async () => {
        user = await User.create(userData);
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

      it('should parse joined record columns', async () => {
        const ProfileWithoutTimestamps = testDb('profile', (t) => ({
          id: t.identity().primaryKey(),
          userId: t.integer().foreignKey('user', 'id'),
          bio: t.text().nullable(),
        }));

        await ProfileWithoutTimestamps.create({
          ...profileData,
          userId: user.id,
        });

        const result = await ProfileWithoutTimestamps.join(User, 'id', 'userId')
          .select('*', { user: 'user.*' })
          .take();

        expect(result.user.createdAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('as', () => {
    const db = createDb({
      adapter: testAdapter,
      columnTypes: (t) => ({
        ...t,
        text: (min = 0, max = Infinity) => t.text(min, max),
        numberTimestamp: () =>
          td
            .timestampNoTZ()
            .encode((input: number) => new Date(input))
            .parse(Date.parse)
            .as(td.integer()),
        dateTimestamp: () =>
          td.timestampNoTZ().parse((input) => new Date(input)),
      }),
    });

    const dbZod = createDb({
      adapter: testAdapter,
      schemaConfig: zodSchemaConfig,
      columnTypes: (t) => ({
        ...t,
        text: (min = 0, max = Infinity) => t.text(min, max),
        numberTimestamp: () =>
          tz
            .timestampNoTZ()
            .encode(z.number(), (input: number) => new Date(input))
            .parse(z.number(), Date.parse)
            .as(tz.integer()),
        dateTimestamp: () =>
          tz.timestampNoTZ().parse(z.date(), (input) => new Date(input)),
      }),
    });

    const UserWithCustomTimestamps = db('user', (t) => ({
      id: t.serial().primaryKey(),
      name: t.text(),
      password: t.text(),
      createdAt: t.numberTimestamp(),
      updatedAt: t.dateTimestamp(),
    }));

    const UserWithCustomTimestampsZod = dbZod('user', (t) => ({
      id: t.serial().primaryKey(),
      name: t.text(),
      password: t.text(),
      createdAt: t.numberTimestamp(),
      updatedAt: t.dateTimestamp(),
    }));

    describe.each`
      schema
      ${'default'}
      ${'zod'}
    `('$schema schema', ({ schema }) => {
      const table =
        schema === 'default'
          ? UserWithCustomTimestamps
          : UserWithCustomTimestampsZod;

      it('should have toCode', () => {
        const t = schema === 'default' ? td : tz;

        expect(column.as(t.integer()).toCode('t')).toEqual(
          't.column().as(t.integer())',
        );
      });

      it('should return same column with `as` property in data', () => {
        let timestamp, integer;

        if (schema === 'default') {
          timestamp = td
            .timestampNoTZ()
            .encode((input: number) => new Date(input))
            .parse(Date.parse);

          integer = td.integer();
        } else {
          timestamp = tz
            .timestampNoTZ()
            .encode(z.number(), (input: number) => new Date(input))
            .parse(z.number(), Date.parse);

          integer = tz.integer();
        }

        const column = timestamp.as(integer);

        expect(column.dataType).toBe(timestamp.dataType);
        expect(column.data.as).toBe(integer);
      });

      it('should parse correctly', async () => {
        const id = await User.get('id').create(userData);

        const user = await table.find(id);

        expect(typeof user.createdAt).toBe('number');
        expect(user.updatedAt).toBeInstanceOf(Date);
      });

      it('should encode columns when creating', () => {
        const createdAt = Date.now();
        const updatedAt = new Date();

        const query = table.create({
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

        const query = table.find(id).update({
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
  });

  describe.each`
    schema
    ${'default'}
    ${'zod'}
  `('asType for $schema schema', ({ schema }) => {
    it('should use custom type', () => {
      if (schema === 'default') {
        const type = td.string().asType((t) => t<'value'>());

        assertType<typeof type.type, 'value'>();
        assertType<typeof type.inputType, 'value'>();
        assertType<typeof type.outputType, 'value'>();
        assertType<typeof type.queryType, 'value'>();
      } else {
        const type = tz.string().asType({
          type: z.literal('value'),
        });

        assertType<typeof type.type, 'value'>();
        assertType<typeof type.inputType, 'value'>();
        assertType<typeof type.inputSchema, ZodLiteral<'value'>>();
        assertType<typeof type.outputType, 'value'>();
        assertType<typeof type.outputSchema, ZodLiteral<'value'>>();
        assertType<typeof type.queryType, 'value'>();
        assertType<typeof type.querySchema, ZodLiteral<'value'>>();
      }
    });

    it('should use custom type along with parse', () => {
      if (schema === 'default') {
        const type = td
          .string()
          .asType((t) => t<'value'>())
          .parse(() => 123);

        assertType<typeof type.type, 'value'>();
        assertType<typeof type.inputType, 'value'>();
        assertType<typeof type.outputType, number>();
        assertType<typeof type.queryType, 'value'>();
      } else {
        const type = tz
          .string()
          .asType({ type: z.literal('value') })
          .parse(z.number(), () => 123);

        assertType<typeof type.type, 'value'>();
        assertType<typeof type.inputType, 'value'>();
        assertType<typeof type.outputType, number>();
        assertType<typeof type.outputSchema, ZodNumber>();
        assertType<typeof type.queryType, 'value'>();
      }
    });

    it('should use custom type along with encode', () => {
      if (schema === 'default') {
        const type = td
          .string()
          .asType((t) => t<'value'>())
          .encode((value: number) => '' + value);

        assertType<typeof type.type, 'value'>();
        assertType<typeof type.inputType, number>();
        assertType<typeof type.outputType, 'value'>();
        assertType<typeof type.queryType, 'value'>();
      } else {
        const type = tz
          .string()
          .asType({ type: z.literal('value') })
          .encode(z.number(), (value: number) => '' + value);

        assertType<typeof type.type, 'value'>();
        assertType<typeof type.inputType, number>();
        assertType<typeof type.inputSchema, ZodNumber>();
        assertType<typeof type.outputType, 'value'>();
        assertType<typeof type.queryType, 'value'>();
      }
    });

    it('should use individual custom types', () => {
      if (schema === 'default') {
        const type = td
          .string()
          .asType((t) => t<'type', 'input', 'output', 'query'>());

        assertType<typeof type.type, 'type'>();
        assertType<typeof type.inputType, 'input'>();
        assertType<typeof type.outputType, 'output'>();
        assertType<typeof type.queryType, 'query'>();
      } else {
        const type = tz.string().asType({
          type: z.literal('type'),
          input: z.literal('input'),
          output: z.literal('output'),
          query: z.literal('query'),
        });

        assertType<typeof type.type, 'type'>();
        assertType<typeof type.inputType, 'input'>();
        assertType<typeof type.outputType, 'output'>();
        assertType<typeof type.queryType, 'query'>();
      }
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
        const uuid = td.uuid().primaryKey();
        expect(uuid.default(null).toCode('t')).toBe(
          `t.uuid().primaryKey().default(null)`,
        );
      });
    });

    it('should encode lazy default value with the encoding function from the column', async () => {
      const User = testDb('user', (t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        password: t.text(),
        data: t.json().default(() => ['foo']),
      }));

      const q = User.insert(userData);
      expectSql(
        q.toSQL(),
        `INSERT INTO "user"("name", "password", "data") VALUES ($1, $2, $3)`,
        [userData.name, userData.password, '["foo"]'],
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

  describe('fromDb', () => {
    it('should instantiate a column', () => {
      const params = {
        maxChars: 1,
        numericPrecision: 2,
        numericScale: 3,
        dateTimePrecision: 4,
      };
      const column = instantiateColumn(
        () => new Column(testSchemaConfig),
        params,
      );
      expect(column).toBeInstanceOf(Column);
      expect(column.data).toMatchObject(params);
    });
  });
});
