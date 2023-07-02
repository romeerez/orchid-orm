import { jsonTypes } from './jsonTypes';
import { assertType } from 'test-utils';

const { discriminatedUnion, literal, object, string, number } = jsonTypes;

describe('json discriminated union', () => {
  const type = discriminatedUnion('type', [
    object({
      type: literal('one'),
      a: string(),
    }),
    object({
      type: literal('two'),
      b: number(),
    }),
  ]);

  assertType<
    (typeof type)['type'],
    { type: 'one'; a: string } | { type: 'two'; b: number }
  >();

  const dp = type.deepPartial();
  assertType<
    (typeof dp)['type'],
    { type: 'one'; a?: string } | { type: 'two'; b?: number }
  >();

  it('should have toCode', () => {
    expect(type.toCode('t')).toEqual([
      `t.discriminatedUnion('type', [`,
      [
        't.object({',
        [`type: t.literal('one'),`],
        [`a: t.string(),`],
        '})',
        't.object({',
        [`type: t.literal('two'),`],
        [`b: t.number(),`],
        '})',
      ],
      '])',
    ]);
  });
});
