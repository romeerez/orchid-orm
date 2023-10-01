import {
  GetStringArg,
  OnQueryBuilder,
  QueryMethods,
  WhereResult,
} from '../queryMethods';
import { QueryData } from '../sql';
import { ColumnsShape, ColumnType } from '../columns';
import { AliasOrTable } from '../common/utils';
import { Db } from './db';
import { RelationsBase } from '../relations';
import { QueryError, QueryErrorName } from '../errors';
import {
  ColumnShapeOutput,
  ColumnsShapeBase,
  ColumnTypeBase,
  EmptyObject,
  Expression,
  QueryCatch,
  QueryThen,
  Spread,
  StringKey,
} from 'orchid-core';
import { QueryBase } from './queryBase';

export type SelectableBase = Record<
  PropertyKey,
  { as: string; column: ColumnTypeBase }
>;

export type SelectableFromShape<
  Shape extends ColumnsShapeBase,
  Table extends string | undefined,
> = { [K in keyof Shape]: { as: K; column: Shape[K] } } & {
  [K in keyof Shape as `${Table}.${StringKey<K>}`]: {
    as: K;
    column: Shape[K];
  };
};

export type WithDataItem = { table: string; shape: ColumnsShapeBase };
export type WithDataBase = Record<never, WithDataItem>;

export type Query = QueryBase &
  QueryMethods<unknown> & {
    queryBuilder: Db;
    columnTypes: unknown;
    onQueryBuilder: typeof OnQueryBuilder;
    table?: string;
    shape: ColumnsShape;
    singlePrimaryKey: string;
    primaryKeys: string[];
    inputType: Record<string, unknown>;
    q: QueryData;
    result: ColumnsShapeBase;
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

export type SelectableOfType<T extends QueryBase, Type> = StringKey<
  {
    [K in keyof T['selectable']]: T['selectable'][K]['column']['type'] extends Type | null
      ? K
      : never;
  }[keyof T['selectable']]
>;

export type SelectableOrExpressionOfType<
  T extends Query,
  C extends ColumnTypeBase,
> =
  | SelectableOfType<T, C['type']>
  | Expression<ColumnTypeBase<C['type'] | null>>;

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
  Result extends ColumnsShapeBase,
> = QueryReturnsAll<ReturnType> extends true
  ? ColumnShapeOutput<Result>[]
  : ReturnType extends 'one'
  ? ColumnShapeOutput<Result> | undefined
  : ReturnType extends 'oneOrThrow'
  ? ColumnShapeOutput<Result>
  : ReturnType extends 'value'
  ? Result extends { value: ColumnType }
    ? Result['value']['outputType'] | undefined
    : never
  : ReturnType extends 'valueOrThrow'
  ? Result extends { value: ColumnType }
    ? Result['value']['outputType']
    : never
  : ReturnType extends 'rows'
  ? ColumnShapeOutput<Result>[keyof Result][][]
  : ReturnType extends 'pluck'
  ? Result extends { pluck: ColumnType }
    ? Result['pluck']['outputType'][]
    : never
  : ReturnType extends 'rowCount'
  ? number
  : ReturnType extends 'void'
  ? void
  : never;

export type AddQuerySelect<
  T extends Pick<Query, 'result' | 'meta' | 'returnType'>,
  Result extends ColumnsShapeBase,
  Data = GetQueryResult<T['returnType'], Result>,
> = T['meta']['hasSelect'] extends true
  ? MergeSelect<T, Result, Data>
  : SetSelect<T, Result, Data>;

type MergeSelect<
  T extends Pick<Query, 'result'>,
  Result extends ColumnsShapeBase,
  Data,
  Merged extends ColumnsShapeBase = {
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
  Result extends ColumnsShapeBase,
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
  C extends ColumnTypeBase,
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
  T extends Query,
  Arg extends GetStringArg<T>,
> = SetQueryReturnsValue<T, Arg, 'value'>;

export type SetQueryReturnsValue<
  T extends Query,
  Arg extends GetStringArg<T>,
  ReturnType extends 'value' | 'valueOrThrow' = 'valueOrThrow',
  Column extends ColumnTypeBase = Arg extends keyof T['selectable']
    ? T['selectable'][Arg]['column']
    : Arg extends Query
    ? Arg['result']['value']
    : never,
> = SetQueryReturnsColumn<T, Column, ReturnType> & Column['operators'];

export type SetQueryReturnsColumnOptional<
  T extends QueryBase,
  Column extends ColumnTypeBase,
> = SetQueryReturnsColumn<T, Column, 'value'>;

export type SetQueryReturnsColumn<
  T extends QueryBase,
  Column extends ColumnTypeBase,
  ReturnType extends 'value' | 'valueOrThrow' = 'valueOrThrow',
  Data = ReturnType extends 'value'
    ? Column['outputType'] | undefined
    : Column['outputType'],
> = {
  [K in keyof T]: K extends 'meta'
    ? T['meta'] & { hasSelect: true }
    : K extends 'result'
    ? { value: Column }
    : K extends 'returnType'
    ? ReturnType
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : T[K];
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
  T extends Pick<Query, 'selectable' | 'table' | 'meta'> & {
    shape: ColumnsShapeBase;
  },
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
