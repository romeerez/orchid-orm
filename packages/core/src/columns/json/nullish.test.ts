import { notNullish, nullish } from './nullish';
import { scalarTypes } from './scalarTypes';

describe('nullish', () => {
  it('should have toCode', () => {
    expect(nullish(scalarTypes.string()).toCode('t')).toBe(
      't.string().nullish()',
    );
  });
});

describe('notNullish', () => {
  it('should have toCode', () => {
    expect(notNullish(scalarTypes.string().nullish()).toCode('t')).toBe(
      't.string()',
    );
  });
});
