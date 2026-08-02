import { Column } from '../../../columns/column';
import { HookPurpose } from '../../extra-features/hooks/hooks.sql';
import { IsQuery } from '../../query';
import { QueryAfterHook } from '../../query-data';
export interface HasCteHooks {
    cteHooks?: CteHooks;
}
export interface CteHooks {
    hasSelect?: boolean;
    tableHooks?: CteTableHooks;
    ensureCount?: EnsureCount;
}
export interface EnsureCount {
    [cteName: string]: EnsureCountItem;
}
export type EnsureCountItem = {
    count: number;
} | {
    jsonNotNull: string;
};
export interface CteTableHooks {
    [K: string]: CteTableHook;
}
export interface CteTableHook {
    table: string;
    shape: Column.Shape.Data;
    tableHook: TableHook;
    throwOnNotFound?: boolean;
}
export interface TableHook {
    hookPurpose?: HookPurpose;
    select?: HookSelect;
    afterCreate?: QueryAfterHook[];
    afterUpdate?: QueryAfterHook[];
    afterSave?: QueryAfterHook[];
    afterDelete?: QueryAfterHook[];
    afterCreateCommit?: QueryAfterHook[];
    afterUpdateCommit?: QueryAfterHook[];
    afterSaveCommit?: QueryAfterHook[];
    afterDeleteCommit?: QueryAfterHook[];
}
export type HookSelect = Map<string, HookSelectValue>;
export interface HookSelectValue {
    select: string | {
        sql: string;
    };
    as?: string;
    temp?: string;
    onAs?: ((as: string) => void)[];
    notLoaded?: boolean;
}
export interface HasTableHook {
    tableHook?: TableHook;
}
export interface HasHookSelect {
    hookSelect?: HookSelect;
}
export declare const _addToHookSelect: (query: IsQuery, selects: string[], notLoaded?: boolean) => void;
export declare const _addToHookSelectWithTable: (query: IsQuery, selects: string[], table: string) => void;
