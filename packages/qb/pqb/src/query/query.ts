import { GetStringArg, QueryMetaHasWhere, QueryMethods } from '../queryMethods';
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
  PickQueryMeta,
  PickQueryMetaResult,
  PickQueryMetaResultReturnType,
  PickQueryMetaReturnType,
  PickQueryResult,
  PickQueryReturnType,
  PickQueryShape,
  PickQueryTable,
  PickType,
  QueryCatch,
  QueryColumn,
  QueryColumns,
  QueryInternalBase,
  QueryReturnType,
  QueryThen,
  RecordUnknown,
} from 'orchid-core';
import { QueryBase } from './queryBase';
import { ColumnType } from '../columns';
import { TableData } from '../tableData';

export interface DbExtension {
  name: string;
  version?: string;
}

export type DbDomainArg<ColumnTypes> = (columnTypes: ColumnTypes) => ColumnType;

export type DbDomainArgRecord = { [K: string]: DbDomainArg<any> }; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface QueryInternal<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SinglePrimaryKey = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UniqueColumns = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UniqueColumnNames = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UniqueColumnTuples = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UniqueConstraints = any,
> extends QueryInternalBase {
  singlePrimaryKey: SinglePrimaryKey;
  uniqueColumns: UniqueColumns;
  uniqueColumnNames: UniqueColumnNames;
  uniqueColumnTuples: UniqueColumnTuples;
  uniqueConstraints: UniqueConstraints;
  extensions?: DbExtension[];
  domains?: DbDomainArgRecord;
  tableData: TableData;
  // access with `getPrimaryKeys` utility
  primaryKeys?: string[];
}

export type SelectableFromShape<
  Shape extends QueryColumns,
  Table extends string | undefined,
> = { [K in keyof Shape]: { as: K; column: Shape[K] } } & {
  [K in keyof Shape & string as `${Table}.${K}`]: {
    as: K;
    column: Shape[K];
  };
};

export interface WithDataItem {
  table: string;
  shape: QueryColumns;
}

export interface WithDataItems {
  [K: string]: WithDataItem;
}

export type WithDataBase = EmptyObject;

export interface Query extends QueryBase, QueryMethods<unknown> {
  queryBuilder: Db;
  columnTypes: unknown;
  shape: QueryColumns;
  inputType: RecordUnknown;
  q: QueryData;
  then: QueryThen<unknown>;
  catch: QueryCatch;
  windows: EmptyObject;
  defaultSelectColumns: string[];
  relations: RelationsBase;
  error: new (
    message: string,
    length: number,
    name: QueryErrorName,
  ) => QueryError;
}

export interface PickQueryWithData {
  withData: WithDataBase;
}

export interface PickQueryWindows {
  windows: EmptyObject;
}

export interface PickQueryRelations {
  relations: RelationsBase;
}

export interface PickQueryQ {
  q: QueryData;
}

export interface PickQueryInternal {
  internal: QueryInternal;
}

export interface PickQueryBaseQuery {
  baseQuery: Query;
}

export interface PickQueryMetaRelations
  extends PickQueryMeta,
    PickQueryRelations {}

export interface PickQueryMetaResultRelations
  extends PickQueryResult,
    PickQueryMeta,
    PickQueryRelations {}

export interface PickQueryMetaResultRelationsWindows
  extends PickQueryMetaResultRelations,
    PickQueryWindows {}

export interface PickQueryMetaResultRelationsWindowsColumnTypes
  extends PickQueryMetaResultRelationsWindows {
  columnTypes: unknown;
}

export interface PickQueryMetaTable extends PickQueryMeta, PickQueryTable {}

export interface PickQueryMetaTableShape
  extends PickQueryMetaTable,
    PickQueryShape {}

export interface PickQueryMetaWithData
  extends PickQueryMeta,
    PickQueryWithData {}

export interface PickQueryRelationsWithData
  extends PickQueryWithData,
    PickQueryRelations {}

export interface PickQueryMetaShapeRelationsWithData
  extends PickQueryMeta,
    PickQueryShape,
    PickQueryRelations,
    PickQueryWithData {}

export interface PickQueryMetaResultRelationsWithDataReturnType
  extends PickQueryMeta,
    PickQueryResult,
    PickQueryRelations,
    PickQueryWithData,
    PickQueryReturnType {}

export interface PickQueryMetaTableShapeReturnTypeWithData
  extends PickQueryMetaTableShape,
    PickQueryReturnType,
    PickQueryMetaWithData {}

export interface PickQueryMetaResultRelationsWithDataReturnTypeShape
  extends PickQueryMetaResultRelationsWithDataReturnType,
    PickQueryShape {}

export interface PickQueryMetaResultReturnTypeWithDataWindows
  extends PickQueryMetaResultReturnType,
    PickQueryWithData,
    PickQueryWindows {}

