import { set } from './set';
import { scalarTypes } from './scalarTypes';

const { number } = scalarTypes;

describe('set', () => {
  it('should have toCode', () => {
    expect(set(number()).toCode('t')).toBe('t.set(t.number())');

    expect(set(number()).deepPartial().toCode('t')).toBe(
      't.set(t.number().optional())',
    );

    expect(set(number()).nonEmpty('nonEmpty message').toCode('t')).toBe(
      `t.set(t.number()).nonEmpty('nonEmpty message')`,
    );

    expect(
      set(number())
        .min(1, 'min message')
        .max(10, 'max message')
        .size(15, 'size message')
        .toCode('t'),
    ).toBe(
      `t.set(t.number())` +
        `.min(1, 'min message')` +
        `.max(10, 'max message')` +
        `.size(15, 'size message')`,
    );
  });
});
