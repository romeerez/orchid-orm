import {
  PickQueryMetaResultRelationsWindows,
  PickQueryQ,
  Query,
  SelectableOrExpressionOfType,
  SetQueryReturnsColumnOrThrow,
} from '../query/query';
import { ExpressionOutput, SelectableOrExpression } from '../common/utils';
import {
  emptyArray,
  emptyObject,
  Expression,
  PickQueryMeta,
  QueryColumn,
  QueryColumnOfDataType,
} from 'orchid-core';
import {
  AggregateOptions,
  makeFnExpression,
  FnExpression,
  Over,
} from '../common/fn';
import {
  OperatorsAny,
  OperatorsArray,
  OperatorsBoolean,
  OperatorsNumber,
  OperatorsText,
} from '../columns/operators';
import { RawSQL } from '../sql/rawSql';
import {
  ColumnType,
  DecimalColumn,
  IntegerColumn,
  NumberAsStringBaseColumn,
  NumberBaseColumn,
  RealColumn,
} from '../columns';
import { defaultSchemaConfig } from '../columns/defaultSchemaConfig';
import {
  _getSelectableColumn,
  _queryGetOptional,
  QueryGetSelf,
} from './get.utils';

// Helper function to check if we're selecting a count on this query.
// Used in `create` to not return a full record after `count()` method.
export const isSelectingCount = (q: PickQueryQ) => {
  const { expr } = q.q;
  return (
    expr instanceof FnExpression && expr.fn === 'count' && expr.args[0] === '*'
  );
};

// `count` returns `bigint` type that is represented by a string.
// This is needed to parse the value back to a number.
const int = new IntegerColumn(defaultSchemaConfig);
int.parseItem = int.parseFn = (input): number => parseInt(input as never);

// Parse nullable string to int, the nullable string may happen because of `bigint` db type.
const nullableInt = new IntegerColumn(defaultSchemaConfig);
nullableInt.parseItem = nullableInt.parseFn = (input): number =>
  (input === null ? null : parseInt(input as never)) as number;

// double-precision is represented by string in JS, parse it to float.
const nullableFloat = new RealColumn(defaultSchemaConfig);
nullableFloat.parseItem = nullableFloat.parseFn = (input): number =>
  (input === null ? null : parseFloat(input as never)) as number;

const stringAsNumber =
  new (NumberAsStringBaseColumn as unknown as typeof DecimalColumn)(
    defaultSchemaConfig,
  );

const numericResultColumn = (
  q: unknown,
  arg: PropertyKey | Expression,
): ColumnType => {
  const type =
    typeof arg === 'string'
      ? _getSelectableColumn(q as Query, arg)
      : (arg as Expression).result.value;

  return type instanceof NumberBaseColumn ? nullableFloat : stringAsNumber;
};

type QueryReturnsAgg<T, C, Op> = SetQueryReturnsColumnOrThrow<
  T,
  QueryColumn<C, Op>
> &
  Op;

type CountReturn<T> = QueryReturnsAgg<T, number, OperatorsNumber> & {
  isCount: true;
};

type SelectableDataType<T extends PickQueryMeta, DataType extends string> =
  | {
      [K in keyof T['meta']['selectable']]: T['meta']['selectable'][K]['column']['dataType'] extends DataType
        ? K
        : never;
    }[keyof T['meta']['selectable']]
  | Expression<QueryColumnOfDataType<DataType>>;

type NumberNullable = QueryColumn<number | null, OperatorsNumber>;

type NumericReturn<
  T extends PickQueryMeta,
  Arg,
> = Arg extends keyof T['meta']['selectable']
  ? SetQueryReturnsColumnOrThrow<
      T,
      QueryColumn<
        T['meta']['selectable'][Arg]['column']['type'] | null,
        OperatorsNumber
      >
    > &
      OperatorsNumber
  : Arg extends Expression
  ? SetQueryReturnsColumnOrThrow<
      T,
      QueryColumn<Arg['result']['value']['type'] | null, OperatorsNumber>
    > &
      OperatorsNumber
  : never;

type NullableNumberReturn<T> = SetQueryReturnsColumnOrThrow<T, NumberNullable> &
  OperatorsNumber;

export type BooleanQueryColumn = QueryColumn<boolean, OperatorsBoolean>;

