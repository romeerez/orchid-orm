import {
  commitSql,
  emptyArray,
  emptyObject,
  RecordString,
  RecordUnknown,
  rollbackSql,
} from '../utils';
import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout } from 'node:timers/promises';
import { QueryError } from '../query/errors';
import {
  _runAfterCommitHooks,
  AfterCommitErrorHandler,
  IsolationLevel,
  Query,
  QueryLogObject,
  QuerySchema,
  SingleSqlItem,
} from '../query';
import {
  AsyncState,
  ProcessedStorageOptions,
} from '../query/basic-features/storage/storage';
import {
  sqlSessionContextComputeSetup,
  sqlSessionContextExecute,
  SqlSessionContextSetupResult,
  SqlSessionState,
} from './features/sql-session-context';
import {
  getResetRoleSql,
  getResetSetConfigSql,
  getSetConfigSql,
  getSetRoleSql,
} from './adapter.utils';

export type { SqlSessionState } from './features/sql-session-context';

/**
 * Generic result returning from query methods.
 */
export interface QueryResultRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K: string]: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QueryResult<T extends QueryResultRow = any> {
  rowCount: number;
  rows: T[];
  fields: {
    name: string;
  }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QueryArraysResult<R extends any[] = any[]> {
  rowCount: number;
  rows: R[];
  fields: { name: string }[];
}

export interface AdapterConfigBase {
  databaseURL?: string;
  database?: string;
  user?: string;
  password?: string | (() => string | Promise<string>);
  searchPath?: string;
  // oxlint-disable-next-line typescript/no-explicit-any - different drivers support different configs for this
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
  strategy?:
    | AdapterConfigConnectRetryStrategyParam
    | AdapterConfigConnectRetryStrategy;
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

// Interface of a database adapter to use for different databases.
// This is the full interface exposed to users, including metadata methods and clone.
export interface Adapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorClass: new (...args: any[]) => Error;
  searchPath?: string;
  driverAdapter: DriverAdapter;

  // Connection state
  isInTransaction(): boolean;

  // Error handling
  assignError(to: QueryError, from: Error): void;

  // make a query to get rows as objects
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    // only has effect in a transaction
    startingSavepoint?: string,
    releasingSavepoint?: string,
    // SQL session state (role and setConfig) from async storage
    sqlSessionState?: SqlSessionState,
  ): Promise<QueryResult<T>>;

  // make a query to get rows as array of column values
  arrays<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    R extends any[] = any[],
  >(
    text: string,
    values?: unknown[],
    // only has effect in a transaction
    startingSavepoint?: string,
    releasingSavepoint?: string,
    // SQL session state (role and setConfig) from async storage
    sqlSessionState?: SqlSessionState,
  ): Promise<QueryArraysResult<R>>;

  /**
   * Run a transaction
   *
   * `options` can be `undefined`.
   */
  transaction<T>(
    asyncStorage: AsyncLocalStorage<AsyncState> | undefined,
    options: AdapterTransactionOptions | undefined,
    cb: (adapter: TransactionAdapter) => Promise<T>,
  ): Promise<T>;

  // close connection
  close(): Promise<void>;

  // Metadata methods
  getDatabase(): string;
  getUser(): string;
  getSearchPath(): string | undefined;
  getHost(): string;
  getSchema(): QuerySchema | undefined;

  // Clone method
  clone(params?: AdapterConfigBase): Adapter;
}

/**
 * Adapter interface for transaction contexts.
 */
export interface TransactionAdapter extends Adapter {
  isInTransaction(): true;
}

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
type Pool = any;
// oxlint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

/**
 * Adapter class used by runtime orchestrator to create driver-specific adapters.
 */
