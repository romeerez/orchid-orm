import { nativeEnum } from './nativeEnum';

describe('nativeEnum', () => {
  it('should have toCode', () => {
    enum A {
      a,
    }
    expect(nativeEnum(A).toCode('t')).toBe('t.nativeEnum(enum)');
  });
});
