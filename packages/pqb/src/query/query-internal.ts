import { QueryInternalColumnNameToKey } from './query-columns/query-columns';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TransactionState } from '../adapters/adapter';
import { RecordUnknown } from '../utils';
import { TableData } from '../tableData';
import {
  DbDomainArgRecord,
  DbExtension,
  GeneratorIgnore,
  Query,
} from './query';

// static query data that is defined only once when the table instance is instantiated
// and doesn't change anymore
export interface QueryInternal<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SinglePrimaryKey = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UniqueColumns = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UniqueColumnNames = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UniqueColumnTuples = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UniqueConstraints = any,
> extends QueryInternalColumnNameToKey {
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
  singlePrimaryKey: SinglePrimaryKey;
  uniqueColumns: UniqueColumns;
  uniqueColumnNames: UniqueColumnNames;
  uniqueColumnTuples: UniqueColumnTuples;
  uniqueConstraints: UniqueConstraints;
  extensions?: DbExtension[];
  domains?: DbDomainArgRecord;
  generatorIgnore?: GeneratorIgnore;
  // primary keys, indexes, checks and constraints of the table
  tableData: TableData;
  // For customizing `now()` sql
  nowSQL?: string;
  // for select, where, join callbacks: memoize a query extended with relations, so query.relName is a relation query
  callbackArg?: Query;
  selectAllCount: number;
  /**
   * @see DbSharedOptions
   */
  nestedCreateBatchMax: number;
}