export interface DriverAdapter {
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  errorClass: new (...args: any[]) => Error;
  errorFields: RecordString;
  configure(config: AdapterConfigBase): Pool;
  manualPool: boolean;
  borrow(pool: Pool): Client;
  release(client: Client): void;
  queryClient<T extends QueryResultRow = QueryResultRow>(
    client: Client,
    text: string,
    values?: unknown[],
    // only has effect in a transaction
    startingSavepoint?: string,
    releasingSavepoint?: string,
    // SQL session state (role and setConfig) from async storage
    arraysMode?: boolean,
  ): Promise<QueryResult<T>>;
  begin<DriverClient, Result>(
    pool: Pool,
    cb: (client: DriverClient) => Promise<Result>,
    options?: string,
  ): Promise<Result>;
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
export class AdapterClass implements Adapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorClass: new (...args: any[]) => Error;
  driverAdapter: DriverAdapter;
  private pool: Pool;
  private readonly config: AdapterConfigBase;
  private readonly connectionState: AdapterConnectionState;

  constructor(private readonly params: AdapterParams) {
    this.config = { ...params.config };

    if (this.config.connectRetry) {
      const connectRetryConfig = makeConnectRetryConfig(
        this.config.connectRetry === true
          ? emptyObject
          : this.config.connectRetry,
      );
      if (connectRetryConfig) {
        this.query = wrapAdapterFnWithConnectRetry(
          connectRetryConfig,
          this.query,
        );
        this.arrays = wrapAdapterFnWithConnectRetry(
          connectRetryConfig,
          this.arrays,
        );
      }
    }
    this.connectionState = createAdapterConnectionState(this.config);
    this.config = createDriverAdapterConfig(this.config, this.connectionState);
    this.driverAdapter = params.driverAdapter;
    this.pool = this.driverAdapter.configure(this.config);
    this.errorClass = this.driverAdapter.errorClass;
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    // only has effect in a transaction
    startingSavepoint?: string,
    releasingSavepoint?: string,
    // SQL session state (role and setConfig) from async storage
    sqlSessionState?: SqlSessionState,
  ): Promise<QueryResult<T>> {
    return runQueryHandlePool<T>(
      this.pool,
      this.driverAdapter,
      text,
      values,
      startingSavepoint,
      releasingSavepoint,
      sqlSessionState,
    );
  }

  // make a query to get rows as array of column values
  arrays<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    R extends any[] = any[],
  >(
    text: string,
    values?: unknown[],
    // only has effect in a transaction
    startingSavepoint?: string,
    releasingSavepoint?: string,
    // SQL session state (role and setConfig) from async storage
    sqlSessionState?: SqlSessionState,
  ): Promise<QueryArraysResult<R>> {
    return runQueryHandlePool<R>(
      this.pool,
      this.driverAdapter,
      text,
      values,
      startingSavepoint,
      releasingSavepoint,
      sqlSessionState,
      true,
    );
  }

  clone(params?: AdapterConfigBase): Adapter {
    return new AdapterClass({
      driverAdapter: this.params.driverAdapter,
      config: cloneAdapterConfig(this.config, params),
    });
  }

  isInTransaction(): boolean {
    return false;
  }

  getDatabase(): string {
    return this.connectionState.database as string;
  }

  getUser(): string {
    return this.connectionState.user as string;
  }

  getSearchPath(): string | undefined {
    return this.connectionState.searchPath;
  }

  getHost(): string {
    return this.connectionState.host as string;
  }

  getSchema(): QuerySchema | undefined {
    return this.connectionState.schema;
  }

  transaction<T>(
    asyncStorage: AsyncLocalStorage<AsyncState> | undefined,
    options: AdapterTransactionOptions | undefined,
    cb: (adapter: TransactionAdapter) => Promise<T>,
  ): Promise<T> {
    return transaction(
      asyncStorage,
      this,
      this.driverAdapter,
      this.pool,
      options,
      cb,
    );
  }

  close = async (): Promise<void> => {
    const { pool } = this;
    this.pool = this.driverAdapter.configure(this.config);
    await this.driverAdapter.close(pool);
  };

  assignError(to: QueryError, from: Error): void {
    const { errorFields } = this.driverAdapter;
    for (const key in errorFields) {
      (to as unknown as RecordUnknown)[key] = (
        from as unknown as RecordUnknown
      )[key];
    }
  }
}

