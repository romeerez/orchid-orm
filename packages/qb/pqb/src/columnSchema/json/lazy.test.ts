import { lazy } from './lazy';
import { scalarTypes } from './scalarTypes';

describe('lazy', () => {
  it('should have toCode', () => {
    expect(lazy(() => scalarTypes.string()).toCode('t')).toEqual([
      't.lazy(() => ',
      ['t.string()'],
      ')',
    ]);
    expect(
      lazy(() => scalarTypes.string())
        .deepPartial()
        .toCode('t'),
    ).toEqual(['t.lazy(() => ', ['t.string().optional()'], ').deepPartial()']);
  });
});
