import { columnTypes as t } from 'pqb';
import { schemaToZod } from './index';
import { z } from 'zod';
import { Buffer } from 'node:buffer';

export type AssertEqual<T, Expected> = [T] extends [Expected]
  ? [Expected] extends [T]
    ? true
    : false
  : false;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const assertType = <T, Expected>(_: AssertEqual<T, Expected>) => {
  // noop
};

describe('schema to zod', () => {
  const smallint = schemaToZod(t.smallint());
  const integer = schemaToZod(t.integer());
  const real = schemaToZod(t.real());
  const smallSerial = schemaToZod(t.smallSerial());
  const serial = schemaToZod(t.serial());
  const money = schemaToZod(t.serial());
  assertType<
    | typeof smallint
    | typeof integer
    | typeof real
    | typeof smallSerial
    | typeof serial
    | typeof money,
    z.ZodNumber
  >(true);

  describe.each([
    'smallint',
    'integer',
    'real',
    'smallSerial',
    'serial',
    'money',
  ])('%s', (method) => {
    it('should convert to number', () => {
      const schema = schemaToZod(t[method as 'integer']());

      expect(schema.parse(123)).toBe(123);

      expect(() => schema.parse('s')).toThrow('Expected number');
    });
  });

  const bigint = schemaToZod(t.bigint());
  const numeric = schemaToZod(t.numeric());
  const decimal = schemaToZod(t.decimal());
  const doublePrecision = schemaToZod(t.doublePrecision());
  const bigSerial = schemaToZod(t.bigSerial());
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
      const schema = schemaToZod(t[method as 'bigint']());

      expect(schema.parse('123')).toBe('123');

      expect(() => schema.parse('s')).toThrow('Failed to parse bigint');
    });
  });

  const varchar = schemaToZod(t.varchar());
  const char = schemaToZod(t.char());
  const text = schemaToZod(t.text());
  const string = schemaToZod(t.string());
  assertType<
    typeof varchar | typeof char | typeof text | typeof string,
    z.ZodString
  >(true);

  describe.each(['varchar', 'char', 'text', 'string'])('%s', (method) => {
    it('should convert to string', () => {
      const schema = schemaToZod(t[method as 'text']());

      expect(schema.parse('s')).toBe('s');

      expect(() => schema.parse(1)).toThrow('Expected string');
    });
  });

  describe('bytea', () => {
    it('should check Buffer', () => {
      const schema = schemaToZod(t.bytea());

      assertType<typeof schema, z.ZodType<Buffer>>(true);

      const buffer = Buffer.from([0x62, 0x75, 0x66, 0x66, 0x65, 0x72]);
      expect(schema.parse(buffer)).toBe(buffer);

      expect(() => schema.parse([1, 0, 1])).toThrow(
        'Input not instance of Buffer',
      );
    });
  });

  const date = schemaToZod(t.date());
  const timestamp = schemaToZod(t.timestamp());
  const timestampWithTimeZone = schemaToZod(t.timestampWithTimeZone());
  assertType<
    typeof date | typeof timestamp | typeof timestampWithTimeZone,
    z.ZodDate
  >(true);

  describe.each(['date', 'timestamp', 'timestampWithTimeZone'])(
    '%s',
    (method) => {
      it('should parse from string to a Date', () => {
        const schema = schemaToZod(t[method as 'date']());

        const date = new Date(2000, 0, 1, 0, 0, 0, 0);
        expect(schema.parse(date.toISOString()).getTime()).toBe(date.getTime());

        expect(() => schema.parse('malformed')).toThrow('Invalid date');
      });

      it('should parse from Date to a Date', () => {
        const schema = schemaToZod(t.timestamp());

        assertType<typeof schema, z.ZodDate>(true);

        const date = new Date(2000, 0, 1, 0, 0, 0, 0);
        expect(schema.parse(date).getTime()).toBe(date.getTime());
      });
    },
  );

  const time = schemaToZod(t.time());
  const timeWithTimeZone = schemaToZod(t.timeWithTimeZone());
  assertType<typeof time | typeof timeWithTimeZone, z.ZodString>(true);

  describe.each(['time', 'timeWithTimeZone'])('%s', (method) => {
    it('should validate and parse to a string', () => {
      const schema = schemaToZod(t[method as 'time']());

      const input = method === 'time' ? '12:12:12' : '12:12:12.1234 +00:00';
      expect(schema.parse(input)).toBe(input);

      expect(() => schema.parse('malformed')).toThrow('Invalid time');
    });
  });

  describe('interval', () => {
    it('should validate and parse time interval', () => {
      const schema = schemaToZod(t.interval());

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
      const schema = schemaToZod(t.boolean());

      assertType<typeof schema, z.ZodBoolean>(true);

      expect(schema.parse(true)).toBe(true);

      expect(() => schema.parse(123)).toThrow(
        'Expected boolean, received number',
      );
    });
  });

  describe('enum', () => {
    it('should validate and parse enum', () => {
      const schema = schemaToZod(t.enum('name', ['a', 'b', 'c']));

      assertType<typeof schema, z.ZodEnum<['a', 'b', 'c']>>(true);

      expect(schema.parse('a')).toBe('a');

      expect(() => schema.parse('d')).toThrow('Invalid enum value');
    });
  });

  const point = schemaToZod(t.point());
  const line = schemaToZod(t.line());
  const lseg = schemaToZod(t.lseg());
  const box = schemaToZod(t.box());
  const path = schemaToZod(t.path());
  const polygon = schemaToZod(t.polygon());
  const circle = schemaToZod(t.circle());
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
        const schema = schemaToZod(t[method as 'point']());

        expect(schema.parse('string')).toBe('string');

        expect(() => schema.parse(123)).toThrow(
          'Expected string, received number',
        );
      });
    },
  );

  const cidr = schemaToZod(t.cidr());
  const inet = schemaToZod(t.inet());
  const macaddr = schemaToZod(t.macaddr());
  const macaddr8 = schemaToZod(t.macaddr8());
  assertType<
    typeof cidr | typeof inet | typeof macaddr | typeof macaddr8,
    z.ZodString
  >(true);

  describe.each(['cidr', 'inet', 'macaddr', 'macaddr8'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const schema = schemaToZod(t[method as 'cidr']());

      expect(schema.parse('string')).toBe('string');

      expect(() => schema.parse(123)).toThrow(
        'Expected string, received number',
      );
    });
  });

  const bit = schemaToZod(t.bit(5));
  const bitVarying = schemaToZod(t.bitVarying());
  assertType<typeof bit | typeof bitVarying, z.ZodString>(true);

  describe.each(['bit', 'bitVarying'])('%s', (method) => {
    it('should validate a string to contain only 1 or 0 and parse to a string', () => {
      const schema = schemaToZod(t[method as 'bit'](5));

      expect(schema.parse('10101')).toBe('10101');

      expect(() => schema.parse('2')).toThrow('Invalid');
    });
  });

  const tsvector = schemaToZod(t.tsvector());
  const tsquery = schemaToZod(t.tsquery());
  assertType<typeof tsvector | typeof tsquery, z.ZodString>(true);

  describe.each(['tsvector', 'tsquery'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const schema = schemaToZod(t[method as 'tsvector']());

      expect(schema.parse('string')).toBe('string');

      expect(() => schema.parse(123)).toThrow(
        'Expected string, received number',
      );
    });
  });

  const xml = schemaToZod(t.xml());
  const jsonText = schemaToZod(t.jsonText());
  assertType<typeof xml | typeof jsonText, z.ZodString>(true);

  describe.each(['xml', 'jsonText'])('%s', (method) => {
    it('should parse to a string without validation', () => {
      const schema = schemaToZod(t[method as 'xml']());

      expect(schema.parse('string')).toBe('string');

      expect(() => schema.parse(123)).toThrow(
        'Expected string, received number',
      );
    });
  });

  describe('uuid', () => {
    it('should validate uuid and parse to a string', () => {
      const schema = schemaToZod(t.uuid());

      assertType<typeof schema, z.ZodString>(true);

      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(schema.parse(uuid)).toBe(uuid);

      expect(() => schema.parse('1234')).toThrow('Invalid uuid');
    });
  });

  describe('array', () => {
    it('should validate and parse array', () => {
      const schema = schemaToZod(t.array(t.integer()));

      assertType<typeof schema, z.ZodArray<z.ZodNumber>>(true);

      expect(schema.parse([1, 2, 3])).toEqual([1, 2, 3]);

      expect(() => schema.parse(123)).toThrow(
        'Expected array, received number',
      );
      expect(() => schema.parse(['a'])).toThrow(
        'Expected number, received string',
      );
    });
  });
});
