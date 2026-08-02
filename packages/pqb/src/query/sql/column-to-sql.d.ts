import { JoinedShapes, QueryData } from '../query-data';
import { ToSQLCtx } from './to-sql';
import { Column } from '../../columns/column';
import { RecordString } from '../../utils';
import { ColumnsParsers } from '../query-columns/query-column-parsers';
import { SelectableOrExpression } from '../expressions/expression';
import { SelectItem } from '../basic-features/select/select.sql';
export declare function simpleColumnToSQL(ctx: ToSQLCtx, queryData: {
    valuesJoinedAs?: RecordString;
    select?: SelectItem[];
    joinedShapes?: JoinedShapes;
    getColumn?: Column;
}, shape: Column.QueryColumns, key: string, column?: Column.Pick.QueryColumn, quotedAs?: string, select?: true, as?: string, jsonList?: {
    [K: string]: Column.Pick.Data | undefined;
}, useSelectList?: true, skipSelectSql?: true, skipValueToArray?: true): string;
export declare const tableColumnToSql: (ctx: ToSQLCtx, queryData: {
    valuesJoinedAs?: RecordString;
    aliases?: RecordString;
    joinedShapes?: QueryData['joinedShapes'];
    parsers?: ColumnsParsers;
    select?: SelectItem[];
    getColumn?: Column;
}, shape: Column.QueryColumns, table: string, key: string, quotedAs?: string, select?: true, as?: string, jsonList?: {
    [K: string]: Column.Pick.Data | undefined;
}, skipValueToArray?: true) => string;
export declare const columnToSqlNotSelect: (ctx: ToSQLCtx, data: {
    valuesJoinedAs?: RecordString;
    aliases?: RecordString;
    joinedShapes?: QueryData['joinedShapes'];
    parsers?: ColumnsParsers;
    select?: SelectItem[];
}, shape: Column.QueryColumns, column: string, quotedAs?: string, useSelectList?: true) => string;
export declare const columnToSql: (ctx: ToSQLCtx, data: {
    valuesJoinedAs?: RecordString;
    aliases?: RecordString;
    joinedShapes?: QueryData['joinedShapes'];
    parsers?: ColumnsParsers;
    select?: SelectItem[];
}, shape: Column.QueryColumns, column: string, quotedAs?: string, select?: true, as?: string, jsonList?: {
    [K: string]: Column.Pick.Data | undefined;
}, useSelectList?: true, skipValueToArray?: true) => string;
export declare const rawOrColumnToSql: (ctx: ToSQLCtx, data: {
    joinedShapes?: JoinedShapes;
    select?: SelectItem[];
}, shape: Column.QueryColumns, expr: SelectableOrExpression, quotedAs: string | undefined, select?: true, skipValueToArray?: true) => string;
