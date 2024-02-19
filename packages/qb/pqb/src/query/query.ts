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
  PickOutputType,
  PickOutputTypeAndOperators,
  PickType,
  QueryCatch,
  QueryColumn,
  QueryColumns,
  QueryThen,
  RecordUnknown,
  Spread,
} from 'orchid-core';
import { QueryBase } from './queryBase';

export type SelectableFromShape<
  Shape extends QueryColumns,
  Table extends string | undefined,
> = { [K in keyof Shape]: { as: K; column: Shape[K] } } & {
  [K in keyof Shape & string as `${Table}.${K}`]: {
    as: K;
    column: Shape[K];
  };
};

export type WithDataItem = { table: string; shape: QueryColumns };
export type WithDataBase = Record<never, WithDataItem>;

export interface Query extends QueryBase, QueryMethods<unknown> {
  queryBuilder: Db;
  columnTypes: unknown;
  onQueryBuilder: typeof OnQueryBuilder;
  shape: QueryColumns;
  singlePrimaryKey: string;
  primaryKeys: string[];
  inputType: RecordUnknown;
  q: QueryData;
  then: QueryThen<unknown>;
  catch: QueryCatch<unknown>;
  windows: EmptyObject;
  defaultSelectColumns: string[];
  relations: RelationsBase;
  error: new (
    message: string,
    length: number,
    name: QueryErrorName,
  ) => QueryError;
}

export type SelectableOfType<T extends Pick<QueryBase, 'meta'>, Type> = {
  [K in keyof T['meta']['selectable']]: T['meta']['selectable'][K]['column']['type'] extends Type | null
    ? K
    : never;
}[keyof T['meta']['selectable']];

export type SelectableOrExpressionOfType<
  T extends Pick<Query, 'meta'>,
  C extends PickType,
> = SelectableOfType<T, C['type']> | Expression<QueryColumn<C['type'] | null>>;

export interface QueryWithTable extends Query {
  table: string;
}

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
  ? Result['value']['outputType'] | undefined
  : ReturnType extends 'valueOrThrow'
  ? Result['value']['outputType']
  : ReturnType extends 'rows'
  ? ColumnShapeOutput<Result>[keyof Result][][]
  : ReturnType extends 'pluck'
  ? Result['pluck']['outputType'][]
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
> = {
  [K in keyof T]: K extends 'result'
    ? {
        [K in keyof T['result'] | keyof Result]: K extends keyof Result
          ? Result[K]
          : K extends keyof T['result']
          ? T['result'][K]
          : never;
      }
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
  T extends Pick<Query, 'result'>,
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

export type SetQueryReturnsKind<
  T extends Pick<Query, 'meta' | 'result'>,
  R extends QueryReturnType,
  Kind extends string,
  Data = GetQueryResult<R, T['result']>,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? R
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : T[K];
};

// Change the query type to return multiple object records.
// It wraps the query with `WhereResult` to allow updating and deleting all records when the `all` method is used.
export type SetQueryReturnsAll<T extends Pick<Query, 'result'>> =
  SetQueryReturns<WhereResult<T>, 'all'>;

export type SetQueryReturnsOneOptional<T extends Pick<Query, 'result'>> =
  SetQueryReturns<T, 'one'>;

export type SetQueryReturnsOne<T extends Pick<Query, 'result'>> =
  SetQueryReturns<T, 'oneOrThrow'>;

export type SetQueryReturnsOneKind<
  T extends Pick<Query, 'result' | 'meta'>,
  Kind extends string,
> = SetQueryReturnsKind<T, 'oneOrThrow', Kind>;

export type SetQueryReturnsRows<T extends Query> = SetQueryReturns<T, 'rows'>;

export type SetQueryReturnsPluck<
  T extends Pick<Query, 'meta'>,
  S extends keyof T['meta']['selectable'] | Expression,
> = SetQueryReturnsPluckColumn<
  T,
  S extends keyof T['meta']['selectable']
    ? T['meta']['selectable'][S]['column']
    : S extends Expression
    ? S['_type']
    : never
>;

export type SetQueryReturnsPluckColumn<T, C extends QueryColumn> = {
  [K in keyof T]: K extends 'meta'
    ? T[K] & { hasSelect: true }
    : K extends 'result'
    ? { pluck: C }
    : K extends 'returnType'
    ? 'pluck'
    : K extends 'then'
    ? QueryThen<C['outputType'][]>
    : K extends 'catch'
    ? QueryCatch<C['outputType'][]>
    : T[K];
};

export type SetQueryReturnsValueOptional<
  T extends Pick<Query, 'meta'>,
  Arg extends GetStringArg<T>,
> = SetQueryReturnsValue<T, Arg, 'value'>;

export type SetQueryReturnsValue<
  T extends Pick<Query, 'meta'>,
  Arg extends GetStringArg<T>,
  ReturnType extends 'value' | 'valueOrThrow' = 'valueOrThrow',
  Column extends PickOutputTypeAndOperators = Arg extends keyof T['meta']['selectable']
    ? T['meta']['selectable'][Arg]['column']
    : Arg extends Query
    ? Arg['result']['value']
    : never,
> = SetQueryReturnsColumn<T, Column, ReturnType> & Column['operators'];

export type SetQueryReturnsColumnOptional<
  T,
  Column extends PickOutputType,
> = SetQueryReturnsColumn<T, Column, 'value'>;

export type SetQueryReturnsColumn<
  T,
  Column extends PickOutputType,
  ReturnType extends 'value' | 'valueOrThrow' = 'valueOrThrow',
  Data = ReturnType extends 'value'
    ? Column['outputType'] | undefined
    : Column['outputType'],
> = {
  [K in keyof T]: K extends 'result'
    ? { value: Column }
    : K extends 'returnType'
    ? ReturnType
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : T[K];
} & { meta: { hasSelect: true } };

export type SetQueryReturnsColumnKind<
  T extends Pick<Query, 'meta'>,
  Column extends QueryColumn,
  Kind extends string,
  ReturnType extends 'value' | 'valueOrThrow' = 'valueOrThrow',
  Data = ReturnType extends 'value'
    ? Column['outputType'] | undefined
    : Column['outputType'],
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'result'
    ? { value: Column }
    : K extends 'returnType'
    ? ReturnType
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : T[K];
} & { meta: { hasSelect: true } };

export type SetQueryReturnsRowCount<
  T extends Pick<Query, 'result' | 'meta'>,
  Kind extends string,
> = SetQueryReturnsKind<T, 'rowCount', Kind>;

export type SetQueryReturnsVoid<T extends Query> = SetQueryReturns<T, 'void'>;

// Set the kind of the query, can be 'select', 'update', 'create', etc.
// `update` method is using the kind of query to allow only 'select' as a callback return for a column.
export type SetQueryKind<T extends Pick<Query, 'meta'>, Kind extends string> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : T[K];
};

export type SetQueryTableAlias<
  T extends Pick<Query, 'table' | 'meta' | 'shape'>,
  As extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta'] | 'as']: K extends 'as'
          ? As
          : K extends 'selectable'
          ? Omit<
              T['meta']['selectable'],
              `${AliasOrTable<T>}.${keyof T['shape'] & string}`
            > & {
              [K in keyof T['shape'] & string as `${As}.${K}`]: {
                as: K;
                column: T['shape'][K];
              };
            }
          : T['meta'][K];
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
