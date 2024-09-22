import { AsyncLocalStorage } from 'node:async_hooks';
import { TransactionState } from './adapter';
import {
  EmptyObject,
  FnUnknownToUnknown,
  MaybePromise,
  RecordKeyTrue,
  RecordUnknown,
} from './utils';
import { QueryColumn, QueryColumns } from './columns';

export type HookSelect = Map<string, { select: string; as?: string }>;

export interface SqlCommonOptions {
  // additional columns to select for `after` hooks
  hookSelect?: HookSelect;
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

// static query data that is defined only once when the table instance is instantiated
// and doesn't change anymore
export interface QueryInternalBase {
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
}

// Scopes data stored in table instance. Doesn't change after defining a table.
export type CoreQueryScopes<Keys extends string> = {
  [K in Keys]: unknown;
};

export type QueryReturnType =
  | undefined
  | 'all'
  | 'one'
  | 'oneOrThrow'
  | 'rows'
  | 'pluck'
  | 'value'
  | 'valueOrThrow'
  | 'rowCount'
  | 'void';

export interface PickQueryTable {
  table?: string;
}

export interface PickQueryMeta {
  meta: QueryMetaBase;
}

export interface PickQueryResult {
  result: QueryColumns;
}

export interface PickQueryShape {
  shape: QueryColumns;
}

export interface PickQueryReturnType {
  returnType: QueryReturnType;
}

export interface PickQueryMetaShape extends PickQueryMeta, PickQueryShape {}

export interface PickQueryMetaResult extends PickQueryMeta, PickQueryResult {}

export interface PickQueryResultUniqueColumns extends PickQueryResult {
  internal: {
    uniqueColumns: unknown;
  };
}

export interface PickQueryUniqueProperties {
  internal: {
    uniqueColumnNames: unknown;
    uniqueColumnTuples: unknown;
    uniqueConstraints: unknown;
  };
}

export interface PickQueryMetaResultWindows extends PickQueryMetaResult {
  windows: EmptyObject;
}

export interface PickQueryTableMetaResult
  extends PickQueryTable,
    PickQueryMetaResult {}

export interface PickQueryTableMetaResultInputType
  extends PickQueryTableMetaResult {
  inputType: unknown;
}

export interface PickQueryTableMetaShape
  extends PickQueryTable,
    PickQueryMetaShape {}

export interface PickQueryTableMetaResultShape
  extends PickQueryTableMetaResult,
    PickQueryMetaShape {}

export interface PickQueryMetaReturnType
  extends PickQueryMeta,
    PickQueryReturnType {}

export interface PickQueryMetaResultReturnType
  extends PickQueryMetaResult,
    PickQueryReturnType {}

export interface PickQueryMetaShapeResultReturnType
  extends PickQueryMetaResultReturnType,
    PickQueryShape {}

export interface IsQuery {
  __isQuery: true;
}

// It is a generic interface that covers any query:
// both the table query objects
// and the lightweight queries inside `where` and `on` callbacks
export interface QueryBaseCommon<Scopes extends RecordKeyTrue = RecordKeyTrue>
  extends IsQuery {
  meta: QueryMetaBase<Scopes>;
  internal: QueryInternalBase;
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

// function to parse a single column after loading the data
export type ColumnParser = FnUnknownToUnknown;

// To parse all returned rows. Unlike column parser, can return a promise.
export interface BatchParser {
  path: string[];
  fn: (path: string[], queryResult: { rows: unknown[] }) => MaybePromise<void>;
}

// set of value parsers
// key is a name of a selected column,
// or it can be a `getValueKey` to parse single values requested by the `.get()`, `.count()`, or similar methods
export type ColumnsParsers = { [K in string | getValueKey]?: ColumnParser };

// set of batch parsers
// is only triggered when loading all,
// or when using `hookSelect` or computed columns that convert response to `all` internally.
// key is a name of a selected column,
// or it can be a `getValueKey` to parse single values requested by the `.get()`, `.count()`, or similar methods
export type BatchParsers = BatchParser[];

// result transformer: function for `transform`, object for `map`
export type QueryDataTransform =
  | FnUnknownToUnknown
  | { map: FnUnknownToUnknown };

/**
 * generic utility to add a parser to the query object
 * @param query - the query object, it will be mutated
 * @param key - the name of the column in the data loaded by the query
 * @param parser - function to process the value of the column with.
 */
export const setParserToQuery = (
  query: { parsers?: ColumnsParsers },
  key: string | getValueKey,
  parser: ColumnParser,
) => {
  if (query.parsers) query.parsers[key] = parser;
  else query.parsers = { [key]: parser };
};

/**
 * similar to setParserToQuery,
 * but if the parser for the column is already set,
 * this will wrap it with HOC to additionally parse with a provided function
 * @param query - the query object, it will be mutated
 * @param key - the name of the column in the data loaded by the query
 * @param parser - function to process the value of the column with.
 */
export const overrideParserInQuery = (
  query: { parsers?: ColumnsParsers },
  key: string | getValueKey,
  parser: ColumnParser,
) => {
  if (query.parsers) {
    const existing = query.parsers[key];
    query.parsers[key] = existing
      ? (value: unknown) => parser(existing(value))
      : parser;
  } else query.parsers = { [key]: parser } as ColumnsParsers;
};

/**
 * See `transform` query method.
 * This helper applies all transform functions to a result.
 *
 * @param returnType - return type of the query, for proper `map` handling
 * @param fns - array of transform functions, can be undefined
 * @param result - query result to transform
 */
export const applyTransforms = (
  returnType: QueryReturnType,
  fns: QueryDataTransform[],
  result: unknown,
): unknown => {
  for (const fn of fns) {
    if ('map' in fn) {
      if (!returnType || returnType === 'all' || returnType === 'pluck') {
        result = (result as unknown[]).map(fn.map);
      } else if (result !== undefined) {
        result = fn.map(result);
      }
    } else {
      result = fn(result);
    }
  }
  return result;
};
