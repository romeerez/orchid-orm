import { compareSqlExpressionResult } from './generators.utils';

describe('generators utils', () => {
  describe('compareSqlExpressionResult', () => {
    it('should match sqls even when the db one is wrapped with `()` and the sql is not', () => {
      const match = compareSqlExpressionResult(
        `SELECT sql AS "*inDb-0*", (sql) AS "*inCode-0-0*"`,
        [1],
      );

      expect(match).toBe(0);
    });

    it('should match sqls even when the sql one is wrapped with `()` and the db is not', () => {
      const match = compareSqlExpressionResult(
        `SELECT (sql) AS "*inDb-0*", sql AS "*inCode-0-0*"`,
        [1],
      );

      expect(match).toBe(0);
    });
  });
});
