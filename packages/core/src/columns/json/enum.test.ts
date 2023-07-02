import { jsonTypes } from './jsonTypes';
import { assertType } from 'test-utils';

describe('json enum', () => {
  it('should have toCode', () => {
    const type = jsonTypes.enum(['a', 'b', 'c']);

    assertType<(typeof type)['type'], 'a' | 'b' | 'c'>();

    expect(type.toCode('t')).toBe(`t.enum(['a', 'b', 'c'])`);
  });
});
