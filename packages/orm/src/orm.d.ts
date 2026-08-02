import { FromArg, FromResult, StorageOptions, Adapter, DbSharedOptions, MaybeArray, MergeQuery, Rls, Grant, EmptyObject, ColumnsShape, RecordUnknown, type TableDataItem } from 'pqb/internal';
import { ORMTableInput, TableClass, TableQueryBuilder } from './orm-table/legacy-table';
import type { OrmTable } from './orm-table/table';
import { transaction, ensureTransaction, isInTransaction, afterCommit } from './transaction';
import { Db, Query } from 'pqb';
export interface FromQuery extends Query {
    returnType: 'all';
}
interface OrchidORMQueryHelper<Q extends Query, Args extends unknown[], Result> {
    <T extends Query>(q: T & {
        table: Q['table'];
    }, ...args: Args): Result extends Query ? MergeQuery<T, Result> : Result;
    isQueryHelper: true;
    table: Q['table'];
    __args: Args;
    __result: Result;
}
interface OrchidORMTableHelper<T extends Query> {
    /**
     * Static table name from the table class.
     */
    table: T['table'];
    /**
     * Create a helper that binds to the DB-aware table query when used.
     */
    makeHelper<Args extends unknown[], Result>(fn: (q: T, ...args: Args) => Result): OrchidORMQueryHelper<T, Args, Result>;
}
/**
 * Table definitions accepted by ORM setup.
 */
export interface OrmTableThunks {
    /**
     * ORM table or view definition keyed by the db instance property name.
     */
    [K: string]: TableClass | {
        data: {
            id: string;
            name: string | undefined;
            table: string | undefined;
            relations: unknown;
            columns: ColumnsShape;
            types: unknown;
            computed: unknown;
            scopes: RecordUnknown | undefined;
            softDelete?: true | string | undefined;
            readOnly?: boolean | undefined;
            materialized?: true | undefined;
            tableData: unknown;
        };
        prototype: {
            columns: {
                shape: ColumnsShape;
            };
        };
        instance(): ORMTableInput;
    };
}
type OrmTableInstance<T> = T extends {
    data: {
        id: infer Id extends string;
        table: infer Table extends string | undefined;
        name: infer Name extends string | undefined;
        columns: infer Columns extends ColumnsShape;
        types: infer ColumnTypes;
        relations: infer Relations;
        computed: infer Computed;
        scopes: infer Scopes extends RecordUnknown | undefined;
        softDelete: infer SoftDelete extends true | string | undefined;
        readOnly: infer ReadOnly extends boolean | undefined;
        materialized: infer Materialized extends true | undefined;
        tableData: infer Data extends TableDataItem[];
    };
} ? OrmTable.Input<Id, Table, Name, Columns, ColumnTypes, OrmTable.Relations.Resolve<Relations>, Computed, Scopes, SoftDelete, ReadOnly, Materialized, Data[number]> : never;
export type TableInstance<T> = T extends {
    new (): infer R extends ORMTableInput;
} ? R : OrmTableInstance<T>;
export type OrchidORMTables<TT extends OrmTableThunks = OrmTableThunks, VT extends OrmTableThunks = OrmTableThunks> = {
    [K in keyof TT]: OrchidORMTableHelper<TableQueryBuilder<TT, VT, TableInstance<TT[K]>>>;
};
export type OrchidORMBundle<TT extends OrmTableThunks = OrmTableThunks, VT extends OrmTableThunks = OrmTableThunks> = OrchidORMTables<TT, VT> & {
    $views: OrchidORMTables<VT, TT>;
};
export type OrchidORMDbTables<TT extends OrmTableThunks = OrmTableThunks, VT extends OrmTableThunks = OrmTableThunks> = {
    [K in keyof TT]: TableQueryBuilder<TT, VT, TableInstance<TT[K]>>;
};
export type OrchidORM<TT extends OrmTableThunks = OrmTableThunks, VT extends OrmTableThunks = OrmTableThunks> = OrchidORMDbTables<TT, VT> & {
    $views: OrchidORMDbTables<VT, TT>;
} & OrchidORMMethods;
/**
 * Identity helper for table row-level security configuration.
 */
export declare const defineRls: <T extends Rls.TableConfig>(rls: T) => T;
/**
 * Identity helper for table-local grant configuration.
 */
