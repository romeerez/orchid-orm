import { RecordString } from '../utils';
import { AsyncLocalStorage } from 'node:async_hooks';
import { QueryError } from '../query/errors';
import { IsolationLevel, Query, QuerySchema } from '../query';
import { AsyncState, ProcessedStorageOptions } from '../query/basic-features/storage/storage';
import { SqlSessionState } from './features/sql-session-context';
import { PostgresInterval } from './driver-adapter-shared';
export type { SqlSessionState } from './features/sql-session-context';
/**
 * Generic result returning from query methods.
 */
export interface QueryResultRow {
    [K: string]: any;
}
export interface QueryResult<T = any> {
    rowCount: number;
    rows: T[];
    /**
     * node-postgres and postgres-js: fields are present even for empty results.
     * Bun doesn't implement fields in the same way, fields are empty if no rows returned.
     */
    fields: {
        name: string;
    }[];
}
export interface AdapterConfigBase {
    databaseURL?: string;
    database?: string;
    user?: string;
    password?: string | (() => string | Promise<string>);
    searchPath?: string;
    ssl?: any;
    /**
     * Postgres settings to apply when driver connections are configured.
     *
     * `searchPath` is normalized to `search_path` in this map.
     */
    setConfig?: RecordString;
    schema?: QuerySchema;
    host?: string;
    /**
     * This option may be useful in CI when database container has started, CI starts performing next steps,
     * migrations begin to apply though database may be not fully ready for connections yet.
     *
     * Set `connectRetry: true` for the default backoff strategy. It performs 10 attempts starting with 50ms delay and increases delay exponentially according to this formula:
     *
     * ```
     * (factor, defaults to 1.5) ** (currentAttempt - 1) * (delay, defaults to 50)
     * ```
     *
     * So the 2nd attempt will happen in 50ms from start, 3rd attempt in 125ms, 3rd in 237ms, and so on.
     *
     * You can customize max attempts to be made, `factor` multiplier and the starting delay by passing:
     *
     * ```ts
     * const options = {
     *   databaseURL: process.env.DATABASE_URL,
     *   connectRetry: {
     *     attempts: 15, // max attempts
     *     strategy: {
     *       delay: 100, // initial delay
     *       factor: 2, // multiplier for the formula above
     *     }
     *   }
     * };
     *
     * rakeDb(options, { ... });
     * ```
     *
     * You can pass a custom function to `strategy` to customize delay behavior:
     *
     * ```ts
     * import { setTimeout } from 'timers/promises';
     *
     * const options = {
     *   databaseURL: process.env.DATABASE_URL,
     *   connectRetry: {
     *     attempts: 5,
     *     stragegy(currentAttempt: number, maxAttempts: number) {
     *       // linear: wait 100ms after 1st attempt, then 200m after 2nd, and so on.
     *       return setTimeout(currentAttempt * 100);
     *     },
     *   },
     * };
     * ```
     */
    connectRetry?: AdapterConfigConnectRetryParam | true;
}
interface AdapterConfigConnectRetryParam {
    attempts?: number;
    strategy?: AdapterConfigConnectRetryStrategyParam | AdapterConfigConnectRetryStrategy;
}
interface AdapterConfigConnectRetryStrategyParam {
    delay?: number;
    factor?: number;
}
export interface AdapterConfigConnectRetry {
    attempts: number;
    strategy: AdapterConfigConnectRetryStrategy;
}
interface AdapterConfigConnectRetryStrategy {
    (attempt: number, attempts: number): Promise<void> | void;
}
export interface AdapterTransactionOptions extends ProcessedStorageOptions {
    level?: IsolationLevel;
    readOnly?: boolean;
    deferrable?: boolean;
}
export interface Adapter {
    errorClass: new (...args: any[]) => Error;
    searchPath?: string;
    driverAdapter: DriverAdapter;
    isInTransaction(this: Adapter): this is TransactionAdapter;
    assignError(to: QueryError, from: Error): void;
    query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[], sqlSessionState?: SqlSessionState): Promise<QueryResult<T>>;
    arrays<R extends any[] = any[]>(text: string, values?: unknown[], sqlSessionState?: SqlSessionState): Promise<QueryResult<R>>;
    /**
     * Run a transaction
     *
     * `options` can be `undefined`.
     */
    transaction<T>(asyncStorage: AsyncLocalStorage<AsyncState> | undefined, options: AdapterTransactionOptions | undefined, cb: (adapter: TransactionAdapter) => Promise<T>): Promise<T>;
    close(): Promise<void>;
    getDatabase(): string;
    getUser(): string;
    getSearchPath(): string | undefined;
    getHost(): string;
    getSchema(): QuerySchema | undefined;
    clone(params?: AdapterConfigBase): Adapter;
}
/**
 * Adapter interface for transaction contexts.
 */
export interface TransactionAdapter extends Adapter {
    isInTransaction(this: Adapter): this is TransactionAdapter;
    savepoint<T>(name: string, cb: () => Promise<T>): Promise<T>;
    /**
     * This is a workaround for postgres-js savepoint limitations.
     * Postgres-js dictates this:
     * - must use its `savepoint` method over manual `SAVEPOINT` because when doing it manually there is no way to prevent transaction from being rolled back when a query in a savepoint fails.
     * - must use its `sql` client from inside the `savepoint` method for the lifetime of the savepoint because of the reason above.
     */
    hackySavepoint<T extends QueryResultRow = QueryResultRow>(state: HackySavepointState, text: string, values?: unknown[], arraysMode?: boolean): Promise<QueryResult<T>>;
}
type Pool = any;
type Client = any;
export interface AdapterSchemaConfigOptions {
    jsonEncodedByDriver?: boolean;
    dateParsedByDriver?: boolean;
    arrayEncode?(input: unknown): unknown;
    intervalParse?(input: string): PostgresInterval;
}
/**
 * Adapter class used by runtime orchestrator to create driver-specific adapters.
 */