export interface PickQueryMetaResultReturnTypeWithDataWindowsTable<
  Table extends string | undefined,
> extends PickQueryMetaResultReturnType,
    PickQueryWithData,
    PickQueryWindows {
  table: Table;
}

export interface PickQueryQAndInternal extends PickQueryQ, PickQueryInternal {}

export interface PickQueryQAndBaseQuery
  extends PickQueryQ,
    PickQueryBaseQuery {}

export interface PickQuerySinglePrimaryKey {
  internal: {
    singlePrimaryKey: unknown;
  };
}

export interface PickQueryShapeSinglePrimaryKey
  extends PickQueryShape,
    PickQuerySinglePrimaryKey {}

export interface PickQueryShapeResultSinglePrimaryKey
  extends PickQueryShapeSinglePrimaryKey,
    PickQueryResult {}

export type SelectableOfType<T extends PickQueryMeta, Type> = {
  [K in keyof T['meta']['selectable']]: T['meta']['selectable'][K]['column']['type'] extends Type | null
    ? K
    : never;
}[keyof T['meta']['selectable']];

export type SelectableOrExpressionOfType<
  T extends PickQueryMeta,
  C extends PickType,
> = SelectableOfType<T, C['type']> | Expression<QueryColumn<C['type'] | null>>;

export interface QueryWithTable extends Query {
  table: string;
}

export const queryTypeWithLimitOne = {
  one: true,
  oneOrThrow: true,
  value: true,
  valueOrThrow: true,
} as { [K in QueryReturnType]: true | undefined };

export const isQueryReturnsAll = (q: Query) =>
  !q.q.returnType || q.q.returnType === 'all';

export type QueryReturnsAll<T extends QueryReturnType> = (
  QueryReturnType extends T ? 'all' : T
) extends 'all'
  ? true
  : false;

export type GetQueryResult<
  T extends PickQueryReturnType,
  Result extends QueryColumns,
> = QueryReturnsAll<T['returnType']> extends true
  ? ColumnShapeOutput<Result>[]
  : T['returnType'] extends 'one'
  ? ColumnShapeOutput<Result> | undefined
  : T['returnType'] extends 'oneOrThrow'
  ? ColumnShapeOutput<Result>
  : T['returnType'] extends 'value'
  ? Result['value']['outputType'] | undefined
  : T['returnType'] extends 'valueOrThrow'
  ? Result['value']['outputType']
  : T['returnType'] extends 'rows'
  ? ColumnShapeOutput<Result>[keyof Result][][]
  : T['returnType'] extends 'pluck'
  ? Result['pluck']['outputType'][]
  : T['returnType'] extends 'rowCount'
  ? number
  : T['returnType'] extends 'void'
  ? void
  : never;

export type AddQuerySelect<
  T extends PickQueryMetaResultReturnType,
  Result extends QueryColumns,
> = {
  [K in keyof T]: K extends 'result'
    ? {
        [K in
          | (T['meta']['hasSelect'] extends true ? keyof T['result'] : never)
          | keyof Result]: K extends keyof Result
          ? Result[K]
          : K extends keyof T['result']
          ? T['result'][K]
          : never;
      }
    : K extends 'then'
    ? QueryThen<GetQueryResult<T, Result>>
    : T[K];
} & QueryMetaHasSelect;

// Merge { hasSelect: true } into 'meta' if it's not true yet.
export interface QueryMetaHasSelect {
  meta: {
    hasSelect: true;
  };
}

// Change the query type to return multiple object records.
// It wraps the query with `WhereResult` to allow updating and deleting all records when the `all` method is used.
export type SetQueryReturnsAll<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'all'
    : K extends 'then'
    ? QueryThen<ColumnShapeOutput<T['result']>[]>
    : T[K];
} & QueryMetaHasWhere;

export type SetQueryReturnsAllKind<
  T extends PickQueryMetaResult,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'all'
    : K extends 'then'
    ? QueryThen<ColumnShapeOutput<T['result']>[]>
    : T[K];
} & QueryMetaHasWhere;

export type SetQueryReturnsAllKindResult<
  T extends PickQueryMetaResult,
  Kind extends string,
  Result extends QueryColumns,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'all'
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<ColumnShapeOutput<T['result']>[]>
    : T[K];
} & QueryMetaHasWhere;

export type SetQueryReturnsOneOptional<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'one'
    : K extends 'then'
    ? QueryThen<ColumnShapeOutput<T['result']> | undefined>
    : T[K];
};

export type SetQueryReturnsOne<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'oneOrThrow'
    : K extends 'then'
    ? QueryThen<ColumnShapeOutput<T['result']>>
    : T[K];
};

