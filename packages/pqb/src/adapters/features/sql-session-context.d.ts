import { type PickQueryQ } from '../../query/pick-query-types';
import { type QueryResult } from '../adapter';
export interface SqlSessionState {
    /**
     * Postgres role for SQL session context.
     *
     * `$withOptions` applies it around query execution; transaction options apply
     * it with transaction-local semantics.
     */
    role?: string;
    /**
     * Postgres custom settings for SQL session context.
     *
     * `$withOptions` applies them around query execution; transaction options
     * apply them with transaction-local semantics.
     */
    setConfig?: Record<string, string | number | boolean>;
}
export interface SqlSessionContextSetupResult {
    roleSetupSql?: string;
    configSetupSql?: string;
    captureRoleSql?: string;
    captureConfigSql?: string;
    captureConfigValues?: string[];
}
export interface SqlSessionContextQueryFn {
    (sql: string, values?: unknown[]): Promise<QueryResult>;
}
export declare const sqlSessionContextSetStorageOptions: (query: PickQueryQ, state: SqlSessionState | undefined, options: SqlSessionState, result: SqlSessionState) => void;
export declare const sqlSessionContextMergeStorageState: (state: SqlSessionState | undefined, options: SqlSessionState | undefined) => SqlSessionState | undefined;
export declare const sqlSessionContextGetStateFromAsyncState: (state: SqlSessionState | undefined) => SqlSessionState | undefined;
export declare const sqlSessionContextComputeSetup: (desired: SqlSessionState | undefined) => SqlSessionContextSetupResult | undefined;
export declare const sqlSessionContextBuildConfigRestoreBatchSql: (configs: Record<string, string | null | undefined>) => string | undefined;
export declare const sqlSessionContextHasState: (state: SqlSessionState | undefined) => boolean;
export declare const sqlSessionContextExecute: <T extends QueryResult>(query: SqlSessionContextQueryFn, setup: SqlSessionContextSetupResult | undefined, mainQuery: () => Promise<T>) => Promise<T>;
