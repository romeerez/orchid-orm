import { emptyObject } from '../utils';
import { setTimeout } from 'timers/promises';
import { QueryError } from '../query/errors';
import { Query, QueryLogObject } from '../query';

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

// Interface of a database adapter to use for different databases.
export interface AdapterBase {
  connectRetryConfig?: AdapterConfigConnectRetry;
  searchPath?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorClass: new (...args: any[]) => Error;
  assignError(to: QueryError, from: Error): void;
  isInTransaction(): boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateConfig(config: any): Promise<void>;

  reconfigure(params: {
    database?: string;
    user?: string;
    password?: string;
    searchPath?: string;
  }): AdapterBase;

  getDatabase(): string;
  getUser(): string;
  getSearchPath(): string | undefined;
  getHost(): string;

  connect?(): Promise<unknown>;

  // make a query to get rows as objects
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    // only has effect in a transaction
    catchingSavepoint?: string,
  ): Promise<QueryResult<T>>;
  // make a query to get rows as array of column values
  arrays<R extends any[] = any[]>( // eslint-disable-line @typescript-eslint/no-explicit-any
    text: string,
    values?: unknown[],
    // only has effect in a transaction
    catchingSavepoint?: string,
  ): Promise<QueryArraysResult<R>>;
  /**
   * Run a transaction
   *
   * @param options - optional transaction parameters
   * @param cb - callback will be called with a db client with a dedicated connection.
   */
  transaction<T>(
    options: string | undefined,
    cb: (adapter: AdapterBase) => Promise<T>,
  ): Promise<T>;
  // close connection
  close(): Promise<void>;
}

/**
 * Use it as an argument type when need to enforce the call site to use a transaction
 */
export interface TransactionAdapterBase extends AdapterBase {
  isInTransaction(): true;
}

// Wrapper type for transactions.
export interface TransactionState {
  // Database adapter that is connected to a currently running transaction.
  adapter: AdapterBase;
  // Number of transaction nesting.
  // Top transaction has id = 0, transaction inside of transaction will have id = 1, and so on.
  transactionId: number;
  // Array of data and functions to call after commit.
  // 1st element is a query result, 2nd element is a query object, 3rd element is array of functions to call with the query result and object.
  afterCommit?: TransactionAfterCommitHook[];
  // To log all the queries inside a transaction.
  log?: QueryLogObject;
  // number of test transaction wrapping the current one
  testTransactionCount?: number;
  // sequential number for catching save-points
  catchI?: number;
}

/**
 * Element of `afterCommit` transaction array. See {@link TransactionState.afterCommit}.
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

export const setConnectRetryConfig = (
  adapter: AdapterBase,
  config: AdapterConfigConnectRetryParam,
) => {
  adapter.connectRetryConfig = {
    attempts: config.attempts ?? 10,
    strategy:
      typeof config.strategy === 'function'
        ? config.strategy
        : defaultConnectRetryStrategy(config.strategy ?? emptyObject),
  };
};

export const wrapAdapterFnWithConnectRetry = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Fn extends (this: unknown, ...args: any[]) => Promise<unknown>,
>(
  adapter: AdapterBase,
  fn: Fn,
) => {
  return async function (...args) {
    let attempt = 1;
    for (;;) {
      try {
        return await fn.call(this, ...args);
      } catch (err) {
        const config = adapter.connectRetryConfig;
        if (
          !err ||
          typeof err !== 'object' ||
          (err as { code: string }).code !== 'ECONNREFUSED' ||
          !config ||
          attempt >= config.attempts
        ) {
          throw err;
        }

        await config.strategy(attempt, config.attempts);
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
