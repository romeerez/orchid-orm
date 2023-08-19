import { columnTypes } from './columnTypes';
import { codeToString } from 'orchid-core';

const t = columnTypes;

describe('json columns', () => {
  describe('json', () => {
    it('should have toCode', () => {
      const code = t.json((t) => t.object({ foo: t.string() })).toCode('t');
      expect(codeToString(code, '', '  ')).toBe(`t.json((t) =>
  t.object({
    foo: t.string(),
  }),
)`);
    });
  });

  describe('jsonText', () => {
    it('should have toCode', () => {
      expect(t.jsonText().toCode('t')).toBe('t.jsonText()');
    });
  });
});
