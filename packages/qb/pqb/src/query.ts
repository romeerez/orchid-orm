import {
  ColumnInfo,
  GetArg,
  getValueKey,
  OnQueryBuilder,
  QueryMethods,
  WhereQueryBuilder,
} from './queryMethods';
import { QueryData } from './sql';
import { ColumnsShape, ColumnType } from './columns';
import { AliasOrTable } from './utils';
import { Db } from './db';
import { RelationQueryBase, RelationsBase } from './relations';
import { QueryError, QueryErrorName } from './errors';
import {
  RawExpression,
  ColumnTypeBase,
  ColumnTypesBase,
  EmptyObject,
  Spread,
  StringKey,
  QueryBaseCommon,
  QueryCommon,
  ColumnShapeOutput,
  ColumnsShapeBase,
  ThenResult,
} from 'orchid-core';

export type ColumnParser = (input: unknown) => unknown;
export type ColumnsParsers = Record<string | getValueKey, ColumnParser>;

export type SelectableBase = Record<
  PropertyKey,
  { as: string; column: ColumnType }
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

export type WithDataItem = { table: string; shape: ColumnsShape };
export type WithDataBase = Record<never, WithDataItem>;

export type QueryBase = QueryBaseCommon & {
  query: QueryData;
  table?: string;
  clone(): QueryBase;
  selectable: SelectableBase;
  shape: ColumnsShapeBase;
  result: ColumnsShape;
  baseQuery: Query;
  relations: RelationsBase;
  withData: WithDataBase;
};

export type defaultsKey = typeof defaultsKey;
export const defaultsKey: unique symbol = Symbol('defaults');

export type Query = QueryCommon &
  QueryMethods & {
    queryBuilder: Db;
    columnTypes: ColumnTypesBase;
    whereQueryBuilder: typeof WhereQueryBuilder;
    onQueryBuilder: typeof OnQueryBuilder;
    table?: string;
    shape: ColumnsShape;
    singlePrimaryKey: string;
    primaryKeys: string[];
    type: Record<string, unknown>;
    inputType: Record<string, unknown>;
    query: QueryData;
    result: ColumnsShape;
    selectable: SelectableBase;
    returnType: QueryReturnType;
    then: ThenResult<unknown>;
    windows: EmptyObject;
    defaultSelectColumns: string[];
    relations: RelationsBase;
    withData: WithDataBase;
    error: new (
      message: string,
      length: number,
      name: QueryErrorName,
    ) => QueryError;
    isSubQuery: boolean;
    [defaultsKey]: EmptyObject;
  };

export type Selectable<T extends QueryBase> = StringKey<keyof T['selectable']>;

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
} as Record<QueryReturnType, true | undefined>;

export const isQueryReturnsAll = (q: Query) =>
  !q.query.returnType || q.query.returnType === 'all';

export type QueryReturnsAll<T extends QueryReturnType> = (
  QueryReturnType extends T ? 'all' : T
) extends 'all'
  ? true
  : false;

export type QueryThen<
  ReturnType extends QueryReturnType,
  Result extends ColumnsShapeBase,
> = QueryReturnsAll<ReturnType> extends true
  ? ThenResult<ColumnShapeOutput<Result>[]>
  : ReturnType extends 'one'
  ? ThenResult<ColumnShapeOutput<Result> | undefined>
  : ReturnType extends 'oneOrThrow'
  ? ThenResult<ColumnShapeOutput<Result>>
  : ReturnType extends 'value'
  ? Result extends { value: ColumnType }
    ? ThenResult<Result['value']['type'] | undefined>
    : never
  : ReturnType extends 'valueOrThrow'
  ? Result extends { value: ColumnType }
    ? ThenResult<Result['value']['type']>
    : never
  : ReturnType extends 'rows'
  ? ThenResult<ColumnShapeOutput<Result>[keyof Result][][]>
  : ReturnType extends 'pluck'
  ? Result extends { pluck: ColumnType }
    ? ThenResult<Result['pluck']['type'][]>
    : never
  : ReturnType extends 'rowCount'
  ? ThenResult<number>
  : ReturnType extends 'void'
  ? ThenResult<void>
  : never;

