import { AsyncLocalStorage } from 'node:async_hooks';
import { EmptyObject } from './utils';
import { TransactionState } from './adapter';

// Output type of the `toSQL` method of query objects.
// This will be passed to database adapter to perform query.
export type Sql = {
  // SQL string
  text: string;
  // bind values passed along with SQL string
  values: unknown[];
  // additional columns to select for `after` hooks
  hookSelect?: string[];
};

// query metadata that is stored only on TS side, not available in runtime
export type QueryMetaBase = {
  // kind of a query: select, update, create, etc.
  kind: string;
  // table alias
  as?: string;
  // return type of `create`, `update`, `delete` depends on whether the query has select
  hasSelect?: true;
  // `update` and `delete` require the query to have `where`.
  // Calling `.all()` is also setting `hasWhere` to true.
  hasWhere?: true;
  // Additional default values for `create`. Columns of the `defaults` become optional in `create`.
  defaults: EmptyObject;
  // Union of available full text search aliases to use in `headline` and in `order`.
  tsQuery?: string;
};

// static query data that is defined only once when the table instance is instantiated
// and doesn't change anymore
export type QueryInternal = {
  columnsForSelectAll?: string[];
  runtimeDefaultColumns?: string[];
  indexes?: {
    columns: ({ column: string } | { expression: string })[];
    options: { unique?: boolean };
  }[];
  transactionStorage: AsyncLocalStorage<TransactionState>;
};

// It is a generic interface that covers any query:
// both the table query objects
// and the lightweight queries inside `where` and `on` callbacks
export type QueryBaseCommon = {
  meta: QueryMetaBase;
  internal: QueryInternal;
};

// Symbol that is used in the parsers in the query data for a column that doesn't have a name
// this is for the case when using query.get('column') or query.count() - it returns anonymous value
export type getValueKey = typeof getValueKey;

// Symbol that is used in the parsers in the query data for a column that doesn't have a name
// this is for the case when using query.get('column') or query.count() - it returns anonymous value
export const getValueKey = Symbol('get');

// function to parse a single column after loading the data
export type ColumnParser = (input: unknown) => unknown;

// functions to parse columns after loading the data
// key is a name of a selected column,
// or it can be a `getValueKey` to parse single values requested by the `.get()`, `.count()`, or similar methods
export type ColumnsParsers = { [K in string | getValueKey]?: ColumnParser };

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
  else query.parsers = { [key]: parser } as ColumnsParsers;
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
 * @param fns - array of transform functions, can be undefined
 * @param result - query result to transform
 */
export const applyTransforms = (
  fns: ((input: unknown) => unknown)[] | undefined,
  result: unknown,
): unknown => {
  if (fns) {
    for (const fn of fns) {
      result = fn(result);
    }
  }
  return result;
};
