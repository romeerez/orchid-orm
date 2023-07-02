import { jsonTypes } from './jsonTypes';
import { assertType } from 'test-utils';

const { literal } = jsonTypes;

describe('json literal', () => {
  it('should have toCode', () => {
    const type = literal('ko');
    assertType<(typeof type)['type'], 'ko'>();

    expect(type.toCode('t')).toBe(`t.literal('ko')`);
  });
});
