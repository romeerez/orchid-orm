import { jsonTypes } from './jsonTypes';
import { assertType } from 'test-utils';

const { tuple, string, number, boolean } = jsonTypes;

describe('json tuple', () => {
  describe('without rest', () => {
    it('should have toCode', () => {
      const type = tuple([string(), number()]);

      assertType<(typeof type)['type'], [string, number]>();

      expect(type.toCode('t')).toBe('t.tuple([t.string(), t.number()])');
    });
  });

  describe('with rest', () => {
    it('should have toCode', () => {
      const type = tuple([string(), number()], boolean());

      assertType<(typeof type)['type'], [string, number, ...boolean[]]>();

      expect(type.toCode('t')).toBe(
        't.tuple([t.string(), t.number()], t.boolean())',
      );
    });
  });
});
