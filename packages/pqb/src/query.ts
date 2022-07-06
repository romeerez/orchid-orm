import { QueryMethods } from './queryMethods';
import { AggregateMethods } from './aggregateMethods';
import { PostgresAdapter } from './adapter';
import { QueryData } from './sql';
import { Column, ColumnsShape, Output } from './schema';
import { Spread } from './utils';
import { AliasOrTable, StringKey } from './common';
import { Then } from './thenMethods';
import { Db } from './db';

export type Query = QueryMethods &
  AggregateMethods & {
    adapter: PostgresAdapter;
    queryBuilder: Db;
    table?: string;
    shape: ColumnsShape;
    type: unknown;
    query?: QueryData;
    result: ColumnsShape;
    hasSelect: boolean;
    selectable: ColumnsShape;
    returnType: QueryReturnType;
    then: any;
    tableAlias: string | undefined;
    withData: Record<never, never>;
    joinedTables: Record<never, never>;
    windows: PropertyKey[];
    primaryKeys: any[];
    primaryTypes: any[];
    defaultSelectColumns: string[];
    relations: Record<
      string,
      | {
          key: string;
          type: string;
          query: QueryWithTable;
          options: Record<string, unknown>;
          joinQuery: Query & { query: QueryData };
        }
      | undefined
    >;
  };

export type Selectable<T extends Query> = StringKey<keyof T['selectable']>;

export type QueryWithTable = Query & { table: string };

export type DefaultSelectColumns<S extends ColumnsShape> = {
  [K in keyof S]: S[K]['isHidden'] extends true ? never : K;
}[StringKey<keyof S>][];

export type QueryReturnType = 'all' | 'one' | 'rows' | 'value' | 'void';

export type JoinedTablesBase = Record<string, Query>;

export type WithBase = { table: string; shape: ColumnsShape };

export type SetQuery<
  T extends Query = Query,
  Result extends ColumnsShape = T['result'],
  ReturnType extends QueryReturnType = T['returnType'],
  TableAlias extends string | undefined = T['tableAlias'],
  JoinedTables extends JoinedTablesBase = T['joinedTables'],
  Windows extends PropertyKey[] = T['windows'],
  R = Output<Result>,
> = Omit<
  T,
  'result' | 'returnType' | 'tableAlias' | 'joinedTables' | 'then' | 'windows'
> & {
  result: Result;
  returnType: ReturnType;
  tableAlias: TableAlias;
  joinedTables: JoinedTables;
  then: ReturnType extends 'all'
    ? Then<R[]>
    : ReturnType extends 'one'
    ? Then<R>
    : ReturnType extends 'value'
    ? Then<R>
    : ReturnType extends 'rows'
    ? Then<R[keyof R]>
    : ReturnType extends 'void'
    ? Then<void>
    : never;
  windows: Windows;
};

export type AddQuerySelect<
  T extends Query,
  Result extends ColumnsShape,
> = T['hasSelect'] extends true
  ? SetQuery<Omit<T, 'hasSelect'> & { hasSelect: false }, Result>
  : SetQuery<T, Spread<[T['result'], Result]>>;

export type SetQueryReturns<
  T extends Query,
  R extends QueryReturnType,
> = SetQuery<T, T['result'], R>;

export type SetQueryReturnsAll<T extends Query> = SetQueryReturns<T, 'all'>;

export type SetQueryReturnsOne<T extends Query> = SetQueryReturns<T, 'one'>;

export type SetQueryReturnsRows<T extends Query> = SetQueryReturns<T, 'rows'>;

export type SetQueryReturnsValue<T extends Query, C extends Column> = SetQuery<
  T,
  { value: C },
  'value'
>;

export type SetQueryReturnsVoid<T extends Query> = SetQueryReturns<T, 'void'>;

export type QueryWithData<T extends Query> = T & { query: QueryData<T> };

export type SetQueryTableAlias<
  T extends Query,
  TableAlias extends string,
> = Omit<T, 'tableAlias' | 'selectable'> & {
  tableAlias: TableAlias;
  selectable: Omit<
    T['selectable'],
    `${AliasOrTable<T>}.${StringKey<keyof T['shape']>}`
  > & {
    [K in keyof T['shape'] as `${TableAlias}.${StringKey<
      keyof T['shape']
    >}`]: T['shape'][K];
  };
};

export type SetQueryJoinedTables<
  T extends Query,
  Selectable extends ColumnsShape,
  JoinedTables extends JoinedTablesBase,
> = Omit<T, 'selectable' | 'joinedTables'> & {
  selectable: Selectable;
  joinedTables: JoinedTables;
};

export type AddQueryJoinedTable<
  T extends Query,
  J extends Query,
> = SetQueryJoinedTables<
  T,
  T['selectable'] & {
    [K in keyof J['result'] as `${AliasOrTable<J>}.${StringKey<K>}`]: J['result'][K];
  },
  Spread<[T['joinedTables'], Record<AliasOrTable<J>, J>]>
>;

export type SetQueryWith<
  T extends Query,
  WithData extends Record<string, WithBase>,
> = Omit<T, 'withData'> & { withData: WithData };

export type AddQueryWith<T extends Query, With extends WithBase> = SetQueryWith<
  T,
  Spread<[T['withData'], { [K in With['table']]: With }]>
>;

export type SetQueryWindows<
  T extends Query,
  W extends PropertyKey[],
> = SetQuery<
  T,
  T['result'],
  T['returnType'],
  T['tableAlias'],
  T['joinedTables'],
  W
>;
