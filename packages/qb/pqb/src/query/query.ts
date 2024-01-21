import {
  GetStringArg,
  OnQueryBuilder,
  QueryMethods,
  WhereResult,
} from '../queryMethods';
import { QueryData } from '../sql';
import { AliasOrTable } from '../common/utils';
import { Db } from './db';
import { RelationsBase } from '../relations';
import { QueryError, QueryErrorName } from '../errors';
import {
  ColumnShapeOutput,
  EmptyObject,
  Expression,
  QueryCatch,
  QueryColumn,
  QueryColumns,
  QueryThen,
  Spread,
  StringKey,
} from 'orchid-core';
import { QueryBase } from './queryBase';

export type SelectableBase = Record<
  PropertyKey,
  { as: string; column: QueryColumn }
>;

export type SelectableFromShape<
  Shape extends QueryColumns,
  Table extends string | undefined,
> = { [K in keyof Shape]: { as: K; column: Shape[K] } } & {
  [K in keyof Shape as `${Table}.${StringKey<K>}`]: {
    as: K;
    column: Shape[K];
  };
};

export type WithDataItem = { table: string; shape: QueryColumns };
export type WithDataBase = Record<never, WithDataItem>;

export type Query = QueryBase &
  QueryMethods<unknown> & {
    queryBuilder: Db;
    columnTypes: unknown;
    onQueryBuilder: typeof OnQueryBuilder;
    table?: string;
    shape: QueryColumns;
    singlePrimaryKey: string;
    primaryKeys: string[];
    inputType: Record<string, unknown>;
    q: QueryData;
    result: QueryColumns;
    selectable: SelectableBase;
    then: QueryThen<unknown>;
    catch: QueryCatch<unknown>;
    windows: EmptyObject;
    defaultSelectColumns: string[];
    relations: RelationsBase;
    withData: WithDataBase;
    error: new (
      message: string,
      length: number,
      name: QueryErrorName,
    ) => QueryError;
  };

export type SelectableOfType<
  T extends Pick<QueryBase, 'selectable'>,
  Type,
> = StringKey<
  {
    [K in keyof T['selectable']]: T['selectable'][K]['column']['type'] extends Type | null
      ? K
      : never;
  }[keyof T['selectable']]
>;

export type SelectableOrExpressionOfType<
  T extends Pick<Query, 'selectable'>,
  C extends QueryColumn,
> = SelectableOfType<T, C['type']> | Expression<QueryColumn<C['type'] | null>>;

export type QueryWithTable = Query & { table: string };

export type QueryReturnType =
  | 'all'
  | 'one'
  | 'oneOrThrow'
  | 'rows'
  | 'pluck'
  | 'value'
  | 'valueOrThrow'
  | 'rowCount'
  | 'void';

export const queryTypeWithLimitOne = {
  one: true,
  oneOrThrow: true,
  value: true,
  valueOrThrow: true,
} as Record<QueryReturnType, true | undefined>;

export const isQueryReturnsAll = (q: Query) =>
  !q.q.returnType || q.q.returnType === 'all';

export type QueryReturnsAll<T extends QueryReturnType> = (
  QueryReturnType extends T ? 'all' : T
) extends 'all'
  ? true
  : false;

export type GetQueryResult<
  ReturnType extends QueryReturnType,
  Result extends QueryColumns,
> = QueryReturnsAll<ReturnType> extends true
  ? ColumnShapeOutput<Result>[]
  : ReturnType extends 'one'
  ? ColumnShapeOutput<Result> | undefined
  : ReturnType extends 'oneOrThrow'
  ? ColumnShapeOutput<Result>
  : ReturnType extends 'value'
  ? Result extends { value: QueryColumn }
    ? Result['value']['outputType'] | undefined
    : never
  : ReturnType extends 'valueOrThrow'
  ? Result extends { value: QueryColumn }
    ? Result['value']['outputType']
    : never
  : ReturnType extends 'rows'
  ? ColumnShapeOutput<Result>[keyof Result][][]
  : ReturnType extends 'pluck'
  ? Result extends { pluck: QueryColumn }
    ? Result['pluck']['outputType'][]
    : never
  : ReturnType extends 'rowCount'
  ? number
  : ReturnType extends 'void'
  ? void
  : never;

export type AddQuerySelect<
  T extends Pick<Query, 'result' | 'meta' | 'returnType'>,
  Result extends QueryColumns,
  Data = GetQueryResult<T['returnType'], Result>,
> = T['meta']['hasSelect'] extends true
  ? MergeSelect<T, Result, Data>
  : SetSelect<T, Result, Data>;

type MergeSelect<
  T extends Pick<Query, 'result'>,
  Result extends QueryColumns,
  Data,
  Merged extends QueryColumns = {
    [K in keyof T['result']]: K extends keyof Result ? unknown : T['result'][K];
  } & Result,
