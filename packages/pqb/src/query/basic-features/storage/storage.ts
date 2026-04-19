import { logParamToLogObject, QueryLogObject } from '../log/log';
import {
  TransactionAdapterBase,
  TransactionAfterCommitHook,
} from '../../../adapters/adapter';
import {
  sqlSessionContextMergeStorageState,
  sqlSessionContextSetStorageOptions,
} from '../../../adapters/features/sql-session-context';
import type { SqlSessionState } from '../../../adapters/features/sql-session-context';
import { PickQueryQ, PickQueryQAndInternal } from '../../pick-query-types';
import { QuerySchema } from '../schema/schema';

export type { SqlSessionState } from '../../../adapters/features/sql-session-context';

export interface AsyncState extends SqlSessionState {
  // Database adapter that is connected to a currently running transaction.
  transactionAdapter?: TransactionAdapterBase;
  // Number of transaction nesting.
  // Top transaction has id = 0, transaction inside of transaction will have id = 1, and so on.
  transactionId?: number;
  // Array of data and functions to call after commit.
  // 1st element is a query result, 2nd element is a query object, 3rd element is array of functions to call with the query result and object.
  afterCommit?: TransactionAfterCommitHook[];
  // To log all the queries after inside the storage scope
  log?: QueryLogObject;
  // number of test transaction wrapping the current one
  testTransactionCount?: number;
  // sequential number for catching save-points
  catchI?: number;
  // a db schema to use by default
  schema?: QuerySchema;
}

export interface StorageOptions extends SqlSessionState {
  log?: boolean;
  schema?: QuerySchema;
}

export interface ProcessedStorageOptions {
  log?: QueryLogObject;
  schema?: QuerySchema;
  role?: SqlSessionState['role'];
  setConfig?: SqlSessionState['setConfig'];
}

export const processStorageOptions = (
  query: PickQueryQ,
  state: AsyncState | undefined,
  options: StorageOptions,
): ProcessedStorageOptions | undefined => {
  let log;
  if (options.log !== undefined && !query.q.log) {
    log = logParamToLogObject(query.q.logger, options.log);
  }

  // Build the result object
  const result: ProcessedStorageOptions = {};

  if (log) result.log = log;
  if ('schema' in options) result.schema = options.schema;

  sqlSessionContextSetStorageOptions(query, state, options, result);

  // Return undefined if no options were processed
  if (
    result.log === undefined &&
    result.schema === undefined &&
    result.role === undefined &&
    result.setConfig === undefined
  ) {
    return undefined;
  }

  return result;
};

let currentDefaultSchema: string | undefined;
export const setCurrentDefaultSchema = (schema: QuerySchema | undefined) => {
  currentDefaultSchema = typeof schema === 'function' ? schema() : schema;
};

export const getQuerySchema = (query: PickQueryQ) =>
  query.q.schema || currentDefaultSchema;

export class QueryStorage {
  async withOptions<Result>(
    this: PickQueryQAndInternal,
    options: StorageOptions,
    cb: () => Promise<Result>,
  ): Promise<Result> {
    const state = this.internal.asyncStorage.getStore();
    const opts = processStorageOptions(this, state, options);
    const sqlSessionState = sqlSessionContextMergeStorageState(state, opts);

    // Build new state if options were processed
    const newState: AsyncState = opts
      ? {
          ...state,
          log: opts.log ?? state?.log,
          schema: opts.schema ?? state?.schema,
          ...sqlSessionState,
        }
      : (undefined as unknown as AsyncState);

    // If no options were processed, run with the existing state or directly if no state
    return !opts
      ? state
        ? this.internal.asyncStorage.run(state, cb)
        : cb()
      : this.internal.asyncStorage.run(newState, cb);
  }
}
