import { QueryBaseCommon, Sql } from './query';
import { emptyObject } from './utils';
import { setTimeout } from 'timers/promises';

// Input type of adapter query methods.
export type QueryInput = string | { text: string; values?: unknown[] };

/**
 * Generic result returning from query methods.
 */
export interface QueryResultRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K: string]: any;
}

export interface AdapterConfigBase {
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

  connect(): Promise<unknown>;

  // make a query to get rows as objects
  query(query: QueryInput): Promise<unknown>;
  // make a query to get rows as array of column values
  arrays(query: QueryInput): Promise<unknown>;
  /**
   * Run a transaction
   *
   * @param begin - SQL for `BEGIN`, it may be a `SAVEPOINT` instead of `BEGIN`
   * @param cb - callback will be called with a db client with a dedicated connection.
   */
  transaction(
    begin: Sql,
    cb: (adapter: AdapterBase) => Promise<unknown>,
  ): Promise<unknown>;
  // close connection
  close(): Promise<void>;
}

// Database adapter type for transaction that contains a connected db client.
export interface TransactionAdapterBase extends AdapterBase {
  client: unknown;
}

// Wrapper type for transactions.
export interface TransactionState {
  // Database adapter that is connected to a currently running transaction.
  adapter: TransactionAdapterBase;
  // Number of transaction nesting.
  // Top transaction has id = 0, transaction inside of transaction will have id = 1, and so on.
  transactionId: number;
  // Array of data and functions to call after commit.
  // 1st element is a query result, 2nd element is a query object, 3rd element is array of functions to call with the query result and object.
  afterCommit?: TransactionAfterCommitHook[];
}

/**
 * Element of `afterCommit` transaction array. See {@link TransactionState.afterCommit}.
 */
export type TransactionAfterCommitHook =
  | unknown[]
  | QueryBaseCommon
  | AfterCommitHook[];

// Function to call after transaction commit.
export interface AfterCommitHook {
  (data: unknown[], q: QueryBaseCommon): void | Promise<void>;
}

export const setAdapterConnectRetry = <Result>(
  adapter: AdapterBase,
  connect: () => Promise<Result>,
  config: AdapterConfigConnectRetryParam,
) => {
  adapter.connectRetryConfig = {
    attempts: config.attempts ?? 10,
    strategy:
      typeof config.strategy === 'function'
        ? config.strategy
        : defaultConnectRetryStrategy(config.strategy ?? emptyObject),
  };

  adapter.connect = async () => {
    let attempt = 1;
    for (;;) {
      try {
        return await connect();
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
  };
};

const defaultConnectRetryStrategy = (
  param: AdapterConfigConnectRetryStrategyParam,
): AdapterConfigConnectRetryStrategy => {
  return (attempt) =>
    setTimeout((param.factor ?? 1.5) ** (attempt - 1) * (param.delay ?? 50));
};
