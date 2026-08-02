import { QueryLogObject } from '../log/log';
import { AdapterTransactionOptions, TransactionAdapter, TransactionAfterCommitHook } from '../../../adapters/adapter';
import type { SqlSessionState } from '../../../adapters/features/sql-session-context';
import { PickQueryQ, PickQueryQAndInternal } from '../../pick-query-types';
import { QuerySchema } from '../schema/schema';
export type { SqlSessionState } from '../../../adapters/features/sql-session-context';
export interface AsyncState extends SqlSessionState {
    transactionAdapter?: TransactionAdapter;
    transactionId?: number;
    afterCommit?: TransactionAfterCommitHook[];
    log?: QueryLogObject;
    testTransactionCount?: number;
    catchI?: number;
    schema?: QuerySchema;
    transactionRole?: SqlSessionState['role'];
    transactionSetConfig?: SqlSessionState['setConfig'];
}
export interface StorageOptions extends SqlSessionState {
    log?: boolean;
    schema?: QuerySchema;
}
export interface ProcessedStorageOptions extends SqlSessionState {
    log?: QueryLogObject;
    schema?: QuerySchema;
}
export declare const processStorageOptions: (query: PickQueryQ, state: AsyncState | undefined, { log: enableLog, ...options }: StorageOptions) => AdapterTransactionOptions | undefined;
export declare const setCurrentDefaultSchema: (schema: QuerySchema | undefined) => void;
export declare const getQuerySchema: (query: PickQueryQ) => QuerySchema | undefined;
export declare class QueryStorage {
    withOptions<Result>(this: PickQueryQAndInternal, options: StorageOptions, cb: () => Promise<Result>): Promise<Result>;
}
