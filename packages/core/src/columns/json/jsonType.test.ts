import { jsonTypes } from './jsonTypes';
import { assertType } from 'test-utils';
import { codeToString } from '../code';

const { string, number } = jsonTypes;

describe('json type', () => {
  describe('optional', () => {
    it('should have toCode', () => {
      const type = string().optional();

      assertType<(typeof type)['type'], string | undefined>();

      expect(type.toCode('t')).toBe('t.string().optional()');
    });
  });

  describe('required', () => {
    it('should have toCode', () => {
      const type = string().optional().required();

      assertType<(typeof type)['type'], string>();

      expect(type.toCode('t')).toBe('t.string()');
    });
  });

  describe('nullable', () => {
    it('should have toCode', () => {
      const type = string().nullable();

      assertType<(typeof type)['type'], string | null>();

      expect(type.toCode('t')).toBe('t.string().nullable()');
    });
  });

  describe('notNullable', () => {
    it('should have toCode', () => {
      const type = string().nullable().notNullable();

      assertType<(typeof type)['type'], string>();

      expect(type.toCode('t')).toBe('t.string()');
    });
  });

  describe('nullish', () => {
    it('should have toCode', () => {
      const type = string().nullish();

      assertType<(typeof type)['type'], string | undefined | null>();

      expect(type.toCode('t')).toBe('t.string().nullish()');
    });
  });

  describe('notNullish', () => {
    it('should have toCode', () => {
      const type = string().nullish().notNullish();

      assertType<(typeof type)['type'], string>();

      expect(type.toCode('t')).toBe('t.string()');
    });
  });

  describe('narrow', () => {
    it('should narrow string type', () => {
      type Type = 'foo' | 'bar';
      const type = string<Type>();
      assertType<(typeof type)['type'], Type>();
    });
    it('should narrow number type', () => {
      type Type = 1024 | 2048;
      const type = number<Type>();
      assertType<(typeof type)['type'], Type>();
    });
  });

  describe('deepPartial', () => {
    it('should return the same column when the type is simple', () => {
      const type = string().deepPartial();

      assertType<(typeof type)['type'], unknown>();

      expect(type.toCode('t')).toBe('t.string()');
    });
  });

  describe('transform', () => {
    it('should have toCode', () => {
      const type = string().transform((s) => parseInt(s));

      assertType<(typeof type)['type'], number>();

      expect(type.toCode('t')).toBe('t.string().transform((s)=>parseInt(s))');
    });
  });

  describe('to', () => {
    it('should have toCode', () => {
      const type = string().to((s) => parseInt(s), number());

      assertType<(typeof type)['type'], number>();

      expect(type.toCode('t')).toBe(
        't.string().to((s)=>parseInt(s), t.number())',
      );
    });
  });

  describe('refine', () => {
    it('should have toCode', () => {
      const type = string().refine((s) => s.length > 0);

      assertType<(typeof type)['type'], string>();

      expect(type.toCode('t')).toBe('t.string().refine((s)=>s.length > 0)');
    });
  });

  describe('superRefine', () => {
    it('should have toCode', () => {
      const type = string().superRefine((s) => s);

      assertType<(typeof type)['type'], string>();

      expect(type.toCode('t')).toBe('t.string().superRefine((s)=>s)');
    });
  });

  describe('and', () => {
    it('should have toCode', () => {
      const type = string().and(number());

      assertType<(typeof type)['type'], string & number>();

      expect(type.toCode('t')).toBe('t.string().and(t.number())');
    });
  });

  describe('or', () => {
    it('should have toCode', () => {
      const type = string().or(number());

      assertType<(typeof type)['type'], string | number>();

      expect(type.toCode('t')).toBe('t.string().or(t.number())');
    });
  });

  describe('default', () => {
    it('should have toCode', () => {
      const type = string().nullable().optional().default('value');

      assertType<(typeof type)['type'], string>();

      expect(string().default('value').toCode('t')).toBe(
        't.string().default("value")',
      );
    });
  });

  describe('array', () => {
    it('should have toCode', () => {
      const type = string().array();

      assertType<(typeof type)['type'], string[]>();

      expect(type.toCode('t')).toBe('t.string().array()');
    });
  });

  describe('errors', () => {
    it('should have toCode', () => {
      const type = string().errors({
        required: 'required message',
        invalidType: 'invalidType message',
      });

      expect(codeToString(type.toCode('t'), '', '  ')).toBe(`t.string().errors({
  required: 'required message',
  invalidType: 'invalidType message',
})`);
    });
  });
});
