import { JSONColumn, JSONTextColumn } from './json';

describe('json columns', () => {
  describe('json', () => {
    it('should have toCode', () => {
      expect(new JSONColumn((t) => t.string()).toCode('t')).toBe(
        't.json((t) => t.string())',
      );
    });
  });

  describe('jsonText', () => {
    it('should have toCode', () => {
      expect(new JSONTextColumn().toCode('t')).toBe('t.jsonText()');
    });
  });
});
