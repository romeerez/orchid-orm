import { scalarTypes } from './scalarTypes';

const { string, number } = scalarTypes;

describe('typeBase', () => {
  describe('optional', () => {
    it('should have toCode', () => {
      expect(string().optional().toCode('t')).toBe('t.string().optional()');
    });
  });

  describe('required', () => {
    it('should have toCode', () => {
      expect(string().optional().required().toCode('t')).toBe('t.string()');
    });
  });

  describe('nullable', () => {
    it('should have toCode', () => {
      expect(string().nullable().toCode('t')).toBe('t.string().nullable()');
    });
  });

  describe('notNullable', () => {
    it('should have toCode', () => {
      expect(string().nullable().notNullable().toCode('t')).toBe('t.string()');
    });
  });

  describe('nullish', () => {
    it('should have toCode', () => {
      expect(string().nullish().toCode('t')).toBe('t.string().nullish()');
    });
  });

  describe('notNullish', () => {
    it('should have toCode', () => {
      expect(string().nullish().notNullish().toCode('t')).toBe('t.string()');
    });
  });

  describe('deepPartial', () => {
    it('should have toCode', () => {
      expect(string().deepPartial().toCode('t')).toBe('t.string().optional()');
    });
  });

  describe('transform', () => {
    it('should have toCode', () => {
      expect(
        string()
          .transform((s) => s)
          .toCode('t'),
      ).toEqual('t.string().transform((s)=>s)');
    });
  });

  describe('to', () => {
    it('should have toCode', () => {
      expect(
        string()
          .to((s) => parseInt(s), number())
          .toCode('t'),
      ).toEqual('t.string().to((s)=>parseInt(s), t.number())');
    });
  });

  describe('refine', () => {
    it('should have toCode', () => {
      expect(
        string()
          .refine((s) => s.length > 0)
          .toCode('t'),
      ).toEqual('t.string().refine((s)=>s.length > 0)');
    });
  });

  describe('superRefine', () => {
    it('should have toCode', () => {
      expect(
        string()
          .superRefine((s) => s)
          .toCode('t'),
      ).toEqual('t.string().superRefine((s)=>s)');
    });
  });

  describe('and', () => {
    it('should have toCode', () => {
      expect(string().and(number()).toCode('t')).toEqual(
        't.string().and(t.number())',
      );
    });
  });

  describe('or', () => {
    it('should have toCode', () => {
      expect(string().or(number()).toCode('t')).toEqual(
        't.string().or(t.number())',
      );
    });
  });

  describe('default', () => {
    it('should have toCode', () => {
      expect(string().default('value').toCode('t')).toBe(
        't.string().default("value")',
      );
    });
  });

  describe('array', () => {
    it('should have toCode', () => {
      expect(string().array().toCode('t')).toEqual('t.string().array()');
    });
  });
});
