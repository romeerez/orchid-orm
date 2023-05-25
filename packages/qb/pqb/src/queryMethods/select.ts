import {
  ColumnParser,
  ColumnsParsers,
  Query,
  QueryReturnsAll,
  GetQueryResult,
  SelectableBase,
} from '../query';
import {
  ArrayOfColumnsObjects,
  ColumnsObject,
  JSONTextColumn,
  PluckResultColumnType,
} from '../columns';
import { pushQueryArray } from '../queryDataUtils';
import { JoinedParsers, QueryData, SelectItem, SelectQueryData } from '../sql';
import { isRequiredRelationKey, Relation } from '../relations';
import { getValueKey } from './get';
import { QueryResult } from '../adapter';
import { UnknownColumn } from '../columns/unknown';
import {
  StringKey,
  isRaw,
  RawExpression,
  ColumnsShapeBase,
  NullableColumn,
  ColumnTypeBase,
  EmptyObject,
  raw,
  setColumnData,
  QueryThen,
  QueryCatch,
} from 'orchid-core';
import { QueryBase } from '../queryBase';
import { _joinLateral } from './_join';

// .select method argument
export type SelectArg<T extends QueryBase> =
  | '*'
  | StringKey<keyof T['selectable']>
  | SelectAsArg<T>;

// .select method object argument
// key is alias for selected item,
// value can be a column, raw, or a function returning query or raw
type SelectAsArg<T extends QueryBase> = Record<string, SelectAsValue<T>>;

// .select method object argument value
// can be column, raw, or a function returning query or raw
type SelectAsValue<T extends QueryBase> =
  | StringKey<keyof T['selectable']>
  | RawExpression
  | ((q: T) => Query)
  | ((q: T) => RawExpression)
  | ((q: T) => Query | RawExpression);

// tuple for the result of selected by objects args
// the first element is shape of selected data
// the second is 'selectable', it allows to order and filter by the records
// that were implicitly joined when selecting belongsTo or hasOne relation
// ```ts
// db.book.select({ author: (q) => q.author }).order('author.name')
// ```
type SelectObjectResultTuple = [ColumnsShapeBase, SelectableBase];

// query type after select
type SelectResult<
  T extends Query,
  Args extends SelectArg<T>[],
  // shape of the columns selected by string args
  SelectStringsResult extends ColumnsShapeBase = SelectStringArgsResult<
    T,
    Args
  >,
  // keys of selected columns by string args
  StringsKeys extends keyof SelectStringsResult = keyof SelectStringsResult,
  // tuple for the result of selected by objects args
  SelectAsResult extends SelectObjectResultTuple = SpreadSelectObjectArgs<
    T,
    Args,
    [EmptyObject, T['selectable']]
  >,
  // keys of combined object args
  AsKeys extends keyof SelectAsResult[0] = keyof SelectAsResult[0],
  // previous result keys to preserve, if the query has select
  ResultKeys extends keyof T['result'] = T['meta']['hasSelect'] extends true
    ? keyof T['result']
    : never,
  // to include all columns when * arg is provided
  ShapeKeys extends keyof T['shape'] = '*' extends Args[number]
    ? keyof T['shape']
    : never,
  // combine previously selected items, all columns if * was provided,
  // and the selected by string and object arguments
  Result extends ColumnsShapeBase = {
    [K in StringsKeys | AsKeys | ResultKeys | ShapeKeys]: K extends StringsKeys
      ? SelectStringsResult[K]
      : K extends AsKeys
      ? SelectAsResult[0][K]
      : K extends ResultKeys
      ? T['result'][K]
      : K extends ShapeKeys
      ? T['shape'][K]
      : never;
  },
  Data = GetQueryResult<T['returnType'], Result>,
> = (T['meta']['hasSelect'] extends true
  ? unknown
  : { meta: { hasSelect: true } }) & {
  [K in keyof T]: K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : K extends 'selectable'
    ? SelectAsResult[1]
    : T[K];
};

// map string args of the select into a resulting object
type SelectStringArgsResult<T extends Query, Args extends SelectArg<T>[]> = {
  [Arg in Args[number] as Arg extends keyof T['selectable']
    ? T['selectable'][Arg]['as']
    : never]: Arg extends keyof T['selectable']
    ? T['selectable'][Arg]['column']
    : never;
};

// combine multiple object args of the select into a tuple
type SpreadSelectObjectArgs<
  T extends Query,
  Args extends [...unknown[]],
  Result extends SelectObjectResultTuple,
> = Args extends [infer L, ...infer R]
  ? SpreadSelectObjectArgs<T, R, SelectAsResult<T, L, Result>>
  : Result;

