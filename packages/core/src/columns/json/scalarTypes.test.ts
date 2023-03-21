import { scalarTypes } from './scalarTypes';

describe('scalarTypes', () => {
  describe('any', () => {
    it('should have toCode', () => {
      expect(scalarTypes.any().toCode('t')).toBe('t.any()');
    });
  });

  describe('bigint', () => {
    it('should have toCode', () => {
      expect(scalarTypes.bigint().toCode('t')).toBe('t.bigint()');
    });
  });

  describe('boolean', () => {
    it('should have toCode', () => {
      expect(scalarTypes.boolean().toCode('t')).toBe('t.boolean()');
    });
  });

  describe('nan', () => {
    it('should have toCode', () => {
      expect(scalarTypes.nan().toCode('t')).toBe('t.nan()');
    });
  });

  describe('never', () => {
    it('should have toCode', () => {
      expect(scalarTypes.never().toCode('t')).toBe('t.never()');
    });
  });

  describe('null', () => {
    it('should have toCode', () => {
      expect(scalarTypes.null().toCode('t')).toBe('t.null()');
    });
  });

  describe('number', () => {
    it('should have toCode', () => {
      expect(scalarTypes.number().toCode('t')).toBe('t.number()');

      expect(
        scalarTypes
          .number()
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
        scalarTypes
          .number()
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
        scalarTypes
          .number()
          .min(1, 'min message')
          .max(2, 'max message')
          .step(3, 'step message')
          .toCode('t'),
      ).toBe(
        `t.number().min(1, 'min message').max(2, 'max message').step(3, 'step message')`,
      );
    });
  });

  describe('date', () => {
    it('should have toCode', () => {
      expect(scalarTypes.date().toCode('t')).toBe('t.date()');

      const now = new Date();
      const s = now.toISOString();
      expect(
        scalarTypes
          .date()
          .min(now, 'min message')
          .max(now, 'max message')
          .toCode('t'),
      ).toBe(
        `t.date()` +
          `.min(new Date('${s}'), 'min message')` +
          `.max(new Date('${s}'), 'max message')`,
      );
    });
  });

  describe('string', () => {
    it('should have toCode', () => {
      expect(scalarTypes.string().toCode('t')).toBe('t.string()');

      expect(
        scalarTypes.string().nonEmpty('nonEmpty message').toCode('t'),
      ).toBe("t.string().nonEmpty('nonEmpty message')");

      expect(
        scalarTypes
          .string()
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

  describe('undefined', () => {
    it('should have toCode', () => {
      expect(scalarTypes.undefined().toCode('t')).toBe('t.undefined()');
    });
  });

  describe('unknown', () => {
    it('should have toCode', () => {
      expect(scalarTypes.unknown().toCode('t')).toBe('t.unknown()');
    });
  });

  describe('void', () => {
    it('should have toCode', () => {
      expect(scalarTypes.void().toCode('t')).toBe('t.void()');
    });
  });
});
