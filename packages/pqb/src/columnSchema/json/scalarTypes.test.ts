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
          .lt(1)
          .lte(2)
          .gt(3)
          .gte(4)
          .multipleOf(5)
          .int()
          .toCode('t'),
      ).toBe('t.number().min(4).gt(3).max(2).lt(1).step(5).int()');

      expect(
        scalarTypes
          .number()
          .positive()
          .nonNegative()
          .negative()
          .nonPositive()
          .toCode('t'),
      ).toBe('t.number().min(0).gt(0).max(0).lt(0)');

      expect(scalarTypes.number().min(1).max(2).step(3).toCode('t')).toBe(
        't.number().min(1).max(2).step(3)',
      );
    });
  });

  describe('date', () => {
    it('should have toCode', () => {
      expect(scalarTypes.date().toCode('t')).toBe('t.date()');

      const now = new Date();
      const s = now.toISOString();
      expect(scalarTypes.date().min(now).max(now).toCode('t')).toBe(
        `t.date().min(new Date('${s}')).max(new Date('${s}'))`,
      );
    });
  });

  describe('string', () => {
    it('should have toCode', () => {
      expect(scalarTypes.string().toCode('t')).toBe('t.string()');

      expect(scalarTypes.string().nonEmpty().toCode('t')).toBe(
        't.string().nonEmpty()',
      );

      expect(
        scalarTypes
          .string()
          .min(1)
          .max(10)
          .length(15)
          .email()
          .url()
          .uuid()
          .cuid()
          .startsWith('start')
          .endsWith('end')
          .trim()
          .toCode('t'),
      ).toBe(
        `t.string().min(1).max(10).length(15).email().url().uuid().cuid().startsWith('start').endsWith('end').trim()`,
      );

      expect(scalarTypes.string().regex(/\d+/g).toCode('t')).toBe(
        `t.string().regex(/\\d+/g)`,
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
