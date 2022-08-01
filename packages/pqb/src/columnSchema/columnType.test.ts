import { ColumnType } from './base';
import { Operators } from '../operators';
import { AssertEqual } from '../test-utils';

describe('column base', () => {
  class Column extends ColumnType {
    dataType = 'test';
    operators = Operators.any;
  }
  const column = new Column();

  describe('.primaryKey', () => {
    it('should mark column as a primary key', () => {
      expect(column.isPrimaryKey).toBe(false);
      expect(column.primaryKey().isPrimaryKey).toBe(true);
    });
  });

  describe('.hidden', () => {
    it('should mark column as hidden', () => {
      expect(column.isHidden).toBe(false);
      expect(column.hidden().isHidden).toBe(true);
    });
  });

  describe('.nullable', () => {
    it('should mark column as nullable', () => {
      expect(column.isNullable).toBe(false);
      expect(column.nullable().isNullable).toBe(true);
    });
  });

  describe('.encodeFn', () => {
    it('should set a function to encode value for this column', () => {
      expect(column.encodeFn).toBe(undefined);
      const fn = (input: number) => input.toString();
      const withEncode = column.encode(fn);
      expect(withEncode.encodeFn).toBe(fn);
      const eq: AssertEqual<typeof withEncode.inputType, number> = true;
      expect(eq).toBeTruthy();
    });
  });
});
