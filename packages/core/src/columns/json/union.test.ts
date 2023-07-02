import { jsonTypes } from './jsonTypes';
import { assertType } from 'test-utils';

const { union, object, string, number } = jsonTypes;

describe('json union', () => {
  it('should have toCode', () => {
    const type = union(string(), number());

    assertType<(typeof type)['type'], string | number>();

    expect(type.toCode('t')).toBe('t.string().or(t.number())');
  });

  it('should have deepPartial', () => {
    const type = union(object({ key: string() }), number()).deepPartial();

    assertType<(typeof type)['type'], { key?: string } | number>();
  });
});
