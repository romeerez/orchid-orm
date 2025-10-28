import {
  assertType,
  expectSql,
  testDb,
  testZodColumnTypes as t,
  useTestDatabase,
} from 'test-utils';
import { ColumnToCodeCtx } from '../core';
import { z } from 'zod/v4';

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

    // array is returned as JS array from sub-selects
    const arr = [1, 2, 3];
    expect(parse(arr)).toEqual(arr);

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

    const jsonArray = t.array(
      t.json(
        z
          .object({ a: z.number() })
          .or(z.object({ b: z.boolean() }))
          .nullable(),
      ),
    );
    assertType<
      typeof jsonArray.outputType,
      ({ a: number } | { b: boolean } | null)[]
    >();

    const parseJson = jsonArray.data.parse!;
    expect(parseJson(`{"{\\"a\\":1}","{\\"b\\":true}",null}`)).toEqual([
      { a: 1 },
      { b: true },
      null,
    ]);
  });

  it('should have toCode', async () => {
    const ctx: ColumnToCodeCtx = {
      t: 't',
      table: 'table',
      currentSchema: 'public',
    };

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

  describe('operators', () => {
    useTestDatabase();

    const table = testDb('table', (t) => ({
      arr: t.array(t.integer()).primaryKey(),
    }));

    it('should have `has` operator', () => {
      const q = table.where({ arr: { has: 1 } });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "table" WHERE $1 = ANY("table"."arr")`,
        [1],
      );
    });

    it('should have `hasEvery` operator', () => {
      const q = table.where({ arr: { hasEvery: [1, 2] } });

      expectSql(q.toSQL(), `SELECT * FROM "table" WHERE "table"."arr" @> $1`, [
        [1, 2],
      ]);
    });

    it('should have `hasSome` operator', () => {
      const q = table.where({ arr: { hasSome: [1, 2] } });

      expectSql(q.toSQL(), `SELECT * FROM "table" WHERE "table"."arr" && $1`, [
        [1, 2],
      ]);
    });

    it('should have `containedIn` operator', async () => {
      const q = table.where({ arr: { containedIn: [1, 2] } });

      expectSql(q.toSQL(), `SELECT * FROM "table" WHERE "table"."arr" <@ $1`, [
        [1, 2],
      ]);
    });

    it('should have `length` operator', () => {
      const q = table.where({
        arr: { length: 3 },
      });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "table" WHERE COALESCE(array_length("table"."arr", 1), 0) = $1`,
        [3],
      );
    });

    it('should support numeric operators in the `length` operator', () => {
      const q = table.where({
        arr: { length: { gt: 3 } },
      });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "table" WHERE COALESCE(array_length("table"."arr", 1), 0) > $1`,
        [3],
      );
    });

    it('should support implicit `equals`', () => {
      const q = table.where({
        arr: [1, 2],
      });

      expectSql(q.toSQL(), `SELECT * FROM "table" WHERE "table"."arr" = $1`, [
        [1, 2],
      ]);
    });
  });
});
