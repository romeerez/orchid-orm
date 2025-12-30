import { QueryMethods } from './query-methods';
import { QueryData, QueryDataBase } from './query-data';
import { QueryBuilder } from './db';
import { Column } from '../columns/column';
import { TableData } from '../tableData';
import { WithDataItems } from './basic-features/cte/cte.sql';
import { ColumnsShape } from '../columns';
import { QueryMetaBase } from './query-meta';
import { QueryInternalBase } from './query-internal';
import {
  PickQueryMeta,
  PickQueryMetaResult,
  PickQueryMetaReturnType,
  PickQueryResult,
  PickQueryResultReturnType,
  PickQueryShape,
} from './pick-query-types';
import { EmptyObject, RecordKeyTrue, RecordUnknown } from '../utils';
import { RelationsBase } from './relations';
import { QueryError, QueryErrorName } from './errors';
import { Expression } from './expressions/expression';
import { GetStringArg } from './basic-features/get/get.utils';
import { QueryMetaHasWhere } from './basic-features/where/where';
import {
  QueryCatch,
  QueryThen,
  QueryThenByQuery,
  QueryThenShallowSimplify,
  QueryThenShallowSimplifyArr,
  QueryThenShallowSimplifyOptional,
} from './then/then';

export interface DbExtension {
  name: string;
  version?: string;
}

export interface GeneratorIgnore {
  schemas?: string[];
  enums?: string[];
  domains?: string[];
  extensions?: string[];
  tables?: string[];
}

export interface DbDomainArg<ColumnTypes> {
  (columnTypes: ColumnTypes): Column;
}

export interface DbDomainArgRecord {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K: string]: DbDomainArg<any>;
}

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
  generatorIgnore?: GeneratorIgnore;
  tableData: TableData;
  // For customizing `now()` sql
  nowSQL?: string;
  // for select, where, join callbacks: memoize a query extended with relations, so query.relName is a relation query
  callbackArg?: Query;
  selectAllCount: number;
}

export type SelectableFromShape<
  Shape extends Column.QueryColumns,
  Table extends string | undefined,
> = { [K in keyof Shape]: { as: K; column: Shape[K] } } & {
  [K in keyof Shape & string as `${Table}.${K}`]: {
    as: K;
    column: Shape[K];
  };
};

export type QueryReturnType =
  | QueryReturnTypeAll
  | 'one'
  | 'oneOrThrow'
  | 'rows'
  | 'pluck'
  | 'value'
  | 'valueOrThrow'
  | 'void';

export type QueryReturnTypeAll = undefined | 'all';

export type QueryReturnTypeOptional = 'one' | 'value';

export interface IsQuery {
  __isQuery: true;
}

export interface IsQueries {
  [K: string]: IsQuery;
}

export interface QueryBase extends IsQuery, PickQueryShape {
  internal: QueryInternalBase;
  q: QueryDataBase;
  table?: string;
}

// It is a generic interface that covers any query:
// both the table query objects
// and the lightweight queries inside `where` and `on` callbacks
export interface QueryBaseCommon<Scopes extends RecordKeyTrue = RecordKeyTrue>
  extends QueryBase {
  meta: QueryMetaBase<Scopes>;
}

export interface QueryOrExpression<T> {
  result: { value: Column.Pick.QueryColumnOfType<T> };
}

export interface Query extends QueryBase, QueryMethods<unknown> {
  __isQuery: true;
  result: Column.QueryColumns;
  withData: WithDataItems;
  baseQuery: Query;
  internal: QueryInternal;
  meta: QueryMetaBase<EmptyObject>;
  returnType: QueryReturnType;
  qb: QueryBuilder;
  columnTypes: unknown;
  inputType: RecordUnknown;
  q: QueryData;
  then: QueryThen<unknown>;
  catch: QueryCatch;
  windows: EmptyObject;
  relations: RelationsBase;
  relationQueries: IsQueries;
  error: new (
    message: string,
    length: number,
    name: QueryErrorName,
  ) => QueryError;
}

export type SelectableOfType<T extends PickQueryMeta, Type> = {
  [K in keyof T['meta']['selectable']]: T['meta']['selectable'][K]['column']['type'] extends Type | null
    ? K
    : never;
}[keyof T['meta']['selectable']];

export type SelectableOrExpressionOfType<
  T extends PickQueryMeta,
  C extends Column.Pick.Type,
> =
  | SelectableOfType<T, C['type']>
  | Expression<Column.Pick.QueryColumnOfType<C['type'] | null>>;

export const queryTypeWithLimitOne: RecordKeyTrue = {
  one: true,
  oneOrThrow: true,
  value: true,
  valueOrThrow: true,
};

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
    ? QueryThenShallowSimplifyArr<ColumnsShape.Output<T['result']>>
    : T[K];
} & QueryMetaHasWhere;

export type SetQueryReturnsAllResult<
  T extends PickQueryMetaResult,
  Result extends Column.QueryColumns,
> = {
  [K in keyof T]: K extends 'returnType'
    ? 'all'
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThenShallowSimplifyArr<T['result']>
    : T[K];
} & QueryMetaHasWhere;

export type QueryTakeOptional<T extends PickQueryResultReturnType> =
  T['returnType'] extends 'value' | 'pluck' | 'void'
    ? T
    : T['returnType'] extends 'valueOrThrow'
    ? {
        [K in keyof T]: K extends 'returnType'
          ? 'value'
          : K extends 'then'
          ? QueryThen<T['result']['value']['outputType'] | undefined>
          : T[K];
      }
    : {
        [K in keyof T]: K extends 'returnType'
          ? 'one'
          : K extends 'then'
          ? QueryThenShallowSimplifyOptional<ColumnsShape.Output<T['result']>>
          : T[K];
      };