/**
 * Shared runtime transaction adapter orchestrator over a driver-specific transaction adapter.
 */
export class TransactionAdapterClass implements TransactionAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorClass: new (...args: any[]) => Error;

  driverAdapter: DriverAdapter;

  constructor(
    private adapter: Adapter,
    private client: Client,
  ) {
    this.driverAdapter = adapter.driverAdapter;
    this.errorClass = this.adapter.errorClass;
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    // only has effect in a transaction
    startingSavepoint?: string,
    releasingSavepoint?: string,
    // SQL session state (role and setConfig) from async storage
    sqlSessionState?: SqlSessionState,
  ): Promise<QueryResult<T>> {
    const setup = sqlSessionContextComputeSetup(sqlSessionState);

    return runQueryHandleSetupAndCleanup<T>(
      this.driverAdapter,
      this.client,
      text,
      values,
      startingSavepoint,
      releasingSavepoint,
      setup,
    );
  }

  // make a query to get rows as array of column values
  arrays<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    R extends any[] = any[],
  >(
    text: string,
    values?: unknown[],
    // only has effect in a transaction
    startingSavepoint?: string,
    releasingSavepoint?: string,
    // SQL session state (role and setConfig) from async storage
    sqlSessionState?: SqlSessionState,
  ): Promise<QueryArraysResult<R>> {
    const setup = sqlSessionContextComputeSetup(sqlSessionState);

    return runQueryHandleSetupAndCleanup<R>(
      this.driverAdapter,
      this.client,
      text,
      values,
      startingSavepoint,
      releasingSavepoint,
      setup,
      true,
    );
  }

  clone(params?: AdapterConfigBase): Adapter {
    return this.adapter.clone(params);
  }

  isInTransaction(): true {
    return true;
  }

  getDatabase(): string {
    return this.adapter.getDatabase();
  }

  getUser(): string {
    return this.adapter.getUser();
  }

  getSearchPath(): string | undefined {
    return this.adapter.getSearchPath();
  }

  getHost(): string {
    return this.adapter.getHost();
  }

  getSchema(): QuerySchema | undefined {
    return this.adapter.getSchema();
  }

  async transaction<T>(
    asyncStorage: AsyncLocalStorage<AsyncState> | undefined,
    options: AdapterTransactionOptions | undefined,
    cb: (adapter: TransactionAdapter) => Promise<T>,
  ): Promise<T> {
    return transaction(
      asyncStorage,
      this.adapter,
      this.driverAdapter,
      this.client,
      options,
      cb,
      this,
    );
  }

  close(): Promise<void> {
    return this.adapter.close();
  }

  assignError(to: QueryError, from: Error): void {
    return this.adapter.assignError(to, from);
  }
}

interface TransactionCtx {
  state?: AsyncState;
  logData: unknown;
}

