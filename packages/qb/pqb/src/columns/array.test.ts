import { assertType, testZodColumnTypes as t, testDb } from 'test-utils';
import { ColumnToCodeCtx } from 'orchid-core';

describe('array column', () => {
  afterAll(testDb.close);

  describe('array', () => {
    it('should output nested array of numbers', async () => {
      const result = await testDb.get(
        testDb.sql`'{{1, 2, 3}, {4, 5, 6}}'::integer[][]`.type((t) =>
          t.array(t.array(t.integer())),
        ),
      );
      expect(result).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);

      assertType<typeof result, number[][]>();
    });

    it('should output nested array of strings', async () => {
      const result = await testDb.get(
        testDb.sql`'{{"a", "b"}, {"c", "d"}}'::text[][]`.type((t) =>
          t.array(t.array(t.text())),
        ),
      );
      expect(result).toEqual([
        ['a', 'b'],
        ['c', 'd'],
      ]);

      assertType<typeof result, string[][]>();
    });

    it('should output nested array of booleans', async () => {
      const result = await testDb.get(
        testDb.sql`'{{true}, {false}}'::text[][]`.type((t) =>
          t.array(t.array(t.boolean())),
        ),
      );
      expect(result).toEqual([[true], [false]]);

      assertType<typeof result, boolean[][]>();
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
});