export type AddQuerySelect<
  T extends Pick<Query, 'result' | 'then' | 'returnType' | 'meta'>,
  Result extends ColumnsShapeBase,
> = T['meta']['hasSelect'] extends true
  ? MergeSelect<T, Result>
  : {
      [K in keyof T]: K extends 'meta'
        ? T['meta'] & { hasSelect: true }
        : K extends 'result'
        ? Result
        : K extends 'then'
        ? QueryThen<T['returnType'], Result>
        : T[K];
    };

type MergeSelect<
  T extends Pick<Query, 'result' | 'then' | 'returnType' | 'meta'>,
  Result extends ColumnsShapeBase,
  Merged extends ColumnsShapeBase = {
    [K in keyof T['result']]: K extends keyof Result ? unknown : T['result'][K];
  } & Result,
> = {
  [K in keyof T]: K extends 'result'
    ? Merged
    : K extends 'then'
    ? QueryThen<T['returnType'], Merged>
    : T[K];
};

export type SetQueryReturns<T extends Query, R extends QueryReturnType> = Omit<
  T,
  'returnType' | 'then'
> & { returnType: R; then: QueryThen<R, T['result']> };

export type SetQueryReturnsAll<T extends Query> = SetQueryReturns<T, 'all'>;

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
  S extends keyof T['selectable'] | RawExpression,
  C extends ColumnTypeBase = S extends keyof T['selectable']
    ? T['selectable'][S]['column']
    : S extends RawExpression
    ? S['__column']
    : never,
> = Omit<T, 'result' | 'returnType' | 'then'> & {
  meta: {
    hasSelect: true;
  };
  result: { pluck: C };
  returnType: 'pluck';
  then: ThenResult<C['type'][]>;
};

export type SetQueryReturnsValueOptional<
  T extends Query,
  Arg extends Exclude<GetArg<T>, RawExpression> | ColumnTypeBase,
  Column extends ColumnTypeBase = Arg extends ColumnTypeBase
    ? Arg
    : Arg extends keyof T['selectable']
    ? T['selectable'][Arg]['column']
    : Arg extends RelationQueryBase
    ? Arg['result']['value']
    : never,
> = Omit<T, 'result' | 'returnType' | 'then'> & {
  meta: {
    hasSelect: true;
  };
  result: { value: Column };
  returnType: 'value';
  then: ThenResult<Column['type'] | undefined>;
};

export type SetQueryReturnsValue<
  T extends Query,
  Arg extends Exclude<GetArg<T>, RawExpression> | ColumnTypeBase,
  Column extends ColumnTypeBase = Arg extends ColumnTypeBase
    ? Arg
    : Arg extends keyof T['selectable']
    ? T['selectable'][Arg]['column']
    : Arg extends RelationQueryBase
    ? Arg['result']['value']
    : never,
> = Omit<T, 'result' | 'returnType' | 'then'> & {
  meta: {
    hasSelect: true;
  };
  result: { value: Column };
  returnType: 'valueOrThrow';
  then: ThenResult<Column['type']>;
};

export type SetQueryReturnsRowCount<T extends Query> = SetQueryReturns<
  T,
  'rowCount'
>;

export type SetQueryReturnsVoid<T extends Query> = SetQueryReturns<T, 'void'>;

export type SetQueryReturnsColumnInfo<
  T extends Query,
  Column extends keyof T['shape'] | undefined,
  Result = Column extends keyof T['shape']
    ? ColumnInfo
    : Record<keyof T['shape'], ColumnInfo>,
> = Omit<T, 'result' | 'returnType' | 'then'> & {
  result: { value: ColumnType<Result> };
  returnType: 'value';
  then: ThenResult<Result>;
};

export type SetQueryTableAlias<T extends Query, As extends string> = {
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
> = Omit<T, 'withData'> & { withData: WithData };

export type AddQueryWith<
  T extends Query,
  With extends WithDataItem,
> = SetQueryWith<T, Spread<[T['withData'], { [K in With['table']]: With }]>>;

export type SetQueryWindows<T extends Query, W extends EmptyObject> = T & {
  windows: W;
};
