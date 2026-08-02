import { DynamicSQLArg, Expression, ExpressionData, ExpressionTypeMethod, RawSQLValues, StaticSQLArgs, TemplateLiteralArgs } from './expression';
import { SqlJoinExpression } from './sql-join-expression';
import { SqlRefExpression } from './sql-ref-expression';
import { Column } from '../../columns/column';
import { ColumnSchemaConfig } from '../../columns/column-schema';
import { DefaultColumnTypes } from '../../columns/column-types';
import { ToSQLCtx, ToSqlValues } from '../sql/to-sql';
import { RecordUnknown } from '../../utils';
import { PrepareSubQueryForSql } from '../internal-features/sub-query/sub-query-for-sql';
import { SQLQueryArgs } from '../db-sql-query';
export declare const setRawSqlPrepareSubQueryForSql: (fn: PrepareSubQueryForSql) => void;
export declare const templateLiteralToSQL: (template: TemplateLiteralArgs, ctx: ToSqlValues, quotedAs?: string) => string;
export interface RawSqlBase<T extends Column.Pick.QueryColumn = Column.Pick.QueryColumn> extends Expression<T> {
    _sql: string | TemplateLiteralArgs;
    _values?: RawSQLValues;
}
export interface RawSql<T extends Column.Pick.QueryColumn, ColumnTypes> extends Expression<T>, RawSqlBase<T>, ExpressionTypeMethod {
}
export declare class RawSql<T extends Column.Pick.QueryColumn = Column.Pick.QueryColumn, ColumnTypes = DefaultColumnTypes<ColumnSchemaConfig>> extends Expression<T> {
    result: {
        value: T;
    };
    columnTypes: ColumnTypes;
    q: ExpressionData;
    _sql: string | TemplateLiteralArgs;
    _values?: RawSQLValues;
    constructor(sql: string | TemplateLiteralArgs, values?: RawSQLValues, type?: T);
    values<Self extends RawSqlBase>(this: Self, values: RawSQLValues): Self;
    makeSQL(ctx: ToSqlValues, quotedAs?: string): string;
}
export declare const isRawSQL: (arg: unknown) => arg is RawSqlBase;
interface RawSqlToCodeCtx {
    t: string;
    sql?: string;
    isSqlUsed?: boolean;
}
export declare const rawSqlToCode: (rawSql: RawSqlBase, ctx: string | RawSqlToCodeCtx) => string;
export interface DynamicRawSQL<T extends Column.Pick.QueryColumn> extends Expression<T>, ExpressionTypeMethod {
}
export declare class DynamicRawSQL<T extends Column.Pick.QueryColumn, ColumnTypes = DefaultColumnTypes<ColumnSchemaConfig>> extends Expression<T> {
    fn: DynamicSQLArg<T>;
    columnTypes: ColumnTypes;
    result: {
        value: T;
    };
    q: ExpressionData;
    dynamicBefore: boolean;
    constructor(fn: DynamicSQLArg<T>);
    makeSQL(ctx: ToSQLCtx, quotedAs?: string): string;
}
/**
 * @deprecated use `sql` instead
 */
export declare function raw<T = never>(...args: StaticSQLArgs): RawSql<Column.Pick.QueryColumnOfType<T>>;
/**
 * @deprecated use `sql` instead
 */
export declare function raw<T = never>(...args: [DynamicSQLArg<Column.Pick.QueryColumnOfType<T>>]): DynamicRawSQL<Column.Pick.QueryColumnOfType<T>>;
export declare const countSelect: RawSql<Column.Pick.QueryColumn, DefaultColumnTypes<ColumnSchemaConfig<Column.Pick.Data>>>[];
export declare function sqlQueryArgsToExpression(args: SQLQueryArgs): RawSqlBase;
export interface SqlFn {
    <T, Args extends TemplateLiteralArgs | [sql: string] | [values: RecordUnknown, sql?: string]>(this: T, ...args: Args): Args extends [RecordUnknown] ? (...sql: TemplateLiteralArgs) => RawSql<Column.Pick.QueryColumn, T> : RawSql<Column.Pick.QueryColumn, T>;
    /**
     * `sql.join` builds a SQL list from values and expressions.
     * Plain values are bound as query parameters, while SQL expressions render as SQL.
     *
     * Use it for SQL constructs such as `ARRAY[...]`, `IN (...)`, function arguments,
     * or tuple lists. The default separator is `, `. Provide a SQL expression as the
     * custom separator when a different separator is needed.
     *
     * ```ts
     * await db.user.whereSql`"id" IN (${sql.join([1, 2, 3])})`;
     * ```
     *
     * ```ts
     * await db.user.whereSql`
     *   (${sql.join([sql.ref('name'), sql.ref('age')])}) IN (${sql.join(
     *     users.map((user) => sql`(${user.name}, ${user.age})`),
     *   )})
     * `;
     * ```
     *
     * ```ts
     * await db.user.select({
     *   displayName: (q) =>
     *     sql<string>`concat(${sql.join(
     *       [q.column('firstName'), q.column('lastName')],
     *       sql` || ' ' || `,
     *     )})`,
     * });
     * ```
     */
    join<T = unknown>(items: readonly unknown[], separator?: RawSqlBase): SqlJoinExpression<Column.Pick.QueryColumnOfType<T>>;
    /**
     * `sql.ref` quotes a SQL identifier such as a table name, column name, or schema name.
     * Use it when you need to dynamically reference an identifier in raw SQL.
     *
     * ```ts
     * import { sql } from './baseTable';
     *
     * const schema = 'my_schema';
     *
     * // Produces: SET LOCAL search_path TO "my_schema"
     * await db.$query`SET LOCAL search_path TO ${sql.ref(schema)}`
     * ```
     *
     * It handles dots to support qualified names:
     *
     * ```ts
     * // "my_schema"."my_table"
     * sql.ref('my_schema.my_table');
     * ```
     */
    ref(name: string): SqlRefExpression;
    unsafe(sql: string | number | boolean): UnsafeSqlExpression;
}
export declare const sqlFn: SqlFn;
export declare class UnsafeSqlExpression extends Expression {
    sql: string | number | boolean;
    result: {
        value: Column.Pick.QueryColumn;
    };
    q: ExpressionData;
    constructor(sql: string | number | boolean);
    makeSQL(): string;
}
export {};