const transaction = <T>(
  asyncStorage: AsyncLocalStorage<AsyncState> | undefined,
  adapter: Adapter,
  driverAdapter: DriverAdapter,
  poolOrClient: Pool | Client,
  options: AdapterTransactionOptions | undefined,
  cb: (adapter: TransactionAdapter) => Promise<T>,
  transactionAdapter?: Adapter,
) => {
  const sql = {
    values: emptyArray,
  } as unknown as SingleSqlItem;

  const log = options?.log;

  const state = asyncStorage?.getStore();

  const ctx = {
    state,
    logData: undefined as unknown,
  };

  const transactionId =
    state?.transactionId !== undefined ? state.transactionId + 1 : 0;

  const fn = (transactionAdapter: TransactionAdapter) => {
    if (log) log.afterQuery(sql, ctx.logData);
    if (log) ctx.logData = log.beforeQuery(commitSql);

    if (state || !asyncStorage) {
      const parentTransactionRole = state?.transactionRole;
      const parentTransactionSetConfig = state?.transactionSetConfig;

      if (state) {
        state.transactionId = transactionId;
        if (options) {
          if (options.role) state.transactionRole = options.role;
          if (options.setConfig)
            state.transactionSetConfig = {
              ...state.transactionSetConfig,
              ...options.setConfig,
            };
        }
      }

      return Promise.resolve(cb(transactionAdapter)).finally(() => {
        if (state) {
          state.transactionId = transactionId - 1;
          state.transactionRole = parentTransactionRole;
          state.transactionSetConfig = parentTransactionSetConfig;
        }
      });
    }

    ctx.state = {
      ...options,
      role: undefined,
      setConfig: undefined,
      transactionAdapter,
      transactionId,
      transactionRole: options?.role,
      transactionSetConfig: options?.setConfig,
    };

    return asyncStorage.run(ctx.state, () => cb(transactionAdapter));
  };

  transactionAdapter ??= state?.transactionAdapter;

  if (transactionAdapter) {
    return nestedTransaction(
      adapter,
      driverAdapter,
      transactionAdapter,
      poolOrClient,
      options,
      fn,
      ctx,
      transactionId,
      sql,
      log,
    );
  } else {
    return realTransaction(
      adapter,
      driverAdapter,
      poolOrClient,
      options,
      fn,
      ctx,
      sql,
      log,
    );
  }
};

const realTransaction = async <T>(
  adapter: Adapter,
  driverAdapter: DriverAdapter,
  pool: Pool,
  options: AdapterTransactionOptions | undefined,
  cb: (adapter: TransactionAdapter) => Promise<T>,
  ctx: TransactionCtx,
  sql: SingleSqlItem,
  log?: QueryLogObject,
) => {
  let trxOpts: string | undefined;
  if (options?.level) {
    trxOpts = `ISOLATION LEVEL ${options.level}`;
  }

  if (options?.readOnly !== undefined) {
    const add = `READ ${options.readOnly ? 'ONLY' : 'WRITE'}`;
    trxOpts = trxOpts ? trxOpts + ' ' + add : add;
  }

  if (options?.deferrable !== undefined) {
    const add = `${options.deferrable ? '' : 'NOT '}DEFERRABLE`;
    trxOpts = trxOpts ? trxOpts + ' ' + add : add;
  }

  if (log) {
    sql.text = trxOpts ? `BEGIN ${trxOpts}` : 'BEGIN';
    ctx.logData = log.beforeQuery(sql);
  }

  const result = (await driverAdapter
    .begin(
      pool,
      (client) => {
        let promises: Promise<unknown>[] | undefined;

        const setRoleSql = getSetRoleSql(undefined, options);
        if (setRoleSql) {
          (promises ??= []).push(driverAdapter.queryClient(client, setRoleSql));
        }

        const setConfigSql = getSetConfigSql(undefined, options);
        if (setConfigSql) {
          (promises ??= []).push(
            driverAdapter.queryClient(client, setConfigSql),
          );
        }

        const transaction = cb(new TransactionAdapterClass(adapter, client));

        return promises
          ? Promise.all(promises).then(() => transaction)
          : transaction;
      },
      trxOpts,
    )
    .catch((err) => {
      if (log) log.afterQuery(rollbackSql, ctx.logData);

      throw err;
    })) as Promise<T>;

  if (log) log.afterQuery(commitSql, ctx.logData);

  if (ctx.state) {
    // state was defined in the callback above;
    runAfterCommit(ctx.state.afterCommit, result);
  }

  return result;
};

