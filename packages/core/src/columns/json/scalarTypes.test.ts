import { jsonTypes } from './jsonTypes';
import { assertType } from 'test-utils';

describe('scalar types', () => {
  describe('unknown', () => {
    const type = jsonTypes.unknown();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assertType<(typeof type)['type'], unknown>();

    it('should have toCode', () => {
      expect(type.toCode('t')).toBe('t.unknown()');
    });
  });

  describe('boolean', () => {
    const type = jsonTypes.boolean();
    assertType<(typeof type)['type'], boolean>();

    it('should have toCode', () => {
      expect(type.toCode('t')).toBe('t.boolean()');
    });
  });

  describe('null', () => {
    const type = jsonTypes.null();
    assertType<(typeof type)['type'], null>();

    it('should have toCode', () => {
      expect(type.toCode('t')).toBe('t.null()');
    });
  });

  describe('number', () => {
    const type = jsonTypes.number();
    assertType<(typeof type)['type'], number>();

    it('should have toCode', () => {
      expect(type.toCode('t')).toBe('t.number()');

      expect(
        type
          .gt(1, 'gt message')
          .gte(2, 'gte message')
          .lt(3, 'lt message')
          .lte(4, 'lte message')
          .multipleOf(5, 'step message')
          .int('int message')
          .toCode('t'),
      ).toBe(
        `t.number()` +
          `.gt(1, 'gt message')` +
          `.min(2, 'gte message')` +
          `.lt(3, 'lt message')` +
          `.max(4, 'lte message')` +
          `.step(5, 'step message')` +
          `.int('int message')`,
      );

      expect(
        type
          .positive('positive message')
          .nonNegative('nonNegative message')
          .negative('negative message')
          .nonPositive('nonPositive message')
          .toCode('t'),
      ).toBe(
        `t.number()` +
          `.gt(0, 'positive message')` +
          `.min(0, 'nonNegative message')` +
          `.lt(0, 'negative message')` +
          `.max(0, 'nonPositive message')`,
      );

      expect(
        type
          .min(1, 'min message')
          .max(2, 'max message')
          .step(3, 'step message')
          .toCode('t'),
      ).toBe(
        `t.number().min(1, 'min message').max(2, 'max message').step(3, 'step message')`,
      );
    });
  });

  describe('string', () => {
    const type = jsonTypes.string();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assertType<(typeof type)['type'], string>();

    it('should have toCode', () => {
      expect(type.toCode('t')).toBe('t.string()');

      expect(type.nonEmpty('nonEmpty message').toCode('t')).toBe(
        "t.string().nonEmpty('nonEmpty message')",
      );

      expect(
        type
          .min(1, 'min message')
          .max(10, 'max message')
          .length(15, 'length message')
          .email('email message')
          .url('url message')
          .emoji('emoji message')
          .uuid('uuid message')
          .cuid('cuid message')
          .cuid2('cuid2 message')
          .ulid('ulid message')
          .datetime({ offset: true, precision: 5, message: 'datetime message' })
          .ip({ version: 'v4', message: 'ip message' })
          .regex(/\d+/g, 'regex message')
          .includes('includes', 'includes message')
          .startsWith('start', 'startsWith message')
          .endsWith('end', 'endsWith message')
          .trim()
          .toLowerCase()
          .toUpperCase()
          .toCode('t'),
      ).toBe(
        `t.string()` +
          `.min(1, 'min message')` +
          `.max(10, 'max message')` +
          `.length(15, 'length message')` +
          `.email('email message')` +
          `.url('url message')` +
          `.emoji('emoji message')` +
          `.uuid('uuid message')` +
          `.cuid('cuid message')` +
          `.cuid2('cuid2 message')` +
          `.ulid('ulid message')` +
          `.regex(/\\d+/g, 'regex message')` +
          ".includes('includes', 'includes message')" +
          ".startsWith('start', 'startsWith message')" +
          ".endsWith('end', 'endsWith message')" +
          `.datetime({ offset: true, precision: 5, message: 'datetime message' })` +
          `.ip({ version: 'v4', message: 'ip message' })` +
          '.trim()' +
          '.toLowerCase()' +
          '.toUpperCase()',
      );
    });
  });
});
