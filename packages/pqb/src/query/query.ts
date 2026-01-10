import { QueryMethods } from './query-methods';
import { QueryData } from './query-data';
import { QueryBuilder } from './db';
import { Column } from '../columns/column';
import { WithDataItems } from './basic-features/cte/cte.sql';
import { ColumnsShape } from '../columns';
import { QueryInternal } from './query-internal';
import {
  PickQueryResult,
  PickQueryResultReturnType,
  PickQueryReturnType,
  PickQuerySelectable,
  PickQueryShape,
  PickQueryTable,
} from './pick-query-types';
import { EmptyObject, RecordKeyTrue, RecordUnknown } from '../utils';
import { RelationsBase } from './relations';
import { QueryError, QueryErrorName } from './errors';
import { Expression } from './expressions/expression';
import { GetStringArg } from './basic-features/get/get.utils';
import { QueryHasWhere } from './basic-features/where/where';
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

export interface QueryHasSelect {
  __hasSelect: true;
}

export interface IsQuery {
  __isQuery: true;
}

// affects on typing of `chain`
export interface IsSubQuery {
  __subQuery: true;
}

export interface IsQueries {
  [K: string]: IsQuery;
}

export interface QueryOrExpression<T> {
  result: { value: Column.Pick.QueryColumnOfType<T> };
}

// query metadata that is stored only on TS side, not available in runtime
export interface QuerySelectable {
  [K: PropertyKey]: { as: string; column: Column.Pick.QueryColumn };
}

export interface Query
  extends IsQuery,
    PickQueryTable,
    PickQueryShape,
    PickQuerySelectable,
    QueryMethods<unknown> {
  __as: string;

  // Commented out for TS optimizations purposes:
  // Single relations (belongsTo, hasOne) returns one when subQuery is true, returns many otherwise.
  // It is of type `true | undefined` when is set.
  // __subQuery: boolean;
  // Union of available full text search aliases to use in `headline` and in `order`.
  // __tsQuery?: string;

  // return type of `create`, `update`, `delete` depends on whether the query has select
  __hasSelect: boolean;
  // `update` and `delete` require the query to have `where`.
  // Calling `.all()` is also setting `__hasWhere` to true.
  __hasWhere: boolean;
  // Record<string, true> where keys are columns with defaults for `create` to make them optional.
  __defaults: EmptyObject;
  // Used to determine what scopes are available on the table.
  __scopes: EmptyObject;
  // union of columns to select by default or with *
  __defaultSelect: PropertyKey;
  result: Column.QueryColumns;
  withData: WithDataItems;
  baseQuery: Query;
  internal: QueryInternal;
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

export type SelectableOfType<T extends PickQuerySelectable, Type> = {
  [K in keyof T['__selectable']]: T['__selectable'][K]['column']['type'] extends Type | null
    ? K
    : never;
}[keyof T['__selectable']];

export type SelectableOrExpressionOfType<
  T extends PickQuerySelectable,
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

// Change the query type to return multiple object records.
// It wraps the query with `WhereResult` to allow updating and deleting all records when the `all` method is used.
export type SetQueryReturnsAll<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'all'
    : K extends 'then'
    ? QueryThenShallowSimplifyArr<ColumnsShape.Output<T['result']>>
    : T[K];
} & QueryHasWhere;

export type SetQueryReturnsAllResult<
  T extends PickQueryResult,
  Result extends Column.QueryColumns,
> = {
  [K in keyof T]: K extends 'returnType'
    ? 'all'
    : K extends 'result'
    ? Result
    : K extends 'then'
    ? QueryThenShallowSimplifyArr<T['result']>
    : T[K];
} & QueryHasWhere;

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

export type QueryManyTakeOptional<T extends PickQueryResultReturnType> = {
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

export type QueryManyTake<T extends PickQueryResultReturnType> = {
  [K in keyof T]: K extends 'returnType'
    ? 'oneOrThrow'
    : K extends 'then'
    ? QueryThenShallowSimplify<ColumnsShape.Output<T['result']>>
    : T[K];
};

export type SetQueryReturnsOne<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'oneOrThrow'
    : K extends 'then'
    ? QueryThenShallowSimplify<ColumnsShape.Output<T['result']>>
    : T[K];
};

export type SetQueryReturnsOneResult<
  T extends PickQueryResult,
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
  T extends PickQuerySelectable,
  S extends keyof T['__selectable'] | Expression,
> = S extends keyof T['__selectable']
  ? {
      [K in keyof T]: K extends '__hasSelect'
        ? true
        : K extends 'result'
        ? {
            pluck: T['__selectable'][S]['column'];
          }
        : K extends 'returnType'
        ? 'pluck'
        : K extends 'then'
        ? QueryThen<T['__selectable'][S]['column']['outputType'][]>
        : T[K];
    }
  : {
      [K in keyof T]: K extends '__hasSelect'
        ? true
        : K extends 'result'
        ? {
            pluck: S extends Expression ? S['result']['value'] : never;
          }
        : K extends 'returnType'
        ? 'pluck'
        : K extends 'then'
        ? QueryThen<
            (S extends Expression
              ? S['result']['value']['outputType']
              : never)[]
          >
        : T[K];
    };

export type SetValueQueryReturnsPluckColumn<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'result'
    ? { pluck: T['result']['value'] }
    : K extends 'returnType'
    ? 'pluck'
    : K extends 'then'
    ? QueryThen<T['result']['value']['outputType'][]>
    : T[K];
} & QueryHasSelect;

export type SetQueryReturnsPluckColumnResult<
  T extends PickQueryResult,
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
} & QueryHasSelect;

export type SetQueryReturnsValueOrThrow<
  T extends PickQuerySelectable,
  Arg extends keyof T['__selectable'],
> = SetQueryReturnsColumnOrThrow<T, T['__selectable'][Arg]['column']> &
  T['__selectable'][Arg]['column']['operators'];

export type SetValueQueryReturnsValueOrThrow<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'then'
    ? QueryThen<T['result']['value']['outputType']>
    : T[K];
};

export type SetQueryReturnsValueOptional<
  T extends PickQuerySelectable,
  Arg extends GetStringArg<T>,
> = SetQueryReturnsColumnOptional<
  T,
  {
    [K in keyof T['__selectable'][Arg]['column']]: K extends 'outputType'
      ? T['__selectable'][Arg]['column'][K] | undefined
      : T['__selectable'][Arg]['column'][K];
  }
> &
  Omit<T['__selectable'][Arg]['column']['operators'], 'equals' | 'not'> &
  Column.Modifiers.OperatorsNullable<T['__selectable'][Arg]['column']>;

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
} & QueryHasSelect;

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
} & QueryHasSelect;

export type SetQueryReturnsColumn<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'result'
    ? { value: T['result']['pluck'] }
    : K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'then'
    ? QueryThen<T['result']['pluck']['outputType']>
    : T[K];
} & QueryHasSelect;

export type SetQueryReturnsColumnResult<
  T extends PickQueryResult,
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
} & QueryHasSelect;

export type SetQueryReturnsRowCount<T extends PickQueryResult> = {
  [K in keyof T]: K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'result'
    ? { value: Column.Pick.QueryColumnOfType<number> }
    : K extends 'then'
    ? QueryThen<number>
    : T[K];
};

export type SetQueryReturnsRowCountMany<T extends PickQueryResult> = {
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
  T extends PickQueryReturnType,
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
