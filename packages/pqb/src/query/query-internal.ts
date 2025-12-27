import { QueryInternalColumnNameToKey } from './query-columns/query-columns';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TransactionState } from '../adapters/adapter';
import { RecordUnknown } from '../utils';

interface QueryInternalTableDataPrimaryKey {
  columns: string[];
  name?: string;
}

export interface QueryInternalTableDataBase {
  primaryKey?: QueryInternalTableDataPrimaryKey;
}

// static query data that is defined only once when the table instance is instantiated
// and doesn't change anymore
export interface QueryInternalBase extends QueryInternalColumnNameToKey {
  runtimeDefaultColumns?: string[];
  transactionStorage: AsyncLocalStorage<TransactionState>;
  // Store scopes data, used for adding or removing a scope to the query.
  scopes?: RecordUnknown;
  // `camelCase` by default, set to true to map column names to and from `snake_case`
  snakeCase?: boolean;
  // true means ignore, for migration generator
  noPrimaryKey: boolean;
  // table comment, for migration generator
  comment?: string;
  // access with `getPrimaryKeys` utility
  primaryKeys?: string[];
  // primary keys, indexes, checks and constraints of the table
  tableData: QueryInternalTableDataBase;
}
