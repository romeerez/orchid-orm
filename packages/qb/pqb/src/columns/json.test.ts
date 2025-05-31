import { codeToString, ColumnToCodeCtx } from 'orchid-core';
import { testZodColumnTypes as t } from 'test-utils';
import { z } from 'zod/v4';

const ctx: ColumnToCodeCtx = { t: 't', table: 'table' };

describe('json columns', () => {
  describe('json', () => {
    it('should have toCode', () => {
      const code = t.json(z.object({ foo: z.string() })).toCode(ctx, 'key');
      expect(codeToString(code, '', '  ')).toBe(`t.json()`);
    });

    it(`should have encode because pg driver fails to encode arrays on its own`, async () => {
      expect(t.json().data.encode?.([1, '2', true])).toBe('[1,"2",true]');
    });
  });

  describe('jsonText', () => {
    it('should have toCode', () => {
      expect(t.jsonText().toCode(ctx, 'key')).toBe('t.jsonText()');
    });

    it(`should not have encode because it expects a JSON string`, async () => {
      expect(t.jsonText().data.encode).toBe(undefined);
    });
  });
});
