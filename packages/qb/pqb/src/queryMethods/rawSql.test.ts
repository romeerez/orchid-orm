import { User } from '../test-utils/test-utils';
import { ColumnType, IntegerColumn } from '../columns';
import { expectSql, testAdapter } from 'test-utils';
import { createDb } from '../query/db';

describe('raw sql', () => {
  it('should use column types in callback from a db instance', () => {
    const type = {} as unknown as ColumnType;
    const db = createDb({
      adapter: testAdapter,
      columnTypes: {
        type: () => type,
      },
    });

    const sql = db.sql`sql`.type((t) => t.type());

    expect(sql._type).toBe(type);
  });

  it('should handle a simple string', () => {
    const sql = User.sql({ raw: 'simple sql' });

    expect(sql).toEqual({
      _sql: 'simple sql',
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT * FROM "user" WHERE (simple sql)`,
    );
  });

  it('should handle values, and a simple string', () => {
    const sql = User.sql({
      raw: '$$_CoLuMn = $VaLuE123',
    }).values({
      _CoLuMn: 'name',
      VaLuE123: 'value',
    });

    expect(sql).toEqual({
      _sql: '$$_CoLuMn = $VaLuE123',
      _values: {
        _CoLuMn: 'name',
        VaLuE123: 'value',
      },
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT * FROM "user" WHERE ("name" = $1)`,
      ['value'],
    );
  });

  it('should handle raw sql and values in single parameter', () => {
    const sql = User.sql({ raw: 'column = $value', values: { value: 'foo' } });

    expect(sql).toEqual({
      _sql: 'column = $value',
      _values: { value: 'foo' },
      columnTypes: User.columnTypes,
    });
  });

  it('should handle values and a template string', () => {
    const sql = User.sql`value = $value`.values({ value: 'value' });

    expect(sql).toEqual({
      _sql: [['value = $value']],
      _values: {
        value: 'value',
      },
      columnTypes: User.columnTypes,
    });
  });

  it('should handle a column and a simple string', () => {
    const sql = User.sql({ raw: 'simple sql' }).type((t) => t.integer());

    expect(sql).toEqual({
      _type: expect.any(IntegerColumn),
      _sql: 'simple sql',
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT * FROM "user" WHERE (simple sql)`,
    );
  });

  it('should handle a column, values, and a simple string', () => {
    const sql = User.sql({
      raw: '$$column = $value',
    })
      .type((t) => t.integer())
      .values({ column: 'name', value: 'value' });

    expect(sql).toEqual({
      _type: expect.any(IntegerColumn),
      _sql: '$$column = $value',
      _values: {
        column: 'name',
        value: 'value',
      },
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT * FROM "user" WHERE ("name" = $1)`,
      ['value'],
    );
  });

  it('should handle a template literal', () => {
    const sql = User.sql`one ${1} two ${true} three ${'string'} four`;

    expect(sql).toEqual({
      _sql: [['one ', ' two ', ' three ', ' four'], 1, true, 'string'],
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT * FROM "user" WHERE (one $1 two $2 three $3 four)`,
      [1, true, 'string'],
    );
  });

  it('should handle column and a template literal', () => {
    const sql = User.sql`one ${1} two ${true} three ${'string'} four`.type(
      (t) => t.integer(),
    );

    expect(sql).toEqual({
      _type: expect.any(IntegerColumn),
      _sql: [['one ', ' two ', ' three ', ' four'], 1, true, 'string'],
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT * FROM "user" WHERE (one $1 two $2 three $3 four)`,
      [1, true, 'string'],
    );
  });

  it('should handle column, values, and a template literal', () => {
    const sql = User.sql`value = $1 AND ${true}`
      .type((t) => t.integer())
      .values({ 1: 'value' });

    expect(sql).toEqual({
      _type: expect.any(IntegerColumn),
      _sql: [['value = $1 AND ', ''], true],
      _values: {
        1: 'value',
      },
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT * FROM "user" WHERE (value = $2 AND $1)`,
      [true, 'value'],
    );
  });

  it('should quote columns with tables', () => {
    const sql = User.sql({ raw: '$$column' }).values({ column: 'user.name' });

    expect(sql).toEqual({
      _sql: '$$column',
      _values: {
        column: 'user.name',
      },
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT * FROM "user" WHERE ("user"."name")`,
    );
  });

  it('should not replace values inside string literals', () => {
    const query = User.where(
      User.sql({
        raw: `foo = $foo AND bar = '$bar''$bar' AND baz = $baz`,
      }).values({
        foo: 1,
        baz: true,
      }),
    );

    expectSql(
      query.toSQL(),
      `SELECT * FROM "user" WHERE (foo = $1 AND bar = '$bar''$bar' AND baz = $2)`,
      [1, true],
    );
  });

  it('should throw when variable in the query is not provided', () => {
    const q = User.where(
      User.sql({ raw: `a = $a AND b = $b` }).values({ a: 1 }),
    );

    expect(() => q.toSQL()).toThrow('Query variable `b` is not provided');
  });

  it('should throw when variable in the object is not used by the query', () => {
    const q = User.where(User.sql({ raw: `a = $a` }).values({ a: 1, b: 'b' }));

    expect(() => q.toSQL()).toThrow('Query variable `b` is unused');
  });
});
