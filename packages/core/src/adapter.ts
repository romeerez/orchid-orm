import { QueryCommon, Sql } from './query';

// Input type of adapter query methods.
export type QueryInput = string | { text: string; values?: unknown[] };

/**
 * Generic result returning from query methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryResultRow = Record<string, any>;

// Interface of a database adapter to use for different databases.
export type AdapterBase = {
  query(query: QueryInput): Promise<unknown>;
  arrays(query: QueryInput): Promise<unknown>;
  transaction(
    begin: Sql,
    cb: (adapter: AdapterBase) => Promise<unknown>,
  ): Promise<unknown>;
  close(): Promise<void>;
};

export type TransactionAdapterBase = AdapterBase & { client: unknown };

// Wrapper type for transactions.
export type TransactionState = {
  // Database adapter that is connected to a currently running transaction.
  adapter: TransactionAdapterBase;
  // Number of transaction nesting.
  // Top transaction has id = 0, transaction inside of transaction will have id = 1, and so on.
  transactionId: number;
  // Array of data and functions to call after commit.
  // 1st element is a query result, 2nd element is a query object, 3rd element is array of functions to call with the query result and object.
  afterCommit?: TransactionAfterCommitHook[];
};

/**
 * Element of `afterCommit` transaction array. See {@link TransactionState.afterCommit}.
 */
export type TransactionAfterCommitHook =
  | unknown[]
  | QueryCommon
  | AfterCommitHook[];

// Function to call after transaction commit.
export type AfterCommitHook = (
  data: unknown[],
  q: QueryCommon,
) => void | Promise<void>;
