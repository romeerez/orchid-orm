import { ArrayColumn } from './array';
import { IntegerColumn } from './number';
import { assertType, testDb } from 'test-utils';
import { raw } from '../sql/rawSql';

describe('array column', () => {
  afterAll(testDb.close);

  describe('array', () => {
    it('should output nested array of numbers', async () => {
      const result = await testDb.get(
        raw`'{{1, 2, 3}, {4, 5, 6}}'::integer[][]`.type(
          (t) => new ArrayColumn(new ArrayColumn(t.integer())),
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
        testDb.sql`'{{"a", "b"}, {"c", "d"}}'::text[][]`.type(
          (t) => new ArrayColumn(new ArrayColumn(t.text())),
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
        raw`'{{true}, {false}}'::text[][]`.type(
          (t) => new ArrayColumn(new ArrayColumn(t.boolean())),
        ),
      );
      expect(result).toEqual([[true], [false]]);

      assertType<typeof result, boolean[][]>();
    });

    it('should have toCode', async () => {
      const column = new ArrayColumn(new IntegerColumn());
      expect(column.toCode('t')).toBe('t.array(t.integer())');

      expect(column.nonEmpty('nonEmpty message').toCode('t')).toBe(
        `t.array(t.integer()).nonEmpty('nonEmpty message')`,
      );

      expect(
        column
          .min(1, 'min message')
          .max(10, 'max message')
          .length(15, 'length message')
          .toCode('t'),
      ).toBe(
        `t.array(t.integer())` +
          `.min(1, 'min message')` +
          `.max(10, 'max message')` +
          `.length(15, 'length message')`,
      );
    });
  });
});
