import { jsonTypes } from './jsonTypes';
import { assertType } from 'test-utils';

const { object, string, number, boolean } = jsonTypes;

describe('json object', () => {
  it('should have proper types', () => {
    const obj = object({
      a: string(),
      b: number().optional(),
    });
    assertType<(typeof obj)['type'], { a: string; b?: number }>();

    const extended = object({
      a: string(),
    }).extend({
      b: number().optional(),
    });
    assertType<(typeof extended)['type'], { a: string; b?: number }>();

    const merged = object({
      a: string(),
    }).merge(
      object({
        b: number().optional(),
      }),
    );
    assertType<(typeof merged)['type'], { a: string; b?: number }>();

    const picked = object({
      a: string(),
      b: number(),
      c: boolean(),
    }).pick('b', 'c');
    assertType<(typeof picked)['type'], { b: number; c: boolean }>();

    const omitted = object({
      a: string(),
      b: number(),
      c: boolean(),
    }).omit('b', 'c');
    assertType<(typeof omitted)['type'], { a: string }>();

    const partial = object({
      a: string(),
      b: number(),
    }).partial();
    assertType<(typeof partial)['type'], { a?: string; b?: number }>();

    const partiallyPartial = object({
      a: string(),
      b: number(),
      c: boolean(),
    }).partial('b', 'c');
    assertType<
      (typeof partiallyPartial)['type'],
      { a: string; b?: number; c?: boolean }
    >();

    const deepPartial = object({
      a: string(),
      b: object({
        c: number(),
      }),
    }).deepPartial();
    assertType<
      (typeof deepPartial)['type'],
      { a?: string; b?: { c?: number } }
    >();

    const catchAll = object({
      a: string(),
    }).catchAll(number());
    assertType<
      (typeof catchAll)['type'],
      { a: string } & Record<string, number>
    >();
  });

  it('should have toCode', () => {
    const shape = { key: string() };
    const other = { other: number() };

    expect(object(shape).toCode('t')).toEqual([
      't.object({',
      ['key: t.string(),'],
      '})',
    ]);

    expect(object(shape).extend(other).toCode('t')).toEqual([
      't.object({',
      ['key: t.string(),'],
      ['other: t.number(),'],
      '})',
    ]);

    expect(object(shape).merge(object(other)).toCode('t')).toEqual([
      't.object({',
      ['key: t.string(),'],
      ['other: t.number(),'],
      '})',
    ]);

    expect(
      object({ ...shape, ...other })
        .pick('key')
        .toCode('t'),
    ).toEqual(['t.object({', ['key: t.string(),'], '})']);

    expect(
      object({ ...shape, ...other })
        .omit('key')
        .toCode('t'),
    ).toEqual(['t.object({', ['other: t.number(),'], '})']);

    expect(
      object({ ...shape, ...other })
        .partial()
        .toCode('t'),
    ).toEqual([
      't.object({',
      ['key: t.string().optional(),'],
      ['other: t.number().optional(),'],
      '})',
    ]);

    expect(
      object({ ...shape, ...other })
        .deepPartial()
        .toCode('t'),
    ).toEqual([
      't.object({',
      ['key: t.string().optional(),'],
      ['other: t.number().optional(),'],
      '})',
    ]);

    expect(object(shape).passthrough().toCode('t')).toEqual([
      't.object({',
      ['key: t.string(),'],
      '}).passthrough()',
    ]);

    expect(object(shape).strict().toCode('t')).toEqual([
      't.object({',
      ['key: t.string(),'],
      '}).strict()',
    ]);

    expect(object(shape).strict('strict message').toCode('t')).toEqual([
      't.object({',
      ['key: t.string(),'],
      `}).strict('strict message')`,
    ]);

    expect(object(shape).catchAll(string()).toCode('t')).toEqual([
      't.object({',
      ['key: t.string(),'],
      '}).catchAll(t.string())',
    ]);
  });
});
