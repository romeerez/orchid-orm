import { jsonTypes } from './jsonTypes';

const { lazy, object, string } = jsonTypes;

describe('lazy', () => {
  it('should have toCode', () => {
    expect(lazy(() => string()).toCode('t')).toEqual([
      't.lazy(() => ',
      ['t.string()'],
      ')',
    ]);

    expect(
      lazy(() => object({ key: string() }))
        .deepPartial()
        .toCode('t'),
    ).toEqual([
      't.lazy(() => ',
      ['t.object({', ['key: t.string().optional(),'], '})'],
      ').deepPartial()',
    ]);
  });
});
