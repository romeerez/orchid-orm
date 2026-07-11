import { assertType, expectSql, sql, testAdapter, testDb } from 'test-utils';
import { BooleanColumn, Column } from '../../columns';
import { createDbWithAdapter } from '../db';
import { User, userColumnsSql } from '../../test-utils/pqb.test-utils';
import { Expression } from '../expressions/expression';
import { emptyObject, noop } from '../../utils';
import { ToSQLCtx } from './to-sql';
import { queryToSql, rawSqlToSql, sqlToRawSql } from './sql';

describe('sql', () => {
  it('should convert query definition SQL to raw SQL with named values', () => {
    const sql = sqlToRawSql(
      queryToSql(User.select('id').where({ name: 'name' })),
    );
    const values: unknown[] = [];

    expect(sql.toSQL({ values })).toBe(
      `SELECT "User"."id" FROM "schema"."user" "User" WHERE "User"."name" = $1`,
    );
    expect(values).toEqual(['name']);
    expect(sql).toMatchObject({
      _sql: 'SELECT "User"."id" FROM "schema"."user" "User" WHERE "User"."name" = $queryValue1',
      _values: { queryValue1: 'name' },
    });
  });

  it('should convert raw SQL to query SQL shape', () => {
    const sql = rawSqlToSql(
      User.sql({ raw: 'name = $name' }).values({ name: 'name' }),
    );

    expect(sql).toEqual({
      text: 'name = $1',
      values: ['name'],
    });
  });

  it('should use column types in callback from a db instance', () => {
    const type = {} as unknown as Column;
    const db = createDbWithAdapter({
      adapter: testAdapter,
      columnTypes: {
        setDriverAdapter: noop,
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
      User.whereSql(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE (simple sql)`,
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
      User.whereSql(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE ("name" = $1)`,
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
      User.whereSql(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE (simple sql)`,
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
      User.whereSql(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE ("name" = $1)`,
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
      User.whereSql(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE (one $1 two $2 three $3 four)`,
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
      User.whereSql(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE (one $1 two $2 three $3 four)`,
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
      User.whereSql(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE (value = $2 AND $1)`,
      [true, 'value'],
    );
  });

  it('should quote columns with tables', () => {
    const sql = User.sql<boolean>({ raw: '$$column' }).values({
      column: 'User.name',
    });

    expect(sql).toMatchObject({
      _sql: '$$column',
      _values: {
        column: 'User.name',
      },
      columnTypes: User.columnTypes,
    });

    expectSql(
      User.whereSql(sql).toSQL(),
      `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE ("User"."name")`,
    );
  });

  it('should not replace values inside string literals', () => {
    const query = User.whereSql(
      User.sql<boolean>({
        raw: `foo = $foo AND bar = '$bar''$bar' AND baz = $baz`,
      }).values({
        foo: 1,
        baz: true,
      }),
    );

    expectSql(
      query.toSQL(),
      `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE (foo = $1 AND bar = '$bar''$bar' AND baz = $2)`,
      [1, true],
    );
  });

  it('should throw when variable in the query is not provided', () => {
    const q = User.whereSql(
      User.sql<boolean>({ raw: `a = $a AND b = $b` }).values({ a: 1 }),
    );

    expect(() => q.toSQL()).toThrow('Query variable `b` is not provided');
  });

  it('should throw when variable in the object is not used by the query', () => {
    const q = User.whereSql(
      User.sql<boolean>({ raw: `a = $a` }).values({ a: 1, b: 'b' }),
    );

    expect(() => q.toSQL()).toThrow('Query variable `b` is unused');
  });

  it('should handle column and ref expressions', () => {
    const q = User.select({
      value: (q) =>
        sql<string>`${q.column('name')} || ' ' || ${q.ref('User.password')}`,
    });

    assertType<Awaited<typeof q>, { value: string }[]>();

    expectSql(
      q.toSQL(),
      `
          SELECT "User"."name" || ' ' || "User"."password" "value"
          FROM "schema"."user" "User"
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

    expectSql(
      q.toSQL(),
      `SELECT hello, "User"! FROM "schema"."user" "User" LIMIT 1`,
      ['value'],
    );
  });

  describe('sql.ref', () => {
    it('should quote a simple identifier', () => {
      const ref = sql.ref('my_table');
      expect(ref.makeSQL()).toBe('"my_table"');
    });

    it('should quote a qualified identifier with dots', () => {
      const ref = sql.ref('my_schema.my_table');
      expect(ref.makeSQL()).toBe('"my_schema"."my_table"');
    });

    it('should escape double quotes in identifier', () => {
      const ref = sql.ref('table"name');
      expect(ref.makeSQL()).toBe('"table""name"');
    });

    it('should be usable inside sql template literal', () => {
      const schema = 'my_schema';
      const q = sql`SET LOCAL SEARCH_PATH TO ${sql.ref(schema)}`;

      expect(q.toSQL({ values: [] })).toBe(
        `SET LOCAL SEARCH_PATH TO "my_schema"`,
      );
    });

    it('should be usable with db.sql in a raw query', () => {
      const tableName = 'users';
      const q = testDb.sql`SELECT * FROM ${sql.ref(tableName)}`;

      expect(q.toSQL({ values: [] })).toBe(`SELECT * FROM "users"`);
    });

    it('should be usable in query builder select', () => {
      const column = 'name';
      const q = User.select({
        value: () => sql<string>`${sql.ref(column)}`,
      });

      expectSql(q.toSQL(), `SELECT "name" "value" FROM "schema"."user" "User"`);
    });
  });

  describe('sql.join', () => {
    it('should render a list of values in whereSql', () => {
      const q = User.whereSql`ARRAY[${sql.join([1, 2, 3])}]`;

      expectSql(
        q.toSQL(),
        `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE (ARRAY[$1, $2, $3])`,
        [1, 2, 3],
      );
    });

    it('should render expression items without parameterizing them', () => {
      const q = User.whereSql`${sql.join([
        sql.ref('name'),
        sql.ref('User.age'),
      ])}`;

      expectSql(
        q.toSQL(),
        `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE ("name", "User"."age")`,
      );
    });

    it('should preserve value order with mixed items and separators', () => {
      const q = User.whereSql`${sql.join(
        [1, sql`lower(${'NAME'})`, sql.ref('age'), 4],
        sql`${'separator'} || `,
      )}`;

      expectSql(
        q.toSQL(),
        `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE ($1$2 || lower($3)$4 || "age"$5 || $6)`,
        [1, 'separator', 'NAME', 'separator', 'separator', 4],
      );
    });

    it('should accept readonly arrays and render empty lists', () => {
      const items = [1, 2] as const;

      expectSql(
        User.whereSql`ARRAY[${sql.join(items)}]`.toSQL(),
        `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE (ARRAY[$1, $2])`,
        [1, 2],
      );

      expectSql(
        User.whereSql`IN (${sql.join([])})`.toSQL(),
        `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE (IN ())`,
      );
    });

    it('should be usable in query builder select', () => {
      const q = User.select({
        value: (q) =>
          sql<string>`concat(${sql.join(
            [q.column('name'), q.column('age')],
            sql` || ' ' || `,
          )})`,
      });

      assertType<Awaited<typeof q>, { value: string }[]>();
      expectSql(
        q.toSQL(),
        `SELECT concat("User"."name" || ' ' || "User"."age") "value" FROM "schema"."user" "User"`,
      );
    });
  });
});