// map a single object arg of the select into the tuple of selected data and selectable columns
type SelectAsResult<
  T extends Query,
  Arg,
  Result extends SelectObjectResultTuple,
  Shape = Result[0],
  AddSelectable extends SelectableBase = {
    [K in keyof Arg]: Arg[K] extends ((q: T) => infer R extends Query)
      ? // turn union of objects into intersection
        // https://stackoverflow.com/questions/66445084/intersection-of-an-objects-value-types-in-typescript
        (x: {
          [C in keyof R['result'] as `${StringKey<K>}.${StringKey<C>}`]: {
            as: C;
            column: R['result'][C];
          };
        }) => void
      : never;
  }[keyof Arg] extends (x: infer I) => void
    ? { [K in keyof I]: I[K] }
    : never,
> = Arg extends SelectAsArg<T>
  ? [
      {
        [K in keyof Shape | keyof Arg]: K extends keyof Arg
          ? SelectAsValueResult<T, Arg[K]>
          : K extends keyof Shape
          ? Shape[K]
          : never;
      },
      Result[1] & AddSelectable,
    ]
  : Result;

// map a single value of select object arg into a column
type SelectAsValueResult<
  T extends Query,
  Arg extends SelectAsValue<T>,
> = Arg extends keyof T['selectable']
  ? T['selectable'][Arg]['column']
  : Arg extends RawExpression
  ? Arg['__column']
  : Arg extends (q: T) => infer R
  ? R extends Query
    ? SelectSubQueryResult<R>
    : R extends RawExpression
    ? R['__column']
    : R extends Query | RawExpression
    ?
        | SelectSubQueryResult<Exclude<R, RawExpression>>
        | Exclude<R, Query>['__column']
    : never
  : never;

// map a sub query result into a column
// query that returns many becomes an array column
// query that returns a single value becomes a column of that value
// query that returns 'pluck' becomes a column with array type of specific value type
// query that returns a single record becomes an object column, possibly nullable
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

// add a parser for a raw expression column
// is used by .select and .get methods
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

// add parsers when selecting a full joined table by name or alias
const addParsersForSelectJoined = (q: Query, arg: string, as = arg) => {
  const parsers = (q.query.joinedParsers as JoinedParsers)[arg];
  if (parsers) {
    addParserToQuery(q.query, as, (item) => {
      subQueryResult.rows = [item];
      const type = q.query.returnType;
      q.query.returnType = 'one';
      const res = q.query.handleResult(q, subQueryResult, true);
      q.query.returnType = type;
      return res;
    });
  }
};

// add parser for a single key-value pair of selected object
export const addParserForSelectItem = <T extends Query>(
  q: T,
  as: string | getValueKey | undefined,
  key: string,
  arg: StringKey<keyof T['selectable']> | RawExpression | Query,
): string | RawExpression | Query => {
  if (typeof arg === 'object') {
    if (isRaw(arg)) {
      addParserForRawExpression(q, key, arg);
    } else {
      const { parsers } = arg.query;
      if (parsers) {
        addParserToQuery(q.query, key, (item) => {
          const t = arg.query.returnType || 'all';
          subQueryResult.rows =
            t === 'value' || t === 'valueOrThrow'
              ? [[item]]
              : t === 'one' || t === 'oneOrThrow'
              ? [item]
              : (item as unknown[]);

          return arg.query.handleResult(arg, subQueryResult, true);
        });
      }
    }
    return arg;
  } else {
    if (q.query.joinedShapes?.[arg]) {
      addParsersForSelectJoined(q, arg, key);
    } else {
      const index = arg.indexOf('.');
      if (index !== -1) {
        const table = arg.slice(0, index);
        const column = arg.slice(index + 1);

        if (table === as) {
          const parser = q.query.parsers?.[column];
          if (parser) addParserToQuery(q.query, key, parser);
        } else {
          const parser = q.query.joinedParsers?.[table]?.[column];
          if (parser) addParserToQuery(q.query, key, parser);
        }
      } else {
        const parser = q.query.parsers?.[arg];
        if (parser) addParserToQuery(q.query, key, parser);
      }
    }

    return arg;
  }
};

// generic utility to add a parser to the query object
export const addParserToQuery = (
  query: QueryData,
  key: string | getValueKey,
  parser: ColumnParser,
) => {
  if (query.parsers) query.parsers[key] = parser;
  else query.parsers = { [key]: parser } as ColumnsParsers;
};

