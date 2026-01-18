import {
  HasCteHooks,
  HasTableHook,
} from '../basic-features/select/hook-select';
import { DelayedRelationSelect } from '../basic-features/select/delayed-relational-select';
import { QueryResult } from '../../adapters/adapter';
import { PickQueryColumTypes } from '../pick-query-types';
import { DynamicSQLArg, StaticSQLArgs } from '../expressions/expression';
import { DynamicRawSQL, raw, RawSql } from '../expressions/raw-sql';
import { Column } from '../../columns';
import { ToSQLCtx } from './to-sql';
import { QueryType } from '../query-data';
import { wrapMainQueryInCte } from './wrap-main-query-in-cte';

export interface SqlCommonOptions extends HasTableHook, HasCteHooks {
  delayedRelationSelect?: DelayedRelationSelect;
}

export interface SingleSqlItem {
  // SQL string
  text: string;
  // bind values passed along with SQL string
  values?: unknown[];
  runAfterQuery?: RunAfterQuery;
}

// is executed immediately after querying SQL.
// `then` early returns its result if `runAfterQuery` returns a result.
export interface RunAfterQuery {
  (queryResult: QueryResult): void | Promise<{ result: unknown }>;
}

export interface SingleSql extends SingleSqlItem, SqlCommonOptions {}

export interface BatchSql extends SqlCommonOptions {
  // batch of sql queries, is used when there is too many binding params for insert
  batch: SingleSql[];
}

// Output type of the `toSQL` method of query objects.
// This will be passed to database adapter to perform query.
export type Sql = SingleSql | BatchSql;

export const makeSql = (
  ctx: ToSQLCtx,
  type: QueryType,
  isSubSql: boolean | undefined,
  runAfterQuery?: RunAfterQuery,
): SingleSql => {
  if (
    (!isSubSql &&
      // require type to exclude SELECT because it does not require wrapping in CTE for UNION
      type &&
      // exclude insert because insert handles this logic on its own, since it has to deal with batches
      type !== 'insert' &&
      // exclude upsert because it upsert is SELECT from a union, select doesn't require wrapping
      type !== 'upsert' &&
      ctx.topCtx.cteHooks) ||
    ctx.q.appendQueries
  ) {
    wrapMainQueryInCte(ctx, ctx.q, isSubSql);
  }

  return {
    text: ctx.sql.join(' '),
    values: ctx.values,
    runAfterQuery,
  };
};

export const quoteSchemaAndTable = (
  schema: string | undefined,
  table: string,
): string => {
  return schema ? `"${schema}"."${table}"` : `"${table}"`;
};

export const makeRowToJson = (
  table: string,
  shape: Column.Shape.Data,
  aliasName: boolean,
  includingExplicitSelect?: boolean,
): string => {
  let isSimple = true;
  const list: string[] = [];

  for (const key in shape) {
    const column = shape[key];
    if (!includingExplicitSelect && column.data.explicitSelect) {
      continue;
    }

    if ((aliasName && column.data.name) || column.data.jsonCast) {
      isSimple = false;
    }

    list.push(
      `'${key}', "${table}"."${(aliasName && column.data.name) || key}"${
        column.data.jsonCast ? `::${column.data.jsonCast}` : ''
      }`,
    );
  }

  return isSimple
    ? `row_to_json("${table}".*)`
    : `CASE WHEN to_jsonb("${table}") IS NULL THEN NULL ELSE json_build_object(` +
        list.join(', ') +
        ') END';
};

export const getSqlText = (sql: Sql) => {
  if ('text' in sql) return sql.text;
  throw new Error(`Batch SQL is not supported in this query`);
};

