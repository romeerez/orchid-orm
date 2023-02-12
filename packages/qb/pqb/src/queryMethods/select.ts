import {
  AddQuerySelect,
  ColumnParser,
  ColumnsParsers,
  isQueryReturnsMultipleRows,
  Query,
  QueryBase,
  QueryReturnsAll,
  QuerySelectAll,
} from '../query';
import {
  ArrayOfColumnsObjects,
  ColumnsObject,
  NullableColumn,
  PluckResultColumnType,
} from '../columns';
import { RawExpression } from '../raw';
import { pushQueryArray } from '../queryDataUtils';
import { parseResult } from './then';
import { QueryData, SelectItem, SelectQueryData } from '../sql';
import {
  FilterTuple,
  getQueryParsers,
  SimpleSpread,
  StringKey,
} from '../utils';
import { isRequiredRelationKey, Relation } from '../relations';
import { getValueKey } from './get';
import { QueryResult } from '../adapter';

export type SelectArg<T extends QueryBase> =
  | StringKey<keyof T['selectable']>
  | (T['relations'] extends Record<string, Relation>
      ? StringKey<keyof T['relations']>
      : never)
  | SelectAsArg<T>;

type SelectAsArg<T extends QueryBase> = Record<
  string,
  StringKey<keyof T['selectable']> | RawExpression | ((q: T) => Query)
>;

type SelectResult<
  T extends Query,
  Args extends SelectArg<T>[],
  SelectAsArgs = SimpleSpread<FilterTuple<Args, SelectAsArg<T>>>,
> = AddQuerySelect<
  T,
  {
    [Arg in Args[number] as Arg extends keyof T['selectable']
      ? T['selectable'][Arg]['as']
      : Arg extends keyof T['relations']
      ? Arg
      : never]: Arg extends keyof T['selectable']
      ? T['selectable'][Arg]['column']
      : T['relations'] extends Record<string, Relation>
      ? Arg extends keyof T['relations']
        ? T['relations'][Arg]['returns'] extends 'many'
          ? ArrayOfColumnsObjects<T['relations'][Arg]['table']['result']>
          : T['relations'][Arg]['options']['required'] extends true
          ? ColumnsObject<T['relations'][Arg]['table']['result']>
          : NullableColumn<
              ColumnsObject<T['relations'][Arg]['table']['result']>
            >
        : never
      : never;
  } & {
    [K in keyof SelectAsArgs]: SelectAsArgs[K] extends keyof T['selectable']
      ? T['selectable'][SelectAsArgs[K]]['column']
      : SelectAsArgs[K] extends RawExpression
      ? SelectAsArgs[K]['__column']
      : SelectAsArgs[K] extends (q: T) => Query
      ? SelectSubQueryResult<ReturnType<SelectAsArgs[K]>>
      : SelectAsArgs[K] extends ((q: T) => Query) | RawExpression
      ?
          | SelectSubQueryResult<
              ReturnType<Exclude<SelectAsArgs[K], RawExpression>>
            >
          | Exclude<SelectAsArgs[K], (q: T) => Query>['__column']
      : never;
  }
>;

type SelectSubQueryResult<
  Arg extends Query & { [isRequiredRelationKey]?: boolean },
> = QueryReturnsAll<Arg['returnType']> extends true
  ? ArrayOfColumnsObjects<Arg['result']>
  : Arg['returnType'] extends 'valueOrThrow'
  ? Arg['result']['value']
  : Arg['returnType'] extends 'pluck'
  ? PluckResultColumnType<Arg['result']['pluck']>
  : Arg[isRequiredRelationKey] extends true
  ? ColumnsObject<Arg['result']>
  : NullableColumn<ColumnsObject<Arg['result']>>;

export const addParserForRawExpression = (
  q: Query,
  key: string | getValueKey,
  raw: RawExpression,
) => {
  const parser = raw.__column?.parseFn;
  if (parser) addParserToQuery(q.query, key, parser);
};

// these are used as a wrapper to pass sub query result to `parseRecord`
const subQueryResult: QueryResult = {
  // sub query can't return a rowCount, use -1 as for impossible case
  rowCount: -1,
  rows: [],
};

