import { jsonTypes } from './jsonTypes';
import { assertType } from 'test-utils';

const { intersection, object, string, number } = jsonTypes;

describe('json intersection', () => {
  const type = intersection(object({ a: string() }), object({ b: number() }));

  assertType<(typeof type)['type'], { a: string; b: number }>();

  it('should have toCode', () => {
    expect(type.toCode('t')).toEqual([
      't.object({',
      ['a: t.string(),'],
      '}).and(',
      ['t.object({', ['b: t.number(),'], '})'],
      ')',
    ]);
  });
});
