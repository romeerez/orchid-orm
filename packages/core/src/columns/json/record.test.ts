import { jsonTypes } from './jsonTypes';
import { assertType } from 'test-utils';

const { record, string, number } = jsonTypes;

describe('json record', () => {
  describe('with only a value', () => {
    it('should have toCode', () => {
      const type = record(number());

      assertType<(typeof type)['type'], Record<string, number>>();

      expect(type.toCode('t')).toBe('t.record(t.number())');
    });
  });

  describe('with key and value', () => {
    it('should have toCode', () => {
      const type = record(number(), string());

      assertType<(typeof type)['type'], Record<number, string>>();

      expect(type.toCode('t')).toBe('t.record(t.number(), t.string())');
    });
  });
});
