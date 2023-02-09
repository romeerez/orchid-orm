import { intersection } from './intersection';
import { object } from './object';
import { scalarTypes } from './scalarTypes';

describe('intersection', () => {
  it('should have toCode', () => {
    expect(
      intersection(
        object({ name: scalarTypes.string() }),
        object({ age: scalarTypes.number() }),
      ).toCode('t'),
    ).toEqual([
      't.object({',
      ['name: t.string(),'],
      '}).and(',
      ['t.object({', ['age: t.number(),'], '})'],
      ')',
    ]);
  });
});
