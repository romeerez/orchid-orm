import { IsQuery } from '../../query';
import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { JoinItem } from '../../basic-features/join/join.sql';
import { RecordString } from '../../../utils';
export interface MutativeQueriesSelectRelationsQueryData {
    selectRelation?: true;
}
export interface MutativeQueriesSelectRelationsSqlProp {
    mutativeQueriesSelectRelationsState?: MutativeQueriesSelectRelationsSqlState;
}
export interface MutativeQueriesSelectRelationsSqlState {
    query: IsQuery;
    value?: MutativeQueriesSelectRelationsValue;
}
export interface MutativeQueriesSelectRelationsValue {
    [K: string]: IsQuery;
}
export declare const newMutativeQueriesSelectRelationsSqlState: (query: ToSQLQuery) => MutativeQueriesSelectRelationsSqlState | undefined;
export declare const setMutativeQueriesSelectRelationsSqlState: (d: MutativeQueriesSelectRelationsSqlState, as: string, rel: IsQuery) => void;
export declare const handleInsertAndUpdateSelectRelationsSqlState: (ctx: ToSQLCtx, state: MutativeQueriesSelectRelationsSqlState | undefined) => void;
export declare const unsetValuesJoinedAsForMutativeSelectRelations: (query: ToSQLQuery) => RecordString | undefined;
export declare const restoreValuesJoinedAsForMutativeSelectRelations: (query: ToSQLQuery, valuesJoinedAs: RecordString | undefined) => void;
export declare const handleDeleteSelectRelationsSqlState: (ctx: ToSQLCtx, query: ToSQLQuery, relationSelectState: MutativeQueriesSelectRelationsSqlState | undefined) => {
    join: JoinItem;
    joinedShape: string;
    movedWhereToCte: boolean;
    addReturning: string;
} | undefined;
export declare const setMutativeQueriesSelectRelationsStateOnSql: (ctx: ToSQLCtx, sql: MutativeQueriesSelectRelationsSqlProp) => void;