const nestedTransaction = async <T>(
  adapter: Adapter,
  driverAdapter: DriverAdapter,
  transactionAdapter: Adapter,
  client: Client,
  options: AdapterTransactionOptions | undefined,
  cb: (adapter: TransactionAdapter) => Promise<T>,
  ctx: TransactionCtx,
  transactionId: number,
  sql: SingleSqlItem,
  log?: QueryLogObject,
) => {
  const state = ctx.state;
  const parentRole = state?.transactionRole;
  const parentSetConfig = state?.transactionSetConfig;

  sql.text = `SAVEPOINT "t${transactionId}"`;
  if (log) ctx.logData = log.beforeQuery(sql);

  await transactionAdapter.arrays(sql.text, sql.values);

  const setRoleSql = getSetRoleSql(parentRole, options);
  if (setRoleSql) {
    // awaited by await below
    driverAdapter.queryClient(client, setRoleSql);
  }

  const setConfigSql = getSetConfigSql(parentSetConfig, options);
  if (setConfigSql) {
    // awaited by await below
    driverAdapter.queryClient(client, setConfigSql);
  }

  let result;
  try {
    result = await cb(new TransactionAdapterClass(adapter, client));
  } catch (err) {
    // config is reverted by this rollback, role is not reverted and it is undone manually in the finally section
    sql.text = `ROLLBACK TO SAVEPOINT "t${transactionId}"`;
    if (log) ctx.logData = log.beforeQuery(sql);
    await transactionAdapter.arrays(sql.text, sql.values);
    if (log) log.afterQuery(sql, ctx.logData);
    throw err;
  } finally {
    const resetRoleSql = getResetRoleSql(parentRole, options);
    if (resetRoleSql) {
      await driverAdapter.queryClient(client, resetRoleSql);
    }
  }

  const resetSetConfigSql = getResetSetConfigSql(parentSetConfig, options);
  if (resetSetConfigSql) {
    // awaited by await release savepoint
    driverAdapter.queryClient(client, resetSetConfigSql);
  }

  sql.text = `RELEASE SAVEPOINT "t${transactionId}"`;
  if (log) ctx.logData = log.beforeQuery(sql);
  await transactionAdapter.arrays(sql.text, sql.values);
  if (log) log.afterQuery(sql, ctx.logData);

  // transactionId is trx.testTransactionCount when only the test transactions are left,
  // and it's time to execute after commit hooks, because they won't be executed for test transactions.
  if (ctx.state && transactionId === ctx.state.testTransactionCount) {
    const { afterCommit } = ctx.state;
    ctx.state.afterCommit = undefined;
    runAfterCommit(afterCommit, result);
  }

  return result;
};

// `afterCommit` hooks are detached from the main flow, this function won't throw.
const runAfterCommit = (
  afterCommit: TransactionAfterCommitHook[] | undefined,
  result: unknown,
) => {
  // to suppress throws of sync afterCommit hooks.
  queueMicrotask(async () => {
    if (afterCommit) {
      const promises = [];

      let catchAfterCommitErrors: AfterCommitErrorHandler[] | undefined;
      for (let i = 0, len = afterCommit.length; i < len; ) {
        const first = afterCommit[i];
        if (typeof first === 'function') {
          try {
            promises.push(first());
          } catch (err) {
            promises.push(Promise.reject(err));
          }
          i++;
        } else {
          const q = afterCommit[i + 1] as Query;
          if (q.q.catchAfterCommitErrors) {
            (catchAfterCommitErrors ??= []).push(...q.q.catchAfterCommitErrors);
          }

          for (const fn of afterCommit[i + 2] as AfterCommitHook[]) {
            try {
              promises.push(fn(first as unknown[], q));
            } catch (err) {
              promises.push(Promise.reject(err));
            }
          }
          i += 3;
        }
      }

      const getHookNames = () => {
        const hookNames = [];
        for (let i = 0, len = afterCommit.length; i < len; ) {
          const first = afterCommit[i];
          if (typeof first === 'function') {
            hookNames.push(first.name);
            i++;
          } else {
            for (const fn of afterCommit[i + 2] as AfterCommitHook[]) {
              hookNames.push(fn.name);
            }
            i += 3;
          }
        }
        return hookNames;
      };

      await _runAfterCommitHooks(
        result,
        promises,
        getHookNames,
        catchAfterCommitErrors,
      );
    }
  });
};

