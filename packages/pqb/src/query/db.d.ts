import { DbDomainArg, GeneratorIgnore, IsQuery, Query, SelectableFromShape } from './query';
import { QueryMethods } from './query-methods';
import { Column, ColumnSchemaConfig, ColumnsShape, DefaultColumnTypes } from '../columns';
import { inspect } from 'node:util';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DynamicRawSQL, RawSql, UnsafeSqlExpression, type RawSqlBase } from './expressions/raw-sql';
import { type SqlJoinExpression } from './expressions/sql-join-expression';
import { SqlRefExpression } from './expressions/sql-ref-expression';
import { ScopeArgumentQuery } from './extra-features/scope/scope';
import { DefaultSchemaConfig } from '../columns/default-schema-config';
import { NonDeletedScope, SoftDeleteOption } from './basic-features/mutate/soft-delete';
import { TableData, TableDataFn, TableDataItem, TableDataItemsUniqueColumns, TableDataItemsUniqueColumnTuples, TableDataItemsUniqueConstraints, UniqueQueryTypeOrExpression } from '../tableData';
import { ComputedColumnsFromOptions, ComputedOptionsFactory } from './extra-features/computed/computed';
import { DbSqlQuery, SQLQueryArgs } from './db-sql-query';
import { EmptyObject, MaybeArray, RecordString, RecordUnknown } from '../utils';
import { Adapter, QueryResult } from '../adapters/adapter';
import { QueryError, QueryErrorName } from './errors';
import { DynamicSQLArg, StaticSQLArgs } from './expressions/expression';
import { QueryLogOptions } from './basic-features/log/log';
import { QueryCatch, QueryThenShallowSimplifyArr } from './then/then';
import { QueryData } from './query-data';
import { QueryInternal } from './query-internal';
import { QuerySchema } from './basic-features/schema/schema';
import { AsyncState } from './basic-features/storage/storage';
import { DbRole } from './extra-features/roles/roles';
import { Rls } from './extra-features/rls/rls.db';
import { Grant } from './extra-features/grants/grants.db';
type ShapeHasPrimaryKeys<Shape extends Column.QueryColumnsInit> = {
    [K in keyof Shape]: Shape[K]['data']['primaryKey'] extends string ? K : never;
}[keyof Shape];
type TablePrimaryKeys<Shape extends Column.QueryColumnsInit> = ShapeHasPrimaryKeys<Shape> extends never ? never : {
    [K in ShapeHasPrimaryKeys<Shape>]: UniqueQueryTypeOrExpression<Shape[K]['__queryType']>;
};
export type ShapeUniqueColumns<Shape extends Column.QueryColumnsInit> = {
    [K in keyof Shape]: Shape[K]['data']['unique'] extends string ? {
        [C in K]: UniqueQueryTypeOrExpression<Shape[K]['__queryType']>;
    } : never;
}[keyof Shape];
export type UniqueConstraints<Shape extends Column.QueryColumnsInit> = {
    [K in keyof Shape]: Shape[K]['data']['primaryKey'] extends string ? string extends Shape[K]['data']['primaryKey'] ? never : Shape[K]['data']['primaryKey'] : Shape[K]['data']['unique'] extends string ? string extends Shape[K]['data']['unique'] ? never : Shape[K]['data']['unique'] : never;
}[keyof Shape];
export type NoPrimaryKeyOption = 'error' | 'warning' | 'ignore';
export interface DbSharedOptions extends QueryLogOptions {
    autoPreparedStatements?: boolean;
    noPrimaryKey?: NoPrimaryKeyOption;
    rls?: Rls.Options;
    extensions?: (string | RecordString)[];
    domains?: {
        [K: string]: DbDomainArg<DefaultColumnTypes<DefaultSchemaConfig>>;
    };
    generatorIgnore?: GeneratorIgnore;
    schema?: QuerySchema;
    /**
     * For `hasMany` and `hasOne`:
     * controls nested create|connect|connectOrCreate strategy in `createMany`.
     * When creating many records <= this value, it will use a single query with CTEs.
     * Otherwise, it will perform nested operations in separate queries in a transaction.
     * A single query is more efficient on lower amount of records and on lower latency to a database.
     */
    nestedCreateBatchMax?: number;
    roles?: DbRole[];
    managedRolesSql?: string;
    /**
     * Default grantor role for grant metadata.
     */
    defaultGrantedBy?: string;
    grants?: Grant.Privilege[];
}
export interface DbOptions<SchemaConfig extends ColumnSchemaConfig, ColumnTypes> extends DbSharedOptions {
    schemaConfig?: () => SchemaConfig;
    columnTypes?: ColumnTypes | ((t: DefaultColumnTypes<SchemaConfig>) => ColumnTypes);
    snakeCase?: boolean;
    nowSQL?: string;
}
export interface DbOptionsWithAdapter<SchemaConfig extends ColumnSchemaConfig, ColumnTypes> extends DbOptions<SchemaConfig, ColumnTypes> {
    adapter: Adapter;
}
export interface DbTableOptions<ColumnTypes, Table extends string | undefined, Shape extends Column.QueryColumns> extends QueryLogOptions {
    schema?: QuerySchema;
    /**
     * Prepare all SQL queries before executing,
     * true by default
     */
    autoPreparedStatements?: boolean;
    noPrimaryKey?: NoPrimaryKeyOption;
    snakeCase?: boolean;
    /**
     * Default language for the full text search
     */
    language?: string;
    /**
     * See {@link ScopeMethods}
     */
    scopes?: DbTableOptionScopes<Table, Shape>;
    /**
     * See {@link SoftDeleteMethods}
     */
    softDelete?: SoftDeleteOption<Shape>;
    /**
     * Table comment, for migrations generator
     */
    comment?: string;
    /**
     * Disallow runtime create, update, and delete operations.
     */
    readOnly?: true | undefined;
    /**
     * Mark query objects as backed by a materialized relation.
     */
    materialized?: true | undefined;
    /**
     * Exclude a table-like definition from migration DDL generation.
     */
    generatorIgnore?: true | undefined;
    /**
     * Database relation name. The public `table` name remains a query alias.
     */
    nameInDb?: string;
    /**
     * Computed SQL or JS columns definitions
     */
    computed?: ComputedOptionsFactory<ColumnTypes, Shape>;
    /**
     * For customizing `now()` sql, used in soft delete
     */
    nowSQL?: string;
}
export type DbTableOptionScopes<Table extends string | undefined, Shape extends Column.QueryColumns, Keys extends string = string> = {
    [K in Keys]: (q: ScopeArgumentQuery<Table, Shape>) => IsQuery;
};
export interface QueryBuilder extends Query.NotReadOnlyQuery {
    returnType: undefined;
}
export declare class Db<Table extends string | undefined = undefined, Shape extends Column.QueryColumnsInit = Column.QueryColumnsInit, Data extends MaybeArray<TableDataItem> = never, ColumnTypes = DefaultColumnTypes<ColumnSchemaConfig>, ReadOnly extends true | undefined = undefined, Options = never> extends QueryMethods<ColumnTypes> implements Query {
    adapterNotInTransaction: Adapter;
    qb: QueryBuilder;
    table: Table;
    columnTypes: ColumnTypes;
    q: QueryData;
    __isQuery: true;
    __as: Table & string;
    __selectable: SelectableFromShape<ComputedColumnsFromOptions<Shape, Options>, Table>;
    __readOnly: ReadOnly;
    __materialized: Options extends {
        materialized: true;
    } ? true : undefined;
    __hasSelect: boolean;
    __hasWhere: boolean;
    __defaults: {
        [K in {
            [K in keyof Shape]: Shape[K]['data']['default'] extends true ? K : never;
        }[keyof Shape]]: true;
    };
    __scopes: {
        [K in keyof MapTableScopesOption<Options>]: true;
    };
    __defaultSelect: ColumnsShape.DefaultSelectKeys<Shape>;
    baseQuery: Query;
    columns: (keyof Shape)[];
    __outputType: ColumnsShape.DefaultSelectOutput<Shape>;
    __inputType: ColumnsShape.Input<Shape>;
    result: {
        [K in ColumnsShape.DefaultSelectKeys<Shape>]: Shape[K];
    };
    returnType: undefined;
    then: QueryThenShallowSimplifyArr<ColumnsShape.DefaultOutput<Shape>>;
    windows: EmptyObject;
    relations: EmptyObject;
    relationsDataForCreate: EmptyObject;
    relationsDataForCreateOptional: EmptyObject;
    relationQueries: EmptyObject;
    withData: EmptyObject;
    error: new (message: string, length: number, name: QueryErrorName) => QueryError<this>;
    internal: QueryInternal<TablePrimaryKeys<Shape> extends never ? never : {
        [K in keyof TablePrimaryKeys<Shape>]: (keyof TablePrimaryKeys<Shape> extends K ? never : keyof TablePrimaryKeys<Shape>) extends never ? TablePrimaryKeys<Shape>[K] : never;
    }[keyof TablePrimaryKeys<Shape>], TablePrimaryKeys<Shape> | ShapeUniqueColumns<Shape> | TableDataItemsUniqueColumns<Shape, Data>, {
        [K in keyof Shape]: Shape[K]['data']['unique'] extends string ? K : never;
    }[keyof Shape] | keyof TablePrimaryKeys<Shape>, TableDataItemsUniqueColumnTuples<Shape, Data>, UniqueConstraints<Shape> | TableDataItemsUniqueConstraints<Data>>;
    catch: QueryCatch;
    shape: ComputedColumnsFromOptions<Shape, Options>;
    constructor(adapterNotInTransaction: Adapter, qb: QueryBuilder, table: Table | undefined, shape: ComputedColumnsFromOptions<Shape, Options>, columnTypes: ColumnTypes, asyncStorage: AsyncLocalStorage<AsyncState>, options: DbTableOptions<ColumnTypes, Table, ComputedColumnsFromOptions<Shape, Options>>, tableData?: TableData, viewData?: QueryInternal['viewData']);
    /**
     * When in transaction, returns a db adapter object for the transaction,
     * returns a default adapter object otherwise.
     */
    $getAdapter(): Adapter;
    [inspect.custom](): string;
    /**
     * Use `query` to perform raw SQL queries.
     *
     * ```ts
     * const value = 1;
     *
     * // it is safe to interpolate inside the backticks (``):
     * const result = await db.query<{ one: number }>`SELECT ${value} AS one`;
     * // data is inside `rows` array:
     * result.rows[0].one;
     * ```
     *
     * If the query is executing inside a transaction, it will use the transaction connection automatically.
     *
     * ```ts
     * await db.transaction(async () => {
     *   // both queries will execute in the same transaction
     *   await db.query`SELECT 1`;
     *   await db.query`SELECT 2`;
     * });
     * ```
     *
     * Alternatively, support a simple SQL string, with optional `values`:
     *
     * Note that the values is a simple array, and the SQL is referring to the values with `$1`, `$2` and so on.
     *
     * ```ts
     * const value = 1;
     *
     * // it is NOT safe to interpolate inside a simple string, use `values` to pass the values.
     * import { raw } from 'orchid-orm';
     *
     * const result = await db.query<{ one: number }>(raw({
     *   raw: 'SELECT $1 AS one',
     *   values: [value],
     * }));
     * // data is inside `rows` array:
     * result.rows[0].one;
     * ```
     *
     * @param args - SQL template literal, or a raw SQL object created by `raw()` or `sql()` function
     */
    get query(): DbSqlQuery;
    private _query?;
    /**
     * Performs a SQL query, returns a db result with array of arrays instead of objects:
     *
     * ```ts
     * const value = 1;
     *
     * // it is safe to interpolate inside the backticks (``):
     * const result = await db.queryArrays<[number]>`SELECT ${value} AS one`;
     * // `rows` is an array of arrays:
     * const row = result.rows[0];
     * row[0]; // our value
     * ```
     *
     * @param args - SQL template literal, or a raw SQL object created by `raw()` or `sql()` function
     */
    queryArrays<R extends any[] = any[]>(...args: SQLQueryArgs): Promise<QueryResult<R>>;
}
export interface DbTableConstructor<ColumnTypes> {
    <Table extends string, Shape extends Column.QueryColumnsInit, Data extends MaybeArray<TableDataItem>, Options extends DbTableOptions<ColumnTypes, Table, Shape> | undefined>(table: Table, shape?: ((t: ColumnTypes) => Shape) | Shape, tableData?: TableDataFn<Shape, Data>, options?: Options): Db<Table, Shape, Data, ColumnTypes, Options extends {
        readOnly: true;
    } ? true : undefined, Options>;
}
export interface DbSqlMethod<ColumnTypes> {
    <T>(...args: StaticSQLArgs): RawSql<Column.Pick.QueryColumnOfType<T>, ColumnTypes>;
    <T>(...args: [DynamicSQLArg<Column.Pick.QueryColumnOfType<T>>]): DynamicRawSQL<Column.Pick.QueryColumnOfType<T>, ColumnTypes>;
    join<T = unknown>(items: readonly unknown[], separator?: RawSqlBase): SqlJoinExpression<Column.Pick.QueryColumnOfType<T>>;
    ref(name: string): SqlRefExpression;
    unsafe(sql: string | number | boolean): UnsafeSqlExpression;
}
export type MapTableScopesOption<T> = T extends {
    scopes: RecordUnknown;
} ? T extends {
    softDelete: true | PropertyKey;
} ? T['scopes'] & NonDeletedScope : T['scopes'] : T extends {
    softDelete: true | PropertyKey;
} ? {
    nonDeleted: unknown;
} : EmptyObject;
export interface DbResult<ColumnTypes> extends Db<undefined, EmptyObject, never, ColumnTypes, never, never>, DbTableConstructor<ColumnTypes> {
    adapterNotInTransaction: Adapter;
    adapter: Adapter;
    close: Adapter['close'];
    sql: DbSqlMethod<ColumnTypes>;
}
/**
 * If you'd like to use the query builder of OrchidORM as a standalone tool, install `pqb` package and use `createDb` to initialize it.
 *
 * As `Orchid ORM` focuses on ORM usage, docs examples mostly demonstrates how to work with ORM-defined tables,
 * but everything that's not related to table relations should also work with `pqb` query builder on its own.
 *
 * It is accepting the same options as `orchidORM` + options of `createBaseTable`:
 *
 * ```ts
 * import { createDb } from 'orchid-orm';
 *
 * import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
 * // or
 * import { SchemaConfig } from 'orchid-orm-valibot';
 *
 * const db = createDb({
 *   // db connection options
 *   databaseURL: process.env.DATABASE_URL,
 *   log: true,
 *
 *   // columns in db are in snake case:
 *   snakeCase: true,
 *
 *   // override default SQL for timestamp, see `nowSQL` above
 *   nowSQL: `now() AT TIME ZONE 'UTC'`,
 *
 *   // optional, but recommended: makes zod schemas for your tables
 *   schemaConfig: zodSchemaConfig,
 *   // or
 *   schemaConfig: valibotSchemaConfig,
 *
 *   // override column types:
 *   columnTypes: (t) => ({
 *     // by default timestamp is returned as a string, override to a number
 *     timestamp: () => t.timestamp().asNumber(),
 *   }),
 * });
 * ```
 *
 * After `db` is defined, construct queryable tables in such way:
 *
 * ```ts
 * export const User = db('user', (t) => ({
 *   id: t.identity().primaryKey(),
 *   name: t.string(),
 *   password: t.varchar(100),
 *   age: t.integer().nullable(),
 *   ...t.timestamps(),
 * }));
 * ```
 *
 * Now the `User` can be used for making type-safe queries:
 *
 * ```ts
 * const users = await User.select('id', 'name') // only known columns are allowed
 *   .where({ age: { gte: 20 } }) // gte is available only on the numeric field, and the only number is allowed
 *   .order({ createdAt: 'DESC' }) // type safe as well
 *   .limit(10);
 *
 * // users array has a proper type of Array<{ id: number, name: string }>
 * ```
 *
 * The optional third argument is for table options:
 *
 * ```ts
 * const Table = db('table', (t) => ({ ...columns }), {
 *   // provide this value if the table belongs to a specific database schema:
 *   schema: 'customTableSchema',
 *   // override `log` option of `createDb`:
 *   log: true, // boolean or object described `createdDb` section
 *   logger: { ... }, // override logger
 *   noPrimaryKey: 'ignore', // override noPrimaryKey
 *   snakeCase: true, // override snakeCase
 * })
 * ```
 */
export declare const createDbWithAdapter: <SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig, ColumnTypes = DefaultColumnTypes<SchemaConfig>>({ log, logger, snakeCase, schemaConfig: schemaConfigFn, columnTypes, schema, ...options }: DbOptionsWithAdapter<SchemaConfig, ColumnTypes>) => DbResult<ColumnTypes>;
export declare function _createDbSqlMethod<ColumnTypes>(columnTypes: ColumnTypes): DbSqlMethod<ColumnTypes>;
export declare const _initQueryBuilder: (adapter: Adapter, columnTypes: unknown, asyncStorage: AsyncLocalStorage<AsyncState>, commonOptions: DbTableOptions<unknown, undefined, Column.QueryColumns>, options: DbSharedOptions) => Db;
export {};
