import { Query } from '../../query';
import { JoinItemArgs } from '../join/join.sql';
import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { QueryData, QueryScopeData } from '../../query-data';
import { SubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
import { QueryDataAliases } from '../as/as';
import { ColumnsParsers } from '../../query-columns/query-column-parsers';
import { Expression } from '../../expressions/expression';
import { MaybeArray, RecordString } from '../../../utils';
import { WhereSearchItem } from '../../extra-features/search/search.sql';
export type WhereItem = {
    [K: string]: unknown | {
        [K: string]: unknown | SubQueryForSql | Expression;
    } | Expression;
    NOT?: MaybeArray<WhereItem>;
    AND?: MaybeArray<WhereItem>;
    OR?: MaybeArray<WhereItem>[];
    IN?: MaybeArray<WhereInItem>;
    EXISTS?: MaybeArray<JoinItemArgs>;
    ON?: WhereOnItem | WhereJsonPathEqualsItem;
    SEARCH?: MaybeArray<WhereSearchItem>;
} | Query | Expression;
export interface WhereInItem {
    columns: string[];
    values: unknown[][] | SubQueryForSql | Expression;
}
export type WhereJsonPathEqualsItem = [
    leftColumn: string,
    leftPath: string,
    rightColumn: string,
    rightPath: string
];
export interface WhereOnItem {
    joinFrom: WhereOnJoinItem;
    from: string;
    joinTo: WhereOnJoinItem;
    to: string;
    useOuterAliases?: true;
    op?: string;
}
export type WhereOnJoinItem = {
    table?: string;
    q: {
        as?: string;
    };
} | string;
interface QueryDataForWhere extends QueryDataAliases {
    and?: QueryData['and'];
    or?: QueryData['or'];
    selectShape: QueryData['selectShape'];
    joinedShapes?: QueryData['joinedShapes'];
    scopes?: {
        [K: string]: QueryScopeData;
    };
    outerAliases?: QueryData['outerAliases'];
    parsers?: ColumnsParsers;
    valuesJoinedAs?: RecordString;
}
export declare const pushWhereStatementSql: (ctx: ToSQLCtx, table: ToSQLQuery, query: QueryDataForWhere, quotedAs?: string, checkIfHasExplicitWhere?: {
    value?: boolean;
}) => void;
export declare const pushWhereToSql: (sql: string[], ctx: ToSQLCtx, table: Query, query: QueryDataForWhere, quotedAs?: string, parens?: boolean) => void;
export declare const whereToSql: (ctx: ToSQLCtx, table: ToSQLQuery, query: QueryDataForWhere, quotedAs?: string, parens?: boolean, checkIfHasExplicitWhere?: {
    value?: boolean;
}) => string | undefined;
export {};
