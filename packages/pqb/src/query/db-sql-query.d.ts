import { QueryBuilder } from './db';
import { QueryData } from './query-data';
import { RawSqlBase } from './expressions/raw-sql';
import { TemplateLiteralArgs } from './expressions/expression';
import { Adapter, QueryResult, QueryResultRow } from '../adapters/adapter';
import { RecordUnknown } from '../utils';
import { QueryInternal } from './query-internal';
export type SQLQueryArgs = TemplateLiteralArgs | [RawSqlBase];
export interface DbSqlQuery {
    <T extends QueryResultRow = QueryResultRow>(...args: SQLQueryArgs): Promise<QueryResult<T>>;
    /**
     * Returns an array of records:
     *
     * ```ts
     * const array: T[] = await db.$query.records<T>`SELECT * FROM table`;
     * ```
     */
    records<T extends RecordUnknown = RecordUnknown>(...args: SQLQueryArgs): Promise<T[]>;
    /**
     * Returns a single record, throws [NotFoundError](/guide/error-handling) if not found.
     *
     * ```ts
     * const one: T = await db.$query.take<T>`SELECT * FROM table LIMIT 1`;
     * ```
     */
    take<T extends RecordUnknown = RecordUnknown>(...args: SQLQueryArgs): Promise<T>;
    /**
     * Returns a single record or `undefined` when not found.
     *
     * ```ts
     * const maybeOne: T | undefined = await db.$query
     *   .takeOptional<T>`SELECT * FROM table LIMIT 1`;
     * ```
     */
    takeOptional<T extends RecordUnknown = RecordUnknown>(...args: SQLQueryArgs): Promise<T | undefined>;
    /**
     * Returns array of tuples of the values:
     *
     * ```ts
     * const arrayOfTuples: [number, string][] = await db.$query.rows<
     *   [number, string]
     * >`SELECT id, name FROM table`;
     * ```
     */
    rows<T extends unknown[]>(...args: SQLQueryArgs): Promise<T[]>;
    /**
     * Returns a flat array of values for a single column:
     *
     * ```ts
     * const strings: string[] = await db.$query.pluck<string>`SELECT name FROM table`;
     * ```
     */
    pluck<T>(...args: SQLQueryArgs): Promise<T[]>;
    /**
     * Returns a single value, throws [NotFoundError](/guide/error-handling) if not found.
     *
     * ```ts
     * const value: number = await db.$query.get<number>`SELECT 1`;
     * ```
     */
    get<T>(...args: SQLQueryArgs): Promise<T>;
    /**
     * Returns a single value or `undefined` when not found.
     *
     * ```ts
     * const value: number | undefined = await db.$query.getOptional<number>`SELECT 1`;
     * ```
     */
    getOptional<T>(...args: SQLQueryArgs): Promise<T | undefined>;
}
export declare const performQuery: <Result = QueryResult>(q: {
    qb: QueryBuilder;
    internal: QueryInternal;
    adapterNotInTransaction: Adapter;
    q: QueryData;
}, args: SQLQueryArgs, method: 'query' | 'arrays') => Promise<Result>;
