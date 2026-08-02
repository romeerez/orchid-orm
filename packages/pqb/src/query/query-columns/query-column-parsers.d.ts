import { FnUnknownToUnknown, MaybePromise } from '../../utils';
import { HookSelect } from '../basic-features/select/hook-select';
import { Query, QueryReturnType } from '../query';
import { Column } from '../../columns';
import { PickQueryQ } from '../pick-query-types';
import { Expression } from '../expressions/expression';
export interface PickQueryDataParsers {
    defaultParsers?: ColumnsParsers;
    parsers?: ColumnsParsers;
    batchParsers?: BatchParsers;
}
export type ColumnParser = FnUnknownToUnknown;
export interface BatchParserPathEntry {
    key: string;
    returnType: QueryReturnType;
}
export interface BatchParser {
    path: BatchParserPathEntry[];
    fn: (path: BatchParserPathEntry[], queryResult: {
        rows: unknown[];
    }) => MaybePromise<void>;
}
export type ColumnsParsers = {
    [K in string]?: ColumnParser;
};
export type BatchParsers = BatchParser[];
/**
 * generic utility to add a parser to the query object
 * @param query - the query object, it will be mutated
 * @param key - the name of the column in the data loaded by the query
 * @param parser - function to process the value of the column with.
 */
export declare const setParserToQuery: (query: {
    parsers?: ColumnsParsers;
}, key: string, parser?: ColumnParser) => void;
/**
 * similar to setParserToQuery,
 * but if the parser for the column is already set,
 * this will wrap it with HOC to additionally parse with a provided function
 * @param query - the query object, it will be mutated
 * @param key - the name of the column in the data loaded by the query
 * @param parser - function to process the value of the column with.
 */
export declare const overrideParserInQuery: (query: {
    parsers?: ColumnsParsers;
}, key: string, parser: ColumnParser) => void;
export declare const getQueryParsers: (q: Query, hookSelect?: HookSelect) => ColumnsParsers | undefined;
export declare const addColumnParserToQuery: (q: {
    parsers?: ColumnsParsers;
}, key: string, column: Column.Pick.QueryColumn) => void;
export declare const setValueParserToQuery: (q: {
    parsers?: ColumnsParsers;
}, column: Column.Pick.QueryColumn) => void;
export declare const getValueParser: (parsers?: ColumnsParsers) => FnUnknownToUnknown | undefined;
export declare const setValueParser: (q: PickQueryDataParsers, parser: ColumnParser | undefined) => void;
export declare const addParserForRawExpression: (q: PickQueryQ, key: string, raw: Expression) => void;