// process select argument: add parsers, join relations when needed
export const processSelectArg = <T extends Query>(
  q: T,
  as: string | undefined,
  arg: SelectArg<T>,
  columnAs?: string | getValueKey,
): SelectItem => {
  if (typeof arg === 'string') {
    if (q.query.joinedShapes?.[arg]) {
      addParsersForSelectJoined(q, arg);
      return arg;
    } else {
      return processSelectColumnArg(q, arg, as, columnAs);
    }
  }

  const selectAs: Record<string, string | Query | RawExpression> = {};

  for (const key in arg as SelectAsArg<T>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value = (arg as SelectAsArg<T>)[key] as any;

    if (typeof value === 'function') {
      const { isSubQuery } = q;
      q.isSubQuery = true;
      value = value(q);
      q.isSubQuery = isSubQuery;

      if (!isRaw(value) && value.joinQuery) {
        value = value.joinQuery(q, value);
        value.query.joinedForSelect = key;

        let query;
        const returnType = value.query.returnType;
        if (!returnType || returnType === 'all') {
          query = value.json(false);
          value.query.coalesceValue = raw("'[]'");
        } else if (returnType === 'pluck') {
          query = value
            .wrap(value.baseQuery.clone())
            ._jsonAgg(value.query.select[0]);
          value.query.coalesceValue = raw("'[]'");
        } else {
          if (
            (returnType === 'value' || returnType === 'valueOrThrow') &&
            value.query.select
          ) {
            if (typeof value.query.select[0] === 'string') {
              value.query.select[0] = {
                selectAs: { r: value.query.select[0] },
              };
            }
          }

          query = value;
        }

        _joinLateral(
          q,
          value.query.innerJoinLateral ? 'JOIN' : 'LEFT JOIN',
          query,
          (q) => q,
          key,
        );
      }
    }

    selectAs[key] = addParserForSelectItem(q, as, key, value);
  }

  return { selectAs };
};

// process string select arg
// adds a column parser for a column
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
      const parser = q.query.parsers?.[column];
      if (parser) addParserToQuery(q.query, columnAs || column, parser);
    } else {
      const parser = q.query.joinedParsers?.[table]?.[column];
      if (parser) addParserToQuery(q.query, columnAs || column, parser);
    }
  } else {
    const parser = q.query.parsers?.[arg];
    if (parser) addParserToQuery(q.query, columnAs || arg, parser);
  }
  return arg;
};

// is mapping result of a query into a columns shape
// in this way, result of a sub query becomes available outside of it for using in WHERE and other methods
//
// when isSubQuery is true, it will remove data.name of columns,
// so that outside of the sub-query the columns are named with app-side names,
// while db column names are encapsulated inside the sub-query
export const getShapeFromSelect = (q: QueryBase, isSubQuery?: boolean) => {
  const query = q.query as SelectQueryData;
  const { select, shape } = query;
  let result: ColumnsShapeBase;
  if (!select) {
    // when no select, and it is a sub-query, return the table shape with unnamed columns
    if (isSubQuery) {
      result = {};
      for (const key in shape) {
        const column = shape[key];
        result[key] = column.data.name
          ? setColumnData(column, 'name', undefined)
          : column;
      }
    } else {
      result = shape;
    }
  } else {
    result = {};
    for (const item of select) {
      if (typeof item === 'string') {
        addColumnToShapeFromSelect(q, item, shape, query, result, isSubQuery);
      } else if ('selectAs' in item) {
        for (const key in item.selectAs) {
          const it = item.selectAs[key];
          if (typeof it === 'string') {
            addColumnToShapeFromSelect(
              q,
              it,
              shape,
              query,
              result,
              isSubQuery,
              key,
            );
          } else if (isRaw(it)) {
            result[key] = it.__column || new UnknownColumn();
          } else {
            const { returnType } = it.query;
            if (returnType === 'value' || returnType === 'valueOrThrow') {
              const type = (it.query as SelectQueryData)[getValueKey];
              if (type) result[key] = type;
            } else {
              result[key] = new JSONTextColumn();
            }
          }
        }
      }
    }
  }

  return result;
};

// converts selected items into a shape of columns
// when `isSubQuery` is true, it un-names named columns
const addColumnToShapeFromSelect = (
  q: QueryBase,
  arg: string,
  shape: ColumnsShapeBase,
  query: SelectQueryData,
  result: ColumnsShapeBase,
  isSubQuery?: boolean,
  key?: string,
) => {
  if ((q.relations as Record<string, Relation>)[arg]) {
    result[key || arg] = new JSONTextColumn();
    return;
  }

  const index = arg.indexOf('.');
  if (index !== -1) {
    const table = arg.slice(0, index);
    const column = arg.slice(index + 1);
    if (table === (q.query.as || q.table)) {
      result[key || column] = shape[column];
    } else {
      const it = query.joinedShapes?.[table]?.[column];
      if (it) result[key || column] = maybeUnNameColumn(it, isSubQuery);
    }
  } else if (arg === '*') {
    for (const key in shape) {
      result[key] = maybeUnNameColumn(shape[key], isSubQuery);
    }
  } else {
    result[key || arg] = maybeUnNameColumn(shape[arg], isSubQuery);
  }
};

// un-name a column if `isSubQuery` is true
const maybeUnNameColumn = (column: ColumnTypeBase, isSubQuery?: boolean) => {
  return isSubQuery && column.data.name
    ? setColumnData(column, 'name', undefined)
    : column;
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

  selectAll<T extends Query>(this: T): SelectResult<T, ['*']> {
    return this.clone()._selectAll();
  }

  _selectAll<T extends Query>(this: T): SelectResult<T, ['*']> {
    this.query.select = ['*'];
    return this as unknown as SelectResult<T, ['*']>;
  }
}