export class QuerySql<ColumnTypes> {
  /**
   * @deprecated: use `sql` exported from the `createBaseTable` (see "define a base table" in the docs)
   *
   * When there is a need to use a piece of raw SQL, use the `sql` exported from the `BaseTable` file, it is also attached to query objects for convenience.
   *
   * When selecting a custom SQL, specify a resulting type with `<generic>` syntax:
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * const result: { num: number }[] = await db.table.select({
   *   num: sql<number>`random() * 100`,
   * });
   * ```
   *
   * In a situation when you want the result to be parsed, such as when returning a timestamp that you want to be parsed into a `Date` object, provide a column type in such a way:
   *
   * This example assumes that the `timestamp` column was overridden with `asDate` as shown in [Override column types](/guide/columns-overview#override-column-types).
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * const result: { timestamp: Date }[] = await db.table.select({
   *   timestamp: sql`now()`.type((t) => t.timestamp()),
   * });
   * ```
   *
   * In some cases such as when using [from](/guide/orm-and-query-builder.html#from), setting column type via callback allows for special `where` operations:
   *
   * ```ts
   * const subQuery = db.someTable.select({
   *   sum: () => sql`$a + $b`.type((t) => t.decimal()).values({ a: 1, b: 2 }),
   * });
   *
   * // `gt`, `gte`, `min`, `lt`, `lte`, `max` in `where`
   * // are allowed only for numeric columns:
   * const result = await db.$from(subQuery).where({ sum: { gte: 5 } });
   * ```
   *
   * Many query methods have a version suffixed with `Sql`, you can pass an SQL template literal directly to these methods.
   * These methods are: `whereSql`, `whereNotSql`, `orderSql`, `havingSql`, `fromSql`, `findBySql`.
   *
   * ```ts
   * await db.table.whereSql`"someValue" = random() * 100`;
   * ```
   *
   * Interpolating values in template literals is completely safe:
   *
   * ```ts
   * // get value from user-provided params
   * const { value } = req.params;
   *
   * // SQL injection is prevented by a library, this is safe:
   * await db.table.whereSql`column = ${value}`;
   * ```
   *
   * In the example above, TS cannot check if the table has `column` column, or if there are joined tables that have such column which will lead to error.
   * Instead, use the [column](/guide/sql-expressions#column) or [ref](/guide/sql-expressions#ref) to reference a column:
   *
   * ```ts
   * // ids will be prefixed with proper table names, no ambiguity:
   * db.table.join(db.otherTable, 'id', 'other.otherId').where`
   *   ${db.table.column('id')} = 1 AND
   *   ${db.otherTable.ref('id')} = 2
   * `;
   * ```
   *
   * SQL can be passed with a simple string, it's important to note that this is not safe to interpolate values in it.
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * // no interpolation is okay
   * await db.table.where(sql({ raw: 'column = random() * 100' }));
   *
   * // get value from user-provided params
   * const { value } = req.params;
   *
   * // this is NOT safe, SQL injection is possible:
   * await db.table.where(sql({ raw: `column = random() * ${value}` }));
   * ```
   *
   * To inject values into `sql({ raw: '...' })` SQL strings, denote it with `$` in the string and provide `values` object.
   *
   * Use `$$` to provide column or/and table name (`column` or `ref` are preferable). Column names will be quoted so don't quote them manually.
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * // get value from user-provided params
   * const { value } = req.params;
   *
   * // this is SAFE, SQL injection are prevented:
   * await db.table.where(
   *   sql<boolean>({
   *     raw: '$$column = random() * $value',
   *     values: {
   *       column: 'someTable.someColumn', // or simply 'column'
   *       one: value,
   *       two: 123,
   *     },
   *   }),
   * );
   * ```
   *
   * Summarizing:
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * // simplest form:
   * sql`key = ${value}`;
   *
   * // with resulting type:
   * sql<boolean>`key = ${value}`;
   *
   * // with column type for select:
   * sql`key = ${value}`.type((t) => t.boolean());
   *
   * // with column name via `column` method:
   * sql`${db.table.column('column')} = ${value}`;
   *
   * // raw SQL string, not allowed to interpolate values:
   * sql({ raw: 'random()' });
   *
   * // with resulting type and `raw` string:
   * sql<number>({ raw: 'random()' });
   *
   * // with column name and a value in a `raw` string:
   * sql({
   *   raw: `$$column = $value`,
   *   values: { column: 'columnName', value: 123 },
   * });
   *
   * // combine template literal, column type, and values:
   * sql`($one + $two) / $one`.type((t) => t.numeric()).values({ one: 1, two: 2 });
   * ```
   *
   * @param args - template literal or an object { raw: string }
   * @return object that has `type` and `values` methods
   */
  sql<T = unknown>(
    this: PickQueryColumTypes,
    ...args: StaticSQLArgs
  ): RawSql<Column.Pick.QueryColumnOfType<T>, ColumnTypes>;
  sql<T = unknown>(
    this: PickQueryColumTypes,
    ...args: [DynamicSQLArg<Column.Pick.QueryColumnOfType<T>>]
  ): DynamicRawSQL<Column.Pick.QueryColumnOfType<T>, ColumnTypes>;
  sql(this: PickQueryColumTypes, ...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sql = (raw as any)(...args);
    sql.columnTypes = this.columnTypes;
    return sql;
  }
}
