import { assertType } from './test-utils';
import { MaybeArray, SetOptional, SomeIsTrue } from './utils';

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

  describe('setOptional', () => {
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
});
