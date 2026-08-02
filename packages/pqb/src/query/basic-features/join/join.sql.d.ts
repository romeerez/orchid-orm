import { IsQuery } from '../../query';
import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { JoinedShapes, QueryData } from '../../query-data';
import { Column } from '../../../columns/column';
import { Expression } from '../../expressions/expression';
import { RecordString, RecordUnknown } from '../../../utils';
import { SubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
import { ColumnsShape } from '../../../columns';
export type SimpleJoinItemNonSubQueryArgs = [{
    [K: string]: string | Expression;
} | Expression | true] | [leftColumn: string | Expression, rightColumn: string | Expression] | [
    leftColumn: string | Expression,
    op: string,
    rightColumn: string | Expression
];
export type JoinItemArgs = {
    u?: true;
    c?: Column.QueryColumns;
    l: SubQueryForSql;
    a: string;
    i?: boolean;
} | {
    u?: true;
    c?: Column.QueryColumns;
    j: IsQuery;
    s: boolean;
    r?: IsQuery;
} | {
    u?: true;
    c?: Column.QueryColumns;
    w: string;
    r: IsQuery;
    s: boolean;
} | {
    u?: true;
    c?: Column.QueryColumns;
    w: string;
    a: SimpleJoinItemNonSubQueryArgs;
} | {
    u?: true;
    c?: Column.QueryColumns;
    q: IsQuery;
    s: boolean;
} | {
    u?: true;
    c?: Column.QueryColumns;
    q: IsQuery;
    r: IsQuery;
    s: boolean;
} | {
    u?: true;
    c?: Column.QueryColumns;
    q: IsQuery;
    a: SimpleJoinItemNonSubQueryArgs;
    s: boolean;
} | {
    u?: true;
    c: Column.Shape.Data;
    a: string;
    d: RecordUnknown[];
};
export interface JoinItem {
    type: string;
    args: JoinItemArgs;
}
interface SqlJoinItem {
    target: string;
    on?: string;
}
export declare const processJoinItem: (ctx: ToSQLCtx, table: ToSQLQuery, query: {
    selectShape: ColumnsShape;
    joinedShapes?: JoinedShapes;
    as?: string;
    outerAliases?: RecordString;
    aliases?: RecordString;
}, args: JoinItemArgs, quotedAs: string | undefined) => SqlJoinItem;
export declare const pushJoinSql: (ctx: ToSQLCtx, table: ToSQLQuery, query: QueryData & {
    join: JoinItem[];
}, quotedAs?: string) => void;
export {};
