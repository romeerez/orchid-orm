import { array } from './array';
import { scalarTypes } from './scalarTypes';

const { string } = scalarTypes;

describe('array', () => {
  it('should have toCode', () => {
    expect(array(string()).toCode('t')).toBe('t.string().array()');

    expect(
      array(string()).deepPartial().nonEmpty('nonEmpty message').toCode('t'),
    ).toBe(
      `t.string().optional().array().nonEmpty('nonEmpty message').deepPartial()`,
    );

    expect(
      array(string())
        .min(1, 'min message')
        .max(10, 'max message')
        .length(15, 'length message')
        .toCode('t'),
    ).toBe(
      `t.string().array()` +
        `.min(1, 'min message')` +
        `.max(10, 'max message')` +
        `.length(15, 'length message')`,
    );
  });
});
