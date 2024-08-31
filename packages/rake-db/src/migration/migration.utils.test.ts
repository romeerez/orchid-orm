import { encodeColumnDefault } from './migration.utils';
import { sql } from 'test-utils';

describe('migration utils', () => {
  describe('encodeColumnDefault', () => {
    it('should handle raw sql', () => {
      const values: unknown[] = [];

      const result = encodeColumnDefault(sql`1 + ${2}`, values);

      expect(result).toBe('1 + $1');
      expect(values).toEqual([2]);
    });

    it('should escape values', () => {
      const result = encodeColumnDefault([[]], []);

      expect(result).toBe('{}');
    });

    it('should return null as is', () => {
      const result = encodeColumnDefault(null, []);

      expect(result).toBe(null);
    });
  });
});
