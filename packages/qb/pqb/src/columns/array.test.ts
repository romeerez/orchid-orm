import { assertType, testZodColumnTypes as t } from 'test-utils';
import { ColumnToCodeCtx } from 'orchid-core';

describe('array column', () => {
  it('should correctly parse various array types', () => {
    const textArray = t.array(t.text());

    assertType<typeof textArray.outputType, string[]>();

    const parse = textArray.data.parse!;
    expect(parse('{}')).toEqual([]);
    expect(parse('{1,2,3}')).toEqual(['1', '2', '3']);
    expect(parse('{a,b,c}')).toEqual(['a', 'b', 'c']);
    expect(parse('{"\\"\\"\\"","\\\\\\\\\\\\"}')).toEqual(['"""', '\\\\\\']);
    expect(parse('{NULL,NULL}')).toEqual([null, null]);
    expect(parse('{{a,b},{c,d}')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);

    const intArray = t.array(t.integer());
    assertType<typeof intArray.outputType, number[]>();

    const parseInt = intArray.data.parse!;
    expect(parseInt('{1,2,3}')).toEqual([1, 2, 3]);
    expect(parseInt('{{1,2,3},{4,5,6}}')).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(parseInt('[0:2]={1,2,3}')).toEqual([1, 2, 3]);

    const boolArray = t.array(t.boolean());
    assertType<typeof boolArray.outputType, boolean[]>();

    const parseBool = boolArray.data.parse!;
    expect(parseBool('{{true},{false}}')).toEqual([[true], [false]]);
  });

  it('should have toCode', async () => {
    const ctx: ColumnToCodeCtx = { t: 't', table: 'table' };

    const column = t.array(t.integer());
    expect(column.toCode(ctx, 'key')).toBe('t.array(t.integer())');

    expect(column.nonEmpty('nonEmpty message').toCode(ctx, 'key')).toBe(
      `t.array(t.integer()).nonEmpty('nonEmpty message')`,
    );

    expect(
      column
        .min(1, 'min message')
        .max(10, 'max message')
        .length(15, 'length message')
        .toCode(ctx, 'key'),
    ).toBe(
      `t.array(t.integer())` +
        `.min(1, 'min message')` +
        `.max(10, 'max message')` +
        `.length(15, 'length message')`,
    );
  });
});
