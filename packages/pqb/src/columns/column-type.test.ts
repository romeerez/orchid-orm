import { ColumnType } from './column-type';
import {
  profileData,
  User,
  userData,
  UserRecord,
} from '../test-utils/test-utils';
import { createDbWithAdapter } from '../query/db';
import { columnCode } from './code';
import { ColumnToCodeCtx } from '../core';
import { Code } from './code';
import {
  assertType,
  expectSql,
  testAdapter,
  testColumnTypes as td,
  testZodColumnTypes as tz,
  testDb,
  testSchemaConfig,
  useTestDatabase,
  testZodColumnTypes as t,
} from 'test-utils';
import { raw } from '../sql/rawSql';
import { Operators } from './operators';
import { z, ZodLiteral, ZodNumber } from 'zod/v4';
import { assignDbDataToColumn } from './column-type.utils';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
import { ColumnSchemaConfig } from './column-schema';

describe('column type', () => {
  useTestDatabase();
  afterAll(testDb.close);

  class Column<Schema extends ColumnSchemaConfig> extends ColumnType<
    Schema,
    number | string
  > {
    dataType = 'test';
    operators = Operators.any;

    constructor(schema: Schema) {
      super(schema, schema.unknown);
    }

    toCode(ctx: ColumnToCodeCtx, key: string): Code {
      return columnCode(this, ctx, key, 'column()');
    }
  }
  const column = new Column(testSchemaConfig);

  const columnToCodeCtx: ColumnToCodeCtx = {
    t: 't',
    table: 'table',
    currentSchema: 'public',
  };

  describe('.primaryKey', () => {
    it('should mark column as a primary key', () => {
      expect(column.data.primaryKey).toBe(undefined);
      expect(column.primaryKey().data.primaryKey).toBe(true);
    });

    it('should have toCode', () => {
      expect(column.primaryKey().toCode(columnToCodeCtx, 'key')).toBe(
        't.column().primaryKey()',
      );
    });
  });

  describe('.foreignKey', () => {
    it('should have toCode', () => {
      class Table {
        readonly table = 'table';
        columns = { shape: { column: td.integer() } };
      }

      expect(
        column.foreignKey(() => Table, 'column').toCode(columnToCodeCtx, 'key'),
      ).toBe(`t.column().foreignKey(()=>Table, 'column')`);

      expect(
        column.foreignKey('table', 'column').toCode(columnToCodeCtx, 'key'),
      ).toBe(`t.column().foreignKey('table', 'column')`);

      expect(
        column
          .foreignKey('table', 'column', {
            name: 'name',
            match: 'FULL',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          })
          .toCode(columnToCodeCtx, 'key'),
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

  describe('.select(false)', () => {
    it('should mark column as hidden', () => {
      expect(column.data.explicitSelect).toBe(undefined);
      expect(column.select(false).data.explicitSelect).toBe(true);
    });

    it('should have toCode', () => {
      expect(column.select(false).toCode(columnToCodeCtx, 'key')).toBe(
        't.column().select(false)',
      );
    });

    test('table with select(false) column should omit from select it by default', () => {
      const User = testDb('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text().select(false),
      }));

      const q = User.all();

      assertType<Awaited<typeof q>, (typeof User.outputType)[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "id", "name" FROM "user"
        `,
      );
    });

    test('table with hidden column still allows to select it', () => {
      const User = testDb('user', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text().select(false),
      }));

      const q = User.select('id', 'name', 'password');

      assertType<
        Awaited<typeof q>,
        (typeof User.outputType & { password: string })[]
      >();

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
      expect(column.nullable().toCode(columnToCodeCtx, 'key')).toEqual(
        't.column().nullable()',
      );
    });
  });

  describe('.encode', () => {
    it('should set a function to encode value for this column', () => {
      expect(column.data.encode).toBe(undefined);
      const fn = (input: number) => input.toString();
      const withEncode = column.encode(z.number(), fn);
      expect(withEncode.data.encode).toBe(fn);
      assertType<typeof withEncode.inputType, number>();
    });
  });

  describe('.parse', () => {
    it('should set a function to encode value for this column', () => {
      expect(column.data.parse).toBe(undefined);
      const fn = () => 123;
      const withEncode = column.parse(z.number(), fn);
      expect(withEncode.data.parse).toBe(fn);
      assertType<typeof withEncode.outputType, number>();
    });

    it('should not override the type to search records with', () => {
      const table = testDb('table', (t) => ({
        id: t.serial(),
        column: t.text().parse(parseInt).primaryKey(),
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
        const db = createDbWithAdapter({
          snakeCase: true,
          adapter: testAdapter,
        });

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

  describe('parseNull', () => {
    it('should set nullType but not alter outputType', () => {
      const c = column
        .parse(z.number(), () => 1)
        .parseNull(z.boolean(), () => true);

      const c2 = column
        .parseNull(z.boolean(), () => true)
        .parse(z.number(), () => 1);

      assertType<typeof c.nullType | typeof c2.nullType, boolean>();
      assertType<typeof c.outputType | typeof c2.outputType, number>();
    });

    it('should alter output type only for nullable column', () => {
      const c = column
        .parse(z.number(), () => 1)
        .parseNull(z.boolean(), () => true)
        .nullable();

      const c2 = column
        .parse(z.number(), () => 1)
        .nullable()
        .parseNull(z.boolean(), () => true);

      const c3 = column
        .nullable()
        .parseNull(z.boolean(), () => true)
        .parse(z.number(), () => 1);

      assertType<
        typeof c.nullType | typeof c2.nullType | typeof c3.nullType,
        boolean
      >();
      assertType<
        typeof c.outputType | typeof c2.outputType | typeof c3.outputType,
        number | boolean
      >();
    });

    it('should replace null at runtime', async () => {
      const result = await testDb.get(
        testDb.sql`NULL`.type(() =>
          t
            .integer()
            .parseNull(z.string(), () => 'parsed null')
            .nullable(),
        ),
      );

      expect(result).toBe('parsed null');
    });
  });

  describe('as', () => {
    const db = createDbWithAdapter({
      snakeCase: true,
      adapter: testAdapter,
      columnTypes: (t) => ({
        ...t,
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

    const dbZod = createDbWithAdapter({
      snakeCase: true,
      adapter: testAdapter,
      schemaConfig: zodSchemaConfig,
      columnTypes: (t) => ({
        ...t,
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

    const userColumnsSql =
      UserWithCustomTimestamps.q.selectAllColumns!.join(', ');

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

        expect(column.as(t.integer()).toCode(columnToCodeCtx, 'key')).toEqual(
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
          INSERT INTO "user"("name", "password", "created_at", "updated_at")
          VALUES ($1, $2, $3, $4)
          RETURNING ${userColumnsSql}
        `,
          [userData.name, userData.password, new Date(createdAt), updatedAt],
        );
      });

      it('should encode columns for update', async () => {
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
          SET "created_at" = $1, "updated_at" = $2
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
      expect(column.default(123).toCode(columnToCodeCtx, 'key')).toBe(
        `t.column().default(123)`,
      );

      expect(column.default('hello').toCode(columnToCodeCtx, 'key')).toBe(
        `t.column().default('hello')`,
      );

      expect(
        column
          .default(raw`sql`.values({ key: 'value' }))
          .toCode(columnToCodeCtx, 'key'),
      ).toBe(`t.column().default(t.sql\`sql\`.values({"key":"value"}))`);
    });

    describe('value is null', () => {
      it('should not be added by toCode', () => {
        const uuid = td.uuid().primaryKey();
        expect(uuid.default(null).toCode(columnToCodeCtx, 'key')).toBe(
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
          // @ts-expect-error name as argument is deprecated
          .index('name', {
            collate: 'collate',
            opclass: 'opclass',
            order: 'order',
            using: 'using',
            include: 'include',
            with: 'with',
            tablespace: 'tablespace',
            where: 'where',
          })
          .toCode(columnToCodeCtx, 'key'),
      ).toEqual([
        't.column().index({',
        [
          `name: 'name',`,
          `collate: 'collate',`,
          `opclass: 'opclass',`,
          `order: 'order',`,
          `using: 'using',`,
          `include: 'include',`,
          `with: 'with',`,
          `tablespace: 'tablespace',`,
          `where: 'where',`,
        ],
        '})',
      ]);

      expect(
        column
          .index({
            name: 'name',
            collate: 'collate',
            opclass: 'opclass',
            order: 'order',
            using: 'using',
            include: 'include',
            with: 'with',
            tablespace: 'tablespace',
            where: 'where',
          })
          .toCode(columnToCodeCtx, 'key'),
      ).toEqual([
        't.column().index({',
        [
          `name: 'name',`,
          `collate: 'collate',`,
          `opclass: 'opclass',`,
          `order: 'order',`,
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
      expect(column.unique().toCode(columnToCodeCtx, 'key')).toBe(
        't.column().unique()',
      );
    });

    it('should handle options', () => {
      expect(
        column
          // @ts-expect-error name as argument is deprecated
          .unique('name', {
            collate: 'collate',
            opclass: 'opclass',
            order: 'order',
            using: 'using',
            include: 'include',
            with: 'with',
            tablespace: 'tablespace',
            where: 'where',
          })
          .toCode(columnToCodeCtx, 'key'),
      ).toEqual([
        't.column().unique({',
        [
          `name: 'name',`,
          `collate: 'collate',`,
          `opclass: 'opclass',`,
          `order: 'order',`,
          `using: 'using',`,
          `include: 'include',`,
          `with: 'with',`,
          `tablespace: 'tablespace',`,
          `where: 'where',`,
        ],
        '})',
      ]);

      expect(
        column
          .unique({
            name: 'name',
            collate: 'collate',
            opclass: 'opclass',
            order: 'order',
            using: 'using',
            include: 'include',
            with: 'with',
            tablespace: 'tablespace',
            where: 'where',
          })
          .toCode(columnToCodeCtx, 'key'),
      ).toEqual([
        't.column().unique({',
        [
          `name: 'name',`,
          `collate: 'collate',`,
          `opclass: 'opclass',`,
          `order: 'order',`,
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
      expect(column.comment('comment').toCode(columnToCodeCtx, 'key')).toBe(
        `t.column().comment('comment')`,
      );
    });
  });

  describe('compression', () => {
    it('should have toCode', () => {
      expect(
        column.compression('compression').toCode(columnToCodeCtx, 'key'),
      ).toBe(`t.column().compression('compression')`);
    });
  });

  describe('collate', () => {
    it('should have toCode', () => {
      expect(column.collate('collate').toCode(columnToCodeCtx, 'key')).toBe(
        `t.column().collate('collate')`,
      );
    });
  });

  describe('modifyQuery', () => {
    it('should have toCode', () => {
      expect(
        column.modifyQuery((table) => table).toCode(columnToCodeCtx, 'key'),
      ).toBe('t.column().modifyQuery((table)=>table)');
    });
  });

  describe('fromDb', () => {
    it('should instantiate a column', () => {
      const params = {
        maxChars: 1,
        numericPrecision: 2,
        numericScale: 3,
        dateTimePrecision: 4,
        typmod: -1,
      };
      const column = assignDbDataToColumn(new Column(testSchemaConfig), params);
      expect(column).toBeInstanceOf(Column);
      expect(column.data).toMatchObject(params);
    });
  });

  describe('generated', () => {
    it('should have toSQL', () => {
      const values: unknown[] = [];

      const sql = column.generated`1 + ${2}`.data.generated!.toSQL({
        values,
        snakeCase: undefined,
      });

      expect(sql).toBe('1 + $1');
      expect(values).toEqual([2]);
    });

    it('should have toCode', () => {
      const sql = column.generated`1 + ${2}`.data.generated!;

      expect(sql.toCode()).toBe('.generated`1 + ${2}`');
    });

    it('should have toCode for raw argument', () => {
      const sql = column.generated({ raw: 'raw' }).data.generated!;

      expect(sql.toCode()).toBe(".generated({ raw: 'raw' })");
    });

    it('should have toCode for raw argument with values', () => {
      const sql = column.generated({ raw: 'raw', values: { num: 123 } }).data
        .generated!;

      expect(sql.toCode()).toBe(
        '.generated({ raw: \'raw\', values: {"num":123} })',
      );
    });

    const table = testDb('table', (t) => ({
      id: t.identity().primaryKey(),
      col: t.integer().generated`123`,
    }));

    it('should not be allowed in create', () => {
      expect(() =>
        table.create({
          // @ts-expect-error not allowed
          col: 123,
        }),
      ).toThrow('Trying to insert a readonly column');
    });

    it('should not be allowed in update', () => {
      expect(() =>
        table.all().update({
          // @ts-expect-error not allowed
          col: 123,
        }),
      ).toThrow('Trying to update a readonly column');
    });
  });
});
