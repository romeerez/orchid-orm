import { tuple } from './tuple';
import { scalarTypes } from './scalarTypes';

describe('tuple', () => {
  it('should have toCode', () => {
    expect(
      tuple([scalarTypes.string(), scalarTypes.number()]).toCode('t'),
    ).toBe('t.tuple([t.string(), t.number()])');

    expect(
      tuple(
        [scalarTypes.string(), scalarTypes.number()],
        scalarTypes.boolean(),
      ).toCode('t'),
    ).toBe('t.tuple([t.string(), t.number()], t.boolean())');
  });
});
