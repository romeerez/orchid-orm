import { union } from './union';
import { scalarTypes } from './scalarTypes';

describe('union', () => {
  it('should have toCode', () => {
    expect(
      union([scalarTypes.string(), scalarTypes.number()]).toCode('t'),
    ).toEqual('t.string().or(t.number())');
  });
});
