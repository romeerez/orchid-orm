import { Query } from '../query';
import { ColumnType } from '../columns';
import {
  ColumnTypesBase,
  RawExpression,
  TemplateLiteralArgs,
} from 'orchid-core';

type SqlArgs<T extends Query> = SqlColumnArgs<T> | SqlNoColumnArgs;

type SqlColumnArgs<T extends Query> =
  | [column: ColumnFn<T>, params?: { raw?: string; values?: Values }];

type SqlColumnArgsWithSQL<T extends Query> =
  | [column: ColumnFn<T>, params: { raw: string }];

type SqlNoColumnArgs =
  | [params: { raw: string; values?: Values }]
  | [params: { values: Values }]
  | TemplateLiteralArgs;

type Values = Record<string, unknown>;

type ColumnFn<T extends Query> = (types: T['columnTypes']) => ColumnType;

type SqlFn<C extends ColumnType> = (
  ...args: TemplateLiteralArgs
) => RawExpression<C>;

type SqlResult<
  T extends Query,
  Args extends SqlArgs<T>,
> = Args extends SqlColumnArgs<T>
  ? Args extends SqlColumnArgsWithSQL<T>
    ? RawExpression<ReturnType<Args[0]>>
    : SqlFn<ReturnType<Args[0]>>
  : Args extends [{ raw: string }] | TemplateLiteralArgs
  ? RawExpression
  : SqlFn<ColumnType>;

type RawArgs<CT extends ColumnTypesBase, C extends ColumnType> =
  | [column: (types: CT) => C, sql: string, values?: Record<string, unknown>]
  | [sql: string, values?: Record<string, unknown>];

export class RawSqlMethods {
  /**
   * When there is a need to use a piece of raw SQL, use the `sql` method.
   *
   * To select with a raw SQL, need to specify a column type as a first argument, so the TS could use it to guess the result type of the query:
   *
   * ```ts
   * const result: { num: number }[] = await db.table.select({
   *   num: db.table.sql((t) => t.integer())`
   *     random() * 100
   *   `,
   * });
   * ```
   *
   * Other than for select, the column type can be omitted:
   *
   * ```ts
   * await db.table.where(db.table.sql`
   *   "someValue" = random() * 100
   * `);
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
   * To inject values into `raw` SQL strings, define it with `$` in the string and provide `values` object.
   *
   * Use `$$` to provide column or/and table name. Column names will be quoted so don't quote them manually.
   *
   * ```ts
   * // get value from user-provided params
   * const { value } = req.params;
   *
   * // this is SAFE, SQL injection are prevented:
   * await db.table.where(
   *   db.table.sql({
   *     values: {
   *       column: 'someTable.someColumn', // or simply 'column'
   *       one: value,
   *       two: 123,
   *     },
   *     raw: '$$column = random() * $value',
   *   }),
   * );
   * ```
   *
   * Summarizing:
   *
   * ```ts
   * // simplest form:
   * db.table`key = ${value}`;
   *
   * // with column type for select:
   * db.table((t) => t.boolean())`key = ${value}`;
   *
   * // raw SQL string, not allowed to interpolate:
   * db.table({ raw: 'random()' });
   *
   * // with values:
   * db.table({
   *   values: {
   *     column: 'columnName',
   *     one: 1,
   *     two: 2,
   *   },
   *   raw: '$$columnName = $one + $two',
   * });
   *
   * // with column type for select:
   * db.table((t) => t.decimal(), { raw: 'random()' });
   *
   * // combine values and template literal:
   * db.table({ values: { one: 1, two: 2 } })`
   *   ($one + $two) / $one
   * `;
   * ```
   *
   * @param args - template string or a specific options
   */
  sql<T extends Query, Args extends SqlArgs<T>>(
    this: T,
    ...args: Args
  ): SqlResult<T, Args> {
    const arg = args[0];

    if (typeof arg === 'object') {
      if (Array.isArray(arg)) {
        return {
          __raw: args,
        } as unknown as SqlResult<T, Args>;
      }

      const obj = arg as { raw?: string; values?: Values };
      if (obj.raw) {
        return {
          __raw: obj.raw,
          __values: obj.values,
        } as unknown as SqlResult<T, Args>;
      }

      return ((...args: unknown[]) => {
        return {
          __raw: args,
          __values: obj.values,
        } as unknown as RawExpression;
      }) as SqlResult<T, Args>;
    }

    const column = (arg as ColumnFn<T>)(this.columnTypes);
    const second = args[1] as { raw?: string; values?: Values } | undefined;

    if (second?.raw) {
      return {
        __column: column,
        __raw: second.raw,
        __values: second.values,
      } as unknown as SqlResult<T, Args>;
    }

    return ((...args: unknown[]) => {
      return {
        __column: column,
        __raw: args,
        __values: second?.values,
      } as unknown as RawExpression;
    }) as SqlResult<T, Args>;
  }

  /**
   * @deprecated use `sql` method instead, `raw` will be removed
   */
  raw<T extends Query, C extends ColumnType>(
    this: T,
    ...args: RawArgs<T['columnTypes'], C>
  ): RawExpression<C> {
    if (typeof args[0] === 'string') {
      return {
        __raw: args[0],
        __values: args[1],
      } as RawExpression<C>;
    } else {
      return {
        __column: args[0](this.columnTypes),
        __raw: args[1],
        __values: args[2],
      } as RawExpression<C>;
    }
  }
}