type BooleanNullable = QueryColumn<boolean | null, OperatorsBoolean>;

type NullableBooleanReturn<T> = SetQueryReturnsColumnOrThrow<
  T,
  BooleanNullable
> &
  OperatorsBoolean;

type NullableJSONAggReturn<
  T extends PickQueryMeta,
  Arg extends SelectableOrExpression<T>,
> = SetQueryReturnsColumnOrThrow<
  T,
  {
    dataType: 'json';
    type: (ExpressionOutput<T, Arg>['type'] | null)[] | null;
    outputType: (ExpressionOutput<T, Arg>['outputType'] | null)[] | null;
    queryType: (ExpressionOutput<T, Arg>['queryType'] | null)[] | null;
    operators: OperatorsArray;
  }
> &
  OperatorsArray;

interface RecordSelectableOrExpression<T extends PickQueryMeta> {
  [K: string]: SelectableOrExpression<T>;
}

type NullableJSONObjectReturn<
  T extends PickQueryMeta,
  Obj extends RecordSelectableOrExpression<T>,
> = SetQueryReturnsColumnOrThrow<
  T,
  {
    dataType: 'json';
    type:
      | {
          [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['type'];
        }
      | null;
    outputType:
      | {
          [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['outputType'];
        }
      | null;
    queryType:
      | {
          [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['queryType'];
        }
      | null;
    operators: OperatorsAny;
  }
> &
  OperatorsAny;

type StringColumn = QueryColumn<string, OperatorsText>;

type StringNullable = QueryColumn<string | null, OperatorsText>;

type NullableStringReturn<T> = SetQueryReturnsColumnOrThrow<T, StringNullable> &
  OperatorsText;

export interface AggregateArgTypes {
  minMax: // bpchar, timetz not supported by ORM
  | 'citext'
    | 'date'
    | 'float4'
    | 'float8'
    | 'inet'
    | 'int2'
    | 'int4'
    | 'int8'
    | 'interval'
    | 'money'
    | 'numeric'
    | 'text'
    | 'time'
    | 'timestamp'
    | 'timestamptz';
  sum:
    | 'float4'
    | 'float8'
    | 'int2'
    | 'int4'
    | 'int8'
    | 'interval'
    | 'money'
    | 'numeric';
  avg: // unlike sum, avg has no money
  'float4' | 'float8' | 'int2' | 'int4' | 'int8' | 'interval' | 'numeric';
  bit: 'bit' | 'int2' | 'int4' | 'int8';
  bool: 'bool';
  stringAgg: 'bytea' | 'text';
}

// Query methods to get a single value for an aggregate function
export class AggregateMethods {
  /**
   * Use `exists()` to check if there is at least one record-matching condition.
   *
   * It will discard previous `select` statements if any. Returns a boolean.
   *
   * ```ts
   * const exists: boolean = await db.table.where(...conditions).exists();
   * ```
   */
  exists<T extends QueryGetSelf>(
    this: T,
  ): SetQueryReturnsColumnOrThrow<T, BooleanQueryColumn> {
    const q = _queryGetOptional(
      (this as unknown as Query).clone(),
      new RawSQL('true'),
    );
    q.q.notFoundDefault = false;
    q.q.coalesceValue = new RawSQL('false');
    return q as never;
  }

  /**
   * Count records with the `count` function:
   *
   * ```ts
   * // count all records:
   * const result: number = await db.table.count();
   *
   * // count records where a column is not NULL:
   * db.table.count('name');
   *
   * // see options above:
   * db.table.count('*', aggregateOptions);
   *
   * // select counts of people grouped by city
   * db.people
   *   .select('city', {
   *     population: (q) => q.count(),
   *   })
   *   .group('city');
   * ```
   *
   * @param arg - optionally, provide a column or a raw SQL for the `count` argument
   * @param options - aggregation options
   */
  count<T extends PickQueryMetaResultRelationsWindows>(
    this: T,
    arg: SelectableOrExpression<T> = '*',
    options?: AggregateOptions<T>,
  ): CountReturn<T> {
    return makeFnExpression(this, int, 'count', [arg], options) as never;
  }

  /**
   * Get the minimum value for the specified numeric column, returns number or `null` if there are no records.
   *
   * ```ts
   * const result: number | null = await db.table.min(
   *   'numericColumn',
   *   aggregateOptions,
   * );
   *
   * // select min product price grouped by product category
   * db.product
   *   .select('category', {
   *     minPrice: (q) => q.min('price'),
   *   })
   *   .group('category')
   *   .take();
   * ```
   *
   * @param arg - numeric column or raw SQL
   * @param options - aggregation options
   */
  min<
    T extends PickQueryMetaResultRelationsWindows,
    Arg extends SelectableDataType<T, AggregateArgTypes['minMax']>,
  >(this: T, arg: Arg, options?: AggregateOptions<T>): NumericReturn<T, Arg> {
    return makeFnExpression(
      this,
      numericResultColumn(this, arg),
      'min',
      [arg],
      options,
    ) as never;
  }

  /**
   * Gets the maximum value for the specified numeric column, returns number or `null` if there are no records.
   *
   * ```ts
   * const result: number | null = await db.table.max(
   *   'numericColumn',
   *   aggregateOptions,
   * );
   *
   * // select max product price grouped by product category
   * db.product
   *   .select('category', {
   *     maxPrice: (q) => q.max('price'),
   *   })
   *   .group('category')
   *   .take();
   * ```
   *
   * @param arg - numeric column or raw SQL
   * @param options - aggregation options
   */
  max<
    T extends PickQueryMetaResultRelationsWindows,
    Arg extends SelectableDataType<T, AggregateArgTypes['minMax']>,
  >(this: T, arg: Arg, options?: AggregateOptions<T>): NumericReturn<T, Arg> {
    return makeFnExpression(
      this,
      numericResultColumn(this, arg),
      'max',
      [arg],
      options,
    ) as never;
  }

  /**
   * Retrieve the sum of the values of a given numeric column, returns number or `null` if there are no records.
   *
   * ```ts
   * const result: number | null = await db.table.sum(
   *   'numericColumn',
   *   aggregateOptions,
   * );
   *
   * // select sum of employee salaries grouped by years
   * db.employee
   *   .select('year', {
   *     yearlySalaries: (q) => q.sum('salary'),
   *   })
   *   .group('year');
   * ```
   *
   * @param arg - numeric column or raw SQL
   * @param options - aggregation options
   */
  sum<
    T extends PickQueryMetaResultRelationsWindows,
    Arg extends SelectableDataType<T, AggregateArgTypes['sum']>,
  >(this: T, arg: Arg, options?: AggregateOptions<T>): NumericReturn<T, Arg> {
    return makeFnExpression(
      this,
      numericResultColumn(this, arg),
      'sum',
      [arg],
      options,
    ) as never;
  }

  /**
   * Retrieve the average value of a numeric column, it returns a number or `null` if there are no records.
   *
   * ```ts
   * const result: number | null = db.table.avg('numericColumn', aggregateOptions);
   *
   * // select average movies ratings
   * db.movie
   *   .select('title', {
   *     averageRating: (q) => q.avg('rating'),
   *   })
   *   .group('title');
   * ```
   *
   * @param arg - numeric column or raw SQL
   * @param options - aggregation options
   */
  avg<
    T extends PickQueryMetaResultRelationsWindows,
    Arg extends SelectableDataType<T, AggregateArgTypes['avg']>,
  >(this: T, arg: Arg, options?: AggregateOptions<T>): NumericReturn<T, Arg> {
    return makeFnExpression(
      this,
      numericResultColumn(this, arg),
      'avg',
      [arg],
      options,
    ) as never;
  }

  /**
   * Bitwise `and` aggregation, returns `number` or `null` if there are no records.
   *
   * ```ts
   * const result: number | null = db.table.bitAnd(
   *   'numericColumn',
   *   aggregateOptions,
   * );
   *
   * // select grouped `bitAnd`
   * db.table
   *   .select('someColumn', {
   *     bitAnd: (q) => q.bitAnd('numericColumn'),
   *   })
   *   .group('someColumn');
   * ```
   *
   * @param arg - numeric column or raw SQL
   * @param options - aggregation options
   */
  bitAnd<
    T extends PickQueryMetaResultRelationsWindows,
    Arg extends SelectableDataType<T, AggregateArgTypes['bit']>,
  >(this: T, arg: Arg, options?: AggregateOptions<T>): NumericReturn<T, Arg> {
    return makeFnExpression(
      this,
      numericResultColumn(this, arg),
      'bit_and',
      [arg],
      options,
    ) as never;
  }

  /**
   * Bitwise `or` aggregation, returns `number` or `null` if there are no records.
   *
   * ```ts
   * const result: number | null = db.table.bitOr('numericColumn', aggregateOptions);
   *
   * // select grouped `bitOr`
   * db.table
   *   .select('someColumn', {
   *     bitOr: (q) => q.bitOr('numericColumn'),
   *   })
   *   .group('someColumn');
   * ```
   *
   * @param arg - numeric column or raw SQL
   * @param options - aggregation options
   */
  bitOr<
    T extends PickQueryMetaResultRelationsWindows,
    Arg extends SelectableDataType<T, AggregateArgTypes['bit']>,
  >(this: T, arg: Arg, options?: AggregateOptions<T>): NumericReturn<T, Arg> {
    return makeFnExpression(
      this,
      numericResultColumn(this, arg),
      'bit_or',
      [arg],
      options,
    ) as never;
  }

  /**
   * Aggregate booleans with `and` logic, it returns `boolean` or `null` if there are no records.
   *
   * ```ts
   * const result: boolean | null = db.table.boolAnd(
   *   'booleanColumn',
   *   aggregateOptions,
   * );
   *
   * // select grouped `boolAnd`
   * db.table
   *   .select('someColumn', {
   *     boolAnd: (q) => q.boolAnd('booleanColumn'),
   *   })
   *   .group('someColumn');
   * ```
   *
   * @param arg - boolean column or raw SQL
   * @param options - aggregation options
   */
  boolAnd<T extends PickQueryMetaResultRelationsWindows>(
    this: T,
    arg: SelectableDataType<T, AggregateArgTypes['bool']>,
    options?: AggregateOptions<T>,
  ): NullableBooleanReturn<T> {
    return makeFnExpression(
      this,
      emptyObject as QueryColumn,
      'bool_and',
      [arg],
      options,
    ) as never;
  }

  /**
   * Aggregate booleans with `or` logic, it returns `boolean` or `null` if there are no records.
   *
   * ```ts
   * const result: boolean | null = db.table.boolOr(
   *   'booleanColumn',
   *   aggregateOptions,
   * );
   *
   * // select grouped `boolOr`
   * db.table
   *   .select('someColumn', {
   *     boolOr: (q) => q.boolOr('booleanColumn'),
   *   })
   *   .group('someColumn');
   * ```
   *
   * @param arg - boolean column or raw SQL
   * @param options - aggregation options
   */
  boolOr<T extends PickQueryMetaResultRelationsWindows>(
    this: T,
    arg: SelectableDataType<T, AggregateArgTypes['bool']>,
    options?: AggregateOptions<T>,
  ): NullableBooleanReturn<T> {
    return makeFnExpression(
      this,
      emptyObject as QueryColumn,
      'bool_or',
      [arg],
      options,
    ) as never;
  }

  /**
   * Equivalent to {@link boolAnd}
   */
  every<T extends PickQueryMetaResultRelationsWindows>(
    this: T,
    arg: SelectableDataType<T, AggregateArgTypes['bool']>,
    options?: AggregateOptions<T>,
  ): NullableBooleanReturn<T> {
    return makeFnExpression(
      this,
      emptyObject as QueryColumn,
      'every',
      [arg],
      options,
    ) as never;
  }

  /**
   * Aggregate values into an array by using `json_agg`. Returns array of values or `null` if there are no records.
   *
   * `jsonAgg` is working a bit faster, `jsonbAgg` is better only when applying JSON operations in SQL.
   *
   * ```ts
   * const idsOrNull: number[] | null = db.table.jsonAgg('id', aggregateOptions);
   *
   * const namesOrNull: string[] | null = db.table.jsonbAgg(
   *   'name',
   *   aggregateOptions,
   * );
   *
   * // select grouped `jsonAgg`
   * db.table
   *   .select('someColumn', {
   *     jsonAgg: (q) => q.jsonAgg('anyColumn'),
   *   })
   *   .group('someColumn');
   * ```
   *
   * @param arg - any column or raw SQL
   * @param options - aggregation options
   */
  jsonAgg<
    T extends PickQueryMetaResultRelationsWindows,
    Arg extends SelectableOrExpression<T>,
  >(
    this: T,
    arg: Arg,
    options?: AggregateOptions<T>,
  ): NullableJSONAggReturn<T, Arg> {
    return makeFnExpression(
      this,
      emptyObject as never,
      'json_agg',
      [arg],
      options,
    );
  }

  /**
   * See {@link jsonAgg}
   */
  jsonbAgg<
    T extends PickQueryMetaResultRelationsWindows,
    Arg extends SelectableOrExpression<T>,
  >(
    this: T,
    arg: Arg,
    options?: AggregateOptions<T>,
  ): NullableJSONAggReturn<T, Arg> {
    return makeFnExpression(
      this,
      emptyObject as never,
      'jsonb_agg',
      [arg],
      options,
    );
  }

  /**
   * It does the construction of JSON objects, keys are provided strings and values can be table columns or raw SQL expressions, and returns `object` or `null` if no records.
   *
   * `jsonObjectAgg` is different from `jsonbObjectAgg` by internal representation in the database, `jsonObjectAgg` is a bit faster as it constructs a simple string.
   *
   * ```ts
   * import { TextColumn } from './string';
   *
   * // object has type { nameAlias: string, foo: string } | null
   * const object = await db.table.jsonObjectAgg(
   *   {
   *     // select a column with alias
   *     nameAlias: 'name',
   *     // select raw SQL with alias
   *     foo: sql<string>`"bar" || "baz"`,
   *   },
   *   aggregateOptions,
   * );
   *
   * // select aggregated object
   * db.table.select('id', {
   *   object: (q) =>
   *     q.jsonObjectAgg({
   *       nameAlias: 'name',
   *       foo: sql<string>`"bar" || "baz"`,
   *     }),
   * });
   * ```
   *
   * @param arg - object where values are column names or SQL
   * @param options - aggregation options
   */
  jsonObjectAgg<
    T extends PickQueryMetaResultRelationsWindows,
    Obj extends RecordSelectableOrExpression<T>,
  >(
    this: T,
    arg: Obj,
    options?: AggregateOptions<T>,
  ): NullableJSONObjectReturn<T, Obj> {
    return makeFnExpression(
      this,
      emptyObject as never,
      'json_object_agg',
      [{ pairs: arg }],
      options,
    );
  }

  /**
   * See {@link jsonObjectAgg}
   */
  jsonbObjectAgg<
    T extends PickQueryMetaResultRelationsWindows,
    Obj extends RecordSelectableOrExpression<T>,
  >(
    this: T,
    arg: Obj,
    options?: AggregateOptions<T>,
  ): NullableJSONObjectReturn<T, Obj> {
    return makeFnExpression(
      this,
      emptyObject as never,
      'jsonb_object_agg',
      [{ pairs: arg }],
      options,
    );
  }

  /**
   * Select joined strings, it returns a string or `null` if no records.
   *
   * ```ts
   * const result: string | null = db.table.stringAgg(
   *   'name',
   *   ', ',
   *   aggregateOptions,
   * );
   *
   * // select joined strings grouped by some column
   * db.table
   *   .select('someColumn', {
   *     joinedNames: (q) => q.stringAgg('name', ', '),
   *   })
   *   .group('someColumn');
   * ```
   *
   * @param arg - string column or SQL
   * @param delimiter - string to join with
   * @param options - aggration options
   */
  stringAgg<T extends PickQueryMetaResultRelationsWindows>(
    this: T,
    arg: SelectableDataType<T, AggregateArgTypes['stringAgg']>,
    delimiter: string,
    options?: AggregateOptions<T>,
  ): NullableStringReturn<T> {
    return makeFnExpression(
      this,
      emptyObject as QueryColumn,
      'string_agg',
      [arg, { value: delimiter }],
      options,
    ) as NullableStringReturn<T>;
  }

  /**
   * Concatenates `xml` columns, returns a `string` or `null` if no records.
   *
   * ```ts
   * const xml: string | null = await db.table.xmlAgg('xmlColumn', aggregateOptions);
   *
   * // select joined XMLs grouped by some column
   * db.table
   *   .select('someColumn', {
   *     joinedXMLs: (q) => q.xmlAgg('xml'),
   *   })
   *   .group('someColumn');
   * ```
   *
   * @param arg - column or SQL with XML
   * @param options - aggregation options
   */
  xmlAgg<T extends PickQueryMetaResultRelationsWindows>(
    this: T,
    arg: SelectableOrExpressionOfType<T, StringColumn>,
    options?: AggregateOptions<T>,
  ): NullableStringReturn<T> {
    return makeFnExpression(
      this,
      emptyObject as QueryColumn,
      'xmlagg',
      [arg],
      options,
    ) as NullableStringReturn<T>;
  }

  /**
   * Selects the` row_number` window function.
   *
   * Returns the number of the current row within its partition, counting from 1.
   *
   * ```ts
   * // result is of type Array<{ rowNumber: number }>
   * const result = await db.table.select({
   *   rowNumber: (q) =>
   *     q.rowNumber({
   *       partitionBy: 'someColumn',
   *       order: { createdAt: 'ASC' },
   *     }),
   * });
   * ```
   *
   * @param over - OVER clause config
   */
  rowNumber<T extends PickQueryMetaResultRelationsWindows>(
    this: T,
    over?: Over<T>,
  ): NullableNumberReturn<T> {
    return makeFnExpression(this, nullableInt, 'row_number', emptyArray, {
      over,
    }) as never;
  }

  /**
   * Selects the` rank` window function.
   *
   * Returns the rank of the current row, with gaps; that is, the row_number of the first row in its peer group.
   *
   * ```ts
   * // result is of type Array<{ rank: number }>
   * const result = await db.table.select({
   *   rank: (q) =>
   *     q.rank({
   *       partitionBy: 'someColumn',
   *       order: { createdAt: 'ASC' },
   *     }),
   * });
   * ```
   *
   * @param over - OVER clause config
   */
  rank<T extends PickQueryMetaResultRelationsWindows>(
    this: T,
    over?: Over<T>,
  ): NullableNumberReturn<T> {
    return makeFnExpression(this, nullableInt, 'rank', emptyArray, {
      over,
    }) as never;
  }

  /**
   * Selects the` dense_rank` window function.
   *
   * Returns the rank of the current row, without gaps; this function effectively counts peer groups.
   *
   * ```ts
   * // result is of type Array<{ denseRank: number }>
   * const result = await db.table.select({
   *   denseRank: (q) =>
   *     q.denseRank({
   *       partitionBy: 'someColumn',
   *       order: { createdAt: 'ASC' },
   *     }),
   * });
   * ```
   *
   * @param over - OVER clause config
   */
  denseRank<T extends PickQueryMetaResultRelationsWindows>(
    this: T,
    over?: Over<T>,
  ): NullableNumberReturn<T> {
    return makeFnExpression(this, nullableInt, 'dense_rank', emptyArray, {
      over,
    }) as never;
  }

  /**
   * Selects the `percent_rank` window function.
   *
   * Returns the relative rank of the current row, that is (rank - 1) / (total partition rows - 1). The value thus ranges from 0 to 1 inclusive.
   *
   * ```ts
   * // result is of type Array<{ percentRank: number }>
   * const result = await db.table.select({
   *   percentRank: (q) =>
   *     q.percentRank({
   *       partitionBy: 'someColumn',
   *       order: { createdAt: 'ASC' },
   *     }),
   * });
   * ```
   *
   * @param over - OVER clause config
   */
  percentRank<T extends PickQueryMetaResultRelationsWindows>(
    this: T,
    over?: Over<T>,
  ): NullableNumberReturn<T> {
    return makeFnExpression(this, nullableInt, 'percent_rank', emptyArray, {
      over,
    }) as never;
  }

  /**
   * Selects the `cume_dist` window function.
   *
   * Returns the cumulative distribution, that is (number of partition rows preceding or peers with current row) / (total partition rows). The value thus ranges from 1/N to 1.
   *
   * ```ts
   * // result is of type Array<{ cumeDist: number }>
   * const result = await db.table.select({
   *   cumeDist: (q) =>
   *     q.cumeDist({
   *       partitionBy: 'someColumn',
   *       order: { createdAt: 'ASC' },
   *     }),
   * });
   * ```
   *
   * @param over - OVER clause config
   */
  cumeDist<T extends PickQueryMetaResultRelationsWindows>(
    this: T,
    over?: Over<T>,
  ): NullableNumberReturn<T> {
    return makeFnExpression(this, nullableFloat, 'cume_dist', emptyArray, {
      over,
    }) as never;
  }
}
