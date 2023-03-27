import {
  ArrayColumn,
  ColumnType,
  columnTypes,
  CustomTypeColumn,
  DateColumn,
  DomainColumn,
  IntegerColumn,
  jsonTypes,
  TextColumn,
  VirtualColumn,
} from 'pqb';
import {
  JSONType,
  JSONTypeAny,
  JSONDate,
  JSONNumber,
  JSONString,
  JSONArray,
} from 'orchid-core';
import { columnToZod, instanceToZod, tableToZod } from './index';
import { z } from 'zod';
import { Buffer } from 'node:buffer';

const t = {
  ...columnTypes,
  text: (min = 0, max = Infinity) => columnTypes.text(min, max),
  string: (min = 0, max = Infinity) => columnTypes.string(min, max),
};

type AssertEqual<T, Expected> = [T] extends [Expected]
  ? [Expected] extends [T]
    ? true
    : false
  : false;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const assertType = <T, Expected>(_: AssertEqual<T, Expected>) => {
  // noop
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columnOrJsonToZod = (type: any): z.ZodTypeAny => {
  return type instanceof ColumnType
    ? columnToZod(type)
    : columnToZod(t.json(() => type));
};

const testTypeMethod = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: any,
  method: string,
  value: unknown,
  error: string,
  ...args: unknown[]
) => {
  expect(() => columnOrJsonToZod(type[method](...args)).parse(value)).toThrow(
    error,
  );

  expect(() =>
    columnOrJsonToZod(type[method](...args, 'custom')).parse(value),
  ).toThrow('custom');
};

describe('table to zod', () => {
  it('should convert a table to a zod validation schema', () => {
    const table = class Table {
      columns = {
        shape: {
          id: t.serial().primaryKey(),
          name: t.text().nullable(),
        },
      };
    };

    const result = tableToZod(table);

    assertType<
      typeof result,
      z.ZodObject<{ id: z.ZodNumber; name: z.ZodNullable<z.ZodString> }>
    >(true);

    expect(result.parse({ id: 1, name: 'name' })).toEqual({
      id: 1,

      name: 'name',
    });

    expect(() => result.parse({ id: '1' })).toThrow(
      'Expected number, received string',
    );
  });
});

describe('instance to zod', () => {
  it('should convert object with shape to a zod validation schema', () => {
    const item = {
      shape: {
        id: t.serial().primaryKey(),
        name: t.text().nullable(),
      },
    };

    const result = instanceToZod(item);
    assertType<
      typeof result,
      z.ZodObject<{ id: z.ZodNumber; name: z.ZodNullable<z.ZodString> }>
    >(true);

    expect(result.parse({ id: 1, name: 'name' })).toEqual({
      id: 1,
      name: 'name',
    });

    expect(() => result.parse({ id: '1' })).toThrow(
      'Expected number, received string',
    );
  });
});

