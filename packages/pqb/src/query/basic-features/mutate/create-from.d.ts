import { Column } from '../../../columns/column';
import { CreateData, CreateDataOmit, CreateSelf } from './create';
import { SetQueryReturnsRowCount, SetQueryReturnsRowCountMany, IsQuery, SetQueryReturnsAll, SetQueryReturnsOne, SetQueryReturnsColumn, SetValueQueryReturnsPluckColumn } from '../../query';
import { QueryData } from '../../query-data';
import { SubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
export type CreateFromMethodNames = 'createOneFrom' | 'insertOneFrom' | CreateManyFromMethodNames;
export type CreateManyFromMethodNames = 'createManyFrom' | 'insertManyFrom' | 'createForEachFrom' | 'insertForEachFrom';
interface QueryReturningOne extends IsQuery {
    result: Column.QueryColumns;
    returnType: 'one' | 'oneOrThrow';
}
type CreateRawOrFromResult<T extends CreateSelf> = T extends {
    isCount: true;
} ? T : T['returnType'] extends undefined | 'all' ? SetQueryReturnsOne<T> : T['returnType'] extends 'pluck' ? SetQueryReturnsColumn<T> : T;
type InsertRawOrFromResult<T extends CreateSelf> = T['__hasSelect'] extends true ? T['returnType'] extends undefined | 'all' ? SetQueryReturnsOne<T> : T['returnType'] extends 'pluck' ? SetQueryReturnsColumn<T> : T : SetQueryReturnsRowCount<T>;
type CreateManyFromResult<T extends CreateSelf> = T extends {
    isCount: true;
} ? T : T['returnType'] extends 'one' | 'oneOrThrow' ? SetQueryReturnsAll<T> : T['returnType'] extends 'value' | 'valueOrThrow' ? SetValueQueryReturnsPluckColumn<T> : T;
type InsertManyFromResult<T extends CreateSelf> = T['__hasSelect'] extends true ? T['returnType'] extends 'one' | 'oneOrThrow' ? SetQueryReturnsAll<T> : T['returnType'] extends 'value' | 'valueOrThrow' ? SetValueQueryReturnsPluckColumn<T> : T : SetQueryReturnsRowCountMany<T>;
/**
 * Function to collect column names from the inner query of create `from` methods.
 *
 * @param q - the creating query
 * @param from - inner query to grab the columns from.
 * @param obj - optionally passed object with specific data, only available when creating a single record.
 * @param many - whether it's for `createForEachFrom`. If no, throws if the inner query returns multiple records.
 */
export declare const getFromSelectColumns: (q: CreateSelf, from: SubQueryForSql, obj?: {
    columns: string[];
    values: QueryData['values'];
}, many?: boolean) => {
    columns: string[];
    queryColumnsCount: number;
    values: unknown[][];
};
export declare const _queryCreateOneFrom: <T extends CreateSelf, Q extends QueryReturningOne>(q: T, query: Q, data?: Omit<CreateData<T>, keyof Q['result']>) => CreateRawOrFromResult<T>;
export declare const _queryInsertOneFrom: <T extends CreateSelf, Q extends QueryReturningOne>(q: T, query: Q, data?: Omit<CreateData<T>, keyof Q['result']>) => InsertRawOrFromResult<T>;
export declare const _queryCreateManyFrom: <T extends CreateSelf, Q extends QueryReturningOne>(q: T, query: Q, data: Omit<CreateData<T>, keyof Q['result']>[]) => CreateManyFromResult<T>;
export declare const _queryInsertManyFrom: <T extends CreateSelf, Q extends QueryReturningOne>(q: T, query: Q, data: Omit<CreateData<T>, keyof Q['result']>[]) => InsertManyFromResult<T>;
export declare const _queryCreateForEachFrom: <T extends CreateSelf>(q: T, query: IsQuery) => CreateManyFromResult<T>;
export declare const _queryInsertForEachFrom: <T extends CreateSelf>(q: T, query: IsQuery) => InsertManyFromResult<T>;
export declare class QueryCreateFrom {
    /**
     * Inserts a single record based on a query that selects a single record.
     *
     * Performs a single SQL query based on `INSERT ... SELECT ... FROM`.
     *
     * See {@link createManyFrom} to insert multiple records based on a single record query,
     * and {@link createForEachFrom} to insert a record per every one found by the query.
     *
     * The first argument is a query of a **single** record, it should have `find`, `take`, or similar.
     *
     * The second optional argument is a data which will be merged with columns returned by the query.
     *
     * The data for the second argument is the same as in {@link create}.
     *
     * Columns with runtime defaults (defined with a callback) are supported here.
     * The value for such a column will be injected unless selected from a related table or provided in a data object.
     *
     * ```ts
     * const oneRecord = await db.table.createOneFrom(
     *   db.relatedTable
     *     // use select to map columns from one table to another
     *     .select({
     *       // relatedTable's id will be inserted as "relatedId"
     *       relatedId: 'id',
     *     })
     *     .findBy({ key: 'value' }),
     *   // optional argument:
     *   {
     *     key: 'value',
     *     // supports sql, nested select, create, update, delete queries
     *     fromSql: () => sql`custom sql`,
     *     fromQuery: () => db.otherTable.find(id).update(data).get('column'),
     *     fromRelated: (q) => q.relatedTable.create(data).get('column'),
     *   },
     * );
     * ```
     *
     * The query above will produce such a SQL (omitting `from*` values):
     *
     * ```sql
     * INSERT INTO "table"("relatedId", "key")
     * SELECT "relatedTable"."id" AS "relatedId", 'value'
     * FROM "relatedTable"
     * WHERE "relatedTable"."key" = 'value'
     * LIMIT 1
     * RETURNING *
     * ```
     *
     * @param query - query to create new records from
     * @param data - additionally you can set some columns
     */
    createOneFrom<T extends CreateSelf, Q extends QueryReturningOne>(this: T, query: Q, data?: CreateDataOmit<T, Q['result'] extends never ? never : keyof Q['result']>): CreateRawOrFromResult<T>;
    /**
     * Works exactly as {@link createOneFrom}, except that it returns inserted row count by default.
     *
     * @param query - query to create new records from
     * @param data - additionally you can set some columns
     */
    insertOneFrom<T extends CreateSelf, Q extends QueryReturningOne>(this: T, query: Q, data?: CreateDataOmit<T, Q['result'] extends never ? never : keyof Q['result']>): InsertRawOrFromResult<T>;
    /**
     * Inserts multiple records based on a query that selects a single record.
     *
     * Performs a single SQL query based on `INSERT ... SELECT ... FROM`.
     *
     * See {@link createOneFrom} to insert a single record based on a single record query,
     * and {@link createForEachFrom} to insert a record per every one found by the query.
     *
     * The first argument is a query of a **single** record, it should have `find`, `take`, or similar.
     *
     * The second argument is array of objects to be merged with columns returned by the query.
     *
     * The data for the second argument is the same as in {@link createMany}.
     *
     * Columns with runtime defaults (defined with a callback) are supported here.
     * The value for such a column will be injected unless selected from a related table or provided in a data object.
     *
     * ```ts
     * const twoRecords = await db.table.createManyFrom(
     *   db.relatedTable
     *     // use select to map columns from one table to another
     *     .select({
     *       // relatedTable's id will be inserted as "relatedId"
     *       relatedId: 'id',
     *     })
     *     .findBy({ key: 'value' }),
     *   [
     *     {
     *       key: 'value 1',
     *       // supports sql, nested select, create, update, delete queries
     *       fromSql: () => sql`custom sql`,
     *       fromQuery: () => db.otherTable.find(id).update(data).get('column'),
     *       fromRelated: (q) => q.relatedTable.create(data).get('column'),
     *     },
     *     {
     *       key: 'value 2',
     *     },
     *   ],
     * );
     * ```
     *
     * The query above will produce such a SQL (omitting `from*` values):
     *
     * ```sql
     * WITH "relatedTable" AS (
     *   SELECT "relatedTable"."id" AS "relatedId", 'value'
     *   FROM "relatedTable"
     *   WHERE "relatedTable"."key" = 'value'
     *   LIMIT 1
     * )
     * INSERT INTO "table"("relatedId", "key")
     * SELECT "relatedTable".*, v."key"::text
     * FROM "relatedTable", (VALUES ('value1'), ('value2')) v("key")
     * RETURNING *
     * ```
     *
     * @param query - query to create new records from
     * @param data - array of records to create
     */
    createManyFrom<T extends CreateSelf, Q extends QueryReturningOne>(this: T, query: Q, data: CreateDataOmit<T, Q['result'] extends never ? never : keyof Q['result']>[]): CreateManyFromResult<T>;
    /**
     * Works exactly as {@link createManyFrom}, except that it returns inserted row count by default.
     *
     * @param query - query to create new records from
     * @param data - array of records to create
     */
    insertManyFrom<T extends CreateSelf, Q extends QueryReturningOne>(this: T, query: Q, data: CreateDataOmit<T, Q['result'] extends never ? never : keyof Q['result']>[]): InsertManyFromResult<T>;
    /**
     * Inserts a single record per every record found in a given query.
     *
     * Performs a single SQL query based on `INSERT ... SELECT ... FROM`.
     *
     * Unlike {@link createOneFrom}, it doesn't accept second argument with data.
     *
     * Runtime defaults cannot work with it.
     *
     * ```ts
     * const manyRecords = await db.table.createForEachFrom(
     *   db.relatedTable.select({ relatedId: 'id' }).where({ key: 'value' }),
     * );
     * ```
     *
     * @param query - query to create new records from
     */
    createForEachFrom<T extends CreateSelf>(this: T, query: IsQuery): CreateManyFromResult<T>;
    /**
     * Works exactly as {@link createForEachFrom}, except that it returns inserted row count by default.
     *
     * @param query - query to create new records from
     */
    insertForEachFrom<T extends CreateSelf>(this: T, query: IsQuery): InsertManyFromResult<T>;
}
export {};