const runQueryHandlePool = async <T extends QueryResultRow = QueryResultRow>(
  pool: Pool,
  driverAdapter: DriverAdapter,
  text: string,
  values?: unknown[],
  // only has effect in a transaction
  startingSavepoint?: string,
  releasingSavepoint?: string,
  // SQL session state (role and setConfig) from async storage
  sqlSessionState?: SqlSessionState,
  arraysMode?: boolean,
  client?: Client,
): Promise<QueryResult<T>> => {
  const setup = sqlSessionContextComputeSetup(sqlSessionState);

  if (client || (!driverAdapter.manualPool && !setup)) {
    return runQueryHandleSetupAndCleanup(
      driverAdapter,
      client || pool,
      text,
      values,
      startingSavepoint,
      releasingSavepoint,
      setup,
      arraysMode,
    );
  }

  client = await driverAdapter.borrow(pool);

  try {
    return await runQueryHandleSetupAndCleanup(
      driverAdapter,
      client,
      text,
      values,
      startingSavepoint,
      releasingSavepoint,
      setup,
      arraysMode,
    );
  } finally {
    driverAdapter.release(client);
  }
};

const runQueryHandleSetupAndCleanup = <
  T extends QueryResultRow = QueryResultRow,
>(
  driverAdapter: DriverAdapter,
  client: Client,
  text: string,
  values?: unknown[],
  // only has effect in a transaction
  startingSavepoint?: string,
  releasingSavepoint?: string,
  setup?: SqlSessionContextSetupResult,
  arraysMode?: boolean,
): Promise<QueryResult<T>> => {
  if (setup) {
    return sqlSessionContextExecute<T>(
      (text, values) =>
        driverAdapter.queryClient(
          client,
          text,
          values,
          undefined,
          undefined,
          true,
        ),
      setup,
      () =>
        driverAdapter.queryClient(
          client,
          text,
          values,
          startingSavepoint,
          releasingSavepoint,
          arraysMode,
        ),
    );
  }

  return driverAdapter.queryClient(
    client,
    text,
    values,
    startingSavepoint,
    releasingSavepoint,
    arraysMode,
  );
};

interface AdapterConnectionState {
  /**
   * Original config copy used for runtime metadata derivation and clone.
   */
  originalConfig: AdapterConfigBase;
  /**
   * Full connection URL when adapter config includes it.
   */
  databaseURL?: string;
  /**
   * Normalized database name derived from URL or direct config.
   */
  database?: string;
  /**
   * Normalized user name derived from URL or direct config.
   */
  user?: string;
  /**
   * Normalized password value derived from URL or direct config.
   */
  password?: string | (() => string | Promise<string>);
  /**
   * Normalized search_path derived from URL or direct config.
   */
  searchPath?: string;
  /**
   * Normalized host derived from URL or direct config.
   */
  host?: string;
  /**
   * Schema metadata from config or adapter instance.
   */
  schema?: QuerySchema;
}

const createAdapterConnectionState = (
  config: AdapterConfigBase,
): AdapterConnectionState => {
  const state: AdapterConnectionState = {
    originalConfig: { ...config },
  };

  const url = config.databaseURL ? new URL(config.databaseURL) : undefined;
  if (url) {
    state.databaseURL = url.toString();
    state.database = url.pathname.slice(1);
    state.user = url.username;
    state.password = url.password;
    state.searchPath = url.searchParams.get('searchPath') ?? config.searchPath;
    state.host = url.hostname;
  } else {
    state.database = config.database;
    state.user = config.user;
    state.password = config.password;
    state.searchPath = config.searchPath;
    state.host = config.host;
  }

  state.schema = config.schema;

  return state;
};

