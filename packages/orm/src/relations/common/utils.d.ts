import { CreateCtx, UpdateData, WhereArg, MaybeArray, RecordUnknown, RelationConfigBase, PickQuerySelectableRelations, UpdateSelf } from 'pqb/internal';
import { Query } from 'pqb';
import { HasOneNestedInsert, HasOneNestedUpdate } from '../hasOne';
import { HasManyNestedInsert, HasManyNestedUpdate } from '../hasMany';
import { ORMTableInput } from '../../orm-table/legacy-table';
import { RelationRefsOptions } from './options';
export interface NestedInsertOneItem {
    create?: NestedInsertOneItemCreate;
    connect?: NestedInsertOneItemConnect;
    connectOrCreate?: NestedInsertOneItemConnectOrCreate;
}
export type NestedInsertOneItemCreate = RecordUnknown;
export type NestedInsertOneItemConnect = RecordUnknown;
export interface NestedInsertOneItemConnectOrCreate {
    where: WhereArg<PickQuerySelectableRelations>;
    create: RecordUnknown;
}
export interface NestedInsertManyItems {
    create?: NestedInsertManyCreate;
    connect?: NestedInsertManyConnect;
    connectOrCreate?: NestedInsertManyConnectOrCreate;
}
export type NestedInsertManyCreate = RecordUnknown[];
export type NestedInsertManyConnect = WhereArg<PickQuerySelectableRelations>[];
export type NestedInsertManyConnectOrCreate = NestedInsertOneItemConnectOrCreate[];
export type NestedInsertItem = NestedInsertOneItem | NestedInsertManyItems;
export interface NestedUpdateOneItem {
    add?: MaybeArray<WhereArg<PickQuerySelectableRelations>>;
    disconnect?: boolean;
    set?: WhereArg<PickQuerySelectableRelations>;
    delete?: boolean;
    update?: UpdateData<UpdateSelf>;
    upsert?: {
        update: UpdateData<UpdateSelf>;
        create: RecordUnknown | (() => RecordUnknown);
    };
    create: RecordUnknown;
}
export interface NestedUpdateManyItems {
    add?: MaybeArray<WhereArg<PickQuerySelectableRelations>>;
    disconnect?: MaybeArray<WhereArg<PickQuerySelectableRelations>>;
    set?: MaybeArray<WhereArg<PickQuerySelectableRelations>>;
    delete?: MaybeArray<WhereArg<PickQuerySelectableRelations>>;
    update?: {
        where: MaybeArray<WhereArg<PickQuerySelectableRelations>>;
        data: UpdateData<UpdateSelf>;
    };
    create: RecordUnknown[];
    upsert?: {
        findBy: PickQuerySelectableRelations;
        update: UpdateData<UpdateSelf>;
        create?: RecordUnknown | (() => RecordUnknown);
    };
}
export type NestedUpdateItem = NestedUpdateOneItem | NestedUpdateManyItems;
interface NestedUpdateSingleRecordParams {
    set?: unknown;
    create?: unknown;
    upsert?: unknown;
}
interface NestedUpdateUpsert {
    update: UpdateData<UpdateSelf>;
    create?: RecordUnknown | (() => RecordUnknown);
}
export interface NestedUpdateRelationIds {
    existingRelQuery: Query;
    setIds: RecordUnknown;
    setAppendedAs: (as: string) => void;
}
export declare const throwIfQueryReturnsAllForNestedUpdate: (q: Query, params: NestedUpdateSingleRecordParams) => void;
export declare const makeNestedUpdateUpsertData: (upsert: NestedUpdateUpsert, setIds: RecordUnknown) => {
    update: UpdateData<UpdateSelf>;
    create: {};
};
export declare const getThroughRelation: (table: Query, through: string) => RelationConfigBase;
export declare const getSourceRelation: (throughRelation: RelationConfigBase, source: string) => RelationConfigBase;
export declare const hasRelationHandleCreate: (q: Query, ctx: CreateCtx, items: RecordUnknown[], rowIndexes: number[], key: string, primaryKeys: string[], nestedInsert: HasOneNestedInsert | HasManyNestedInsert) => void;
export declare const hasRelationHandleUpdate: (q: Query, set: RecordUnknown, key: string, primaryKeys: string[], nestedUpdate: HasOneNestedUpdate | HasManyNestedUpdate) => void;
export declare const _selectIfNotSelected: (q: Query, columns: string[]) => void;
export declare function joinHasThrough(q: Query, baseQuery: Query, joiningQuery: Query, throughRelation: RelationConfigBase, sourceRelation: RelationConfigBase): Query;
export declare function joinHasRelation(baseQuery: Query, joiningQuery: Query, primaryKeys: string[], foreignKeys: string[], len: number): Query;
export declare const addAutoForeignKey: (tableConfig: ORMTableInput, from: Query, to: Query, primaryKeys: string[], foreignKeys: string[], options: RelationRefsOptions<PropertyKey>, originalForeignKeys?: string[]) => void;
export declare const selectCteColumnsSql: (cteAs: string, columns: string[]) => string;
export declare const selectCteColumnSql: (cteAs: string, column: string) => string;
export declare const makeNestedUpdateRelationIds: (q: Query, relQuery: Query, primaryKeys: string[], foreignKeys: string[]) => NestedUpdateRelationIds;
export declare const selectCteColumnFromManySql: (cteAs: string, column: string, rowIndex: number, count: number) => string;
export {};
