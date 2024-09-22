import { ZodSchemaConfig, zodSchemaConfig } from './zod';
import { CustomTypeColumn, makeColumnTypes, VirtualColumn } from 'pqb';
import {
  z,
  ZodArray,
  ZodBoolean,
  ZodDate,
  ZodEnum,
  ZodNever,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodString,
  ZodType,
  ZodTypeAny,
  ZodUnion,
} from 'zod';
import { AssertEqual, assertType } from 'test-utils';

const t = makeColumnTypes(zodSchemaConfig);

type TypeBase = {
  inputSchema: ZodTypeAny;
  outputSchema: ZodTypeAny;
  querySchema: ZodTypeAny;
};

const assertAllTypes = <T extends TypeBase, Expected extends ZodTypeAny>(
  ..._: AssertEqual<
    T['inputSchema'] | T['outputSchema'] | T['querySchema'],
    Expected
  > extends true
    ? []
    : ['invalid type']
) => {
  // noop
};

function expectAllParse(type: TypeBase, input: unknown, expected: unknown) {
  expect({
    input: type.inputSchema.parse(input),
    output: type.inputSchema.parse(input),
    query: type.inputSchema.parse(input),
  }).toEqual({
    input: expected,
    output: expected,
    query: expected,
  });
}

function expectAllThrow(type: TypeBase, input: unknown, message: string) {
  expect(() => type.inputSchema.parse(input)).toThrow(message);
  expect(() => type.outputSchema.parse(input)).toThrow(message);
  expect(() => type.querySchema.parse(input)).toThrow(message);
}

function expectInputQueryThrow(
  type: TypeBase,
  input: unknown,
  message: string,
) {
  expect(() => type.inputSchema.parse(input)).toThrow(message);
  expect(() => type.querySchema.parse(input)).toThrow(message);
}

function testTypeMethod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: any,
  method: string,
  value: unknown,
  error: string,
  ...args: unknown[]
) {
  const a = type[method](...args);
  expect(() => a.inputSchema.parse(value)).toThrow(error);
  expect(() => a.querySchema.parse(value)).toThrow(error);

  const b = type[method](...args, { message: 'custom' });
  expect(() => b.inputSchema.parse(value)).toThrow('custom');
  expect(() => b.querySchema.parse(value)).toThrow('custom');
}

