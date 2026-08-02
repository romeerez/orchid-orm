import { IsQuery, SetQueryReturnsColumnOrThrow } from '../query/query';
import { Column } from './column';
import { MoveMutativeQueryToCte } from '../query/basic-features/cte/cte.sql';
import { PrepareSubQueryForSql } from '../query/internal-features/sub-query/sub-query-for-sql';
import { Db } from '../query/db';
import { PickQueryColumTypes, PickQueryResult, PickQueryResultColumnTypes } from '../query/pick-query-types';
import { MaybeArray, RecordUnknown } from '../utils';
import { Expression } from '../query/expressions/expression';
import { BooleanQueryColumn } from '../query/basic-features/aggregate/aggregate';
import { QueryThen } from '../query';
export declare const setMoveMutativeQueryToCte: (fn: MoveMutativeQueryToCte) => void;
export declare const setPrepareSubQueryForSql: (fn: PrepareSubQueryForSql) => void;
export declare const setDb: (db: typeof Db) => void;
/**
 * Function to turn the operator expression into SQL.
 *
 * @param key - SQL of the target to apply operator for, can be a quoted column name or an SQL expression wrapped with parens.
 * @param args - arguments of operator function.
 * @param ctx - context object for SQL conversions, for collecting query variables.
 * @param quotedAs - quoted table name.
 */
