import { PickQueryAs, PickQuerySelectable, PickQueryShape, PickQueryTable, PickQueryResult, PickQueryRelations, PickQueryReturnType } from './pick-query-types';
import { RecordUnknown } from '../utils';
import { IsQuery, QueryManyTake, QueryManyTakeOptional } from './query';
export interface RelationJoinQuery {
    (joiningQuery: IsQuery, baseQuery: IsQuery): IsQuery;
}
export interface RelationConfigQuery extends PickQueryResult, PickQuerySelectable, PickQueryShape, PickQueryTable, PickQueryAs, PickQueryRelations, PickQueryReturnType {
}
export interface RelationConfigBase extends IsQuery {
    returnsOne: boolean;
    required?: unknown;
    query: RelationConfigQuery;
    joinQuery: RelationJoinQuery;
    reverseJoin: RelationJoinQuery;
    params: unknown;
    queryRelated(params: unknown): unknown;
    modifyRelatedQuery?(relatedQuery: IsQuery): (query: IsQuery) => void;
    omitForeignKeyInCreate: PropertyKey;
    dataForUpdate: unknown;
    dataForUpdateOne: unknown;
    primaryKeys: string[];
}
export interface RelationConfigDataForCreate {
    columns: PropertyKey;
    nested: RecordUnknown;
}
export interface RelationsBase {
    [relationName: string]: RelationConfigBase;
}
export interface RelationsDataForCreateBase {
    [relationName: string]: unknown;
}
export interface RelationsDataForCreateOptionalBase {
    [relationName: string]: unknown;
}
export type RelationQueryMaybeSingle<T extends RelationConfigBase> = T['returnsOne'] extends true ? T['required'] extends true ? QueryManyTake<T['query']> : QueryManyTakeOptional<T['query']> : T['query'];
export declare const isRelationQuery: (q: IsQuery) => q is RelationConfigBase;
