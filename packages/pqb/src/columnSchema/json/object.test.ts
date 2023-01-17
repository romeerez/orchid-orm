import { object } from './object';
import { scalarTypes } from './scalarTypes';

describe('object', () => {
  it('should have toCode', () => {
    const shape = { key: scalarTypes.string() };
    const other = { other: scalarTypes.number() };

    expect(object(shape).toCode('t')).toEqual([
      't.object({',
      ['key: t.string(),'],
      '})',
    ]);

    expect(object(shape).extend(other).toCode('t')).toEqual([
      't.object({',
      ['key: t.string(),', 'other: t.number(),'],
      '})',
    ]);

    expect(object(shape).merge(object(other)).toCode('t')).toEqual([
      't.object({',
      ['key: t.string(),', 'other: t.number(),'],
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
      ['key: t.string().optional(),', 'other: t.number().optional(),'],
      '})',
    ]);

    expect(
      object({ ...shape, ...other })
        .deepPartial()
        .toCode('t'),
    ).toEqual([
      't.object({',
      ['key: t.string().optional(),', 'other: t.number().optional(),'],
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

    expect(object(shape).catchAll(scalarTypes.string()).toCode('t')).toEqual([
      't.object({',
      ['key: t.string(),'],
      '}).catchAll(t.string())',
    ]);
  });
});
