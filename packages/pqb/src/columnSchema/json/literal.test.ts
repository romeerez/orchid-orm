import { literal } from './literal';

describe('literal', () => {
  it('should have toCode', () => {
    expect(literal('ko').toCode('t')).toBe(`t.literal('ko')`);
  });
});