export interface OperatorToSQL {
    (key: string, args: [unknown], ctx: unknown, quotedAs?: string): string;
}
export interface Operator<Value, Column extends Column.Pick.OutputTypeAndOperators = Column.Pick.OutputTypeAndOperators> {
    <T extends PickQueryResult>(this: T, arg: Value): {
        [K in Exclude<keyof T, keyof T['result']['value']['operators']>]: K extends 'result' ? {
            value: Column;
        } : K extends 'returnType' ? 'valueOrThrow' : K extends 'then' ? QueryThen<Column['__outputType']> : T[K];
    } & Column['operators'];
    _opType: Value;
}
export declare function setQueryOperators(query: IsQuery, operators: RecordUnknown): IsQuery;
export declare const prepareOpArg: (q: unknown, arg: unknown) => import("../query").SubQueryForSql | undefined;
interface Base<Value> {
    __hasSelect: true;
    equals: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
    not: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
    isDistinctFrom: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
    isNotDistinctFrom: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
    in: Operator<Value[] | IsQuery | Expression, BooleanQueryColumn>;
    notIn: Operator<Value[] | IsQuery | Expression, BooleanQueryColumn>;
}
interface OperatorsBooleanSelf extends OperatorsBoolean {
    result: {
        value: BooleanQueryColumn;
    };
}
export interface Ord<Value> extends Base<Value> {
    lt: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
    lte: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
    gt: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
    gte: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
    between: Operator<[
        Value | IsQuery | Expression,
        Value | IsQuery | Expression
    ], BooleanQueryColumn>;
}
export type OperatorsNumber = Ord<number>;
export interface OperatorsBoolean extends Ord<boolean> {
    and: Operator<OperatorsBooleanSelf, BooleanQueryColumn>;
    or: Operator<OperatorsBooleanSelf, BooleanQueryColumn>;
}
export interface OperatorsText extends Base<string> {
    contains: Operator<string | IsQuery | Expression, BooleanQueryColumn>;
    containsSensitive: Operator<string | IsQuery | Expression, BooleanQueryColumn>;
    startsWith: Operator<string | IsQuery | Expression, BooleanQueryColumn>;
    startsWithSensitive: Operator<string | IsQuery | Expression, BooleanQueryColumn>;
    endsWith: Operator<string | IsQuery | Expression, BooleanQueryColumn>;
    endsWithSensitive: Operator<string | IsQuery | Expression, BooleanQueryColumn>;
}
export interface OperatorsOrdinalText extends Ord<string>, OperatorsText {
}
interface JsonPathQueryOptions {
    vars?: RecordUnknown;
    silent?: boolean;
}
interface JsonPathQueryTypeOptions<T extends PickQueryColumTypes, C extends Column.Pick.QueryColumn> extends JsonPathQueryOptions {
    type?: (types: T['columnTypes']) => C;
}
interface JsonPathQuery {
    /**
     * Selects a value from JSON data using a JSON path.
     *
     * Calls the [jsonb_path_query_first](https://www.postgresql.org/docs/current/functions-json.html) Postgres function.
     *
     * Type can be provided via `{ type: (t) => t.columnType() }` options, by default the type is `unknown`.
     *
     * Optionally takes `vars` and `silent` parameters, see [Postgres docs](https://www.postgresql.org/docs/current/functions-json.html) for details.
     *
     * The `type` option sets the output type when selecting a value,
     * also it makes specific operators available in `where`, so that you can apply `contains` if the type is text, and `gt` if the type is numeric.
     *
     * ```ts
     * // query a single value from a JSON data,
     * // because of the provided type, string JSON value will be parsed to a Date object.
     * const value = await db.table
     *   .get('data')
     *   .jsonPathQueryFirst('$.path.to.date', { type: (t) => t.date().asDate() });
     *
     * // using it in a select
     * const records = await db.table.select({
     *   date: (q) =>
     *     q.get('data').jsonPathQueryFirst('$[*] ? (@ = key)', {
     *       type: (t) => t.integer(),
     *       // defining `vars` and `silent`
     *       vars: { key: 'key' },
     *       silent: true,
     *     }),
     * });
     *
     * // using it in `where`
     * const filtered = await db.table.where((q) =>
     *   // filtering records by the `name` property from the `data` JSON column
     *   q.get('data').jsonPathQueryFirst('$.name').equals('name'),
     * );
     *
     * // using it in update
     * await db.table.find(id).update({
     *   // using data property to set the `name` column
     *   name: (q) =>
     *     q.get('data').jsonPathQueryFirst('$.name', { type: (t) => t.string() }),
     * });
     *
     * // filtering records to contain 'word' in the json property "name"
     * await db.table.where((q) =>
     *   q
     *     .get('data')
     *     .jsonPathQueryFirst('$.name', { type: (t) => t.string() })
     *     .contains('word'),
     * );
     * ```
     *
     * @param path - JSON path
     * @param options - can have type, vars, silent
     */
    <T extends PickQueryResultColumnTypes, C extends Column.Pick.QueryColumn = Column.Pick.QueryColumnOfTypeAndOps<string, unknown, OperatorsAny>>(this: T, path: string, options?: JsonPathQueryTypeOptions<T, C>): Omit<SetQueryReturnsColumnOrThrow<T, C>, keyof T['result']['value']['operators']> & C['operators'];
    _opType: never;
}
export interface OperatorsJson extends Ord<unknown> {
    jsonPathQueryFirst: JsonPathQuery;
    jsonSupersetOf: Operator<unknown | IsQuery | Expression, BooleanQueryColumn>;
    jsonSubsetOf: Operator<unknown | IsQuery | Expression, BooleanQueryColumn>;
    jsonSet: {
        /**
         * Returns a JSON value/object/array where a given value is set at the given path.
         * The path is a key or an array of keys to access the value.
         *
         * Calls the [jsonb_set](https://www.postgresql.org/docs/current/functions-json.html) Postgres function.
         *
         * It can be used in all contexts on a single JSON value.
         *
         * ```ts
         * await db.table.find(id).update({
         *   data: (q) => q.get('data').jsonSet(['path', 'to', 'value'], 'new value'),
         *   // supports sql for the value
         *   data: (q) => q.get('data').jsonSet(['path', 'to', 'value'], sql`'new value'`),
         * });
         * ```
         *
         * @param path - key or array of keys
         * @param value - value to set
         */
        <T extends PickQueryResult>(this: T, path: MaybeArray<string | number>, value: unknown): T;
        _opType: never;
    };
    jsonReplace: {
        /**
         * The same as {@link jsonSet}, but sets the last argument of `jsonb_set` to false,
         * so this function only has effect when the value already existed in the JSON.
         *
         * ```ts
         * await db.table.find(id).update({
         *   // data.path.to.value will be updated only if it already was defined
         *   data: (q) => q.get('data').jsonReplace(['path', 'to', 'value'], 'new value'),
         *   // supports sql for the value
         *   data: (q) =>
         *     q.get('data').jsonReplace(['path', 'to', 'value'], sql`'new value'`),
         * });
         * ```
         *
         * @param path - key or array of keys
         * @param value - value to set
         */
        <T extends PickQueryResult>(this: T, path: MaybeArray<string | number>, value: unknown): T;
        _opType: never;
    };
    jsonInsert: {
        /**
         * Inserts a value into a given position of JSON array and returns the whole array.
         * The path is a key or an array of keys to access the value.
         *
         * If a value exists at the given path, the value is not replaced.
         *
         * Provide `{ after: true }` option to insert a value after a given position.
         *
         * Calls the [jsonb_insert](https://www.postgresql.org/docs/current/functions-json.html) Postgres function.
         *
         * It can be used in all contexts on a single JSON value.
         *
         * ```ts
         * // update the record with data { tags: ['two'] } to have data { tags: ['one', 'two'] }
         * await db.table.find(id).update({
         *   data: (q) => q.get('data').jsonInsert(['tags', 0], 'one'),
         *   // supports sql for the value
         *   data: (q) => q.get('data').jsonInsert(['tags', 0], sql`'one'`),
         * });
         *
         * // add 'three' after 'two'
         * await db.table.find(id).update({
         *   data: (q) => q.get('data').jsonInsert(['tags', 1], 'three', { after: true }),
         * });
         * ```
         *
         * @param path - key or array of keys
         * @param value - value to insert
         * @param options - can have `after: true`
         */
        <T extends PickQueryResult>(this: T, path: MaybeArray<string | number>, value: unknown, options?: {
            after?: boolean;
        }): T;
        _opType: never;
    };
    jsonRemove: {
        /**
         * Remove a value from a JSON object or array at a given path.
         * The path is a key or an array of keys to access the value.
         *
         * Uses the [#-](https://www.postgresql.org/docs/current/functions-json.html) Postgres operator.
         *
         * It can be used in all contexts on a single JSON value.
         *
         * ```ts
         * // the record has data { tags: ['one', 'two'] }
         * // removing the first tag, the data will be { tags: ['two'] }
         * const result = await db.table.find(id).update({
         *   data: (q) => q.get('data').jsonRemove(['tags', 0]),
         * });
         * ```
         *
         * @param path - key or array of keys
         */
        <T extends PickQueryResult>(this: T, path: MaybeArray<string | number>): T;
        _opType: never;
    };
}
export type OperatorsAny = Base<any>;
export type OperatorsDate = Ord<Date | string>;
export type OperatorsTime = Ord<string>;
export interface OperatorsArray<T> extends Ord<T[]> {
    has: Operator<T | IsQuery | Expression, BooleanQueryColumn>;
    hasEvery: Operator<T[] | IsQuery | Expression, BooleanQueryColumn>;
    hasSome: Operator<T[] | IsQuery | Expression, BooleanQueryColumn>;
    containedIn: Operator<T[] | IsQuery | Expression, BooleanQueryColumn>;
    length: {
        _opType: number | {
            [K in Exclude<keyof OperatorsNumber, '__hasSelect'>]?: OperatorsNumber[K]['_opType'];
        };
    };
}
export declare const Operators: {
    any: OperatorsAny;
    ordinalText: OperatorsOrdinalText;
    boolean: OperatorsBoolean;
    number: OperatorsNumber;
    date: OperatorsDate;
    time: OperatorsTime;
    text: OperatorsText;
    json: OperatorsJson;
    array: OperatorsArray<unknown>;
};
export {};
