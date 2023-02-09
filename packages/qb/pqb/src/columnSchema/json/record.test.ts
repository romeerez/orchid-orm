import { record } from './record';
import { scalarTypes } from './scalarTypes';

describe('record', () => {
  it('should have toCode', () => {
    expect(record(scalarTypes.number()).toCode('t')).toBe(
      't.record(t.number())',
    );

    expect(record(scalarTypes.number(), scalarTypes.number()).toCode('t')).toBe(
      't.record(t.number(), t.number())',
    );
  });
});
