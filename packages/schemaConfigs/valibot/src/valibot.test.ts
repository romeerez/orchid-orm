import { CustomTypeColumn, makeColumnTypes, VirtualColumn } from 'pqb';
import { AssertEqual, assertType } from 'test-utils';
import { ValibotSchemaConfig, valibotSchemaConfig } from './valibot';
import {
  ArraySchema,
  BaseSchema,
  boolean,
  BooleanSchema,
  DateSchema,
  InstanceSchema,
  NullableSchema,
  number,
  NumberSchema,
  object,
  Output,
  parse,
  partial,
  PicklistSchema,
  string,
  StringSchema,
  date,
  NeverSchema,
  transform,
  optional,
  nullable,
} from 'valibot';

const t = makeColumnTypes(valibotSchemaConfig);

type TypeBase = {
  inputSchema: BaseSchema;
  outputSchema: BaseSchema;
  querySchema: BaseSchema;
};

const assertAllTypes = <T extends TypeBase, Expected extends BaseSchema>(
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
    input: parse(type.inputSchema, input),
    output: parse(type.inputSchema, input),
    query: parse(type.inputSchema, input),
  }).toEqual({
    input: expected,
    output: expected,
    query: expected,
  });
}

function expectAllThrow(type: TypeBase, input: unknown, message: string) {
  expect(() => parse(type.inputSchema, input)).toThrow(message);
  expect(() => parse(type.outputSchema, input)).toThrow(message);
  expect(() => parse(type.querySchema, input)).toThrow(message);
}

function expectInputQueryThrow(
  type: TypeBase,
  input: unknown,
  message: string,
) {
  expect(() => parse(type.inputSchema, input)).toThrow(message);
  expect(() => parse(type.querySchema, input)).toThrow(message);
}

function testTypeMethod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: () => any,
  method: string,
  value: unknown,
  error: string,
  ...args: unknown[]
) {
  const a = type()[method](...args);
  expect(() => parse(a.inputSchema, value)).toThrow(error);
  expect(() => parse(a.querySchema, value)).toThrow(error);

  const b = type()[method](...args, 'custom');
  expect(() => parse(b.inputSchema, value)).toThrow('custom');
  expect(() => parse(b.querySchema, value)).toThrow('custom');
}

