import { columnDefaultArgumentToCode, raw } from 'orchid-core';

describe('columnDefaultArgumentToCode', () => {
  it('should handle string', () => {
    expect(columnDefaultArgumentToCode('t', 'string')).toBe(`'string'`);
  });

  it('should JSON stringify other values', () => {
    expect(columnDefaultArgumentToCode('t', [{ key: 'value' }])).toBe(
      `[{"key":"value"}]`,
    );
  });

  it('should handle raw SQL', () => {
    expect(
      columnDefaultArgumentToCode('t', raw('sql = $key', { key: 'value' })),
    ).toBe(`t.sql({"values":{"key":"value"},"raw":"sql = $key"})`);
  });

  it('should stringify function', () => {
    expect(columnDefaultArgumentToCode('t', () => Math.random())).toBe(
      `()=>Math.random()`,
    );
  });
});
