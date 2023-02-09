import { assertType, db } from '../test-utils/test-utils';
import { ArrayColumn } from './array';
import { IntegerColumn } from './number';

describe('array column', () => {
  afterAll(db.close);

  describe('array', () => {
    it('should output nested array of numbers', async () => {
      const result = await db.get(
        db.raw(
          (t) => new ArrayColumn(new ArrayColumn(t.integer())),
          `'{{1, 2, 3}, {4, 5, 6}}'::integer[][]`,
        ),
      );
      expect(result).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);

      assertType<typeof result, number[][]>();
    });

    it('should output nested array of strings', async () => {
      const result = await db.get(
        db.raw(
          (t) => new ArrayColumn(new ArrayColumn(t.text())),
          `'{{"a", "b"}, {"c", "d"}}'::text[][]`,
        ),
      );
      expect(result).toEqual([
        ['a', 'b'],
        ['c', 'd'],
      ]);

      assertType<typeof result, string[][]>();
    });

    it('should output nested array of booleans', async () => {
      const result = await db.get(
        db.raw(
          (t) => new ArrayColumn(new ArrayColumn(t.boolean())),
          `'{{true}, {false}}'::text[][]`,
        ),
      );
      expect(result).toEqual([[true], [false]]);

      assertType<typeof result, boolean[][]>();
    });

    it('should have toCode', async () => {
      const column = new ArrayColumn(new IntegerColumn());
      expect(column.toCode('t')).toBe('t.array(t.integer())');

      expect(column.nonEmpty().toCode('t')).toBe(
        't.array(t.integer()).nonEmpty()',
      );

      expect(column.min(1).max(10).length(15).toCode('t')).toBe(
        't.array(t.integer()).min(1).max(10).length(15)',
      );
    });
  });
});
