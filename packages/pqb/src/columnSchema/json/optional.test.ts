import { scalarTypes } from './scalarTypes';
import { optional, required } from './optional';

describe('optional', () => {
  it('should have toCode', () => {
    expect(optional(scalarTypes.string()).toCode('t')).toBe(
      't.string().optional()',
    );
  });
});

describe('required', () => {
  it('should have toCode', () => {
    expect(required(scalarTypes.string().optional()).toCode('t')).toBe(
      't.string()',
    );
  });
});
