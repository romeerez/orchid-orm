import { ZodSchemaConfig, zodSchemaConfig } from './zod';
import { CustomTypeColumn, makeColumnTypes, VirtualColumn } from 'pqb';
import {
  z,
  ZodArray,
  ZodBoolean,
  ZodDate,
  ZodEnum,
  ZodLiteral,
  ZodNever,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodString,
  ZodType,
  ZodTypeAny,
  ZodUnion,
} from 'zod/v4';
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

function expectError(type: ZodTypeAny, input: unknown, message: string) {
  const flat = z.flattenError(type.safeParse(input).error!);

  expect([
    ...flat.formErrors,
    ...Object.values(flat.fieldErrors).flat(),
  ]).toContain(message);
}

function expectAllThrow(type: TypeBase, input: unknown, message: string) {
  for (const key of ['inputSchema', 'outputSchema', 'querySchema'] as const) {
    expectError(type[key], input, message);
  }
}

function expectInputQueryThrow(
  type: TypeBase,
  input: unknown,
  message: string,
) {
  expectError(type.inputSchema, input, message);
  expectError(type.querySchema, input, message);
}

function testTypeMethod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: () => any,
  method: string,
  value: unknown,
  error: string,
  args: unknown[] = [],
  opts?: { noCustom?: boolean },
) {
  const a = type()[method](...args);
  expectError(a.inputSchema, value, error);
  expectError(a.querySchema, value, error);

  if (!opts?.noCustom) {
    const b = type()[method](...args, { error: 'custom' });
    expectError(b.inputSchema, value, 'custom');
    expectError(b.querySchema, value, 'custom');
  }
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

    expectAllThrow(
      type,
      { id: '1', name: 'name' },
      'Invalid input: expected number, received string',
    );
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
        'Invalid input: expected number, received string',
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

      expectError(
        pkeySchema,
        {},
        'Invalid input: expected number, received undefined',
      );
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
        const type = () => t[method as 'integer']();

        expectAllParse(type(), 123, 123);

        expectAllThrow(
          type(),
          's',
          'Invalid input: expected number, received string',
        );

        const isInt = method !== 'real' && method !== 'money';

        if (isInt) {
          expectAllThrow(
            type(),
            1.5,
            'Invalid input: expected int, received number',
          );
        }

        testTypeMethod(type, 'lt', 10, 'Too big: expected number to be <5', [
          5,
        ]);

        testTypeMethod(type, 'lte', 10, 'Too big: expected number to be <=5', [
          5,
        ]);

        testTypeMethod(type, 'max', 10, 'Too big: expected number to be <=5', [
          5,
        ]);

        testTypeMethod(type, 'gt', 0, 'Too small: expected number to be >5', [
          5,
        ]);

        testTypeMethod(type, 'gte', 0, 'Too small: expected number to be >=5', [
          5,
        ]);

        testTypeMethod(type, 'min', 0, 'Too small: expected number to be >=5', [
          5,
        ]);

        testTypeMethod(
          type,
          'positive',
          -1,
          'Too small: expected number to be >0',
        );

        testTypeMethod(
          type,
          'nonNegative',
          -1,
          'Too small: expected number to be >=0',
        );

        testTypeMethod(
          type,
          'negative',
          0,
          'Too big: expected number to be <0',
        );

        testTypeMethod(
          type,
          'nonPositive',
          1,
          'Too big: expected number to be <=0',
        );

        testTypeMethod(
          type,
          'step',
          3,
          'Invalid number: must be a multiple of 5',
          [5],
        );

        testTypeMethod(
          type,
          'finite',
          Infinity,
          'Invalid input: expected number, received number',
          [],
          { noCustom: true },
        );

        testTypeMethod(
          type,
          'safe',
          Number.MAX_SAFE_INTEGER + 1,
          `Too big: expected int to be <${Number.MAX_SAFE_INTEGER}`,
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

      expectAllThrow(
        type(),
        1,
        'Invalid input: expected string, received number',
      );

      testTypeMethod(
        type,
        'min',
        '',
        'Too small: expected string to have >1 characters',
        [1],
      );

      testTypeMethod(
        type,
        'max',
        '123',
        'Too big: expected string to have <1 characters',
        [1],
      );

      testTypeMethod(
        type,
        'length',
        '',
        'Too small: expected string to have >1 characters',
        [1],
      );

      testTypeMethod(
        type,
        'length',
        '123',
        'Too big: expected string to have <1 characters',
        [1],
      );

      testTypeMethod(type, 'email', 'invalid', 'Invalid email address');

      testTypeMethod(type, 'url', 'invalid', 'Invalid URL');

      testTypeMethod(type, 'emoji', 'invalid', 'Invalid emoji');

      testTypeMethod(type, 'uuid', 'invalid', 'Invalid UUID');

      testTypeMethod(type, 'cuid', '', 'Invalid cuid');

      testTypeMethod(type, 'ulid', 'invalid', 'Invalid ULID');

      testTypeMethod(
        type,
        'nonEmpty',
        '',
        'Too small: expected string to have >1 characters',
      );

      testTypeMethod(
        type,
        'regex',
        'invalid',
        'Invalid string: must match pattern /\\d+/',
        [/\d+/],
      );

      testTypeMethod(
        type,
        'includes',
        'invalid',
        'Invalid string: must include "koko"',
        ['koko'],
      );

      testTypeMethod(
        type,
        'startsWith',
        'invalid',
        'Invalid string: must start with "koko"',
        ['koko'],
      );

      testTypeMethod(
        type,
        'endsWith',
        'invalid',
        'Invalid string: must end with "koko"',
        ['koko'],
      );

      testTypeMethod(type, 'datetime', 'invalid', 'Invalid ISO datetime');

      testTypeMethod(type, 'ipv4', 'invalid', 'Invalid IPv4 address');

      testTypeMethod(type, 'ipv6', 'invalid', 'Invalid IPv6 address');

      expectAllParse(type().trim(), '  trimmed  ', 'trimmed');

      expectAllParse(type().toLowerCase(), 'DOWN', 'down');

      expectAllParse(type().toUpperCase(), 'up', 'UP');
    });

    it('should convert to string with limit', () => {
      const type = t[method as 'text']().length(3);

      expectAllThrow(
        type,
        '',
        'Too small: expected string to have >3 characters',
      );

      expectAllThrow(
        type,
        '1234',
        'Too big: expected string to have <3 characters',
      );
    });
  });

  describe.each(['varchar', 'string'])('%s', (method) => {
    it('should accept max as argument', () => {
      const type = t[method as 'varchar'](3);

      expectError(
        type.inputSchema,
        'asdf',
        'Too big: expected string to have <3 characters',
      );
    });
  });

  describe.each(['text', 'citext'])('%s', (method) => {
    it('should accept min and max as arguments', () => {
      const type = t[method as 'text']().min(2).max(3);

      expectError(
        type.inputSchema,
        'a',
        'Too small: expected string to have >2 characters',
      );

      expectError(
        type.inputSchema,
        'asdf',
        'Too big: expected string to have <3 characters',
      );
    });
  });

  describe('bytea', () => {
    it('should check Buffer', () => {
      const type = t.bytea();

      assertType<(typeof type)['inputSchema'], ZodType<Buffer>>();
      assertType<(typeof type)['outputSchema'], ZodType<Buffer>>();
      assertType<(typeof type)['querySchema'], ZodString>();

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

      expectInputQueryThrow(
        type,
        'malformed',
        'Invalid input: expected date, received Date',
      );
    });

    it('should parse from number to a Date', () => {
      const date = new Date(2000, 0, 1, 0, 0, 0, 0);

      expectAllParse(type, date.getTime(), date);

      expectInputQueryThrow(
        type,
        new Date(NaN),
        'Invalid input: expected date, received Date',
      );
    });

    it('should parse from Date to a Date', () => {
      const date = new Date(2000, 0, 1, 0, 0, 0, 0);

      expectAllParse(type, date, date);

      expectInputQueryThrow(
        type,
        new Date(NaN),
        'Invalid input: expected date, received Date',
      );
    });

    it('should support date methods', () => {
      const now = new Date();
      const min = new Date(now.getTime() + 100);
      const max = new Date(now.getTime() - 100);

      expectInputQueryThrow(
        type.min(min),
        now,
        `Too small: expected date to be >=${min}`,
      );

      expectInputQueryThrow(type.min(min, 'custom'), now, 'custom');

      expectInputQueryThrow(
        type.max(max),
        now,
        `Too big: expected date to be <=${max}`,
      );

      expectInputQueryThrow(type.max(max, 'custom'), now, 'custom');
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
        'Invalid input: expected number, received string',
      );
    });
  });

  describe('boolean', () => {
    it('should validate and parse a boolean', () => {
      const type = t.boolean();

      assertAllTypes<typeof type, ZodBoolean>();

      expectAllParse(type, true, true);

      expectAllThrow(
        type,
        123,
        'Invalid input: expected boolean, received number',
      );
    });
  });

  describe('enum', () => {
    it('should validate and parse enum', () => {
      const values = ['a', 'b', 'c'] as const;
      const type = t.enum('name', values);

      assertAllTypes<typeof type, ZodEnum<{ a: 'a'; b: 'b'; c: 'c' }>>();

      expectAllParse(type, 'a', 'a');

      expectAllThrow(type, 'd', 'Invalid option: expected one of "a"|"b"|"c"');
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

        expectAllThrow(
          type,
          123,
          'Invalid input: expected string, received number',
        );
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

      expectAllThrow(
        type,
        123,
        'Invalid input: expected string, received number',
      );
    });
  });

  const bit = t.bit(5);
  const bitVarying = t.bitVarying();
  assertAllTypes<typeof bit | typeof bitVarying, ZodString>();

  describe.each(['bit', 'bitVarying'])('%s', (method) => {
    it('should validate a string to contain only 1 or 0 and parse to a string', () => {
      const type = t[method as 'bit'](5);

      expectAllParse(type, '10101', '10101');

      expectAllThrow(type, '2', 'Invalid string: must match pattern /[10]/g');

      expectAllThrow(
        type,
        '101010',
        'Too big: expected string to have <5 characters',
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

      expectAllThrow(
        type,
        123,
        'Invalid input: expected string, received number',
      );
    });
  });

  describe('money', () => {
    it('should parse to a number', () => {
      const type = t.money();
      assertAllTypes<typeof type, ZodNumber>();

      expectAllParse(type, 123, 123);

      expectAllThrow(
        type,
        '123',
        'Invalid input: expected number, received string',
      );
    });
  });

  const xml = t.xml();
  const jsonText = t.jsonText();
  assertAllTypes<typeof xml | typeof jsonText, ZodString>();

  describe.each(['xml', 'jsonText'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const type = t[method as 'xml']();

      expectAllParse(type, 'string', 'string');

      expectAllThrow(
        type,
        123,
        'Invalid input: expected string, received number',
      );
    });
  });

  describe('uuid', () => {
    it('should validate uuid and parse to a string', () => {
      const type = t.uuid();

      assertAllTypes<typeof type, ZodString>();

      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expectAllParse(type, uuid, uuid);

      expectAllThrow(type, '1234', 'Invalid UUID');
    });
  });

  describe('array', () => {
    it('should validate and parse array', () => {
      const type = () => t.array(t.integer());

      assertAllTypes<ReturnType<typeof type>, ZodArray<ZodNumber>>();

      expectAllParse(type(), [1, 2, 3], [1, 2, 3]);

      expectAllThrow(
        type(),
        123,
        'Invalid input: expected array, received number',
      );

      expectAllThrow(
        type(),
        's',
        'Invalid input: expected array, received string',
      );

      testTypeMethod(
        type,
        'min',
        [],
        'Too small: expected array to have >1 items',
        [1],
      );

      testTypeMethod(
        type,
        'max',
        [1, 2],
        'Too big: expected array to have <1 items',
        [1],
      );

      testTypeMethod(
        type,
        'length',
        [],
        'Too small: expected array to have >1 items',
        [1],
      );

      testTypeMethod(
        type,
        'length',
        [1, 2],
        'Too big: expected array to have <1 items',
        [1],
      );

      testTypeMethod(
        type,
        'nonEmpty',
        [],
        'Too small: expected array to have >1 items',
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

  describe('narrowType', () => {
    it('accepts narrowed type', () => {
      const column = t.text().narrowType(z.literal('type'));

      assertType<
        | typeof column.inputType
        | typeof column.outputType
        | typeof column.queryType,
        'type'
      >();
      assertType<
        | typeof column.inputSchema
        | typeof column.inputSchema
        | typeof column.outputSchema,
        ZodLiteral<'type'>
      >();

      expect(column.inputSchema).toBeInstanceOf(ZodLiteral);
      expect(column.outputSchema).toBeInstanceOf(ZodLiteral);
      expect(column.querySchema).toBeInstanceOf(ZodLiteral);
    });

    it('does not accept non-compatible type', () => {
      // @ts-expect-error non-compatible type
      t.text().narrowType(z.number());
    });

    it('can be set to a common denominator of columns where input type is different from output, such as timestamp', () => {
      t.timestamp().narrowType(z.literal('string'));

      // @ts-expect-error non-compatible type
      t.timestamp().narrowType(z.date());
    });
  });

  describe('narrowAllTypes', () => {
    it('accepts narrowed types', () => {
      const column = t.text().narrowAllTypes({
        input: z.literal('input'),
        output: z.literal('output'),
        query: z.literal('query'),
      });

      assertType<typeof column.inputType, 'input'>();
      assertType<typeof column.inputSchema, ZodLiteral<'input'>>();
      assertType<typeof column.outputType, 'output'>();
      assertType<typeof column.outputSchema, ZodLiteral<'output'>>();
      assertType<typeof column.queryType, 'query'>();
      assertType<typeof column.querySchema, ZodLiteral<'query'>>();

      expect(column.inputSchema).toBeInstanceOf(ZodLiteral);
      expect(column.outputSchema).toBeInstanceOf(ZodLiteral);
      expect(column.querySchema).toBeInstanceOf(ZodLiteral);
    });

    it('does not accept non-compatible types', () => {
      t.text().narrowAllTypes({
        // @ts-expect-error non-compatible type
        input: z.number(),
      });

      t.text().narrowAllTypes({
        // @ts-expect-error non-compatible type
        output: z.number(),
      });

      t.text().narrowAllTypes({
        // @ts-expect-error non-compatible type
        query: z.number(),
      });
    });
  });

  describe('virtual', () => {
    class Virtual extends VirtualColumn<ZodSchemaConfig> {}

    it('should return ZodNever from columnToZod', () => {
      const type = new Virtual(zodSchemaConfig);

      assertAllTypes<typeof type, ZodNever>();

      expectAllThrow(
        type,
        123,
        'Invalid input: expected never, received number',
      );
    });
  });

  describe('domain', () => {
    it('should convert it to a base column', () => {
      const type = t.domain('domainName').as(t.integer());

      assertAllTypes<typeof type, ZodNumber>();

      expectAllParse(type, 123, 123);

      expectAllThrow(
        type,
        'string',
        'Invalid input: expected number, received string',
      );
    });
  });

  describe('custom type', () => {
    it('should convert it to a base column', () => {
      const type = new CustomTypeColumn(zodSchemaConfig, 'customType').as(
        t.integer(),
      );

      assertAllTypes<typeof type, ZodNumber>();

      expectAllParse(type, 123, 123);

      expectAllThrow(
        type,
        'string',
        'Invalid input: expected number, received string',
      );
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

      expectAllThrow(
        type,
        '123',
        'Invalid input: expected object, received string',
      );
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
      expect(z.treeifyError(type.outputSchema.safeParse(null).error!)).toEqual({
        errors: [
          'Invalid input: expected number, received null',
          'Invalid input: expected boolean, received null',
        ],
      });
    });
  });
});
