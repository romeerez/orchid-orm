import {
  ColumnParser,
  ColumnsParsers,
  Query,
  QueryReturnsAll,
  QueryThen,
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
} from 'orchid-core';
import { QueryBase } from '../queryBase';
import { _joinLateral } from './_join';

export type SelectArg<T extends QueryBase> =
  | '*'
  | StringKey<keyof T['selectable']>
  | SelectAsArg<T>;

type SelectAsArg<T extends QueryBase> = Record<string, SelectAsValue<T>>;

type SelectAsValue<T extends QueryBase> =
  | StringKey<keyof T['selectable']>
  | RawExpression
  | ((q: T) => Query)
  | ((q: T) => RawExpression)
  | ((q: T) => Query | RawExpression);

type SelectResult<
  T extends Query,
  Args extends SelectArg<T>[],
  SelectStringsResult extends ColumnsShapeBase = SelectStringArgsResult<
    T,
    Args
  >,
  StringsKeys extends keyof SelectStringsResult = keyof SelectStringsResult,
  SelectAsResult extends ColumnsShapeBase = SpreadSelectArgs<T, Args>,
  AsKeys extends keyof SelectAsResult = keyof SelectAsResult,
  ResultKeys extends keyof T['result'] = T['meta']['hasSelect'] extends true
    ? keyof T['result']
    : never,
  ShapeKeys extends keyof T['shape'] = '*' extends Args[number]
    ? keyof T['shape']
    : never,
  Result extends ColumnsShapeBase = {
    [K in StringsKeys | AsKeys | ResultKeys | ShapeKeys]: K extends StringsKeys
      ? SelectStringsResult[K]
      : K extends AsKeys
      ? SelectAsResult[K]
      : K extends ResultKeys
      ? T['result'][K]
      : K extends ShapeKeys
      ? T['shape'][K]
      : never;
  },
> = (T['meta']['hasSelect'] extends true
  ? unknown
  : { meta: { hasSelect: true } }) & {
  [K in keyof T]: K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<T['returnType'], Result>
    : T[K];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpreadSelectArgs<T extends Query, Args extends [...any]> = Args extends [
  infer L,
  ...infer R,
]
  ? L extends SelectAsArg<T>
    ? SelectAsResult<T, L> & SpreadSelectArgs<T, R>
    : SpreadSelectArgs<T, R>
  : EmptyObject;

type SelectStringArgsResult<T extends Query, Args extends SelectArg<T>[]> = {
  [Arg in Args[number] as Arg extends keyof T['selectable']
    ? T['selectable'][Arg]['as']
    : never]: Arg extends keyof T['selectable']
    ? T['selectable'][Arg]['column']
    : never;
};

type SelectAsResult<T extends Query, Arg extends SelectAsArg<T>> = {
  [K in keyof Arg]: SelectAsValueResult<T, Arg[K]>;
};

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
      q.query.joinRelationAs = key;
      value = value(q);
      q.isSubQuery = isSubQuery;

      if (!isRaw(value) && value.joinQuery) {
        value = value.joinQuery(q, value);
        value.query.joinedForSelect = true;

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
          query = value;
        }

        _joinLateral(q, 'LEFT JOIN', query, (q) => q, key);
      }
    }

    selectAs[key] = addParserForSelectItem(q, as, key, value);
  }

  return { selectAs };
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
export const getShapeFromSelect = (q: QueryBase, isSubQuery?: boolean) => {
  const query = q.query as SelectQueryData;
  const { select, shape } = query;
  if (!select) {
    return shape;
  }

  const result: ColumnsShapeBase = {};
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

  return result;
};

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

const maybeUnNameColumn = (column: ColumnTypeBase, isSubQuery?: boolean) => {
  if (!isSubQuery || !column.data.name) return column;

  const cloned = Object.create(column);
  cloned.data = { ...column.data };
  delete cloned.data.name;
  return cloned;
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
