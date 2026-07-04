import {
  FnUnknownToUnknown,
  MaybePromise,
  setObjectValueImmutable,
} from '../../utils';
import { HookSelect } from '../basic-features/select/hook-select';
import { Query, QueryReturnType } from '../query';
import { Column } from '../../columns';
import { PickQueryQ } from '../pick-query-types';
import { Expression } from '../expressions/expression';

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

export interface BatchParserPathEntry {
  key: string;
  returnType: QueryReturnType;
}

// To parse all returned rows. Unlike column parser, can return a promise.
export interface BatchParser {
  path: BatchParserPathEntry[];
  fn: (
    path: BatchParserPathEntry[],
    queryResult: { rows: unknown[] },
  ) => MaybePromise<void>;
}

// set of value parsers
// key is a name of a selected column,
// 'v' is a special name for a single-value queries parser
export type ColumnsParsers = { [K in string]?: ColumnParser };

// set of batch parsers
// is only triggered when loading all,
// or when using `hookSelect` or computed columns that convert response to `all` internally.
// key is a name of a selected column
export type BatchParsers = BatchParser[];

/**
 * generic utility to add a parser to the query object
 * @param query - the query object, it will be mutated
 * @param key - the name of the column in the data loaded by the query
 * @param parser - function to process the value of the column with.
 */
export const setParserToQuery = (
  query: { parsers?: ColumnsParsers },
  key: string,
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
  key: string,
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

export const addColumnParserToQuery = (
  q: { parsers?: ColumnsParsers },
  key: string,
  column: Column.Pick.QueryColumn,
) => {
  if ((column as Column)._parse) {
    setObjectValueImmutable(q, 'parsers', key, (column as Column)._parse);
  }
};

export const setValueParserToQuery = (
  q: { parsers?: ColumnsParsers },
  column: Column.Pick.QueryColumn,
) => {
  addColumnParserToQuery(q, 'v', column);
};

export const getValueParser = (parsers?: ColumnsParsers) => {
  return parsers?.v;
};

export const setValueParser = (
  q: PickQueryDataParsers,
  parser: ColumnParser | undefined,
) => {
  setObjectValueImmutable(q, 'parsers', 'v', parser);
};

// export const setValueParserForSelectedString = (
//   query: PickQueryQAndInternal,
//   arg: string,
//   as: string | undefined,
// ) => setParserForSelectedString(query, arg, as, 'v');

// add a parser for a raw expression column
// is used by .select and .get methods
export const addParserForRawExpression = (
  q: PickQueryQ,
  key: string,
  raw: Expression,
) => {
  if (raw.result.value) addColumnParserToQuery(q.q, key, raw.result.value);
};