export type QueryTake<T extends PickQueryResultReturnType> =
  T['returnType'] extends 'valueOrThrow' | 'pluck' | 'void'
    ? T
    : T['returnType'] extends 'value'
    ? {
        [K in keyof T]: K extends 'returnType'
          ? 'valueOrThrow'
          : K extends 'then'
          ? QueryThen<Exclude<T['result']['value']['outputType'], undefined>>
          : T[K];
      }
    : {
        [K in keyof T]: K extends 'returnType'
          ? 'oneOrThrow'
          : K extends 'then'
          ? QueryThenShallowSimplify<ColumnsShape.Output<T['result']>>
          : T[K];
      };

export type SetQueryReturnsOne<T extends PickQueryMetaResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'oneOrThrow'
    : K extends 'then'
    ? QueryThenShallowSimplify<ColumnsShape.Output<T['result']>>
    : T[K];
};

export type SetQueryReturnsOneResult<
  T extends PickQueryMetaResult,
  Result extends Column.QueryColumns,
> = {
  [K in keyof T]: K extends 'returnType'
    ? 'oneOrThrow'
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThenShallowSimplify<ColumnsShape.Output<Result>>
    : T[K];
};

export type SetQueryReturnsRows<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'rows'
    : K extends 'then'
    ? QueryThen<ColumnsShape.Output<T['result']>[keyof T['result']][][]>
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

export type SetQueryReturnsPluckColumn<T, C extends Column.Pick.QueryColumn> = {
  [K in keyof T]: K extends 'result'
    ? { pluck: C }
    : K extends 'returnType'
    ? 'pluck'
    : K extends 'then'
    ? QueryThen<C['outputType'][]>
    : T[K];
} & QueryMetaHasSelect;

export type SetValueQueryReturnsPluckColumn<T extends PickQueryMetaResult> = {
  [K in keyof T]: K extends 'result'
    ? { pluck: T['result']['value'] }
    : K extends 'returnType'
    ? 'pluck'
    : K extends 'then'
    ? QueryThen<T['result']['value']['outputType'][]>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsPluckColumnResult<
  T extends PickQueryMetaResult,
  Result extends Column.QueryColumns,
> = {
  [K in keyof T]: K extends 'result'
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
  Arg extends keyof T['meta']['selectable'],
> = SetQueryReturnsColumnOrThrow<T, T['meta']['selectable'][Arg]['column']> &
  T['meta']['selectable'][Arg]['column']['operators'];

export type SetValueQueryReturnsValueOrThrow<T extends PickQueryMetaResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'then'
    ? QueryThen<T['result']['value']['outputType']>
    : T[K];
};

export type SetQueryReturnsValueOptional<
  T extends PickQueryMeta,
  Arg extends GetStringArg<T>,
> = SetQueryReturnsColumnOptional<
  T,
  {
    [K in keyof T['meta']['selectable'][Arg]['column']]: K extends 'outputType'
      ? T['meta']['selectable'][Arg]['column'][K] | undefined
      : T['meta']['selectable'][Arg]['column'][K];
  }
> &
  Omit<T['meta']['selectable'][Arg]['column']['operators'], 'equals' | 'not'> &
  Column.Modifiers.OperatorsNullable<T['meta']['selectable'][Arg]['column']>;

export type SetQueryReturnsColumnOrThrow<
  T,
  Column extends Column.Pick.OutputType,
> = {
  [K in keyof T]: K extends 'result'
    ? { value: Column }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'then'
    ? QueryThen<Column['outputType']>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsColumnOptional<
  T,
  Column extends Column.Pick.OutputType,
> = {
  [K in keyof T]: K extends 'result'
    ? { value: Column }
    : K extends 'returnType'
    ? 'value'
    : K extends 'then'
    ? QueryThen<Column['outputType'] | undefined>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsColumn<T extends PickQueryMetaResult> = {
  [K in keyof T]: K extends 'result'
    ? { value: T['result']['pluck'] }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'then'
    ? QueryThen<T['result']['pluck']['outputType']>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsColumnResult<
  T extends PickQueryMetaResult,
  Result extends Column.QueryColumns,
> = {
  [K in keyof T]: K extends 'result'
    ? { value: T['result']['pluck'] }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThen<Result['pluck']['outputType']>
    : T[K];
} & QueryMetaHasSelect;

export type SetQueryReturnsRowCount<T extends PickQueryMetaResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'result'
    ? { value: Column.Pick.QueryColumnOfType<number> }
    : K extends 'then'
    ? QueryThen<number>
    : T[K];
};

export type SetQueryReturnsRowCountMany<T extends PickQueryMetaResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'pluck'
    : K extends 'result'
    ? { pluck: Column.Pick.QueryColumnOfType<number> }
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

export type SetQueryResult<
  T extends PickQueryMetaReturnType,
  Result extends Column.QueryColumns,
> = {
  [K in keyof T]: K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThenByQuery<T, Result>
    : T[K];
};

export interface ReturnsQueryOrExpression<T> {
  (): QueryOrExpression<T>;
}

export interface QueryOrExpressionBooleanOrNullResult {
  result: { value: Column.Pick.QueryColumnOfType<boolean | null> };
}

export const isQueryReturnsAll = (q: Query) =>
  !q.q.returnType || q.q.returnType === 'all';

export const isQuery = (q: unknown): q is IsQuery =>
  !!q && typeof q === 'object' && '__isQuery' in q && q.__isQuery === true;