export type SetQueryReturnsOneKind<
  T extends PickQueryMetaResult,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'oneOrThrow'
    : K extends 'then'
    ? QueryThen<ColumnShapeOutput<T['result']>>
    : T[K];
};

export type SetQueryReturnsOneKindResult<
  T extends PickQueryMetaResult,
  Kind extends string,
  Result extends QueryColumns,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'oneOrThrow'
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<ColumnShapeOutput<Result>>
    : T[K];
};

export type SetQueryReturnsRows<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'rows'
    : K extends 'then'
    ? QueryThen<ColumnShapeOutput<T['result']>[keyof T['result']][][]>
    : T[K];
};

export type SetQueryReturnsPluck<
  T extends PickQueryMeta,
  S extends keyof T['meta']['selectable'] | Expression,
> = SetQueryReturnsPluckColumn<
  T,
  S extends keyof T['meta']['selectable']
    ? T['meta']['selectable'][S]['column']
    : S extends Expression
    ? S['result']['value']
    : never
>;

export type SetQueryReturnsPluckColumn<T, C extends QueryColumn> = {
  [K in keyof T]: K extends 'result'
    ? { pluck: C }
    : K extends 'returnType'
    ? 'pluck'
    : K extends 'then'
    ? QueryThen<C['outputType'][]>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsPluckColumnKind<
  T extends PickQueryMetaResult,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'result'
    ? { pluck: T['result']['value'] }
    : K extends 'returnType'
    ? 'pluck'
    : K extends 'then'
    ? QueryThen<T['result']['value']['outputType'][]>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsPluckColumnKindResult<
  T extends PickQueryMetaResult,
  Kind extends string,
  Result extends QueryColumns,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'result'
    ? { pluck: T['result']['value'] }
    : K extends 'returnType'
    ? 'pluck'
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<T['result']['value']['outputType'][]>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsValueOrThrow<
  T extends PickQueryMeta,
  Arg extends GetStringArg<T>,
> = SetQueryReturnsColumnOrThrow<T, T['meta']['selectable'][Arg]['column']> &
  T['meta']['selectable'][Arg]['column']['operators'];

export type SetQueryReturnsValueOptional<
  T extends PickQueryMeta,
  Arg extends GetStringArg<T>,
> = SetQueryReturnsColumnOptional<T, T['meta']['selectable'][Arg]['column']> &
  T['meta']['selectable'][Arg]['column']['operators'];

export type SetQueryReturnsColumnOrThrow<T, Column extends PickOutputType> = {
  [K in keyof T]: K extends 'result'
    ? { value: Column }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'then'
    ? QueryThen<Column['outputType']>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsColumnOptional<T, Column extends PickOutputType> = {
  [K in keyof T]: K extends 'result'
    ? { value: Column }
    : K extends 'returnType'
    ? 'value'
    : K extends 'then'
    ? QueryThen<Column['outputType'] | undefined>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsColumnKind<
  T extends PickQueryMetaResult,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'result'
    ? { value: T['result']['pluck'] }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'then'
    ? QueryThen<T['result']['pluck']['outputType']>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsColumnKindResult<
  T extends PickQueryMetaResult,
  Kind extends string,
  Result extends QueryColumns,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'result'
    ? { value: T['result']['pluck'] }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<Result['pluck']['outputType']>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsRowCount<
  T extends PickQueryMetaResult,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'rowCount'
    : K extends 'then'
    ? QueryThen<number>
    : T[K];
};

export type SetQueryReturnsVoid<T> = {
  [K in keyof T]: K extends 'returnType'
    ? 'void'
    : K extends 'then'
    ? QueryThen<void>
    : T[K];
};

export type SetQueryReturnsVoidKind<
  T extends PickQueryMeta,
  Kind extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'returnType'
    ? 'void'
    : K extends 'then'
    ? QueryThen<void>
    : T[K];
};

// Set the kind of the query, can be 'select', 'update', 'create', etc.
// `update` method is using the kind of query to allow only 'select' as a callback return for a column.
export type SetQueryKind<T extends PickQueryMeta, Kind extends string> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : T[K];
};

export type SetQueryKindResult<
  T extends PickQueryMetaReturnType,
  Kind extends string,
  Result extends QueryColumns,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta']]: K extends 'kind' ? Kind : T['meta'][K];
      }
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<GetQueryResult<T, Result>>
    : T[K];
};

export type SetQueryTableAlias<
  T extends PickQueryMetaTableShape,
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

export type SetQueryWith<T, WithData> = {
  [K in keyof T]: K extends 'withData' ? WithData : T[K];
};

export type AddQueryWith<
  T extends PickQueryWithData,
  With extends WithDataItem,
> = SetQueryWith<
  T,
  {
    [K in keyof T['withData'] | With['table']]: K extends With['table']
      ? With
      : K extends keyof T['withData']
      ? T['withData'][K]
      : never;
  }
>;
