import { notNullable, nullable } from './nullable';
import { scalarTypes } from './scalarTypes';

describe('nullable', () => {
  it('should have toCode', () => {
    expect(nullable(scalarTypes.string()).toCode('t')).toBe(
      't.string().nullable()',
    );
  });
});

describe('notNullable', () => {
  it('should have toCode', () => {
    expect(notNullable(scalarTypes.string().nullable()).toCode('t')).toBe(
      't.string()',
    );
  });
});
