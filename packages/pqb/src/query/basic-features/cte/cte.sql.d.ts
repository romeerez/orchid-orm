import { RecordUnknown } from '../../../utils';
import { Expression } from '../../expressions/expression';
import { ToSQLCtx } from '../../sql/to-sql';
import { QueryData, WithItems } from '../../query-data';
import { Column } from '../../../columns';
import { SubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
import { SingleSql, SingleSqlItem } from '../../sql/sql';
export interface WithDataItem {
    table: string;
    shape: Column.QueryColumns;
}
export interface WithDataItems {
    [K: string]: WithDataItem;
}
export interface CteItem {
    n: string | ((as: string) => void);
    o?: CteOptions;
    q?: SubQueryForSql;
    s?: Expression;
    p?: boolean;
}
export interface CteOptions {
    columns?: string[];
    recursive?: true;
    materialized?: true;
    notMaterialized?: true;
}
export interface TopCTE {
    names: RecordUnknown;
    stack: string[][];
    append: string[][];
}
export declare const getTopCteSize: ({ topCtx: { topCTE }, }: ToSQLCtx) => number | undefined;
export declare const setTopCteSize: ({ topCtx }: ToSQLCtx, size?: number) => void;
export declare const ctesToSql: (ctx: ToSQLCtx, ctes?: WithItems) => void;
export declare const cteToSqlGiveAs: (ctx: ToSQLCtx, item: CteItem, type: QueryData['type'], dontAddTableHook?: boolean) => {
    as: string;
    sql: string;
};
export declare const cteToSql: (ctx: ToSQLCtx, item: CteItem, type: QueryData['type'], dontAddTableHook?: boolean) => string;
export declare const setFreeTopCteAs: (ctx: ToSQLCtx) => string;
export declare const addTopCteSql: (ctx: ToSQLCtx, as: string | undefined, sql: string) => string;
export declare const addTopCte: (place: 'before' | 'after', ctx: ToSQLCtx, q: SubQueryForSql, type: QueryData['type'], as?: string | ((as: string) => void), dontAddTableHook?: boolean) => string;
export declare const addWithToSql: (ctx: ToSQLCtx, sql: SingleSql, isSubSql?: boolean) => void;
export declare const composeCteSingleSql: (ctx: ToSQLCtx) => SingleSqlItem;
export interface MoveMutativeQueryToCte {
    (ctx: ToSQLCtx, query: SubQueryForSql): string;
}
export declare const moveMutativeQueryToCte: MoveMutativeQueryToCte;
