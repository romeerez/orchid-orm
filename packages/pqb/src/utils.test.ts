import { assertType } from './test-utils';
import {
  GetTypeOrRaw,
  GetTypesOrRaw,
  makeRegexToFindInSql,
  MaybeArray,
  SetOptional,
  SomeIsTrue,
} from './utils';
import { RawExpression } from './common';

describe('utils', () => {
  describe('SomeIsTrue', () => {
    it('should be true if some is true', () => {
      assertType<SomeIsTrue<[false, false, true, false]>, true>();
    });

    it('should be false if none is true', () => {
      assertType<SomeIsTrue<[false, false, false]>, false>();
    });

    it('should be false if types array is empty', () => {
      assertType<SomeIsTrue<[]>, false>();
    });
  });

  describe('MaybeArray', () => {
    it('should turn a type into union of T | T[]', () => {
      assertType<MaybeArray<number>, number | number[]>();
    });
  });

  describe('SetOptional', () => {
    it('should make specified keys optional', () => {
      assertType<
        SetOptional<{ a: number; b: string; c: boolean }, 'b' | 'c'>,
        {
          a: number;
          b?: string;
          c?: boolean;
        }
      >();
    });
  });

  describe('GetTypesOrRaw', () => {
    it('should add each element to union with RawExpression', () => {
      assertType<
        GetTypesOrRaw<[number, string]>,
        [number | RawExpression, string | RawExpression]
      >();
    });
  });

  describe('GetTypeOrRaw', () => {
    it('should add type to union with RawExpression', () => {
      assertType<GetTypeOrRaw<number>, number | RawExpression>();
    });
  });

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
