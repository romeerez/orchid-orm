import { assertType, expectSql, sql, testAdapter, testDb } from 'test-utils';
import { BooleanColumn, Column } from '../columns';
import { createDbWithAdapter } from '../query/db';
import { emptyObject, Expression } from '../core';
import { ToSQLCtx } from '../sql';
import { User, userColumnsSql } from '../test-utils/test-utils';

describe('sql', () => {
  it('should use column types in callback from a db instance', () => {
    const type = {} as unknown as Column;
    const db = createDbWithAdapter({
      adapter: testAdapter,
      columnTypes: {
        type: () => type,
      },
    });

    const sql = db.sql`sql`.type((t) => t.type());

    expect(sql.result.value).toBe(type);
  });

  it('should handle a simple string', () => {
    const sql = User.sql<boolean>({ raw: 'simple sql' });

    expect(sql).toMatchObject({
      _sql: 'simple sql',
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "user" WHERE (simple sql)`,
    );
  });

  it('should handle values, and a simple string', () => {
    const sql = User.sql<boolean>({
      raw: '$$_CoLuMn = $VaLuE123',
    }).values({
      _CoLuMn: 'name',
      VaLuE123: 'value',
    });

    expect(sql).toMatchObject({
      _sql: '$$_CoLuMn = $VaLuE123',
      _values: {
        _CoLuMn: 'name',
        VaLuE123: 'value',
      },
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "user" WHERE ("name" = $1)`,
      ['value'],
    );
  });

  it('should handle raw sql and values in single parameter', () => {
    const sql = User.sql({
      raw: 'column = $value',
      values: { value: 'foo' },
    });

    expect(sql).toMatchObject({
      _sql: 'column = $value',
      _values: { value: 'foo' },
      columnTypes: User.columnTypes,
    });
  });

  it('should handle values and a template string', () => {
    const sql = User.sql`value = $value`.values({ value: 'value' });

    expect(sql).toMatchObject({
      _sql: [['value = $value']],
      _values: {
        value: 'value',
      },
      columnTypes: User.columnTypes,
    });
  });

  it('should handle a column and a simple string', () => {
    const sql = User.sql({ raw: 'simple sql' }).type((t) => t.boolean());

    expect(sql).toMatchObject({
      result: { value: expect.any(BooleanColumn) },
      _sql: 'simple sql',
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "user" WHERE (simple sql)`,
    );
  });

  it('should handle a column, values, and a simple string', () => {
    const sql = User.sql({
      raw: '$$column = $value',
    })
      .type((t) => t.boolean())
      .values({ column: 'name', value: 'value' });

    expect(sql).toMatchObject({
      result: { value: expect.any(BooleanColumn) },
      _sql: '$$column = $value',
      _values: {
        column: 'name',
        value: 'value',
      },
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "user" WHERE ("name" = $1)`,
      ['value'],
    );
  });

  it('should handle a template literal', () => {
    const sql = User.sql<boolean>`one ${1} two ${true} three ${'string'} four`;

    expect(sql).toMatchObject({
      _sql: [['one ', ' two ', ' three ', ' four'], 1, true, 'string'],
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "user" WHERE (one $1 two $2 three $3 four)`,
      [1, true, 'string'],
    );
  });

  it('should handle column and a template literal', () => {
    const sql = User.sql`one ${1} two ${true} three ${'string'} four`.type(
      (t) => t.boolean(),
    );

    expect(sql).toMatchObject({
      result: { value: expect.any(BooleanColumn) },
      _sql: [['one ', ' two ', ' three ', ' four'], 1, true, 'string'],
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "user" WHERE (one $1 two $2 three $3 four)`,
      [1, true, 'string'],
    );
  });

  it('should handle column, values, and a template literal', () => {
    const sql = User.sql`value = $1 AND ${true}`
      .type((t) => t.boolean())
      .values({ 1: 'value' });

    expect(sql).toMatchObject({
      result: { value: expect.any(BooleanColumn) },
      _sql: [['value = $1 AND ', ''], true],
      _values: {
        1: 'value',
      },
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "user" WHERE (value = $2 AND $1)`,
      [true, 'value'],
    );
  });

  it('should quote columns with tables', () => {
    const sql = User.sql<boolean>({ raw: '$$column' }).values({
      column: 'user.name',
    });

    expect(sql).toMatchObject({
      _sql: '$$column',
      _values: {
        column: 'user.name',
      },
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.where(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "user" WHERE ("user"."name")`,
    );
  });

  it('should not replace values inside string literals', () => {
    const query = User.where(
      User.sql<boolean>({
        raw: `foo = $foo AND bar = '$bar''$bar' AND baz = $baz`,
      }).values({
        foo: 1,
        baz: true,
      }),
    );

    expectSql(
      query.toSQL(),
      `SELECT ${userColumnsSql} FROM "user" WHERE (foo = $1 AND bar = '$bar''$bar' AND baz = $2)`,
      [1, true],
    );
  });

  it('should throw when variable in the query is not provided', () => {
    const q = User.where(
      User.sql<boolean>({ raw: `a = $a AND b = $b` }).values({ a: 1 }),
    );

    expect(() => q.toSQL()).toThrow('Query variable `b` is not provided');
  });

  it('should throw when variable in the object is not used by the query', () => {
    const q = User.where(
      User.sql<boolean>({ raw: `a = $a` }).values({ a: 1, b: 'b' }),
    );

    expect(() => q.toSQL()).toThrow('Query variable `b` is unused');
  });

  it('should handle column and ref expressions', () => {
    const q = User.select({
      value: (q) =>
        sql<string>`${q.column('name')} || ' ' || ${q.ref('user.password')}`,
    });

    assertType<Awaited<typeof q>, { value: string }[]>();

    expectSql(
      q.toSQL(),
      `
          SELECT "user"."name" || ' ' || "user"."password" "value"
          FROM "user"
        `,
    );
  });

  describe('dynamic raw sql', () => {
    it('should accept function which is executed dynamically each time when converting the expression to sql', () => {
      const sql = testDb.sql((sql) => sql({ raw: `value = ${value}` }));

      const ctx = { values: [] };

      let value = 1;
      expect(sql.toSQL(ctx)).toBe('value = 1');

      value++;
      expect(sql.toSQL(ctx)).toBe('value = 2');
    });
  });

  it('should interpolate expressions', () => {
    class CustomExpression extends Expression {
      declare result: { value: Column.Pick.QueryColumn };
      q = emptyObject;
      makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
        ctx.values.push('value');
        return `hello, ${quotedAs}!`;
      }
    }

    const q = User.get(testDb.sql`${new CustomExpression()}`);

    expectSql(q.toSQL(), `SELECT hello, "user"! FROM "user" LIMIT 1`, [
      'value',
    ]);
  });
});
