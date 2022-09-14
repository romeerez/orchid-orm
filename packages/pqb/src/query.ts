import { QueryMethods } from './queryMethods/queryMethods';
import { QueryData } from './sql';
import {
  ColumnShapeOutput,
  ColumnsShape,
  ColumnType,
  TableSchema,
} from './columnSchema';
import { Spread } from './utils';
import { AliasOrTable, RawExpression, StringKey } from './common';
import { ThenResult } from './queryMethods/then';
import { Db } from './db';
import { ColumnInfo } from './queryMethods/columnInfo';
import { RelationsBase } from './relations';
import { WhereQueryBuilder } from './queryMethods/where';
import { OnQueryBuilder } from './queryMethods/join';

export type ColumnParser = (input: unknown) => unknown;
export type ColumnsParsers = Record<string, ColumnParser>;

export type SelectableBase = Record<
  PropertyKey,
  { as: string; column: ColumnType }
>;

export type WithDataItem = { table: string; shape: ColumnsShape };
export type WithDataBase = Record<never, WithDataItem>;

export type QueryBase = {
  query: QueryData;
  table?: string;
  tableAlias?: string;
  clone(): QueryBase;
  selectable: SelectableBase;
  __model?: QueryBase;
  relations: RelationsBase;
  withData: WithDataBase;
};

export type defaultsKey = typeof defaultsKey;
export const defaultsKey: unique symbol = Symbol('defaults');

export type Query = QueryMethods & {
  queryBuilder: Db;
  whereQueryBuilder: typeof WhereQueryBuilder;
  onQueryBuilder: typeof OnQueryBuilder;
  table?: string;
  shape: ColumnsShape;
  schema: Omit<TableSchema<ColumnsShape>, 'primaryKeys' | 'primaryTypes'> & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    primaryKeys: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    primaryTypes: any[];
  };
  type: Record<string, unknown>;
  query: QueryData;
  result: ColumnsShape;
  hasSelect: boolean;
  selectable: SelectableBase;
  returnType: QueryReturnType;
  then: ThenResult<unknown>;
  tableAlias: string | undefined;
  joinedTables: Record<string, Pick<Query, 'result' | 'tableAlias' | 'table'>>;
  windows: PropertyKey[];
  defaultSelectColumns: string[];
  columnsParsers?: ColumnsParsers;
  relations: RelationsBase;
  withData: WithDataBase;
  [defaultsKey]?: string;
};

export type Selectable<T extends QueryBase> = StringKey<keyof T['selectable']>;

export type QueryWithTable = Query & { table: string };

export type DefaultSelectColumns<S extends ColumnsShape> = {
  [K in keyof S]: S[K]['isHidden'] extends true ? never : K;
}[StringKey<keyof S>][];

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

export type JoinedTablesBase = Record<
  string,
  Pick<Query, 'result' | 'tableAlias' | 'table'>
>;

type QueryThen<
  ReturnType extends QueryReturnType,
  Result extends ColumnsShape,
> = ReturnType extends 'all'
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
  T extends Pick<Query, 'hasSelect' | 'result' | 'then' | 'returnType'>,
  Result extends ColumnsShape,
> = T['hasSelect'] extends false
  ? Omit<T, 'hasSelect' | 'result' | 'then'> & {
      hasSelect: true;
      result: Result;
      then: QueryThen<T['returnType'], Result>;
    }
  : Omit<T, 'result' | 'then'> & {
      result: Spread<[T['result'], Result]>;
      then: QueryThen<T['returnType'], Spread<[T['result'], Result]>>;
    };

export type SetQueryReturns<T extends Query, R extends QueryReturnType> = Omit<
  T,
  'returnType' | 'then'
> & { returnType: R; then: QueryThen<R, T['result']> };

export type SetQueryReturnsAll<T extends Query> = SetQueryReturns<T, 'all'>;

export type SetQueryReturnsOneOrUndefined<T extends Query> = SetQueryReturns<
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
  C extends ColumnType = S extends keyof T['selectable']
    ? T['selectable'][S]['column']
    : S extends RawExpression
    ? S['__column']
    : never,
> = Omit<T, 'result' | 'returnType' | 'then'> & {
  result: { pluck: C };
  returnType: 'pluck';
  then: ThenResult<C['type'][]>;
};

export type SetQueryReturnsValueOrUndefined<
  T extends Query,
  C extends ColumnType,
> = Omit<T, 'result' | 'returnType' | 'then'> & {
  result: { value: C };
  returnType: 'value';
  then: ThenResult<C['type'] | undefined>;
};

export type SetQueryReturnsValue<T extends Query, C extends ColumnType> = Omit<
  T,
  'result' | 'returnType' | 'then'
> & {
  result: { value: C };
  returnType: 'valueOrThrow';
  then: ThenResult<C['type']>;
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

export type SetQueryTableAlias<
  T extends Query,
  TableAlias extends string,
> = Omit<T, 'tableAlias' | 'selectable'> & {
  tableAlias: TableAlias;
  selectable: Omit<
    T['selectable'],
    `${AliasOrTable<T>}.${StringKey<keyof T['shape']>}`
  > & {
    [K in keyof T['shape'] as `${TableAlias}.${StringKey<keyof T['shape']>}`]: {
      as: K;
      column: T['shape'][K];
    };
  };
};

export type SetQueryJoinedTables<
  T extends Query,
  Selectable extends Record<string, { as: string; column: ColumnType }>,
  JoinedTables extends JoinedTablesBase,
> = Omit<T, 'selectable' | 'joinedTables'> & {
  selectable: Selectable;
  joinedTables: JoinedTables;
};

export type AddQueryJoinedTable<
  T extends Query,
  J extends Pick<Query, 'result' | 'tableAlias' | 'table'>,
> = SetQueryJoinedTables<
  T,
  T['selectable'] & {
    [K in keyof J['result'] as `${AliasOrTable<J>}.${StringKey<K>}`]: {
      as: K;
      column: J['result'][K];
    };
  },
  string extends keyof T['joinedTables']
    ? Record<AliasOrTable<J>, J>
    : Spread<[T['joinedTables'], Record<AliasOrTable<J>, J>]>
>;

export type SetQueryWith<
  T extends Query,
  WithData extends Record<string, WithDataItem>,
> = Omit<T, 'withData'> & { withData: WithData };

export type AddQueryWith<
  T extends Query,
  With extends WithDataItem,
> = SetQueryWith<T, Spread<[T['withData'], { [K in With['table']]: With }]>>;

export type SetQueryWindows<T extends Query, W extends PropertyKey[]> = Omit<
  T,
  'windows'
> & { windows: W };
