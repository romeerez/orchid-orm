import { map } from './map';
import { scalarTypes } from './scalarTypes';

describe('map', () => {
  it('should have toCode', () => {
    expect(map(scalarTypes.string(), scalarTypes.number()).toCode('t')).toBe(
      't.map(t.string(), t.number())',
    );
  });
});
