import { FnUnknownToUnknown, MaybePromise } from '../../utils';
import { HookSelect } from '../basic-features/select/hook-select';
import { Query } from '../query';
import { getValueKey } from '../basic-features/get/get-value-key';

export interface PickQueryDataParsers {
  // column parsers that are applied by default, when not selecting anything
  defaultParsers?: ColumnsParsers;
  // parsers added for selected items
  parsers?: ColumnsParsers;
  // parsers for nested records
  batchParsers?: BatchParsers;
}

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

/**
 * generic utility to add a parser to the query object
 * @param query - the query object, it will be mutated
 * @param key - the name of the column in the data loaded by the query
 * @param parser - function to process the value of the column with.
 */
export const setParserToQuery = (
  query: { parsers?: ColumnsParsers },
  key: string | getValueKey,
  parser?: ColumnParser,
) => {
  if (parser) {
    if (query.parsers) query.parsers[key] = parser;
    else query.parsers = { [key]: parser };
  } else if (query.parsers) {
    delete query.parsers[key];
  }
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

export const getQueryParsers = (q: Query, hookSelect?: HookSelect) => {
  if (hookSelect) {
    const parsers = { ...q.q.parsers };
    const { defaultParsers } = q.q;
    if (defaultParsers) {
      for (const [key, value] of hookSelect) {
        const parser = defaultParsers[key];
        if (parser) {
          parsers[value.as || key] = parser;
        }
      }
    }
    return parsers;
  }

  return q.q.select ? q.q.parsers : q.q.defaultParsers;
};
