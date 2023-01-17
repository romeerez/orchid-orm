import { set } from './set';
import { scalarTypes } from './scalarTypes';

const { number } = scalarTypes;

describe('set', () => {
  it('should have toCode', () => {
    expect(set(number()).toCode('t')).toEqual(['t.set(', 't.number()', ')']);

    expect(set(number()).deepPartial().toCode('t')).toEqual([
      't.set(',
      't.number().optional()',
      ')',
    ]);

    expect(set(number()).nonEmpty().toCode('t')).toEqual([
      't.set(',
      't.number()',
      ')',
      '.nonEmpty()',
    ]);

    expect(set(number()).min(1).max(10).size(15).toCode('t')).toEqual([
      't.set(',
      't.number()',
      ').min(1).max(10).size(15)',
    ]);
  });
});
