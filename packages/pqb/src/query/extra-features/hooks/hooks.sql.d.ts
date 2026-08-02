import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { CteHooks, EnsureCountItem, HookSelect } from '../../basic-features/select/hook-select';
import { QueryData } from '../../query-data';
export type HookPurpose = 'Create' | 'Update' | 'Delete';
export declare const addTableHook: (ctx: ToSQLCtx, q: ToSQLQuery, data: QueryData, select?: HookSelect, hookPurpose?: HookPurpose, dontAddTableHook?: boolean) => void;
export declare const setCteHooks: (ctx: ToSQLCtx, hasSelect: boolean) => CteHooks;
export declare const ensureCTECount: (ctx: ToSQLCtx, cteName: string, countItem: EnsureCountItem) => void;
