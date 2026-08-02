import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { QueryData, SelectAllColumn } from '../../query-data';
import { Column } from '../../../columns/column';
import { HookSelect } from './hook-select';
import { RecordUnknown } from '../../../utils';
import { ColumnsParsers } from '../../query-columns/query-column-parsers';
import { Expression } from '../../expressions/expression';
import { Query } from '../../query';
import { MutativeQueriesSelectRelationsSqlState } from '../../internal-features/mutative-queries-select-relation/mutative-queries-select-relations.sql';
export type SelectItem = string | SelectAs | Expression | undefined;
export interface SelectAs {
    selectAs: SelectAsValue;
}
export interface SelectAsValue {
    [K: string]: string | Query | Expression | undefined;
}
export declare const setSqlCtxSelectList: (ctx: ToSQLCtx, table: ToSQLQuery, query: {
    selectShape: Column.QueryColumns;
    hookSelect?: HookSelect;
    selectCache?: QueryData['selectCache'];
    returnType?: QueryData['returnType'];
}, quotedAs?: string, isSubSql?: boolean, aliases?: string[]) => void;
export declare const selectToSqlList: (ctx: ToSQLCtx, table: ToSQLQuery, query: {
    select?: QueryData['select'];
    selectAllColumns?: SelectAllColumn[];
    selectAllShape?: RecordUnknown;
    join?: QueryData['join'];
    hookSelect?: HookSelect;
    selectShape: Column.QueryColumns;
    parsers?: ColumnsParsers;
    joinedShapes?: QueryData['joinedShapes'];
    returnType?: QueryData['returnType'];
    getColumn?: Column;
}, quotedAs: string | undefined, hookSelect?: HookSelect | undefined, isSubSql?: boolean, aliases?: string[], jsonList?: {
    [K: string]: Column.Pick.Data | undefined;
}, delayedRelationSelect?: MutativeQueriesSelectRelationsSqlState) => string[];
export declare const selectToSql: (ctx: ToSQLCtx, table: ToSQLQuery, query: {
    select?: QueryData['select'];
    selectAllColumns?: SelectAllColumn[];
    selectAllShape?: RecordUnknown;
    join?: QueryData['join'];
    hookSelect?: HookSelect;
    selectShape: Column.QueryColumns;
    parsers?: ColumnsParsers;
    joinedShapes?: QueryData['joinedShapes'];
    returnType?: QueryData['returnType'];
}, quotedAs: string | undefined, hookSelect?: HookSelect | undefined, isSubSql?: boolean, aliases?: string[], jsonList?: {
    [K: string]: Column.Pick.Data | undefined;
}, delayedRelationSelect?: MutativeQueriesSelectRelationsSqlState) => string;
export declare const selectAllSql: (q: {
    updateFrom?: unknown;
    updateMany?: unknown;
    join?: QueryData['join'];
    selectAllColumns?: SelectAllColumn[];
    selectAllShape?: RecordUnknown;
    selectShape: Column.QueryColumns;
}, quotedAs?: string, columnsCount?: number, ctx?: ToSQLCtx) => string[];
