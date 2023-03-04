import { instanceOf } from './instanceOf';

describe('instanceOf', () => {
  it('should have toCode', () => {
    class A {}
    expect(instanceOf(A).toCode('t')).toBe('t.instanceOf(A)');
  });
});
