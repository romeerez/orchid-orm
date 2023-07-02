import { jsonTypes } from './jsonTypes';
import { assertType } from 'test-utils';

const { array, string } = jsonTypes;

describe('array', () => {
  it('should have toCode', () => {
    const stringArray = array(string());
    assertType<(typeof stringArray)['type'], string[]>();
    expect(stringArray.toCode('t')).toBe('t.string().array()');

    const optionalStringArray = array(string().optional());
    assertType<(typeof optionalStringArray)['type'], (string | undefined)[]>();
    expect(
      optionalStringArray
        .deepPartial()
        .nonEmpty('nonEmpty message')
        .toCode('t'),
    ).toBe(
      `t.string().optional().array().nonEmpty('nonEmpty message').deepPartial()`,
    );

    expect(
      stringArray
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
