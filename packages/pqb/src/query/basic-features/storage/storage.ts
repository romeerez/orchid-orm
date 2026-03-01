import { logParamToLogObject, QueryLogObject } from '../log/log';
import {
  TransactionAdapterBase,
  TransactionAfterCommitHook,
} from '../../../adapters/adapter';
import { PickQueryQ, PickQueryQAndInternal } from '../../pick-query-types';
import { QuerySchema } from '../schema/schema';

export interface AsyncState {
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

export interface StorageOptions {
  log?: boolean;
  schema?: QuerySchema;
}

export const processStorageOptions = (
  query: PickQueryQ,
  options: StorageOptions,
): Pick<AsyncState, 'log' | 'schema'> | undefined => {
  let log;
  if (options.log !== undefined && !query.q.log) {
    log = logParamToLogObject(query.q.logger, options.log);
  }

  return log || 'schema' in options
    ? {
        log,
        schema: options.schema,
      }
    : undefined;
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
    const opts = processStorageOptions(this, options);

    return this.internal.asyncStorage.run(
      {
        ...state,
        ...opts,
      },
      cb,
    );
  }
}
