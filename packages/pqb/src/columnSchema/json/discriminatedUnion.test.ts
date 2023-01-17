import { scalarTypes } from './scalarTypes';
import { discriminatedUnion } from './discriminatedUnion';
import { object } from './object';
import { literal } from './literal';

describe('discriminatedUnion', () => {
  it('should have toCode', () => {
    expect(
      discriminatedUnion('type', [
        object({
          type: literal('one'),
          a: scalarTypes.string(),
        }),
        object({
          type: literal('two'),
          b: scalarTypes.number(),
        }),
      ]).toCode('t'),
    ).toEqual([
      `t.discriminatedUnion('type', [`,
      [
        't.object({',
        [`type: t.literal('one'),`, `a: t.string(),`],
        '})',
        't.object({',
        [`type: t.literal('two'),`, `b: t.number(),`],
        '})',
      ],
      '])',
    ]);
  });
});
