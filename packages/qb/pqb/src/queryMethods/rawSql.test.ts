import { User } from '../test-utils/test-utils';
import { ColumnType, IntegerColumn } from '../columns';
import { assertType, expectSql, testAdapter, testDb } from 'test-utils';
import { createDb } from '../db';

describe('raw sql', () => {
  it('should use column types in callback from a db instance', () => {
    const type = {} as unknown as ColumnType;
    const db = createDb({
      adapter: testAdapter,
      columnTypes: {
        type: () => type,
      },
    });

    const sql = db.sql((t) => t.type(), { raw: 'sql' });

    expect(sql.__column).toBe(type);
  });

  it('should handle a simple string', () => {
    const sql = User.sql({ raw: 'simple sql' });

    expect(sql).toEqual({
      __raw: 'simple sql',
    });

    expectSql(
      User.where(sql).toSql(),
      `SELECT * FROM "user" WHERE (simple sql)`,
    );
  });

  it('should handle values, and a simple string', () => {
    const sql = User.sql({
      raw: '$$_CoLuMn = $VaLuE123',
      values: { _CoLuMn: 'name', VaLuE123: 'value' },
    });

    expect(sql).toEqual({
      __raw: '$$_CoLuMn = $VaLuE123',
      __values: {
        _CoLuMn: 'name',
        VaLuE123: 'value',
      },
    });

    expectSql(
      User.where(sql).toSql(),
      `SELECT * FROM "user" WHERE ("name" = $1)`,
      ['value'],
    );
  });

  it('should handle values and a template string', () => {
    const sql = User.sql({ values: { value: 'value' } })`value = $value`;

    expect(sql).toEqual({
      __raw: [['value = $value']],
      __values: {
        value: 'value',
      },
    });
  });

  it('should handle a column and a simple string', () => {
    const sql = User.sql((t) => t.integer(), { raw: 'simple sql' });

    expect(sql).toEqual({
      __column: expect.any(IntegerColumn),
      __raw: 'simple sql',
    });

    expectSql(
      User.where(sql).toSql(),
      `SELECT * FROM "user" WHERE (simple sql)`,
    );
  });

  it('should handle a column, values, and a simple string', () => {
    const sql = User.sql((t) => t.integer(), {
      raw: '$$column = $value',
      values: { column: 'name', value: 'value' },
    });

    expect(sql).toEqual({
      __column: expect.any(IntegerColumn),
      __raw: '$$column = $value',
      __values: {
        column: 'name',
        value: 'value',
      },
    });

    expectSql(
      User.where(sql).toSql(),
      `SELECT * FROM "user" WHERE ("name" = $1)`,
      ['value'],
    );
  });

  it('should handle a template literal', () => {
    const sql = User.sql`one ${1} two ${true} three ${'string'} four`;

    expect(sql).toEqual({
      __raw: [['one ', ' two ', ' three ', ' four'], 1, true, 'string'],
    });

    expectSql(
      User.where(sql).toSql(),
      `SELECT * FROM "user" WHERE (one $1 two $2 three $3 four)`,
      [1, true, 'string'],
    );
  });

  it('should handle column and a template literal', () => {
    const sql = User.sql((t) =>
      t.integer(),
    )`one ${1} two ${true} three ${'string'} four`;

    expect(sql).toEqual({
      __column: expect.any(IntegerColumn),
      __raw: [['one ', ' two ', ' three ', ' four'], 1, true, 'string'],
    });

    expectSql(
      User.where(sql).toSql(),
      `SELECT * FROM "user" WHERE (one $1 two $2 three $3 four)`,
      [1, true, 'string'],
    );
  });

  it('should handle column, values, and a template literal', () => {
    const sql = User.sql((t) => t.integer(), {
      values: { 1: 'value' },
    })`value = $1 AND ${true}`;

    expect(sql).toEqual({
      __column: expect.any(IntegerColumn),
      __raw: [['value = $1 AND ', ''], true],
      __values: {
        1: 'value',
      },
    });

    expectSql(
      User.where(sql).toSql(),
      `SELECT * FROM "user" WHERE (value = $2 AND $1)`,
      [true, 'value'],
    );
  });

  it('should quote columns with tables', () => {
    const sql = User.sql({ raw: '$$column', values: { column: 'user.name' } });

    expect(sql).toEqual({
      __raw: '$$column',
      __values: {
        column: 'user.name',
      },
    });

    expectSql(
      User.where(sql).toSql(),
      `SELECT * FROM "user" WHERE ("user"."name")`,
    );
  });

  it('should not replace values inside string literals', () => {
    const query = User.where(
      User.sql({
        raw: `foo = $foo AND bar = '$bar''$bar' AND baz = $baz`,
        values: {
          foo: 1,
          baz: true,
        },
      }),
    );

    expectSql(
      query.toSql(),
      `SELECT * FROM "user" WHERE (foo = $1 AND bar = '$bar''$bar' AND baz = $2)`,
      [1, true],
    );
  });

  it('should throw when variable in the query is not provided', () => {
    const q = User.where(
      User.sql({ raw: `a = $a AND b = $b`, values: { a: 1 } }),
    );

    expect(() => q.toSql()).toThrow('Query variable `b` is not provided');
  });

  it('should throw when variable in the object is not used by the query', () => {
    const q = User.where(User.sql({ raw: `a = $a`, values: { a: 1, b: 'b' } }));

    expect(() => q.toSql()).toThrow('Query variable `b` is unused');
  });

  it.only('should return unknown without type cast', () => {
    const q = testDb.select({ test: testDb.sql({ raw: 'simple sql' }) }).take();

    assertType<Awaited<typeof q>, { test: unknown }>();
  });

  it.only('should type cast a simple string', () => {
    const q = testDb
      .select({ test: testDb.sql({ raw: 'simple sql' }).castTo<string>() })
      .take();

    assertType<Awaited<typeof q>, { test: string }>();
  });

  it.only('should type cast a template literal', () => {
    const q = testDb
      .select({ test: testDb.sql`one = ${1}`.castTo<string>() })
      .take();

    assertType<Awaited<typeof q>, { test: string }>();
  });

  it.only('should allow type casting a column to the same type', () => {
    const q = testDb
      .select({
        test: testDb.sql((t) => t.string(1, 10))`one = ${1}`.castTo<string>(),
      })
      .take();

    assertType<Awaited<typeof q>, { test: string }>();
  });

  it.only('should type cast a column to a narrowing type', () => {
    type Fish = 'Salmon' | 'Tuna' | 'Trout';
    const q = testDb
      .select({
        test: testDb.sql((t) => t.string(1, 10))`one = ${1}`.castTo<Fish>(),
      })
      .take();

    assertType<Awaited<typeof q>, { test: Fish }>();
  });

  it.only('should type cast to a complex type', () => {
    type Type = { name: string; active: boolean };
    const q = testDb
      .select({ test: testDb.sql`one = ${1}`.castTo<Type>() })
      .take();

    assertType<Awaited<typeof q>, { test: Type }>();
  });

  it.only('should disallow incompatible type cast', () => {
    // @ts-expect-error should prevent casting IntegerColumn result to string
    User.sql((t) => t.integer())`one = ${1}`.castTo<string>();
  });
});
