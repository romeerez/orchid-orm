import { array } from './array';
import { scalarTypes } from './scalarTypes';

const { string } = scalarTypes;

describe('array', () => {
  it('should have toCode', () => {
    expect(array(string()).toCode('t')).toBe('t.string().array()');

    expect(array(string()).deepPartial().nonEmpty().toCode('t')).toBe(
      't.string().optional().array().deepPartial().nonEmpty()',
    );

    expect(array(string()).min(1).max(10).length(15).toCode('t')).toBe(
      't.string().array().min(1).max(10).length(15)',
    );
  });
});
