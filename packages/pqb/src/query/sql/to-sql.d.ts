import { IsQuery, Query } from '../query';
import { QueryData, QueryType } from '../query-data';
import { QueryBuilder } from '../db';
import { TopCTE } from '../basic-features/cte/cte.sql';
import { QueryInternal } from '../query-internal';
import { Sql } from '../sql/sql';
import { HasCteHooks, TableHook } from '../basic-features/select/hook-select';
import { MutativeQueriesSelectRelationsSqlState } from '../internal-features/mutative-queries-select-relation/mutative-queries-select-relations.sql';
interface ToSqlOptionsInternal {
    hasNonSelect?: boolean;
    aliasValue?: true;
    skipBatchCheck?: true;
    selectedCount?: number;
    selectList?: string[];
}
export interface ToSqlValues {
    values: unknown[];
}
export interface TopToSqlCtx extends ToSqlOptionsInternal, HasCteHooks, ToSqlValues {
    topCtx: TopToSqlCtx;
    topCTE?: TopCTE;
    tableHook?: TableHook;
    mutativeQueriesSelectRelationsSqlState?: MutativeQueriesSelectRelationsSqlState;
    cteHookTopNullSelectAppended?: boolean;
}
export interface ToSQLCtx extends ToSqlOptionsInternal, ToSqlValues {
    topCtx: TopToSqlCtx;
    qb: QueryBuilder;
    q: QueryData;
    sql: string[];
    selectedCount: number;
    cteName?: string;
    wrapAs?: string;
}
export interface ToSQLQuery extends IsQuery {
    __isQuery: Query['__isQuery'];
    q: Query['q'];
    qb: Query['qb'];
    table?: Query['table'];
    internal: QueryInternal;
    relations: Query['relations'];
    withData: Query['withData'];
    clone: Query['clone'];
    baseQuery: Query['baseQuery'];
    returnType: Query['returnType'];
    result: Query['result'];
    shape: Query['shape'];
}
export interface ToSql {
    (table: ToSQLQuery, type: QueryType, topCtx?: TopToSqlCtx, isSubSql?: boolean, cteName?: string, calledByThen?: boolean, dontAddTableHook?: boolean): Sql;
}
export declare const newToSqlCtx: (query: ToSQLQuery) => ToSQLCtx;
export declare const toSql: ToSql;
export {};
