import { codeToString } from 'orchid-core';
import { testColumnTypes as t, useTestDatabase } from 'test-utils';
import { z } from 'zod';

describe('json columns', () => {
  describe('json', () => {
    useTestDatabase();

    it('should have toCode', () => {
      const code = t.json(z.object({ foo: z.string() })).toCode('t');
      expect(codeToString(code, '', '  ')).toBe(`t.json()`);
    });

    it(`should have encodeFn because pg driver fails to encode arrays on its own`, async () => {
      expect(t.json().encodeFn?.([1, '2', true])).toBe('[1,"2",true]');
    });
  });

  describe('jsonText', () => {
    it('should have toCode', () => {
      expect(t.jsonText().toCode('t')).toBe('t.jsonText()');
    });

    it(`should not have encodeFn because it expects a JSON string`, async () => {
      expect(t.jsonText().encodeFn).toBe(undefined);
    });
  });
});
