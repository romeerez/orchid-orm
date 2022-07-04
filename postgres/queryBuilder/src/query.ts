import { QueryMethods } from './queryMethods';
import { AggregateMethods } from './aggregateMethods';
import { PostgresAdapter } from './adapter';
import { QueryData } from './sql/types';
import { ColumnsShape, Output } from './schema';
import { Spread } from './utils';
import { AliasOrTable } from './common';
import { Then } from './thenMethods';

export type AllColumns = { __all: true };

export type DefaultSelectColumns<S extends ColumnsShape> = {
  [K in keyof S]: S[K]['isHidden'] extends true ? never : K;
}[keyof S][];

export type QueryReturnType = 'all' | 'one' | 'rows' | 'value' | 'void';

export type JoinedTablesBase = Record<string, Query>;

export type WithBase = Pick<Query, 'table' | 'type' | 'shape'>;

export type SetQuery<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Query = any,
  Result = T['result'],
  ReturnType extends QueryReturnType = T['returnType'],
  TableAlias extends string | undefined = T['tableAlias'],
  JoinedTables extends JoinedTablesBase = T['joinedTables'],
  Windows extends PropertyKey[] = T['windows'],
  R = FinalizeQueryResult<T, Result>,
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

export type FinalizeQueryResult<
  T extends Query,
  Result = T['result'],
> = Result extends AllColumns
  ? Output<Pick<T['shape'], T['defaultSelectColumns'][number]>>
  : Result;

export type AddQuerySelect<T extends Query, ResultArg> = SetQuery<
  T,
  T['result'] extends AllColumns ? ResultArg : Spread<[T['result'], ResultArg]>
>;

export type SetQueryReturns<
  T extends Query,
  R extends QueryReturnType,
> = SetQuery<T, T['result'], R>;

export type SetQueryReturnsAll<T extends Query> = SetQueryReturns<T, 'all'>;

export type SetQueryReturnsOne<T extends Query> = SetQueryReturns<T, 'one'>;

export type SetQueryReturnsRows<T extends Query> = SetQueryReturns<T, 'rows'>;

export type SetQueryReturnsValue<T extends Query, R> = SetQuery<T, R, 'value'>;

export type SetQueryReturnsVoid<T extends Query> = SetQueryReturns<T, 'void'>;

export type QueryWithData<T extends Query> = T & { query: QueryData<T> };

export type SetQueryTableAlias<
  T extends Query,
  TableAlias extends string,
> = Omit<T, 'tableAlias'> & { tableAlias: TableAlias };

export type SetQueryJoinedTables<
  T extends Query,
  JoinedTables extends JoinedTablesBase,
> = Omit<T, 'joinedTables'> & { joinedTables: JoinedTables };

export type AddQueryJoinedTable<
  T extends Query,
  J extends Query,
> = SetQueryJoinedTables<
  T,
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

export type Query = QueryMethods &
  AggregateMethods & {
    adapter: PostgresAdapter;
    query?: QueryData<any>;
    shape: ColumnsShape;
    type: Record<string, unknown>;
    result: any;
    returnType: QueryReturnType;
    then: any;
    table: string;
    tableAlias: string | undefined;
    withData: Record<never, never>;
    joinedTables: Record<never, never>;
    windows: PropertyKey[];
    primaryKeys: any[];
    primaryTypes: any[];
    defaultSelectColumns: string[];
    relations: Record<
      string,
      {
        key: string;
        type: string;
        query: Query;
        options: Record<string, unknown>;
        joinQuery: Query & { query: QueryData };
      }
    >;
  };
