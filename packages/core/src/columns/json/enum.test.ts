import { enumType } from './enum';

describe('enum', () => {
  it('should have toCode', () => {
    expect(enumType(['a', 'b', 'c']).toCode('t')).toBe(
      `t.enum(['a', 'b', 'c'])`,
    );
  });
});
