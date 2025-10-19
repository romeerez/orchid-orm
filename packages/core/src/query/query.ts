import { AsyncLocalStorage } from 'node:async_hooks';
import { TransactionState } from '../adapter';
import {
  EmptyObject,
  pushOrNewArrayToObjectImmutable,
  RecordKeyTrue,
  RecordUnknown,
} from '../utils';
import { QueryColumn, QueryColumns } from '../columns';
import { DelayedRelationSelect } from './delayed-relational-select';
import { QueryInternalColumnNameToKey } from './column-name-to-key';
import { QueryDataBase } from './query-data';
import { HasHookSelect } from './hook-select';

export interface SqlCommonOptions extends HasHookSelect {
  delayedRelationSelect?: DelayedRelationSelect;
}

export interface SingleSqlItem {
  // SQL string
  text: string;
  // bind values passed along with SQL string
  values?: unknown[];
}

export interface SingleSql extends SingleSqlItem, SqlCommonOptions {}

export interface BatchSql extends SqlCommonOptions {
  // batch of sql queries, is used when there is too many binding params for insert
  batch: SingleSql[];
}

// Output type of the `toSQL` method of query objects.
// This will be passed to database adapter to perform query.
export type Sql = SingleSql | BatchSql;

// query metadata that is stored only on TS side, not available in runtime
export interface QueryMetaBase<Scopes extends RecordKeyTrue = RecordKeyTrue> {
  // kind of a query: select, update, create, etc.
  kind: string;
  // table alias
  as?: string;
  // single relations (belongsTo, hasOne) returns one when subQuery is true, returns many otherwise
  subQuery: boolean;
  // return type of `create`, `update`, `delete` depends on whether the query has select
  hasSelect?: true;
  // `update` and `delete` require the query to have `where`.
  // Calling `.all()` is also setting `hasWhere` to true.
  hasWhere?: true;
  // Record<string, true> where keys are columns with defaults for `create` to make them optional.
  defaults: EmptyObject;
  // Union of available full text search aliases to use in `headline` and in `order`.
  tsQuery?: string;
  // Used to determine what scopes are available on the table.
  scopes: Scopes;
  // tracking columns of the main table, joined tables, `with` tables that are available for `select`.
  selectable: SelectableBase;
  // union of columns to select by default or with *
  defaultSelect: PropertyKey;
}

// affects on typing of `chain`
export interface QueryMetaIsSubQuery {
  meta: {
    subQuery: true;
  };
}

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

// Scopes data stored in table instance. Doesn't change after defining a table.
export type CoreQueryScopes<Keys extends string> = {
  [K in Keys]: unknown;
};

export type QueryReturnType =
  | QueryReturnTypeAll
  | 'one'
  | 'oneOrThrow'
  | 'rows'
  | 'pluck'
  | 'value'
  | 'valueOrThrow'
  | 'void';

export type QueryReturnTypeAll = undefined | 'all';

export type QueryReturnTypeOptional = 'one' | 'value';

export interface IsQuery {
  __isQuery: true;
}

export interface IsQueries {
  [K: string]: IsQuery;
}

export interface QueryBase extends IsQuery {
  internal: QueryInternalBase;
  shape: QueryColumns;
  q: QueryDataBase;
  table?: string;
}

// It is a generic interface that covers any query:
// both the table query objects
// and the lightweight queries inside `where` and `on` callbacks
export interface QueryBaseCommon<Scopes extends RecordKeyTrue = RecordKeyTrue>
  extends QueryBase {
  meta: QueryMetaBase<Scopes>;
}

export interface SelectableBase {
  [K: PropertyKey]: { as: string; column: QueryColumn };
}

// Symbol that is used in the parsers in the query data for a column that doesn't have a name
// this is for the case when using query.get('column') or query.count() - it returns anonymous value
export type getValueKey = typeof getValueKey;

// Symbol that is used in the parsers in the query data for a column that doesn't have a name
// this is for the case when using query.get('column') or query.count() - it returns anonymous value
export const getValueKey = Symbol('get');

// result transformer: function for `transform`, object for `map`
export type QueryDataTransform =
  | QueryDataTransformFn
  | {
      map: (record: unknown, index: number, array: unknown) => unknown;
      thisArg?: unknown;
    };

interface QueryDataTransformFn {
  (data: unknown, queryData: unknown): unknown;
}

/**
 * See `transform` query method.
 * This helper applies all transform functions to a result.
 *
 * @param queryData - query data
 * @param returnType - return type of the query, for proper `map` handling
 * @param fns - array of transform functions, can be undefined
 * @param result - query result to transform
 */
export const applyTransforms = (
  queryData: unknown,
  returnType: QueryReturnType,
  fns: QueryDataTransform[],
  result: unknown,
): unknown => {
  for (const fn of fns) {
    if ('map' in fn) {
      if (!returnType || returnType === 'all' || returnType === 'pluck') {
        result = (result as unknown[]).map(fn.map, fn.thisArg);
      } else if (result !== undefined) {
        result =
          result === null ? null : fn.map.call(fn.thisArg, result, 0, result);
      }
    } else {
      result = fn(result, queryData);
    }
  }
  return result;
};

/**
 * Push a new element into an array in the query data - immutable version
 *
 * @param q - query
 * @param key - key to get the array
 * @param value - new element to push
 */
export const pushQueryValueImmutable = <T extends IsQuery>(
  q: T,
  key: string,
  value: unknown,
): T => {
  pushOrNewArrayToObjectImmutable(
    (q as unknown as { q: object }).q,
    key,
    value,
  );
  return q;
};

export interface QueryOrExpression<T> {
  result: { value: QueryColumn<T> };
}
