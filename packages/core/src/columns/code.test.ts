import { columnDefaultArgumentToCode } from './code';
import { ColumnTypeBase } from './columnType';
import { emptyObject, EmptyObject } from '../utils';
import { RawSQLBase } from '../raw';

class UnknownColumn extends ColumnTypeBase {
  dataType = 'unknown';
  operators = emptyObject;

  toCode() {
    return 'mock code';
  }

  toSQL() {
    return 'mock sql';
  }
}

class RawSQL extends RawSQLBase {
  columnTypes!: EmptyObject;
  _type = UnknownColumn as unknown as ColumnTypeBase;

  toSQL(): string {
    return 'mock sql';
  }
}

describe('columnDefaultArgumentToCode', () => {
  it('should handle string', () => {
    expect(columnDefaultArgumentToCode('t', 'string')).toBe(`'string'`);
  });

  it('should JSON stringify other values', () => {
    expect(columnDefaultArgumentToCode('t', [{ key: 'value' }])).toBe(
      `[{"key":"value"}]`,
    );
  });

  it('should handle raw SQL', () => {
    expect(
      columnDefaultArgumentToCode(
        't',
        new RawSQL('sql = $key', { key: 'value' }),
      ),
    ).toBe(`t.sql({ raw: 'sql = $key' }).values({"key":"value"})`);
  });

  it('should stringify function', () => {
    expect(columnDefaultArgumentToCode('t', () => Math.random())).toBe(
      `()=>Math.random()`,
    );
  });
});