describe('zod schema config', () => {
  it('should create schemas for a table', () => {
    const columns = {
      shape: {
        id: t.identity().primaryKey(),
        name: t.string(),
      },
    };

    const klass = {
      prototype: { columns },
      inputSchema: zodSchemaConfig.inputSchema,
      outputSchema: zodSchemaConfig.outputSchema,
      querySchema: zodSchemaConfig.querySchema,
      pkeySchema: zodSchemaConfig.pkeySchema,
      createSchema: zodSchemaConfig.createSchema,
    };

    const type = {
      inputSchema: klass.inputSchema(),
      outputSchema: klass.outputSchema(),
      querySchema: klass.querySchema(),
    };

    const expected = z.object({ id: z.number(), name: z.string() });

    assertType<typeof type.inputSchema, typeof expected>();
    assertType<typeof type.outputSchema, typeof expected>();

    expectAllParse(type, { id: 1, name: 'name' }, { id: 1, name: 'name' });

    expectAllThrow(type, { id: '1' }, 'Expected number, received string');
  });

  describe('querySchema', () => {
    it('should be partial', () => {
      const columns = {
        shape: {
          id: t.identity().primaryKey(),
          name: t.string(),
        },
      };

      const klass = {
        prototype: { columns },
        inputSchema: zodSchemaConfig.inputSchema,
        outputSchema: zodSchemaConfig.outputSchema,
        querySchema: zodSchemaConfig.querySchema,
        pkeySchema: zodSchemaConfig.pkeySchema,
        createSchema: zodSchemaConfig.createSchema,
      };

      const schema = klass.querySchema();

      const expected = z.object({ id: z.number(), name: z.string() }).partial();

      assertType<typeof schema, typeof expected>();

      expect(schema.parse({ id: 1, name: 'name' })).toEqual({
        id: 1,
        name: 'name',
      });

      expect(() => schema.parse({ id: '1' })).toThrow(
        'Expected number, received string',
      );
    });
  });

  describe('createSchema', () => {
    it('should be an inputSchema without primary keys', () => {
      const columns = {
        shape: {
          id: t.identity().primaryKey(),
          name: t.string(),
          optional: t.string().nullable(),
          withDefault: t.string().default(''),
        },
      };

      const klass = {
        prototype: { columns },
        inputSchema: zodSchemaConfig.inputSchema,
        querySchema: zodSchemaConfig.outputSchema,
        pkeySchema: zodSchemaConfig.pkeySchema,
        createSchema: zodSchemaConfig.createSchema,
      };

      const createSchema = klass.createSchema();

      const expected = z.object({
        name: z.string(),
        optional: z.string().nullable().optional(),
        withDefault: z.string().optional(),
      });
      assertType<typeof createSchema, typeof expected>();

      expect(createSchema.parse({ name: 'name' })).toEqual({
        name: 'name',
      });
    });
  });

  describe('updateSchema', () => {
    it('should be a partial inputSchema without primary keys', () => {
      const columns = {
        shape: {
          id: t.identity().primaryKey(),
          name: t.string(),
        },
      };

      const klass = {
        prototype: { columns },
        inputSchema: zodSchemaConfig.inputSchema,
        querySchema: zodSchemaConfig.outputSchema,
        pkeySchema: zodSchemaConfig.pkeySchema,
        createSchema: zodSchemaConfig.createSchema,
        updateSchema: zodSchemaConfig.updateSchema,
      };

      const updateSchema = klass.updateSchema();

      const expected = z.object({ name: z.string() }).partial();
      assertType<typeof updateSchema, typeof expected>();

      expect(updateSchema.parse({ name: 'name' })).toEqual({
        name: 'name',
      });

      expect(updateSchema.parse({})).toEqual({});
    });
  });

  describe('pkeySchema', () => {
    it('should validate primary keys', () => {
      const columns = {
        shape: {
          id: t.identity().primaryKey(),
          name: t.string().primaryKey(),
          age: t.integer(),
        },
      };

      const klass = {
        prototype: { columns },
        inputSchema: zodSchemaConfig.inputSchema,
        querySchema: zodSchemaConfig.outputSchema,
        pkeySchema: zodSchemaConfig.pkeySchema,
        createSchema: zodSchemaConfig.createSchema,
      };

      const pkeySchema = klass.pkeySchema();

      const expected = z.object({ id: z.number(), name: z.string() });
      assertType<typeof pkeySchema, typeof expected>();

      expect(pkeySchema.parse({ id: 1, name: 'name' })).toEqual({
        id: 1,
        name: 'name',
      });

      expect(() => pkeySchema.parse({})).toThrow('Required');
    });
  });

  describe('nullable', () => {
    it('should parse nullable', () => {
      const type = t.string().nullable();

      assertAllTypes<typeof type, ZodNullable<ZodString>>();

      expectAllParse(type, null, null);
    });
  });

  const smallint = t.smallint();
  const integer = t.integer();
  const real = t.real();
  const smallSerial = t.smallSerial();
  const serial = t.serial();

  assertAllTypes<
    | typeof smallint
    | typeof integer
    | typeof real
    | typeof smallSerial
    | typeof serial,
    ZodNumber
  >();

  describe.each(['smallint', 'integer', 'real', 'smallSerial', 'serial'])(
    '%s',
    (method) => {
      it('should convert to number', () => {
        const type = t[method as 'integer']();

        expectAllParse(type, 123, 123);

        expectAllThrow(type, 's', 'Expected number');

        const isInt = method !== 'real' && method !== 'money';

        if (isInt) {
          expectAllThrow(type, 1.5, 'Expected integer, received float');
        }

        testTypeMethod(type, 'lt', 10, 'Number must be less than 5', 5);

        testTypeMethod(
          type,
          'lte',
          10,
          'Number must be less than or equal to 5',
          5,
        );

        testTypeMethod(
          type,
          'max',
          10,
          'Number must be less than or equal to 5',
          5,
        );

        testTypeMethod(type, 'gt', 0, 'Number must be greater than 5', 5);

        testTypeMethod(
          type,
          'gte',
          0,
          'Number must be greater than or equal to 5',
          5,
        );

        testTypeMethod(
          type,
          'min',
          0,
          'Number must be greater than or equal to 5',
          5,
        );

        testTypeMethod(type, 'positive', -1, 'Number must be greater than 0');

        testTypeMethod(
          type,
          'nonNegative',
          -1,
          'Number must be greater than or equal to 0',
        );

        testTypeMethod(type, 'negative', 0, 'Number must be less than 0');

        testTypeMethod(
          type,
          'nonPositive',
          1,
          'Number must be less than or equal to 0',
        );

        testTypeMethod(type, 'step', 3, 'Number must be a multiple of 5', 5);

        // remove int check before checking for infinity
        (type.data as { int?: boolean }).int = undefined;

        testTypeMethod(type, 'finite', Infinity, 'Number must be finite');

        testTypeMethod(
          type,
          'safe',
          Number.MAX_SAFE_INTEGER + 1,
          `Number must be less than or equal to ${Number.MAX_SAFE_INTEGER}`,
        );
      });
    },
  );

  const bigint = t.bigint();
  const bigSerial = t.bigSerial();
  const numeric = t.numeric();
  const decimal = t.decimal();
  const doublePrecision = t.doublePrecision();
  const varchar = t.varchar();
  const text = t.text();
  const string = t.string();

  assertAllTypes<
    | typeof numeric
    | typeof decimal
    | typeof doublePrecision
    | typeof bigint
    | typeof bigSerial
    | typeof varchar
    | typeof text
    | typeof string,
    ZodString
  >();

  describe.each([
    'numeric',
    'decimal',
    'doublePrecision',
    'bigint',
    'bigSerial',
    'varchar',
    'text',
    'string',
  ])('%s', (method) => {
    it('should convert to string', () => {
      const type = t[method as 'text'];

      expectAllParse(type(), 's', 's');

      expectAllThrow(type(), 1, 'Expected string');

      testTypeMethod(
        type(),
        'min',
        '',
        'String must contain at least 1 character(s)',
        1,
      );

      testTypeMethod(
        type(),
        'max',
        '123',
        'String must contain at most 1 character(s)',
        1,
      );

      testTypeMethod(
        type(),
        'length',
        '',
        'String must contain exactly 1 character(s)',
        1,
      );

      testTypeMethod(
        type(),
        'length',
        '123',
        'String must contain exactly 1 character(s)',
        1,
      );

      testTypeMethod(type(), 'email', 'invalid', 'Invalid email');

      testTypeMethod(type(), 'url', 'invalid', 'Invalid url');

      testTypeMethod(type(), 'emoji', 'invalid', 'Invalid emoji');

      testTypeMethod(type(), 'uuid', 'invalid', 'Invalid uuid');

      testTypeMethod(type(), 'cuid', '', 'Invalid cuid');

      testTypeMethod(type(), 'ulid', 'invalid', 'Invalid ulid');

      testTypeMethod(
        type(),
        'nonEmpty',
        '',
        'String must contain at least 1 character(s)',
      );

      testTypeMethod(type(), 'regex', 'invalid', 'Invalid', /\d+/);

      testTypeMethod(type(), 'includes', 'invalid', 'Invalid', 'koko');

      testTypeMethod(type(), 'startsWith', 'invalid', 'Invalid', 'koko');

      testTypeMethod(type(), 'endsWith', 'invalid', 'Invalid', 'koko');

      testTypeMethod(type(), 'datetime', 'invalid', 'Invalid');

      testTypeMethod(type(), 'ip', 'invalid', 'Invalid');

      expectAllParse(type().trim(), '  trimmed  ', 'trimmed');

      expectAllParse(type().toLowerCase(), 'DOWN', 'down');

      expectAllParse(type().toUpperCase(), 'up', 'UP');
    });

    it('should convert to string with limit', () => {
      const type = t[method as 'text']().length(3);

      expectAllThrow(type, '', 'String must contain exactly 3 character(s)');

      expectAllThrow(
        type,
        '1234',
        'String must contain exactly 3 character(s)',
      );
    });
  });

  describe.each(['varchar', 'string'])('%s', (method) => {
    it('should accept max as argument', () => {
      const type = t[method as 'varchar'](3);

      expect(() => type.inputSchema.parse('asdf')).toThrow(
        'String must contain at most 3 character(s)',
      );
    });
  });

  describe.each(['text', 'citext'])('%s', (method) => {
    it('should accept min and max as arguments', () => {
      const type = t[method as 'text']().min(2).max(3);

      expect(() => type.inputSchema.parse('a')).toThrow(
        'String must contain at least 2 character(s)',
      );

      expect(() => type.inputSchema.parse('asdf')).toThrow(
        'String must contain at most 3 character(s)',
      );
    });
  });

  describe('bytea', () => {
    it('should check Buffer', () => {
      const type = t.bytea();

      assertAllTypes<typeof type, ZodType<Buffer>>();

      const buffer = Buffer.from([0x62, 0x75, 0x66, 0x66, 0x65, 0x72]);
      expectAllParse(type, buffer, buffer);

      expectAllThrow(type, [1, 0, 1], 'Input not instance of Buffer');
    });
  });

  const date = t.date();
  const timestampNoTz = t.timestampNoTZ();
  const timestamp = t.timestamp();

  assertType<
    | typeof date.inputSchema
    | typeof timestampNoTz.inputSchema
    | typeof timestamp.inputSchema,
    ZodDate
  >();

  assertType<
    | typeof date.outputSchema
    | typeof timestampNoTz.outputSchema
    | typeof timestamp.outputSchema,
    ZodString
  >();

  assertType<
    | typeof date.querySchema
    | typeof timestampNoTz.querySchema
    | typeof timestamp.querySchema,
    ZodDate
  >();

  describe.each(['date', 'timestampNoTZ', 'timestamp'])('%s', (method) => {
    const type = t[method as 'date']();

    const asDate = type.asDate();
    assertType<typeof asDate.outputSchema, ZodDate>();

    const asNumber = type.asNumber();
    assertType<typeof asNumber.outputSchema, ZodNumber>();

    it('should parse from string to a Date', () => {
      const date = new Date(2000, 0, 1, 0, 0, 0, 0);

      expectAllParse(type, date.toISOString(), date);

      expectInputQueryThrow(type, 'malformed', 'Invalid date');
    });

    it('should parse from number to a Date', () => {
      const date = new Date(2000, 0, 1, 0, 0, 0, 0);

      expectAllParse(type, date.getTime(), date);

      expectInputQueryThrow(type, new Date(NaN), 'Invalid date');
    });

    it('should parse from Date to a Date', () => {
      const date = new Date(2000, 0, 1, 0, 0, 0, 0);

      expectAllParse(type, date, date);

      expectInputQueryThrow(type, new Date(NaN), 'Invalid date');
    });

    it('should support date methods', () => {
      const now = new Date();

      expectInputQueryThrow(
        type.min(new Date(now.getTime() + 100)),
        now,
        'Date must be greater than or equal to',
      );

      expectInputQueryThrow(
        type.min(new Date(now.getTime() + 100), 'custom'),
        now,
        'custom',
      );

      expectInputQueryThrow(
        type.max(new Date(now.getTime() - 100)),
        now,
        'Date must be smaller than or equal to',
      );

      expectInputQueryThrow(
        type.max(new Date(now.getTime() - 100), 'custom'),
        now,
        'custom',
      );
    });
  });

  const time = t.time();
  assertAllTypes<typeof time, ZodString>();

  describe('time', () => {
    it('should validate and parse to a string', () => {
      const input = '12:12:12';
      expectAllParse(time, input, input);
    });
  });

  describe('interval', () => {
    it('should validate and parse time interval', () => {
      const type = t.interval();

      const interval = {
        years: 1,
        months: 1,
        days: 1,
        hours: 1,
        seconds: 1,
      };

      assertType<
        ReturnType<(typeof type.outputSchema)['parse']>,
        Partial<typeof interval>
      >();

      expectAllParse(type, interval, interval);

      expectAllThrow(
        type,
        { years: 'string' },
        'Expected number, received string',
      );
    });
  });

  describe('boolean', () => {
    it('should validate and parse a boolean', () => {
      const type = t.boolean();

      assertAllTypes<typeof type, ZodBoolean>();

      expectAllParse(type, true, true);

      expectAllThrow(type, 123, 'Expected boolean, received number');
    });
  });

  describe('enum', () => {
    it('should validate and parse enum', () => {
      const values = ['a', 'b', 'c'] as const;
      const type = t.enum('name', values);

      assertAllTypes<typeof type, ZodEnum<['a', 'b', 'c']>>();

      expectAllParse(type, 'a', 'a');

      expectAllThrow(type, 'd', 'Invalid enum value');
    });
  });

  const point = t.point();
  const line = t.line();
  const lseg = t.lseg();
  const box = t.box();
  const path = t.path();
  const polygon = t.polygon();
  const circle = t.circle();
  assertAllTypes<
    | typeof point
    | typeof line
    | typeof lseg
    | typeof box
    | typeof path
    | typeof polygon
    | typeof circle,
    ZodString
  >();

  describe.each(['point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle'])(
    '%s',
    (method) => {
      it('should parse to a string without validation', () => {
        const type = t[method as 'point']();

        expectAllParse(type, 'string', 'string');

        expectAllThrow(type, 123, 'Expected string, received number');
      });
    },
  );

  const cidr = t.cidr();
  const inet = t.inet();
  const macaddr = t.macaddr();
  const macaddr8 = t.macaddr8();
  assertAllTypes<
    typeof cidr | typeof inet | typeof macaddr | typeof macaddr8,
    ZodString
  >();

  describe.each(['cidr', 'inet', 'macaddr', 'macaddr8'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const type = t[method as 'cidr']();

      expectAllParse(type, 'string', 'string');

      expectAllThrow(type, 123, 'Expected string, received number');
    });
  });

  const bit = t.bit(5);
  const bitVarying = t.bitVarying();
  assertAllTypes<typeof bit | typeof bitVarying, ZodString>();

  describe.each(['bit', 'bitVarying'])('%s', (method) => {
    it('should validate a string to contain only 1 or 0 and parse to a string', () => {
      const type = t[method as 'bit'](5);

      expectAllParse(type, '10101', '10101');

      expectAllThrow(type, '2', 'Invalid');

      expectAllThrow(
        type,
        '101010',
        'String must contain at most 5 character(s)',
      );
    });
  });

  const tsvector = t.tsvector();
  const tsquery = t.tsquery();
  assertAllTypes<typeof tsvector | typeof tsquery, ZodString>();

  describe.each(['tsvector', 'tsquery'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const type = t[method as 'tsvector']();

      expectAllParse(type, 'string', 'string');

      expectAllThrow(type, 123, 'Expected string, received number');
    });
  });

  describe('money', () => {
    it('should parse to a number', () => {
      const type = t.money();
      assertAllTypes<typeof type, ZodNumber>();

      expectAllParse(type, 123, 123);

      expectAllThrow(type, '123', 'Expected number, received string');
    });
  });

  const xml = t.xml();
  const jsonText = t.jsonText();
  assertAllTypes<typeof xml | typeof jsonText, ZodString>();

  describe.each(['xml', 'jsonText'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const type = t[method as 'xml']();

      expectAllParse(type, 'string', 'string');

      expectAllThrow(type, 123, 'Expected string, received number');
    });
  });

  describe('uuid', () => {
    it('should validate uuid and parse to a string', () => {
      const type = t.uuid();

      assertAllTypes<typeof type, ZodString>();

      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expectAllParse(type, uuid, uuid);

      expectAllThrow(type, '1234', 'Invalid uuid');
    });
  });

  describe('array', () => {
    it('should validate and parse array', () => {
      const type = t.array(t.integer());

      assertAllTypes<typeof type, ZodArray<ZodNumber>>();

      expectAllParse(type, [1, 2, 3], [1, 2, 3]);

      expectAllThrow(type, 123, 'Expected array, received number');

      expectAllThrow(type, 's', 'Expected array, received string');

      testTypeMethod(
        type,
        'min',
        [],
        'Array must contain at least 1 element(s)',
        1,
      );

      testTypeMethod(
        type,
        'max',
        [1, 2],
        'Array must contain at most 1 element(s)',
        1,
      );

      testTypeMethod(
        type,
        'length',
        [],
        'Array must contain exactly 1 element(s)',
        1,
      );

      testTypeMethod(
        type,
        'length',
        [1, 2],
        'Array must contain exactly 1 element(s)',
        1,
      );

      testTypeMethod(
        type,
        'nonEmpty',
        [],
        'Array must contain at least 1 element(s)',
      );
    });
  });

  describe('error messages', () => {
    it('should support `required_error`', () => {
      const type = t.string().error({
        required: 'custom message',
      });

      assertAllTypes<typeof type, ZodString>();

      expectAllThrow(type, undefined, 'custom message');
    });

    it('should support `invalid_type_error`', () => {
      const type = t.string().error({
        invalidType: 'custom message',
      });

      assertAllTypes<typeof type, ZodString>();

      expectAllThrow(type, 123, 'custom message');
    });
  });

  describe('json', () => {
    it('should parse json', () => {
      const type = t.json(
        z.object({
          bool: z.boolean(),
        }),
      );

      const expected = z.object({ bool: z.boolean() });
      assertAllTypes<typeof type, typeof expected>();
    });
  });

  describe('as', () => {
    it('should convert one type to the same schema as another type', () => {
      const timestampAsInteger = t
        .timestampNoTZ()
        .encode(z.number(), (input: number) => new Date(input))
        .parse(z.date(), Date.parse)
        .as(t.integer());

      assertAllTypes<typeof timestampAsInteger, ZodNumber>();

      expectAllParse(timestampAsInteger, 123, 123);

      const timestampAsDate = t
        .timestampNoTZ()
        .parse(z.date(), (string) => new Date(string));

      assertType<typeof timestampAsDate.outputSchema, ZodDate>();

      const date = new Date();
      expect(timestampAsDate.outputSchema.parse(date)).toEqual(date);
    });
  });

  describe('virtual', () => {
    class Virtual extends VirtualColumn<ZodSchemaConfig> {}

    it('should return ZodNever from columnToZod', () => {
      const type = new Virtual(zodSchemaConfig);

      assertAllTypes<typeof type, ZodNever>();

      expectAllThrow(type, 123, 'Expected never, received number');
    });
  });

  describe('domain', () => {
    it('should convert it to a base column', () => {
      const type = t.domain('domainName').as(t.integer());

      assertAllTypes<typeof type, ZodNumber>();

      expectAllParse(type, 123, 123);

      expectAllThrow(type, 'string', 'Expected number, received string');
    });
  });

  describe('custom type', () => {
    it('should convert it to a base column', () => {
      const type = new CustomTypeColumn(zodSchemaConfig, 'customType').as(
        t.integer(),
      );

      assertAllTypes<typeof type, ZodNumber>();

      expectAllParse(type, 123, 123);

      expectAllThrow(type, 'string', 'Expected number, received string');
    });
  });

  describe('customizing schema types', () => {
    const fn = (s: ZodString) =>
      s.transform((s) => s.split('').reverse().join(''));

    const type = t.string().input(fn).output(fn).query(fn);

    expectAllParse(type, 'foo', 'oof');
  });

  describe('geography point', () => {
    it('should parse', () => {
      const type = t.geography.point();
      assertAllTypes<
        typeof type,
        ZodObject<{
          srid: ZodOptional<ZodNumber>;
          lon: ZodNumber;
          lat: ZodNumber;
        }>
      >();

      expectAllParse(
        type,
        { srid: 1, lon: 2, lat: 3 },
        { srid: 1, lon: 2, lat: 3 },
      );

      expectAllThrow(type, '123', 'Expected object, received string');
    });
  });

  describe('parseNull', () => {
    it('should combine output schema with null schema for parsing', () => {
      const type = t
        .string()
        .parse(z.number(), parseInt)
        .parseNull(z.boolean(), () => true)
        .nullable();

      assertType<typeof type.outputSchema, ZodUnion<[ZodNumber, ZodBoolean]>>();

      expect(type.outputSchema.parse(123)).toBe(123);
      expect(type.outputSchema.parse(true)).toBe(true);
      expect(() => type.outputSchema.parse(null)).toThrow(
        'Expected number, received null',
      );
    });
  });
});