const cloneAdapterConfig = (
  config: AdapterConfigBase,
  params?: AdapterConfigBase,
): AdapterConfigBase => {
  if (!params) {
    return { ...config };
  }

  const clonedConfig = { ...config };

  if ('databaseURL' in params) {
    clonedConfig.databaseURL = params.databaseURL;
  }

  const url = clonedConfig.databaseURL
    ? new URL(clonedConfig.databaseURL)
    : undefined;
  if (url) {
    if ('database' in params) {
      url.pathname = `/${params.database ?? ''}`;
    }

    if ('user' in params) {
      url.username = params.user ?? '';
    }

    if ('password' in params && typeof params.password !== 'function') {
      url.password = params.password ?? '';
    }

    if ('searchPath' in params) {
      if (params.searchPath === undefined) {
        url.searchParams.delete('searchPath');
      } else {
        url.searchParams.set('searchPath', params.searchPath);
      }
      clonedConfig.searchPath = params.searchPath;
    }

    clonedConfig.databaseURL = url.toString();
  } else {
    if ('database' in params) {
      clonedConfig.database = params.database;
    }

    if ('user' in params) {
      clonedConfig.user = params.user;
    }

    if ('password' in params) {
      clonedConfig.password = params.password;
    }

    if ('searchPath' in params) {
      clonedConfig.searchPath = params.searchPath;
    }
  }

  if ('connectRetry' in params) {
    clonedConfig.connectRetry = params.connectRetry;
  }

  return clonedConfig;
};

const createDriverAdapterConfig = (
  config: AdapterConfigBase,
  state: AdapterConnectionState,
): AdapterConfigBase => {
  const setConfig: RecordString = config.setConfig
    ? { ...config.setConfig }
    : {};
  delete setConfig.search_path;
  if (state.searchPath && state.searchPath !== 'public') {
    setConfig.search_path = state.searchPath;
  }

  const driverConfig: AdapterConfigBase = {
    ...config,
    searchPath: state.searchPath,
    setConfig,
  };

  if (driverConfig.databaseURL) {
    const url = new URL(driverConfig.databaseURL);
    url.searchParams.delete('searchPath');

    const ssl = url.searchParams.get('ssl');
    if (ssl === 'false') {
      driverConfig.ssl = false;
      url.searchParams.delete('ssl');
    } else if (ssl === 'true') {
      driverConfig.ssl = true;
      url.searchParams.delete('ssl');
    }

    driverConfig.databaseURL = url.toString();
  }

  return driverConfig;
};

/**
 * Element of `afterCommit` transaction array. See {@link AsyncState.afterCommit}.
 */
export type TransactionAfterCommitHook =
  | unknown[]
  | Query
  | AfterCommitHook[]
  | AfterCommitStandaloneHook;

// Function to call after transaction commit.
export interface AfterCommitHook {
  (data: unknown[], q: Query): unknown | Promise<unknown>;
}

export interface AfterCommitStandaloneHook {
  (): unknown | Promise<unknown>;
}

export const makeConnectRetryConfig = (
  config: AdapterConfigConnectRetryParam,
): AdapterConfigConnectRetry => {
  return {
    attempts: config.attempts ?? 10,
    strategy:
      typeof config.strategy === 'function'
        ? config.strategy
        : defaultConnectRetryStrategy(config.strategy ?? emptyObject),
  };
};

export const wrapAdapterFnWithConnectRetry = <
  // oxlint-disable-next-line typescript/no-explicit-any
  Fn extends (...args: any[]) => any,
>(
  connectRetryConfig: AdapterConfigConnectRetry,
  fn: Fn,
): Fn => {
  return async function (this: unknown, ...args: unknown[]) {
    let attempt = 1;
    for (;;) {
      try {
        return await fn.call(this as never, ...args);
      } catch (err) {
        if (
          !err ||
          typeof err !== 'object' ||
          (err as { code: string }).code !== 'ECONNREFUSED' ||
          attempt >= connectRetryConfig.attempts
        ) {
          throw err;
        }

        await connectRetryConfig.strategy(attempt, connectRetryConfig.attempts);
        attempt++;
      }
    }
  } as Fn;
};

const defaultConnectRetryStrategy = (
  param: AdapterConfigConnectRetryStrategyParam,
): AdapterConfigConnectRetryStrategy => {
  return (attempt) =>
    setTimeout((param.factor ?? 1.5) ** (attempt - 1) * (param.delay ?? 50));
};