export declare const setGrants: <const T extends readonly Grant.TableClassGrant[]>(grants: T) => T;
interface OrchidORMMethods {
    /**
     * @see import('pqb').QueryTransaction.prototype.transaction
     */
    $transaction: typeof transaction;
    /**
     * @see import('pqb').QueryTransaction.prototype.ensureTransaction
     */
    $ensureTransaction: typeof ensureTransaction;
    /**
     * @see import('pqb').QueryTransaction.prototype.isInTransaction
     */
    $isInTransaction: typeof isInTransaction;
    /**
     * @see import('pqb').QueryTransaction.prototype.afterCommit
     */
    $afterCommit: typeof afterCommit;
    $qb: Db;
    $adapterNotInTransaction: Adapter;
    /**
     * Adapter is a wrapper on top of `postgres-js`, `node-postgres`, or other db driver.
     *
     * When in transaction, returns a db adapter object for the transaction,
     * returns a default adapter object otherwise.
     *
     * Treat the adapter as implementation detail and avoid accessing it directly.
     */
    $getAdapter(): Adapter;
    /**
     * Use `$query` to perform raw SQL queries.
     *
     * ```ts
     * const value = 1;
     *
     * // it is safe to interpolate inside the backticks (``):
     * const result = await db.$query<{ one: number }>`SELECT ${value}  one`;
     * // data is inside `rows` array:
     * result.rows[0].one;
     * ```
     *
     * If the query is executing inside a transaction, it will use the transaction connection automatically.
     *
     * ```ts
     * await db.transaction(async () => {
     *   // both queries will execute in the same transaction
     *   await db.$query`SELECT 1`;
     *   await db.$query`SELECT 2`;
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
     * const result = await db.$query<{ one: number }>({
     *   raw: 'SELECT $1 AS one',
     *   values: [value],
     * });
     * // data is inside `rows` array:
     * result.rows[0].one;
     * ```
     *
     * @param args - SQL template literal, or an object { raw: string, values?: unknown[] }
     */
    $query: Db['query'];
    /**
     * The same as the {@link $query}, but returns an array of arrays instead of objects:
     *
     * ```ts
     * const value = 1;
     *
     * // it is safe to interpolate inside the backticks (``):
     * const result = await db.$queryArrays<[number]>`SELECT ${value} AS one`;
     * // `rows` is an array of arrays:
     * const row = result.rows[0];
     * row[0]; // our value
     * ```
     *
     * @param args - SQL template literal, or an object { raw: string, values?: unknown[] }
     */
    $queryArrays: Db['queryArrays'];
    /**
     * See {@link FromMethods.from}
     */
    $from<Arg extends MaybeArray<FromArg<Query>>>(arg: Arg): FromResult<FromQuery, Arg>;
    /**
     * `$withOptions` supports overriding `log`, `schema`, `role`, and `setConfig`.
     *
     * - `log`: boolean, enables or disables logging in the scope of the callback.
     * - `schema`: set a **default** schema, note that it does not override
     *   if you already have a schema set in the ORM config or for a specific table.
     * - `role`: string, switches the Postgres role for the duration of the callback.
     *   Used for row-level security policies.
     * - `setConfig`: object with string, number, or boolean values, sets Postgres custom
     *   settings for the duration of the callback. Use dotted names like `app.tenant_id`.
     *   Values are normalized to strings internally.
     *
     * SQL session options (`role` and `setConfig`) cannot be nested.
     * If an outer scope already has `role` or `setConfig`, attempting to set them again
     * in a nested `$withOptions` call will throw an error.
     * For transaction-bound work that needs nested overrides, pass `role` and
     * `setConfig` to nested `$transaction` calls instead.
     * Nested scopes that only change `log` or `schema` will inherit the outer SQL session context.
     *
     * Explicit transactions inside the callback inherit the same SQL session context:
     *
     * ```ts
     * await db.$withOptions(
     *   {
     *     role: 'app_user',
     *     setConfig: {
     *       'app.tenant_id': tenantId,
     *       'app.user_id': userId,
     *     },
     *   },
     *   async () => {
     *     const project = await db.project.find(projectId);
     *
     *     await db.$transaction(async () => {
     *       // This query runs in the transaction with the same role and config
     *       await db.project.find(projectId).update({ lastViewedAt: new Date() });
     *     });
     *   },
     * );
     * ```
     *
     * When the request's DB work should run in one transaction, prefer passing
     * `role` and `setConfig` directly to `$transaction`.
     *
     * Basic usage with `log` and `schema`:
     *
     * ```ts
     * await db.$withOptions({ log: true, schema: 'custom' }, async () => {
     *   // will log this query, and will use the custom schema for this table,
     *   // unless this table already has a configured schema.
     *   await db.table.find(123);
     * });
     * ```
     */
    $withOptions<Result>(options: StorageOptions, cb: () => Promise<Result>): Promise<Result>;
    $close(): Promise<void>;
}
export type OrchidOrmParam<Options> = true | null extends true ? 'Set strict: true to tsconfig' : Options;
export interface OrchidORMSetupOptions<V extends OrmTableThunks = OrmTableThunks> extends DbSharedOptions {
    /**
     * First-class regular views exposed under db.$views.
     */
    views?: V;
}
export declare const bundleOrchidORM: <T extends OrmTableThunks = EmptyObject, V extends OrmTableThunks = EmptyObject>({ tables, views, }: {
    tables?: T;
    views?: V;
}) => OrchidORMBundle<T, V>;
export declare const bundleOrchidORMTables: <T extends OrmTableThunks>(tables: T) => OrchidORMBundle<T, EmptyObject>;
export declare const makeOrchidOrmDbWithAdapter: <T extends OrmTableThunks, V extends OrmTableThunks>(orm: OrchidORMBundle<T, V>, options: OrchidOrmParam<({
    db: Query;
} | {
    adapter: Adapter;
}) & DbSharedOptions>) => OrchidORM<T, V>;
export declare const orchidORMWithAdapter: <T extends OrmTableThunks, V extends OrmTableThunks = EmptyObject>(options: OrchidOrmParam<({
    db: Query;
} | {
    adapter: Adapter;
}) & OrchidORMSetupOptions<V>>, tables: T) => OrchidORM<T, V>;
export {};