describe('schema to zod', () => {
  describe('transform', () => {
    it('should transform column value', () => {
      const type = columnToZod(
        t.text().transform((text) => text.split('').reverse().join('')),
      );

      expect(type.parse('123')).toBe('321');
    });

    it('should transform json value', () => {
      const type = columnToZod(
        t.json((t) =>
          t.string().transform((text) => text.split('').reverse().join('')),
        ),
      );

      expect(type.parse('123')).toBe('321');
    });
  });

  describe('to', () => {
    it('should transform column value to a type', () => {
      const type = columnToZod(t.text().to(parseInt, t.integer()));
      expect(type.parse('123')).toBe(123);
    });

    it('should transform json value to a type', () => {
      const type = columnToZod(
        t.json((t) => t.string().to(parseInt, t.number())),
      );
      expect(type.parse('123')).toBe(123);
    });
  });

  describe('refine', () => {
    it('should add a refine check for column type', () => {
      const type = columnToZod(t.text().refine((val) => val !== 'val'));
      expect(() => type.parse('val')).toThrow('Invalid input');
    });

    it('should add a refine check for json type', () => {
      const type = columnToZod(
        t.json((t) => t.string().refine((val) => val !== 'val')),
      );
      expect(() => type.parse('val')).toThrow('Invalid input');
    });

    it('should support custom message', () => {
      const type = columnToZod(
        t.text().refine((val) => val !== 'val', 'custom message'),
      );
      expect(() => type.parse('val')).toThrow('custom message');
    });
  });

  describe('superRefine', () => {
    it('should add a superRefine check for column type', () => {
      const type = columnToZod(
        t.text().superRefine((val, ctx) => {
          if (val.length > 3) {
            ctx.addIssue({
              code: z.ZodIssueCode.too_big,
              maximum: 3,
              type: 'string',
              inclusive: true,
              message: 'Too many items 😡',
            });
          }
        }),
      );

      expect(() => type.parse('1234')).toThrow('Too many items');
    });

    it('should add a superRefine check for json type', () => {
      const type = columnToZod(
        t.json((t) =>
          t.string().superRefine((val, ctx) => {
            if (val.length > 3) {
              ctx.addIssue({
                code: z.ZodIssueCode.too_big,
                maximum: 3,
                type: 'string',
                inclusive: true,
                message: 'Too many items 😡',
              });
            }
          }),
        ),
      );

      expect(() => type.parse('1234')).toThrow('Too many items');
    });
  });

  describe('validationDefault', () => {
    it('should set default value for column', () => {
      const type = columnToZod(t.text().validationDefault('value'));

      expect(type.parse(undefined)).toBe('value');
    });

    it('should set default value for json type', () => {
      const type = columnToZod(t.json((t) => t.string().default('value')));

      expect(type.parse(undefined)).toBe('value');
    });
  });

  describe('nullable', () => {
    it('should parse nullable', () => {
      const schema = columnToZod(t.text().nullable());

      assertType<typeof schema, z.ZodNullable<z.ZodString>>(true);

      expect(schema.parse(null)).toBe(null);
    });
  });

  const smallint = columnToZod(t.smallint());
  const integer = columnToZod(t.integer());
  const real = columnToZod(t.real());
  const smallSerial = columnToZod(t.smallSerial());
  const serial = columnToZod(t.serial());
  const money = columnToZod(t.serial());
  assertType<
    | typeof smallint
    | typeof integer
    | typeof real
    | typeof smallSerial
    | typeof serial
    | typeof money,
    z.ZodNumber
  >(true);

  const testNumberMethods = (
    type: IntegerColumn | JSONNumber,
    isInt: boolean,
  ) => {
    if (isInt) {
      expect(() => columnOrJsonToZod(type).parse(1.5)).toThrow(
        'Expected integer, received float',
      );
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

    testTypeMethod(type, 'multipleOf', 3, 'Number must be a multiple of 5', 5);

    testTypeMethod(type, 'step', 3, 'Number must be a multiple of 5', 5);

    // remove int check before checking for infinity
    expect(
      () => ((type.data as { int?: boolean }).int = undefined),
    ).not.toThrow();

    testTypeMethod(type, 'finite', Infinity, 'Number must be finite');

    testTypeMethod(
      type,
      'safe',
      Number.MAX_SAFE_INTEGER + 1,
      `Number must be less than or equal to ${Number.MAX_SAFE_INTEGER}`,
    );
  };

  describe.each([
    'smallint',
    'integer',
    'real',
    'smallSerial',
    'serial',
    'money',
  ])('%s', (method) => {
    it('should convert to number', () => {
      const schema = columnToZod(t[method as 'integer']());

      expect(schema.parse(123)).toBe(123);

      expect(() => schema.parse('s')).toThrow('Expected number');

      testNumberMethods(
        t[method as 'integer'](),
        method !== 'real' && method !== 'money',
      );
    });
  });

  const bigint = columnToZod(t.bigint());
  const numeric = columnToZod(t.numeric());
  const decimal = columnToZod(t.decimal());
  const doublePrecision = columnToZod(t.doublePrecision());
  const bigSerial = columnToZod(t.bigSerial());
  assertType<
    | typeof bigint
    | typeof numeric
    | typeof decimal
    | typeof doublePrecision
    | typeof bigSerial,
    z.ZodString
  >(true);

  describe.each([
    'bigint',
    'numeric',
    'decimal',
    'doublePrecision',
    'bigSerial',
  ])('%s', (method) => {
    it('should validate bigint and parse to a string', () => {
      const schema = columnToZod(t[method as 'bigint']());

      expect(schema.parse('123')).toBe('123');

      expect(() => schema.parse('s')).toThrow('Failed to parse bigint');
    });
  });

  const varchar = columnToZod(t.varchar());
  const char = columnToZod(t.char());
  const text = columnToZod(t.text());
  const string = columnToZod(t.string());
  assertType<
    typeof varchar | typeof char | typeof text | typeof string,
    z.ZodString
  >(true);

  const testStringMethods = (type: TextColumn | JSONString) => {
    testTypeMethod(
      type,
      'min',
      '',
      'String must contain at least 1 character(s)',
      1,
    );

    testTypeMethod(
      type,
      'max',
      '123',
      'String must contain at most 1 character(s)',
      1,
    );

    testTypeMethod(
      type,
      'length',
      '',
      'String must contain exactly 1 character(s)',
      1,
    );

    testTypeMethod(
      type,
      'length',
      '123',
      'String must contain exactly 1 character(s)',
      1,
    );

    testTypeMethod(type, 'email', 'invalid', 'Invalid email');

    testTypeMethod(type, 'url', 'invalid', 'Invalid url');

    testTypeMethod(type, 'emoji', 'invalid', 'Invalid emoji');

    testTypeMethod(type, 'uuid', 'invalid', 'Invalid uuid');

    testTypeMethod(type, 'cuid', '', 'Invalid cuid');

    testTypeMethod(type, 'ulid', 'invalid', 'Invalid ulid');

    testTypeMethod(
      type,
      'nonEmpty',
      '',
      'String must contain at least 1 character(s)',
    );

    testTypeMethod(type, 'regex', 'invalid', 'Invalid', /\d+/);

    testTypeMethod(type, 'includes', 'invalid', 'Invalid', 'koko');

    testTypeMethod(type, 'startsWith', 'invalid', 'Invalid', 'koko');

    testTypeMethod(type, 'endsWith', 'invalid', 'Invalid', 'koko');

    testTypeMethod(type, 'datetime', 'invalid', 'Invalid');

    testTypeMethod(type, 'ip', 'invalid', 'Invalid');

    expect(columnOrJsonToZod(type.trim()).parse('  trimmed  ')).toBe('trimmed');

    expect(columnOrJsonToZod(type.toLowerCase()).parse('DOWN')).toBe('down');

    expect(columnOrJsonToZod(type.toUpperCase()).parse('up')).toBe('UP');
  };

  describe.each(['varchar', 'char', 'text', 'string'])('%s', (method) => {
    it('should convert to string', () => {
      const schema = columnToZod(t[method as 'text']());

      expect(schema.parse('s')).toBe('s');

      expect(() => schema.parse(1)).toThrow('Expected string');

      testStringMethods(t[method as 'text']());
    });

    if (method === 'varchar' || method === 'char') {
      it('should convert to string with limit', () => {
        const schema = columnToZod(t[method as 'varchar'](3));

        expect(() => schema.parse('')).toThrow(
          'String must contain exactly 3 character(s)',
        );

        expect(() => schema.parse('1234')).toThrow(
          'String must contain exactly 3 character(s)',
        );
      });
    }
  });

  describe('bytea', () => {
    it('should check Buffer', () => {
      const schema = columnToZod(t.bytea());

      assertType<typeof schema, z.ZodType<Buffer>>(true);

      const buffer = Buffer.from([0x62, 0x75, 0x66, 0x66, 0x65, 0x72]);
      expect(schema.parse(buffer)).toBe(buffer);

      expect(() => schema.parse([1, 0, 1])).toThrow(
        'Input not instance of Buffer',
      );
    });
  });

  const date = columnToZod(t.date());
  const timestamp = columnToZod(t.timestamp());
  const timestampWithTimeZone = columnToZod(t.timestampWithTimeZone());
  assertType<
    typeof date | typeof timestamp | typeof timestampWithTimeZone,
    z.ZodDate
  >(true);

  const testDateMethods = (type: DateColumn | JSONDate) => {
    const now = new Date();

    expect(() =>
      columnOrJsonToZod(type.min(new Date(now.getTime() + 100))).parse(now),
    ).toThrow('Date must be greater than or equal to');

    expect(() =>
      columnOrJsonToZod(
        type.min(new Date(now.getTime() + 100), 'custom'),
      ).parse(now),
    ).toThrow('custom');

    expect(() =>
      columnOrJsonToZod(type.max(new Date(now.getTime() - 100))).parse(now),
    ).toThrow('Date must be smaller than or equal to');

    expect(() =>
      columnOrJsonToZod(
        type.max(new Date(now.getTime() - 100), 'custom'),
      ).parse(now),
    ).toThrow('custom');
  };

  describe.each(['date', 'timestamp', 'timestampWithTimeZone'])(
    '%s',
    (method) => {
      it('should parse from string to a Date', () => {
        const schema = columnToZod(t[method as 'date']());

        const date = new Date(2000, 0, 1, 0, 0, 0, 0);
        expect(schema.parse(date)).toEqual(date);

        expect(() => schema.parse('malformed')).toThrow('Invalid date');
      });

      it('should parse from Date to a Date', () => {
        const schema = columnToZod(t[method as 'date']());

        assertType<typeof schema, z.ZodDate>(true);

        const date = new Date(2000, 0, 1, 0, 0, 0, 0);
        expect(schema.parse(date)).toEqual(date);

        testDateMethods(t[method as 'date']());
      });
    },
  );

  const time = columnToZod(t.time());
  const timeWithTimeZone = columnToZod(t.timeWithTimeZone());
  assertType<typeof time | typeof timeWithTimeZone, z.ZodString>(true);

  describe.each(['time', 'timeWithTimeZone'])('%s', (method) => {
    it('should validate and parse to a string', () => {
      const schema = columnToZod(t[method as 'time']());

      const input = method === 'time' ? '12:12:12' : '12:12:12.1234 +00:00';
      expect(schema.parse(input)).toBe(input);

      expect(() => schema.parse('malformed')).toThrow('Invalid time');
    });
  });

  describe('interval', () => {
    it('should validate and parse time interval', () => {
      const schema = columnToZod(t.interval());

      const interval = {
        years: 1,
        months: 1,
        days: 1,
        hours: 1,
        seconds: 1,
      };

      assertType<ReturnType<typeof schema['parse']>, Partial<typeof interval>>(
        true,
      );

      expect(schema.parse(interval)).toEqual(interval);

      expect(() => schema.parse({ years: 'string' })).toThrow(
        'Expected number, received string',
      );
    });
  });

  describe('boolean', () => {
    it('should validate and parse a boolean', () => {
      const schema = columnToZod(t.boolean());

      assertType<typeof schema, z.ZodBoolean>(true);

      expect(schema.parse(true)).toBe(true);

      expect(() => schema.parse(123)).toThrow(
        'Expected boolean, received number',
      );
    });
  });

  describe('enum', () => {
    it('should validate and parse enum', () => {
      const schema = columnToZod(t.enum('name', ['a', 'b', 'c']));

      assertType<typeof schema, z.ZodEnum<['a', 'b', 'c']>>(true);

      expect(schema.parse('a')).toBe('a');

      expect(() => schema.parse('d')).toThrow('Invalid enum value');
    });
  });

  const point = columnToZod(t.point());
  const line = columnToZod(t.line());
  const lseg = columnToZod(t.lseg());
  const box = columnToZod(t.box());
  const path = columnToZod(t.path());
  const polygon = columnToZod(t.polygon());
  const circle = columnToZod(t.circle());
  assertType<
    | typeof point
    | typeof line
    | typeof lseg
    | typeof box
    | typeof path
    | typeof polygon
    | typeof circle,
    z.ZodString
  >(true);

  describe.each(['point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle'])(
    '%s',
    (method) => {
      it('should parse to a string without validation', () => {
        const schema = columnToZod(t[method as 'point']());

        expect(schema.parse('string')).toBe('string');

        expect(() => schema.parse(123)).toThrow(
          'Expected string, received number',
        );
      });
    },
  );

  const cidr = columnToZod(t.cidr());
  const inet = columnToZod(t.inet());
  const macaddr = columnToZod(t.macaddr());
  const macaddr8 = columnToZod(t.macaddr8());
  assertType<
    typeof cidr | typeof inet | typeof macaddr | typeof macaddr8,
    z.ZodString
  >(true);

  describe.each(['cidr', 'inet', 'macaddr', 'macaddr8'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const schema = columnToZod(t[method as 'cidr']());

      expect(schema.parse('string')).toBe('string');

      expect(() => schema.parse(123)).toThrow(
        'Expected string, received number',
      );
    });
  });

  const bit = columnToZod(t.bit(5));
  const bitVarying = columnToZod(t.bitVarying());
  assertType<typeof bit | typeof bitVarying, z.ZodString>(true);

  describe.each(['bit', 'bitVarying'])('%s', (method) => {
    it('should validate a string to contain only 1 or 0 and parse to a string', () => {
      const schema = columnToZod(t[method as 'bit'](5));

      expect(schema.parse('10101')).toBe('10101');

      expect(() => schema.parse('2')).toThrow('Invalid');
    });
  });

  const tsvector = columnToZod(t.tsvector());
  const tsquery = columnToZod(t.tsquery());
  assertType<typeof tsvector | typeof tsquery, z.ZodString>(true);

  describe.each(['tsvector', 'tsquery'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const schema = columnToZod(t[method as 'tsvector']());

      expect(schema.parse('string')).toBe('string');

      expect(() => schema.parse(123)).toThrow(
        'Expected string, received number',
      );
    });
  });

  const xml = columnToZod(t.xml());
  const jsonText = columnToZod(t.jsonText());
  assertType<typeof xml | typeof jsonText, z.ZodString>(true);

  describe.each(['xml', 'jsonText'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const schema = columnToZod(t[method as 'xml']());

      expect(schema.parse('string')).toBe('string');

      expect(() => schema.parse(123)).toThrow(
        'Expected string, received number',
      );
    });
  });

  describe('uuid', () => {
    it('should validate uuid and parse to a string', () => {
      const schema = columnToZod(t.uuid());

      assertType<typeof schema, z.ZodString>(true);

      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(schema.parse(uuid)).toBe(uuid);

      expect(() => schema.parse('1234')).toThrow('Invalid uuid');
    });
  });

  const testArrayMethods = (
    type: ArrayColumn<ColumnType> | JSONArray<JSONTypeAny>,
  ) => {
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
  };

  describe('array', () => {
    it('should validate and parse array', () => {
      const schema = columnToZod(t.array(t.integer()));

      assertType<typeof schema, z.ZodArray<z.ZodNumber>>(true);

      expect(schema.parse([1, 2, 3])).toEqual([1, 2, 3]);

      expect(() => schema.parse(123)).toThrow(
        'Expected array, received number',
      );
      expect(() => schema.parse(['a'])).toThrow(
        'Expected number, received string',
      );

      testArrayMethods(t.array(t.integer()));
    });
  });

  describe('error messages', () => {
    it('should support `required_error`', () => {
      const schema = columnToZod(
        t.text().errors({
          required: 'custom message',
        }),
      );

      assertType<typeof schema, z.ZodString>(true);

      expect(() => schema.parse(undefined)).toThrow('custom message');
    });

    it('should support `invalid_type_error`', () => {
      const schema = columnToZod(
        t.text().errors({
          invalidType: 'custom message',
        }),
      );

      assertType<typeof schema, z.ZodString>(true);

      expect(() => schema.parse(123)).toThrow('custom message');
    });
  });

  describe('json', () => {
    describe('any', () => {
      it('should parse to any', () => {
        const schema = columnToZod(t.json((t) => t.any()));

        assertType<typeof schema, z.ZodTypeAny>(true);

        expect(schema.parse(123)).toBe(123);
      });
    });

    describe('bigint', () => {
      it('should validate bigint and parse to string', () => {
        const schema = columnToZod(t.json((t) => t.bigint()));

        assertType<typeof schema, z.ZodString>(true);

        expect(schema.parse('123')).toBe('123');

        expect(() => schema.parse('kokoko')).toThrow('Failed to parse bigint');
      });
    });

    describe('boolean', () => {
      it('should parse boolean', () => {
        const schema = columnToZod(t.json((t) => t.boolean()));

        assertType<typeof schema, z.ZodBoolean>(true);

        expect(schema.parse(true)).toBe(true);

        expect(() => schema.parse(123)).toThrow(
          'Expected boolean, received number',
        );
      });
    });

    describe('date', () => {
      it('should parse a Date', () => {
        const schema = columnToZod(t.json((t) => t.date()));

        assertType<typeof schema, z.ZodDate>(true);

        const date = new Date(2000, 0, 1);
        expect(schema.parse(date).getTime()).toBe(date.getTime());

        expect(() => schema.parse(new Date('koko'))).toThrow('Invalid date');

        testDateMethods(jsonTypes.date());
      });
    });

    describe('nan', () => {
      it('should parse a NaN', () => {
        const schema = columnToZod(t.json((t) => t.nan()));

        assertType<typeof schema, z.ZodNaN>(true);

        expect(schema.parse(NaN)).toBe(NaN);

        expect(() => schema.parse(123)).toThrow(
          'Expected nan, received number',
        );
      });
    });

    describe('never', () => {
      it('should parse a never', () => {
        const schema = columnToZod(t.json((t) => t.never()));

        assertType<typeof schema, z.ZodNever>(true);

        expect(() => schema.parse(123)).toThrow(
          'Expected never, received number',
        );
      });
    });

    describe('null', () => {
      it('should parse a null', () => {
        const schema = columnToZod(t.json((t) => t.null()));

        assertType<typeof schema, z.ZodNull>(true);

        expect(schema.parse(null)).toBe(null);

        expect(() => schema.parse(123)).toThrow(
          'Expected null, received number',
        );
      });
    });

    describe('number', () => {
      it('should parse a number', () => {
        const schema = columnToZod(t.json((t) => t.number()));

        assertType<typeof schema, z.ZodNumber>(true);

        expect(schema.parse(123)).toBe(123);

        expect(() => schema.parse('123')).toThrow(
          'Expected number, received string',
        );

        testNumberMethods(jsonTypes.number().int(), true);
      });
    });

    describe('string', () => {
      it('should parse a string', () => {
        const schema = columnToZod(t.json((t) => t.string()));

        assertType<typeof schema, z.ZodString>(true);

        expect(schema.parse('string')).toBe('string');

        expect(() => schema.parse(123)).toThrow(
          'Expected string, received number',
        );

        testStringMethods(jsonTypes.string());
      });
    });

    describe('unknown', () => {
      it('should parse unknown', () => {
        const schema = columnToZod(t.json((t) => t.unknown()));

        assertType<typeof schema, z.ZodUnknown>(true);

        expect(schema.parse(123)).toBe(123);
      });
    });

    describe('array', () => {
      it('should validate and parse array', () => {
        const schema = columnToZod(t.json((t) => t.array(t.number())));

        assertType<typeof schema, z.ZodArray<z.ZodNumber>>(true);

        expect(schema.parse([1, 2, 3])).toEqual([1, 2, 3]);

        expect(() => schema.parse(123)).toThrow(
          'Expected array, received number',
        );

        expect(() => schema.parse(['a'])).toThrow(
          'Expected number, received string',
        );

        testArrayMethods(jsonTypes.array(jsonTypes.number()));
      });
    });

    describe('enum', () => {
      it('should parse enum', () => {
        const schema = columnToZod(t.json((t) => t.enum(['a', 'b', 'c'])));

        assertType<typeof schema, z.ZodEnum<['a', 'b', 'c']>>(true);

        expect(schema.parse('a')).toBe('a');

        expect(() => schema.parse('d')).toThrow('Invalid enum value');
      });
    });

    describe('instanceOf', () => {
      it('should parse instance of', () => {
        const schema = columnToZod(t.json((t) => t.instanceOf(Date)));

        assertType<typeof schema, z.ZodType<Date, z.ZodTypeDef, Date>>(true);

        const date = new Date();
        expect(schema.parse(date)).toBe(date);

        expect(() => schema.parse({})).toThrow('Input not instance of Date');
      });
    });

    describe('literal', () => {
      it('should parse literal', () => {
        const schema = columnToZod(t.json((t) => t.literal('string')));

        assertType<typeof schema, z.ZodLiteral<'string'>>(true);

        expect(schema.parse('string')).toBe('string');

        expect(() => schema.parse('koko')).toThrow('Invalid literal value');
      });
    });

    describe('map', () => {
      it('should parse map', () => {
        const schema = columnToZod(
          t.json((t) => t.map(t.string(), t.number())),
        );

        assertType<typeof schema, z.ZodMap<z.ZodString, z.ZodNumber>>(true);

        const map = new Map();
        map.set('key', 123);
        expect(schema.parse(map)).toEqual(map);

        map.set(123, 'key');
        expect(() => schema.parse(map)).toThrow(
          'Expected number, received string',
        );
      });
    });

    describe('set', () => {
      it('should parse set', () => {
        const schema = columnToZod(t.json((t) => t.set(t.number())));

        assertType<typeof schema, z.ZodSet<z.ZodNumber>>(true);

        const set = new Set();
        set.add(1);
        expect(schema.parse(set)).toEqual(set);

        set.add('string');
        expect(() => schema.parse(set)).toThrow(
          'Expected number, received string',
        );

        const type = jsonTypes.set(jsonTypes.number());

        expect(() => columnOrJsonToZod(type.min(1)).parse(new Set())).toThrow(
          'Invalid input',
        );

        expect(() =>
          columnOrJsonToZod(type.min(1, 'custom')).parse(new Set()),
        ).toThrow('custom');

        expect(() =>
          columnOrJsonToZod(type.max(1)).parse(new Set([1, 2])),
        ).toThrow('Invalid input');

        expect(() =>
          columnOrJsonToZod(type.max(1, 'custom')).parse(new Set([1, 2])),
        ).toThrow('custom');

        expect(() => columnOrJsonToZod(type.size(1)).parse(new Set())).toThrow(
          'Invalid input',
        );

        expect(() =>
          columnOrJsonToZod(type.size(1, 'custom')).parse(new Set()),
        ).toThrow('custom');

        expect(() =>
          columnOrJsonToZod(type.size(1)).parse(new Set([1, 2])),
        ).toThrow('Invalid input');

        expect(() =>
          columnOrJsonToZod(type.size(1, 'custom')).parse(new Set([1, 2])),
        ).toThrow('custom');

        expect(() =>
          columnOrJsonToZod(type.nonEmpty()).parse(new Set()),
        ).toThrow('Invalid input');

        expect(() =>
          columnOrJsonToZod(type.nonEmpty('custom')).parse(new Set()),
        ).toThrow('custom');
      });
    });

    describe('nativeEnum', () => {
      it('should parse native enum', () => {
        enum Test {
          one = 'one',
          two = 'two',
        }

        const schema = columnToZod(t.json((t) => t.nativeEnum(Test)));

        assertType<typeof schema, z.ZodNativeEnum<typeof Test>>(true);

        expect(schema.parse('one')).toBe('one');

        expect(() => schema.parse('ko')).toThrow('Invalid enum value');
      });
    });

    describe('tuple', () => {
      it('should parse tuple', () => {
        const schema = columnToZod(
          t.json((t) => t.tuple([t.number(), t.string()])),
        );

        assertType<typeof schema, z.ZodTuple<[z.ZodNumber, z.ZodString]>>(true);

        expect(schema.parse([1, 'string'])).toEqual([1, 'string']);

        expect(() => schema.parse(['string', 1])).toThrow(
          `Expected number, received string`,
        );
      });

      it('should parse rest elements', () => {
        const schema = columnToZod(
          t.json((t) => t.tuple([t.number()]).rest(t.string())),
        );

        assertType<typeof schema, z.ZodTuple<[z.ZodNumber], z.ZodString>>(true);

        expect(schema.parse([1, 'a', 'b'])).toEqual([1, 'a', 'b']);

        expect(() => schema.parse([1, 'a', 2])).toThrow(
          'Expected string, received number',
        );
      });
    });

    describe('nullable', () => {
      it('should parse nullable', () => {
        const schema = columnToZod(t.json((t) => t.nullable(t.number())));

        assertType<typeof schema, z.ZodNullable<z.ZodNumber>>(true);

        expect(schema.parse(null)).toBe(null);
      });
    });

    describe('nullish', () => {
      it('should parse nullish', () => {
        const schema = columnToZod(t.json((t) => t.nullish(t.number())));

        assertType<typeof schema, z.ZodNullable<z.ZodOptional<z.ZodNumber>>>(
          true,
        );

        expect(schema.parse(null)).toBe(null);
        expect(schema.parse(undefined)).toBe(undefined);
      });
    });

    describe('optional', () => {
      it('should parse optional', () => {
        const schema = columnToZod(t.json((t) => t.optional(t.number())));

        assertType<typeof schema, z.ZodOptional<z.ZodNumber>>(true);

        expect(schema.parse(undefined)).toBe(undefined);
      });
    });

    describe('object', () => {
      it('should parse object', () => {
        const schema = columnToZod(
          t.json((t) => t.object({ key: t.number() })),
        );

        assertType<
          typeof schema,
          z.ZodObject<{ key: z.ZodNumber }, 'strip', z.ZodTypeAny>
        >(true);

        expect(schema.parse({ key: 123 })).toEqual({ key: 123 });

        expect(() => schema.parse({ key: 'string' })).toThrow(
          'Expected number, received string',
        );
      });

      it('should parse object with passing through unknown keys', () => {
        const schema = columnToZod(
          t.json((t) => t.object({ key: t.number() }).passthrough()),
        );

        assertType<
          typeof schema,
          z.ZodObject<{ key: z.ZodNumber }, 'passthrough'>
        >(true);

        expect(schema.parse({ key: 123, koko: 'koko' })).toEqual({
          key: 123,
          koko: 'koko',
        });

        expect(() => schema.parse({ key: 'string' })).toThrow(
          'Expected number, received string',
        );
      });

      it('should parse object with strict unknown keys', () => {
        const schema = columnToZod(
          t.json((t) => t.object({ key: t.number() }).strict()),
        );

        assertType<typeof schema, z.ZodObject<{ key: z.ZodNumber }, 'strict'>>(
          true,
        );

        expect(schema.parse({ key: 123 })).toEqual({ key: 123 });

        expect(() => schema.parse({ key: 123, koko: 'koko' })).toThrow(
          'Unrecognized key(s)',
        );
      });

      it('should parse object with catch all option', () => {
        const schema = columnToZod(
          t.json((t) => t.object({ key: t.number() }).catchAll(t.number())),
        );

        assertType<
          typeof schema,
          z.ZodObject<{ key: z.ZodNumber }, 'strip', z.ZodNumber>
        >(true);

        expect(schema.parse({ key: 123, koko: 123 })).toEqual({
          key: 123,
          koko: 123,
        });

        expect(() => schema.parse({ key: 123, koko: 'koko' })).toThrow(
          'Expected number, received string',
        );
      });
    });

    describe('record', () => {
      it('should parse record', () => {
        const schema = columnToZod(
          t.json((t) => t.record(t.string(), t.number())),
        );

        assertType<typeof schema, z.ZodRecord<z.ZodString, z.ZodNumber>>(true);

        expect(schema.parse({ key: 123 })).toEqual({ key: 123 });

        expect(() => schema.parse({ key: 'string' })).toThrow(
          'Expected number, received string',
        );
      });
    });

    describe('intersection', () => {
      it('should parse intersection', () => {
        const schema = columnToZod(
          t.json((t) =>
            t.intersection(
              t.object({ a: t.string(), b: t.number() }),
              t.object({ a: t.string(), c: t.number() }),
            ),
          ),
        );

        assertType<
          typeof schema,
          z.ZodIntersection<
            z.ZodObject<
              { a: z.ZodString; b: z.ZodNumber },
              'strip',
              z.ZodTypeAny
            >,
            z.ZodObject<
              { a: z.ZodString; c: z.ZodNumber },
              'strip',
              z.ZodTypeAny
            >
          >
        >(true);

        expect(schema.parse({ a: 'string', b: 123, c: 123 })).toEqual({
          a: 'string',
          b: 123,
          c: 123,
        });

        expect(() => schema.parse({ a: 'string', b: 123 })).toThrow('Required');
      });
    });

    describe('union', () => {
      it('should parse union', () => {
        const schema = columnToZod(
          t.json((t) => t.union([t.number(), t.string()])),
        );

        assertType<typeof schema, z.ZodUnion<[z.ZodNumber, z.ZodString]>>(true);

        expect(schema.parse(123)).toBe(123);
        expect(schema.parse('string')).toBe('string');

        expect(() => schema.parse(true)).toThrow('Invalid input');
      });
    });

    describe('discriminatedUnion', () => {
      it('should parse discriminated union', () => {
        const schema = columnToZod(
          t.json((t) =>
            t.discriminatedUnion('type', [
              t.object({ type: t.literal('a'), a: t.string() }),
              t.object({ type: t.literal('b'), b: t.number() }),
            ]),
          ),
        );

        assertType<
          typeof schema,
          z.ZodDiscriminatedUnion<
            'type',
            [
              z.ZodObject<{ type: z.ZodLiteral<'a'>; a: z.ZodString }>,
              z.ZodObject<{ type: z.ZodLiteral<'b'>; b: z.ZodNumber }>,
            ]
          >
        >(true);

        expect(schema.parse({ type: 'a', a: 'string' })).toEqual({
          type: 'a',
          a: 'string',
        });
        expect(schema.parse({ type: 'b', b: 123 })).toEqual({
          type: 'b',
          b: 123,
        });

        expect(() => schema.parse({ type: 'c' })).toThrow(
          'Invalid discriminator value',
        );
      });
    });

    describe('lazy', () => {
      it('should parse lazy type', () => {
        interface Category {
          name: string;
          subCategories: Category[];
        }

        const JsonCategory: JSONType<Category> = jsonTypes.lazy(() =>
          jsonTypes.object({
            name: jsonTypes.string(),
            subCategories: jsonTypes.array(JsonCategory),
          }),
        );

        const schema = columnToZod(t.json(() => JsonCategory));

        const valid = {
          name: 'name',
          subCategories: [{ name: 'name', subCategories: [] }],
        };
        expect(schema.parse(valid)).toEqual(valid);

        expect(() =>
          schema.parse({ name: 'name', subCategories: [{ name: 'name' }] }),
        ).toThrow('Required');
      });
    });

    describe('error messages', () => {
      it('should support `required_error`', () => {
        const schema = columnToZod(
          t.json((j) =>
            j.string().errors({
              required: 'custom message',
            }),
          ),
        );

        assertType<typeof schema, z.ZodString>(true);

        expect(() => schema.parse(undefined)).toThrow('custom message');
      });

      it('should support `invalid_type_error`', () => {
        const schema = columnToZod(
          t.json((j) =>
            j.string().errors({
              invalidType: 'custom message',
            }),
          ),
        );

        assertType<typeof schema, z.ZodString>(true);

        expect(() => schema.parse(123)).toThrow('custom message');
      });
    });
  });

  describe('as', () => {
    it('should convert one type to the same schema as another type', () => {
      const timestampAsInteger = columnToZod(
        t
          .timestamp()
          .encode((input: number) => new Date(input))
          .parse(Date.parse)
          .as(t.integer()),
      );

      assertType<typeof timestampAsInteger, z.ZodNumber>(true);
      expect(timestampAsInteger.parse(123)).toBe(123);

      const timestampAsDate = columnToZod(
        t.timestamp().parse((string) => new Date(string)),
      );

      assertType<typeof timestampAsDate, z.ZodDate>(true);
      const date = new Date();
      expect(timestampAsDate.parse(date)).toEqual(date);
    });
  });

  describe('virtual', () => {
    class Virtual extends VirtualColumn {}

    it('should skip virtual column in instanceToZod', () => {
      const schema = instanceToZod({
        shape: {
          text: t.text(),
          virtual: new Virtual({}),
        },
      });

      expect(Object.keys(schema.shape)).toEqual(['text']);
    });

    it('should return ZodNever from columnToZod', () => {
      const schema = columnToZod(new Virtual({}));

      assertType<typeof schema, z.ZodNever>(true);

      expect(() => schema.parse(123)).toThrow(
        'Expected never, received number',
      );
    });
  });

  describe('domain', () => {
    it('should convert it to a base column', () => {
      const schema = columnToZod(
        new DomainColumn({}, 'domainName').as(new IntegerColumn({})),
      );

      assertType<typeof schema, z.ZodNumber>(true);

      expect(schema.parse(123)).toBe(123);
      expect(() => schema.parse('string')).toThrow(
        'Expected number, received string',
      );
    });
  });

  describe('custom type', () => {
    it('should convert it to a base column', () => {
      const schema = columnToZod(
        new CustomTypeColumn({}, 'customType').as(new IntegerColumn({})),
      );

      assertType<typeof schema, z.ZodNumber>(true);

      expect(schema.parse(123)).toBe(123);
      expect(() => schema.parse('string')).toThrow(
        'Expected number, received string',
      );
    });
  });
});