export interface DriverAdapter {
    noFieldsForArrays?: boolean;
    schemaConfig?: AdapterSchemaConfigOptions;
    errorClass: new (...args: any[]) => Error;
    errorFields: RecordString;
    configure(config: AdapterConfigBase): Pool;
    manualPool: boolean;
    borrow(pool: Pool): Client;
    release(client: Client): void;
    queryClient<T = QueryResultRow>(client: Client, text: string, values?: unknown[], arraysMode?: boolean): Promise<QueryResult<T>>;
    begin<DriverClient, Result>(pool: Pool, cb: (client: DriverClient) => Promise<Result>, options?: string): Promise<Result>;
    savepoint<T>(client: Client, setClient: (client: Client) => void, name: string, cb: () => Promise<T>): Promise<T>;
    hackySavepoint<T extends QueryResultRow>(client: Client, setClient: (client: Client) => void, state: HackySavepointState, text: string, values?: unknown[], arraysMode?: boolean): Promise<QueryResult<T>>;
    close(pool: Pool): Promise<void>;
}
/**
 * Constructor params for the shared runtime adapter orchestrator.
 */
export interface AdapterParams {
    /**
     * Driver-specific adapter class implementing `DriverAdapter`.
     */
    driverAdapter: DriverAdapter;
    /**
     * Base config saved by runtime and used for clone recreation.
     */
    config: AdapterConfigBase;
}
/**
 * Shared runtime adapter orchestrator over a driver-specific adapter implementation.
 */
export declare class AdapterClass implements Adapter {
    private readonly params;
    errorClass: new (...args: any[]) => Error;
    driverAdapter: DriverAdapter;
    private pool;
    private readonly config;
    private readonly connectionState;
    constructor(params: AdapterParams);
    query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[], sqlSessionState?: SqlSessionState): Promise<QueryResult<T>>;
    arrays<R extends any[] = any[]>(text: string, values?: unknown[], sqlSessionState?: SqlSessionState): Promise<QueryResult<R>>;
    clone(params?: AdapterConfigBase): Adapter;
    isInTransaction(this: Adapter): this is TransactionAdapter;
    getDatabase(): string;
    getUser(): string;
    getSearchPath(): string | undefined;
    getHost(): string;
    getSchema(): QuerySchema | undefined;
    transaction<T>(asyncStorage: AsyncLocalStorage<AsyncState> | undefined, options: AdapterTransactionOptions | undefined, cb: (adapter: TransactionAdapter) => Promise<T>): Promise<T>;
    close: () => Promise<void>;
    assignError(to: QueryError, from: Error): void;
}
export interface HackySavepointStateActiveSavepoint {
    release(): Promise<void>;
    rollback(err: unknown): Promise<void>;
}
export interface HackySavepointState {
    name: string;
    activeSavepoint?: HackySavepointStateActiveSavepoint;
}
/**
 * Shared runtime transaction adapter orchestrator over a driver-specific transaction adapter.
 */
export declare class TransactionAdapterClass implements TransactionAdapter {
    private adapter;
    private client;
    errorClass: new (...args: any[]) => Error;
    driverAdapter: DriverAdapter;
    constructor(adapter: Adapter, client: Client);
    query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[], sqlSessionState?: SqlSessionState): Promise<QueryResult<T>>;
    arrays<R extends any[] = any[]>(text: string, values?: unknown[], sqlSessionState?: SqlSessionState): Promise<QueryResult<R>>;
    clone(params?: AdapterConfigBase): Adapter;
    isInTransaction(this: Adapter): this is TransactionAdapter;
    getDatabase(): string;
    getUser(): string;
    getSearchPath(): string | undefined;
    getHost(): string;
    getSchema(): QuerySchema | undefined;
    transaction<T>(asyncStorage: AsyncLocalStorage<AsyncState> | undefined, options: AdapterTransactionOptions | undefined, cb: (adapter: TransactionAdapter) => Promise<T>): Promise<T>;
    savepoint<T>(name: string, cb: () => Promise<T>): Promise<T>;
    hackySavepoint<T extends QueryResultRow = QueryResultRow>(state: HackySavepointState, text: string, values?: unknown[], arraysMode?: boolean): Promise<QueryResult<T>>;
    close(): Promise<void>;
    assignError(to: QueryError, from: Error): void;
}
/**
 * Element of `afterCommit` transaction array. See {@link AsyncState.afterCommit}.
 */
export type TransactionAfterCommitHook = unknown[] | Query | AfterCommitHook[] | AfterCommitStandaloneHook;
export interface AfterCommitHook {
    (data: unknown[], q: Query): unknown | Promise<unknown>;
}
export interface AfterCommitStandaloneHook {
    (): unknown | Promise<unknown>;
}
export declare const makeConnectRetryConfig: (config: AdapterConfigConnectRetryParam) => AdapterConfigConnectRetry;
export declare const wrapAdapterFnWithConnectRetry: <Fn extends (...args: any[]) => any>(connectRetryConfig: AdapterConfigConnectRetry, fn: Fn) => Fn;
export declare const getDriverErrorCode: (err: object) => unknown;