export const addParserForSelectItem = <T extends Query>(
  q: T,
  as: string | getValueKey | undefined,
  key: string,
  arg: StringKey<keyof T['selectable']> | RawExpression | ((q: T) => Query),
): string | RawExpression | Query => {
  if (typeof arg === 'object') {
    addParserForRawExpression(q, key, arg);
    return arg;
  } else if (typeof arg === 'function') {
    q.isSubQuery = true;
    const rel = arg(q);
    q.isSubQuery = false;
    const parsers = getQueryParsers(rel);
    if (parsers) {
      addParserToQuery(q.query, key, (item) => {
        subQueryResult.rows = isQueryReturnsMultipleRows(rel)
          ? (item as unknown[])
          : [item];
        return parseResult(rel, rel.query.returnType || 'all', subQueryResult);
      });
    }
    return rel;
  } else {
    const index = arg.indexOf('.');
    if (index !== -1) {
      const table = arg.slice(0, index);
      const column = arg.slice(index + 1);

      if (table === as) {
        const parser = q.columnsParsers?.[column];
        if (parser) addParserToQuery(q.query, key, parser);
      } else {
        const parser = (q.query as SelectQueryData).joinedParsers?.[table]?.[
          column
        ];
        if (parser) addParserToQuery(q.query, key, parser);
      }
    } else {
      const parser = q.columnsParsers?.[arg];
      if (parser) addParserToQuery(q.query, key, parser);
    }
    return arg;
  }
};

export const addParserToQuery = (
  query: QueryData,
  key: string | getValueKey,
  parser: ColumnParser,
) => {
  if (query.parsers) query.parsers[key] = parser;
  else query.parsers = { [key]: parser } as ColumnsParsers;
};

export const processSelectArg = <T extends Query>(
  q: T,
  as: string | undefined,
  arg: SelectArg<T>,
  columnAs?: string | getValueKey,
): SelectItem => {
  if (typeof arg === 'string') {
    if ((q.relations as Record<string, Relation>)[arg]) {
      const rel = (q.relations as Record<string, Relation>)[arg];
      arg = {
        [arg]: () => rel.joinQuery(q, rel.query),
      };
    } else {
      return processSelectColumnArg(q, arg, as, columnAs);
    }
  }

  return processSelectAsArg(q, arg, as);
};

const processSelectColumnArg = <T extends Query>(
  q: T,
  arg: string,
  as?: string,
  columnAs?: string | getValueKey,
): SelectItem => {
  const index = arg.indexOf('.');
  if (index !== -1) {
    const table = arg.slice(0, index);
    const column = arg.slice(index + 1);

    if (table === as) {
      const parser = q.columnsParsers?.[column];
      if (parser) addParserToQuery(q.query, columnAs || column, parser);
    } else {
      const parser = (q.query as SelectQueryData).joinedParsers?.[table]?.[
        column
      ];
      if (parser) addParserToQuery(q.query, columnAs || column, parser);
    }
  } else {
    const parser = q.columnsParsers?.[arg];
    if (parser) addParserToQuery(q.query, columnAs || arg, parser);
  }
  return arg;
};

const processSelectAsArg = <T extends Query>(
  q: T,
  arg: SelectAsArg<T>,
  as?: string,
): SelectItem => {
  const selectAs: Record<string, string | Query | RawExpression> = {};
  for (const key in arg) {
    selectAs[key] = addParserForSelectItem(q, as, key, arg[key]);
  }
  return { selectAs };
};

export class Select {
  select<T extends Query, K extends SelectArg<T>[]>(
    this: T,
    ...args: K
  ): SelectResult<T, K> {
    return this.clone()._select(...args) as unknown as SelectResult<T, K>;
  }

  _select<T extends Query, K extends SelectArg<T>[]>(
    this: T,
    ...args: K
  ): SelectResult<T, K> {
    if (!args.length) {
      return this as unknown as SelectResult<T, K>;
    }

    const as = this.query.as || this.table;
    const selectArgs = args.map((item) => processSelectArg(this, as, item));

    return pushQueryArray(
      this,
      'select',
      selectArgs,
    ) as unknown as SelectResult<T, K>;
  }

  selectAll<T extends Query>(this: T): QuerySelectAll<T> {
    return this.clone()._selectAll();
  }

  _selectAll<T extends Query>(this: T): QuerySelectAll<T> {
    this.query.select = ['*'];
    return this as unknown as QuerySelectAll<T>;
  }
}
