import { makeRegexToFindInSql } from './utils';

describe('utils', () => {
  describe('makeRegexToFindWordInSql', () => {
    it('should return a proper regex', () => {
      const regex = makeRegexToFindInSql('\\bupdatedAt\\b');

      expect('koupdatedAtko'.match(regex)).toBe(null);
      expect('updatedAtko'.match(regex)).toBe(null);
      expect('koupdatedAt'.match(regex)).toBe(null);
      expect('updatedAt'.match(regex)).toEqual(['updatedAt']);
      expect(' updatedAt '.match(regex)).toEqual(['updatedAt']);
      expect("'updatedAt'".match(regex)).toEqual(null);
    });
  });
});
