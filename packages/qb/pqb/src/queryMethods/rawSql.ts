import { ColumnTypesBase, ColumnTypeBase, RawSQLArgs } from 'orchid-core';
import { raw, RawSQL } from '../sql/rawSql';

export class RawSqlMethods<CT extends ColumnTypesBase> {
  /**
   * When there is a need to use a piece of raw SQL, use the `sql` method from tables, or a `raw` function imported from `orchid-orm`.
   *
   * When selecting a raw SQL, specify a resulting type with `<generic>` syntax:
   *
   * ```ts
   * const result: { num: number }[] = await db.table.select({
   *   num: db.table.sql<number>`
   *     random() * 100
   *   `,
   * });
   * ```
   *
   * In a situation when you want the result to be parsed, such as when returning a timestamp that you want to be parsed into a `Date` object, provide a column type in such a way:
   *
   * This example assumes that the `timestamp` column was overridden with `asDate` as shown in [Override column types](/guide/columns-overview#override-column-types).
   *
   * ```ts
   * const result: { timestamp: Date }[] = await db.table.select({
   *   timestamp: db.table.sql`now()`.type((t) => t.timestamp()),
   * });
   * ```
   *
   * In some cases such as when using [from](/guide/orm-and-query-builder.html#from), setting column type via callback allows for special `where` operations:
   *
   * ```ts
   * const subQuery = db.someTable.select({
   *   sum: (q) => q.sql`$a + $b`.type((t) => t.decimal()).values({ a: 1, b: 2 }),
   * });
   *
   * // `gt`, `gte`, `min`, `lt`, `lte`, `max` in `where`
   * // are allowed only for numeric columns:
   * const result = await db.$from(subQuery).where({ sum: { gte: 5 } });
   * ```
   *
   * ```ts
   * db.$from(Otherdb.table.select('foo', 'bar'));
   * ```
   *
   * `where` and other methods don't need the return type, so it can be omitted:
   *
   * ```ts
   * await db.table.where(db.table.sql`
   *   "someValue" = random() * 100
   * `);
   * ```
   *
   * Instead of `sql` method, you can use `raw` function from `orchid-orm` (or `pqb`) to do the same.
   * The only difference, `raw` function don't have access to the overridden column types.
   *
   * ```ts
   * import { raw } from 'orchid-orm';
   *
   * await db.table.where(raw`
   *   "someValue" = random() * 100
   * `);
   *
   * await db.table.select({
   *   // it is a default `timestamp` column,
   *   // if you have overriden it with `asDate` or `asNumber` it won't be parsed properly:
   *   now: raw`now()`.type((t) => t.timestamp()),
   * });
   * ```
   *
   * Interpolating values in template literals is completely safe:
   *
   * ```ts
   * // get value from user-provided params
   * const { value } = req.params;
   *
   * // SQL injection is prevented by a library, this is safe:
   * await db.table.where(db.table.sql`
   *   column = ${value}
   * `);
   * ```
   *
   * SQL can be passed with a simple string, it's important to note that this is not safe to interpolate values in it.
   *
   * ```ts
   * // no interpolation is okay
   * await db.table.where(db.table.sql({ raw: 'column = random() * 100' }));
   *
   * // get value from user-provided params
   * const { value } = req.params;
   *
   * // this is NOT safe, SQL injection is possible:
   * await db.table.where(db.table.sql({ raw: `column = random() * ${value}` }));
   * ```
   *
   * To inject values into `raw` SQL strings, denote it with `$` in the string and provide `values` object.
   *
   * Use `$$` to provide column or/and table name. Column names will be quoted so don't quote them manually.
   *
   * ```ts
   * // get value from user-provided params
   * const { value } = req.params;
   *
   * // this is SAFE, SQL injection are prevented:
   * await db.table.where(
   *   db.table.sql({ raw: '$$column = random() * $value' }).values({
   *     column: 'someTable.someColumn', // or simply 'column'
   *     one: value,
   *     two: 123,
   *   }),
   * );
   * ```
   *
   * Summarizing:
   *
   * ```ts
   * // simplest form:
   * db.table.sql`key = ${value}`;
   *
   * // with resulting type:
   * db.table.sql<boolean>`key = ${value}`;
   *
   * // with column type for select:
   * db.table.sql`key = ${value}`.type((t) => t.boolean());
   *
   * // raw SQL string, not allowed to interpolate:
   * db.table.sql({ raw: 'random()' });
   *
   * // with resulting type:
   * db.table.sql<number>({ raw: 'random()' });
   *
   * // with values:
   * db.table.sql({ raw: '$$columnName = $one + $two' }).values({
   *   columnName: 'column',
   *   one: 1,
   *   two: 2,
   * });
   *
   * // combine template literal, column type, and values:
   * db.table.sql`($one + $two) / $one`
   *   .type((t) => t.numeric())
   *   .values({ one: 1, two: 2 });
   * ```
   *
   * @param args - template literal or an object { raw: string }
   * @return object that has `type` and `values` methods
   */
  sql<T = unknown>(
    this: { columnTypes: CT },
    ...args: RawSQLArgs
  ): RawSQL<ColumnTypeBase<T>, CT> {
    const sql = raw<T>(...args) as unknown as RawSQL<ColumnTypeBase<T>, CT>;
    sql.columnTypes = this.columnTypes;
    return sql;
  }
}
