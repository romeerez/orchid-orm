import { QueryMethods, QueryReturnType } from './queryMethods';
import { AggregateMethods } from './aggregateMethods';
import { QueryData } from './toSql';
import { PostgresAdapter } from './adapter';
import { Operators } from './operators';

export type ColumnsShape = Record<
  string,
  { isHidden: boolean; operators: Operators; output: unknown }
>;

export type Output<S extends ColumnsShape> = {
  [K in keyof S]: S[K]['output'];
};

export type AllColumns = { __all: true };

export type DefaultSelectColumns<S extends ColumnsShape> = {
  [K in keyof S]: S[K]['isHidden'] extends true ? never : K;
}[keyof S][];

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
    joinedTables: any;
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