describe('valibot schema config', () => {
  it('should create schemas for a table', () => {
    const columns = {
      shape: {
        id: t.identity().primaryKey(),
        name: t.string(),
      },
    };

    const klass = {
      prototype: { columns },
      inputSchema: valibotSchemaConfig.inputSchema,
      outputSchema: valibotSchemaConfig.outputSchema,
      querySchema: valibotSchemaConfig.querySchema,
      pkeySchema: valibotSchemaConfig.pkeySchema,
      createSchema: valibotSchemaConfig.createSchema,
    };

    const type = {
      inputSchema: klass.inputSchema(),
      outputSchema: klass.outputSchema(),
      querySchema: klass.querySchema(),
    };

    const expected = object({ id: number(), name: string() });

    assertType<typeof type.inputSchema, typeof expected>();
    assertType<typeof type.outputSchema, typeof expected>();

    expectAllParse(type, { id: 1, name: 'name' }, { id: 1, name: 'name' });

    expectAllThrow(
      type,
      { id: '1' },
      'Invalid type: Expected number but received "1"',
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
        inputSchema: valibotSchemaConfig.inputSchema,
        outputSchema: valibotSchemaConfig.outputSchema,
        querySchema: valibotSchemaConfig.querySchema,
        pkeySchema: valibotSchemaConfig.pkeySchema,
        createSchema: valibotSchemaConfig.createSchema,
      };

      const schema = klass.querySchema();

      const expected = partial(object({ id: number(), name: string() }));

      assertType<typeof schema, typeof expected>();

      expect(parse(schema, { id: 1, name: 'name' })).toEqual({
        id: 1,
        name: 'name',
      });

      expect(() => parse(schema, { id: '1' })).toThrow(
        'Invalid type: Expected number but received "1"',
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
        inputSchema: valibotSchemaConfig.inputSchema,
        querySchema: valibotSchemaConfig.outputSchema,
        pkeySchema: valibotSchemaConfig.pkeySchema,
        createSchema: valibotSchemaConfig.createSchema,
      };

      const createSchema = klass.createSchema();

      const expected = object({
        name: string(),
        optional: optional(nullable(string())),
        withDefault: optional(string()),
      });
      assertType<typeof createSchema, typeof expected>();

      expect(parse(createSchema, { name: 'name' })).toEqual({
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
        inputSchema: valibotSchemaConfig.inputSchema,
        querySchema: valibotSchemaConfig.outputSchema,
        pkeySchema: valibotSchemaConfig.pkeySchema,
        createSchema: valibotSchemaConfig.createSchema,
        updateSchema: valibotSchemaConfig.updateSchema,
      };

      const updateSchema = klass.updateSchema();

      const expected = partial(object({ name: string() }));
      assertType<typeof updateSchema, typeof expected>();

      expect(parse(updateSchema, { name: 'name' })).toEqual({
        name: 'name',
      });

      expect(parse(updateSchema, {})).toEqual({});
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
        inputSchema: valibotSchemaConfig.inputSchema,
        querySchema: valibotSchemaConfig.outputSchema,
        pkeySchema: valibotSchemaConfig.pkeySchema,
        createSchema: valibotSchemaConfig.createSchema,
      };

      const pkeySchema = klass.pkeySchema();

      const expected = object({ id: number(), name: string() });
      assertType<typeof pkeySchema, typeof expected>();

      expect(parse(pkeySchema, { id: 1, name: 'name' })).toEqual({
        id: 1,
        name: 'name',
      });

      expect(() => parse(pkeySchema, {})).toThrow(
        'Invalid type: Expected !undefined but received undefined',
      );
    });
  });

  describe('nullable', () => {
    it('should parse nullable', () => {
      const type = t.string().nullable();

      assertAllTypes<typeof type, NullableSchema<StringSchema>>();

      expectAllParse(type, null, null);
    });
  });

  const numberTypes = {
    smallint: t.smallint(),
    integer: t.integer(),
    real: t.real(),
    smallSerial: t.smallSerial(),
    serial: t.serial(),
  };

  assertAllTypes<
    (typeof numberTypes)[keyof typeof numberTypes],
    NumberSchema
  >();

  describe.each(['smallint', 'integer', 'real', 'smallSerial', 'serial'])(
    '%s',
    (method) => {
      it('should convert to number', () => {
        const type = () => t[method as 'integer']();

        expectAllParse(type(), 123, 123);

        expectAllThrow(type(), 's', 'Expected number');

        const isInt = method !== 'real' && method !== 'money';

        if (isInt) {
          expectAllThrow(type(), 1.5, 'Invalid integer: Received 1.5');
        }

        testTypeMethod(type, 'lt', 10, 'Expected <5 but received 10', 5);

        testTypeMethod(type, 'lte', 10, 'Expected <=5 but received 10', 5);

        testTypeMethod(type, 'max', 10, 'Expected <=5 but received 10', 5);

        testTypeMethod(type, 'gt', 0, 'Expected >5 but received 0', 5);

        testTypeMethod(type, 'gte', 0, 'Expected >=5 but received 0', 5);

        testTypeMethod(type, 'min', 0, 'Expected >=5 but received 0', 5);

        testTypeMethod(type, 'positive', -1, 'Expected >0 but received -1');

        testTypeMethod(type, 'nonNegative', -1, 'Expected >=0 but received -1');

        testTypeMethod(type, 'negative', 0, 'Expected <0 but received 0');

        testTypeMethod(type, 'nonPositive', 1, 'Expected <=0 but received 1');

        testTypeMethod(
          type,
          'step',
          3,
          'Expected a multiple of 5 but received 3',
          5,
        );

        const a = t[method as 'integer']().finite();
        expect(() => parse(a.inputSchema, Infinity)).toThrow(
          `Invalid ${isInt ? 'integer' : 'finite'}: Received Infinity`,
        );
        expect(() => parse(a.querySchema, Infinity)).toThrow(
          `Invalid ${isInt ? 'integer' : 'finite'}: Received Infinity`,
        );

        testTypeMethod(
          type,
          'safe',
          Number.MAX_SAFE_INTEGER + 1,
          `Expected <=9007199254740991 but received 9007199254740992`,
        );
      });
    },
  );

  const stringTypes = {
    bigint: t.bigint(),
    bigSerial: t.bigSerial(),
    numeric: t.numeric(),
    decimal: t.decimal(),
    doublePrecision: t.doublePrecision(),
    varchar: t.varchar(10),
    text: t.text(),
    string: t.string(),
  };

  assertAllTypes<
    (typeof stringTypes)[keyof typeof stringTypes],
    StringSchema
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
      const type =
        method === 'varchar' ? () => t.varchar(20) : t[method as 'numeric'];

      expectAllParse(type(), 's', 's');

      expectAllThrow(type(), 1, 'Expected string');

      testTypeMethod(
        type,
        'min',
        '',
        'Invalid length: Expected >=1 but received 0',
        1,
      );

      testTypeMethod(
        type,
        'max',
        '123',
        'Invalid length: Expected <=1 but received 3',
        1,
      );

      testTypeMethod(
        type,
        'length',
        '',
        'Invalid length: Expected 1 but received 0',
        1,
      );

      testTypeMethod(
        type,
        'length',
        '123',
        'Invalid length: Expected 1 but received 3',
        1,
      );

      testTypeMethod(type, 'email', 'invalid', 'Invalid email');

      testTypeMethod(type, 'url', 'invalid', 'Invalid URL');

      testTypeMethod(type, 'emoji', 'invalid', 'Invalid emoji');

      testTypeMethod(type, 'uuid', 'invalid', 'Invalid UUID');

      testTypeMethod(type, 'cuid2', '', 'Invalid Cuid2');

      testTypeMethod(type, 'ulid', 'invalid', 'Invalid ULID');

      testTypeMethod(
        type,
        'nonEmpty',
        '',
        'Invalid length: Expected >=1 but received 0',
      );

      testTypeMethod(type, 'regex', 'invalid', 'Invalid', /\d+/);

      testTypeMethod(type, 'includes', 'invalid', 'Invalid', 'koko');

      testTypeMethod(type, 'startsWith', 'invalid', 'Invalid', 'koko');

      testTypeMethod(type, 'endsWith', 'invalid', 'Invalid', 'koko');

      testTypeMethod(type, 'datetime', 'invalid', 'Invalid date-time');

      testTypeMethod(type, 'ip', 'invalid', 'Invalid IP');

      expectAllParse(type().trim(), '  trimmed  ', 'trimmed');

      expectAllParse(type().toLowerCase(), 'DOWN', 'down');

      expectAllParse(type().toUpperCase(), 'up', 'UP');
    });

    it('should convert to string with limit', () => {
      const type =
        method === 'varchar'
          ? t.varchar(10).length(3)
          : t[method as 'text']().length(3);

      expectAllThrow(type, '', 'Invalid length: Expected 3 but received 0');

      expectAllThrow(type, '1234', 'Invalid length: Expected 3 but received 4');
    });
  });

  describe.each(['varchar', 'string'])('%s', (method) => {
    it('should accept max as argument', () => {
      const type = t[method as 'varchar'](3);

      expect(() => parse(type.inputSchema, 'asdf')).toThrow(
        'Invalid length: Expected <=3 but received 4',
      );
    });
  });

  describe.each(['text', 'citext'])('%s', (method) => {
    it('should accept min and max as arguments', () => {
      const type = t[method as 'text']().min(2).max(3);

      expect(() => parse(type.inputSchema, 'a')).toThrow(
        'Invalid length: Expected >=2 but received 1',
      );

      expect(() => parse(type.inputSchema, 'asdf')).toThrow(
        'Invalid length: Expected <=3 but received 4',
      );
    });
  });

  describe('bytea', () => {
    it('should check Buffer', () => {
      const type = t.bytea();

      assertAllTypes<typeof type, InstanceSchema<typeof Buffer>>();

      const buffer = Buffer.from([0x62, 0x75, 0x66, 0x66, 0x65, 0x72]);
      expectAllParse(type, buffer, buffer);

      expectAllThrow(
        type,
        [1, 0, 1],
        'Invalid type: Expected Buffer but received Array',
      );
    });
  });

  const dateTypes = {
    date: t.date(),
    timestampNoTz: t.timestampNoTZ(),
    timestamp: t.timestamp(),
  };

  assertType<
    (typeof dateTypes)[keyof typeof dateTypes]['inputSchema'],
    DateSchema
  >();

  assertType<
    (typeof dateTypes)[keyof typeof dateTypes]['outputSchema'],
    StringSchema
  >();

  assertType<
    (typeof dateTypes)[keyof typeof dateTypes]['inputSchema'],
    DateSchema
  >();

  // describe.each(['date', 'timestampNoTZ', 'timestamp'])('%s', (method) => {
  describe.each(['date'])('%s', (method) => {
    const type = () => t[method as 'date']();

    const asDate = () => type().asDate();
    type AsDate = typeof asDate;
    assertType<ReturnType<AsDate>['outputSchema'], DateSchema>();

    const asNumber = () => type().asNumber();
    type AsNumber = typeof asNumber;
    assertType<ReturnType<AsNumber>['outputSchema'], NumberSchema>();

    it('should parse from string to a Date', () => {
      const date = new Date(2000, 0, 1, 0, 0, 0, 0);

      expectAllParse(type(), date.toISOString(), date);

      expectInputQueryThrow(
        type(),
        'malformed',
        'Invalid type: Expected Date but received Date',
      );
    });

    it('should parse from number to a Date', () => {
      const date = new Date(2000, 0, 1, 0, 0, 0, 0);

      expectAllParse(type(), date.getTime(), date);

      expectInputQueryThrow(
        type(),
        new Date(NaN),
        'Invalid type: Expected Date but received Date',
      );
    });

    it('should parse from Date to a Date', () => {
      const date = new Date(2000, 0, 1, 0, 0, 0, 0);

      expectAllParse(type(), date, date);

      expectInputQueryThrow(
        type(),
        new Date(NaN),
        'Invalid type: Expected Date but received Date',
      );
    });

    it('should support date methods', () => {
      const now = new Date();

      expectAllThrow(
        asDate().min(new Date(now.getTime() + 100)),
        now,
        'Invalid value: Expected >=',
      );

      expectAllThrow(
        asDate().min(new Date(now.getTime() + 100), 'custom'),
        now,
        'custom',
      );

      expectAllThrow(
        asDate().max(new Date(now.getTime() - 100)),
        now,
        'Invalid value: Expected <=',
      );

      expectAllThrow(
        asDate().max(new Date(now.getTime() - 100), 'custom'),
        now,
        'custom',
      );
    });
  });

  const time = t.time();
  assertAllTypes<typeof time, StringSchema>();

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

      assertType<Output<typeof type.outputSchema>, Partial<typeof interval>>();

      expectAllParse(type, interval, interval);

      expectAllThrow(
        type,
        { years: 'string' },
        'Invalid type: Expected number but received "string"',
      );
    });
  });

  describe('boolean', () => {
    it('should validate and parse a boolean', () => {
      const type = t.boolean();

      assertAllTypes<typeof type, BooleanSchema>();

      expectAllParse(type, true, true);

      expectAllThrow(
        type,
        123,
        'Invalid type: Expected boolean but received 123',
      );
    });
  });

  describe('enum', () => {
    it('should validate and parse enum', () => {
      const values = ['a', 'b', 'c'] as const;
      const type = t.enum('name', values);

      assertAllTypes<typeof type, PicklistSchema<readonly ['a', 'b', 'c']>>();

      expectAllParse(type, 'a', 'a');

      expectAllThrow(
        type,
        'd',
        'Invalid type: Expected "a" | "b" | "c" but received "d"',
      );
    });
  });

  const geometryTypes = {
    point: t.point(),
    line: t.line(),
    lseg: t.lseg(),
    box: t.box(),
    path: t.path(),
    polygon: t.polygon(),
    circle: t.circle(),
  };

  assertAllTypes<
    (typeof geometryTypes)[keyof typeof geometryTypes],
    StringSchema
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
          'Invalid type: Expected string but received 123',
        );
      });
    },
  );

  const networkTypes = {
    cidr: t.cidr(),
    inet: t.inet(),
    macaddr: t.macaddr(),
    macaddr8: t.macaddr8(),
  };

  assertAllTypes<
    (typeof networkTypes)[keyof typeof networkTypes],
    StringSchema
  >();

  describe.each(['cidr', 'inet', 'macaddr', 'macaddr8'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const type = t[method as 'cidr']();

      expectAllParse(type, 'string', 'string');

      expectAllThrow(
        type,
        123,
        'Invalid type: Expected string but received 123',
      );
    });
  });

  const bit = t.bit(5);
  const bitVarying = t.bitVarying();
  assertAllTypes<typeof bit | typeof bitVarying, StringSchema>();

  describe.each(['bit', 'bitVarying'])('%s', (method) => {
    it('should validate a string to contain only 1 or 0 and parse to a string', () => {
      const type = t[method as 'bit'](5);

      expectAllParse(type, '10101', '10101');

      expectAllThrow(type, '2', 'Invalid');

      expectAllThrow(
        type,
        '101010',
        'Invalid length: Expected <=5 but received 6',
      );
    });
  });

  const tsvector = t.tsvector();
  const tsquery = t.tsquery();
  assertAllTypes<typeof tsvector | typeof tsquery, StringSchema>();

  describe.each(['tsvector', 'tsquery'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const type = t[method as 'tsvector']();

      expectAllParse(type, 'string', 'string');

      expectAllThrow(
        type,
        123,
        'Invalid type: Expected string but received 123',
      );
    });
  });

  const money = t.money();
  const xml = t.xml();
  const jsonText = t.jsonText();
  assertAllTypes<typeof money | typeof xml | typeof jsonText, StringSchema>();

  describe.each(['money', 'xml', 'jsonText'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const type = t[method as 'xml']();

      expectAllParse(type, 'string', 'string');

      expectAllThrow(
        type,
        123,
        'Invalid type: Expected string but received 123',
      );
    });
  });

  describe('uuid', () => {
    it('should validate uuid and parse to a string', () => {
      const type = t.uuid();

      assertAllTypes<typeof type, StringSchema>();

      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expectAllParse(type, uuid, uuid);

      expectAllThrow(type, '1234', 'Invalid UUID: Received "1234"');
    });
  });

  describe('array', () => {
    it('should validate and parse array', () => {
      const type = () => t.array(t.integer());

      assertAllTypes<ReturnType<typeof type>, ArraySchema<NumberSchema>>();

      expectAllParse(type(), [1, 2, 3], [1, 2, 3]);

      expectAllThrow(
        type(),
        123,
        'Invalid type: Expected Array but received 123',
      );

      expectAllThrow(
        type(),
        's',
        'Invalid type: Expected Array but received "s"',
      );

      testTypeMethod(
        type,
        'min',
        [],
        'Invalid length: Expected >=1 but received 0',
        1,
      );

      testTypeMethod(
        type,
        'max',
        [1, 2],
        'Invalid length: Expected <=1 but received 2',
        1,
      );

      testTypeMethod(
        type,
        'length',
        [],
        'Invalid length: Expected 1 but received 0',
        1,
      );

      testTypeMethod(
        type,
        'length',
        [1, 2],
        'Invalid length: Expected 1 but received 2',
        1,
      );

      testTypeMethod(
        type,
        'nonEmpty',
        [],
        'Invalid length: Expected >=1 but received 0',
      );
    });
  });

  describe('error messages', () => {
    it('should customize error message', () => {
      const type = t.string().error('custom message');

      assertAllTypes<typeof type, StringSchema>();

      expectAllThrow(type, undefined, 'custom message');
    });
  });

  describe('json', () => {
    it('should parse json', () => {
      const type = t.json(
        object({
          bool: boolean(),
        }),
      );

      const expected = object({ bool: boolean() });
      assertAllTypes<typeof type, typeof expected>();
    });
  });

  describe('as', () => {
    it('should convert one type to the same schema as another type', () => {
      const timestampAsInteger = t
        .timestampNoTZ()
        .encode(number(), (input: number) => new Date(input))
        .parse(date(), Date.parse)
        .as(t.integer());

      assertAllTypes<typeof timestampAsInteger, NumberSchema>();

      expectAllParse(timestampAsInteger, 123, 123);

      const timestampAsDate = t
        .timestampNoTZ()
        .parse(date(), (string) => new Date(string));

      assertType<typeof timestampAsDate.outputSchema, DateSchema>();

      const dateValue = new Date();
      expect(parse(timestampAsDate.outputSchema, dateValue)).toEqual(dateValue);
    });
  });

  describe('virtual', () => {
    class Virtual extends VirtualColumn<ValibotSchemaConfig> {}

    it('should result in a never type', () => {
      const type = new Virtual(valibotSchemaConfig);

      assertAllTypes<typeof type, NeverSchema>();

      expectAllThrow(
        type,
        123,
        'Invalid type: Expected never but received 123',
      );
    });
  });

  describe('domain', () => {
    it('should convert it to a base column', () => {
      const type = t.domain('domainName').as(t.integer());

      assertAllTypes<typeof type, NumberSchema>();

      expectAllParse(type, 123, 123);

      expectAllThrow(
        type,
        'string',
        'Invalid type: Expected number but received "string"',
      );
    });
  });

  describe('custom type', () => {
    it('should convert it to a base column', () => {
      const type = new CustomTypeColumn(valibotSchemaConfig, 'customType').as(
        t.integer(),
      );

      assertAllTypes<typeof type, NumberSchema>();

      expectAllParse(type, 123, 123);

      expectAllThrow(
        type,
        'string',
        'Invalid type: Expected number but received "string"',
      );
    });
  });

  describe('customizing schema types', () => {
    const fn = (s: StringSchema) =>
      transform(s, (s) => s.split('').reverse().join(''));

    const type = t.string().input(fn).output(fn).query(fn);

    expectAllParse(type, 'foo', 'oof');
  });
});