> = {
  [K in keyof T]: K extends 'result'
    ? Merged
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : T[K];
};

type SetSelect<
  T extends Pick<Query, 'result' | 'meta'>,
  Result extends QueryColumns,
  Data,
> = {
  [K in keyof T]: K extends 'meta'
    ? T['meta'] & { hasSelect: true }
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : T[K];
};

export type SetQueryReturns<
  T extends Query,
  R extends QueryReturnType,
  Data = GetQueryResult<R, T['result']>,
> = {
  [K in keyof T]: K extends 'returnType'
    ? R
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : T[K];
};

// Change the query type to return multiple object records.
// It wraps the query with `WhereResult` to allow updating and deleting all records when the `all` method is used.
export type SetQueryReturnsAll<T extends Query> = SetQueryReturns<
  WhereResult<T>,
  'all'
>;

export type SetQueryReturnsOneOptional<T extends Query> = SetQueryReturns<
  T,
  'one'
>;

export type SetQueryReturnsOne<T extends Query> = SetQueryReturns<
  T,
  'oneOrThrow'
>;

export type SetQueryReturnsRows<T extends Query> = SetQueryReturns<T, 'rows'>;

export type SetQueryReturnsPluck<
  T extends Query,
  S extends keyof T['selectable'] | Expression,
> = SetQueryReturnsPluckColumn<
  T,
  S extends keyof T['selectable']
    ? T['selectable'][S]['column']
    : S extends Expression
    ? S['_type']
    : never
>;

export type SetQueryReturnsPluckColumn<
  T extends Query,
  C extends QueryColumn,
> = Omit<T, 'result' | 'returnType' | 'then' | 'catch'> & {
  meta: {
    hasSelect: true;
  };
  result: { pluck: C };
  returnType: 'pluck';
  then: QueryThen<C['outputType'][]>;
  catch: QueryCatch<C['outputType'][]>;
};

export type SetQueryReturnsValueOptional<
  T extends Pick<Query, 'selectable'>,
  Arg extends GetStringArg<T>,
> = SetQueryReturnsValue<T, Arg, 'value'>;

export type SetQueryReturnsValue<
  T extends Pick<Query, 'selectable'>,
  Arg extends GetStringArg<T>,
  ReturnType extends 'value' | 'valueOrThrow' = 'valueOrThrow',
  Column extends QueryColumn = Arg extends keyof T['selectable']
    ? T['selectable'][Arg]['column']
    : Arg extends Query
    ? Arg['result']['value']
    : never,
> = SetQueryReturnsColumn<T, Column, ReturnType> & Column['operators'];

export type SetQueryReturnsColumnOptional<
  T,
  Column extends QueryColumn,
> = SetQueryReturnsColumn<T, Column, 'value'>;

export type SetQueryReturnsColumn<
  T,
  Column extends QueryColumn,
  ReturnType extends 'value' | 'valueOrThrow' = 'valueOrThrow',
  Data = ReturnType extends 'value'
    ? Column['outputType'] | undefined
    : Column['outputType'],
> = Omit<T, 'result' | 'returnType' | 'then' | 'catch'> & {
  meta: { hasSelect: true };
  result: { value: Column };
  returnType: ReturnType;
  then: QueryThen<Data>;
  catch: QueryCatch<Data>;
};

export type SetQueryReturnsRowCount<T extends Query> = SetQueryReturns<
  T,
  'rowCount'
>;

export type SetQueryReturnsVoid<T extends Query> = SetQueryReturns<T, 'void'>;

// Set the kind of the query, can be 'select', 'update', 'create', etc.
// `update` method is using the kind of query to allow only 'select' as a callback return for a column.
export type SetQueryKind<T extends Query, Kind extends string> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : T[K];
};

export type SetQueryTableAlias<
  T extends Pick<Query, 'selectable' | 'table' | 'meta' | 'shape'>,
  As extends string,
> = {
  [K in keyof T]: K extends 'selectable'
    ? Omit<
        T['selectable'],
        `${AliasOrTable<T>}.${StringKey<keyof T['shape']>}`
      > & {
        [K in keyof T['shape'] as `${As}.${StringKey<keyof T['shape']>}`]: {
          as: K;
          column: T['shape'][K];
        };
      }
    : K extends 'meta'
    ? Omit<T['meta'], 'as'> & {
        as: As;
      }
    : T[K];
};

export type SetQueryWith<
  T extends Query,
  WithData extends Record<string, WithDataItem>,
> = { [K in keyof T]: K extends 'withData' ? WithData : T[K] };

export type AddQueryWith<
  T extends Query,
  With extends WithDataItem,
> = SetQueryWith<T, Spread<[T['withData'], { [K in With['table']]: With }]>>;
