import {
  Query,
  SelectableOrExpressionOfType,
  SetQueryReturnsColumn,
} from '../query/query';
import {
  ArrayColumn,
  BooleanColumn,
  BooleanNullable,
  ColumnType,
  IntegerColumn,
  JSONColumn,
  JSONTextColumn,
  NumberBaseColumn,
  NumberColumn,
  TextBaseColumn,
  TextColumn,
  UnknownColumn,
  XMLColumn,
} from '../columns';
import { ExpressionOutput, SelectableOrExpression } from '../common/utils';
import { ColumnTypeBase, emptyArray, NullableColumn } from 'orchid-core';
import {
  AggregateOptions,
  makeFnExpression,
  ColumnExpression,
  FnExpression,
  Over,
} from '../common/fn';
import { Operators } from '../columns/operators';

// Helper function to check if we're selecting a count on this query.
// Used in `create` to not return a full record after `count()` method.
export const isSelectingCount = (q: Query) => {
  const { expr } = q.q;
  return (
    expr instanceof FnExpression && expr.fn === 'count' && expr.args[0] === '*'
  );
};

// `count` returns `bigint` type that is represented by a string.
// This is needed to parse the value back to a number.
const int = new IntegerColumn().parse((input) =>
  parseInt(input as unknown as string),
);

type NullableInteger = NullableColumn<IntegerColumn>;

// Parse nullable string to int, the nullable string may happen because of `bigint` db type.
const nullableInt = new IntegerColumn().parse((input) =>
  input === null ? null : parseInt(input as unknown as string),
) as NullableInteger;

type NullableNumber = NullableColumn<NumberColumn>;

// double-precision is represented by string in JS, parse it to float.
const nullableFloat = new IntegerColumn().parse((input) =>
  input === null ? null : parseFloat(input as unknown as string),
) as NullableNumber;

const nullableBoolean: BooleanNullable = new BooleanColumn().nullable();

type NullableJSONAgg<
  T extends Query,
  Arg extends SelectableOrExpression<T>,
> = NullableColumn<ArrayColumn<ExpressionOutput<T, Arg>>>;

type NullableJSONObject<
  T extends Query,
  Obj extends Record<string, SelectableOrExpression<T>>,
  Outputs extends Record<string, ColumnTypeBase> = {
    [K in keyof Obj]: ExpressionOutput<T, Obj[K]>;
  },
> = NullableColumn<
  ColumnType<
    { [K in keyof Outputs]: Outputs[K]['type'] },
    typeof Operators.any,
    { [K in keyof Outputs]: Outputs[K]['inputType'] },
    { [K in keyof Outputs]: Outputs[K]['outputType'] }
  >
>;

const jsonColumn = new JSONTextColumn().nullable();
const jsonbColumn = new JSONColumn().nullable();

type NullableText = NullableColumn<TextColumn>;
const nullableText = new TextColumn().nullable();

// Query methods to get a single value for an aggregate function
export class AggregateMethods {
  /**
   * See {@link SelectAggMethods.fn}
   */
  fn<T extends Query, Type = unknown, C extends ColumnType = ColumnType<Type>>(
    this: T,
    fn: string,
    args: SelectableOrExpression<T>[],
    options?: AggregateOptions<T>,
    type?: (t: T['columnTypes']) => C,
  ): SetQueryReturnsColumn<T, C> & C['operators'] {
    return makeFnExpression(
      this,
      (type?.(this.columnTypes) || UnknownColumn.instance) as C,
      fn,
      args,
      options,
    );
  }

  /**
   * See {@link SelectAggMethods.count}
   */
  count<T extends Query>(
    this: T,
    arg: SelectableOrExpression<T> = '*',
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NumberColumn> & {
    isCount: true;
  } & NumberColumn['operators'] {
    return makeFnExpression(
      this,
      int,
      'count',
      [arg],
      options,
    ) as SetQueryReturnsColumn<T, NumberColumn> & {
      isCount: true;
    } & NumberColumn['operators'];
  }

  /**
   * See {@link SelectAggMethods.avg}
   */
  avg<T extends Query>(
    this: T,
    arg: SelectableOrExpressionOfType<T, NumberBaseColumn>,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NullableNumber> & NullableNumber['operators'] {
    return makeFnExpression(this, nullableFloat, 'avg', [arg], options);
  }

  /**
   * See {@link SelectAggMethods.min}
   */
  min<T extends Query>(
    this: T,
    arg: SelectableOrExpressionOfType<T, NumberBaseColumn>,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NullableNumber> & NullableNumber['operators'] {
    return makeFnExpression(this, nullableFloat, 'min', [arg], options);
  }

  /**
   * See {@link SelectAggMethods.max}
   */
  max<T extends Query>(
    this: T,
    arg: SelectableOrExpressionOfType<T, NumberBaseColumn>,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NullableNumber> & NullableNumber['operators'] {
    return makeFnExpression(this, nullableFloat, 'max', [arg], options);
  }

  /**
   * See {@link SelectAggMethods.sum}
   */
  sum<T extends Query>(
    this: T,
    arg: SelectableOrExpressionOfType<T, NumberBaseColumn>,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NullableNumber> & NullableNumber['operators'] {
    return makeFnExpression(this, nullableFloat, 'sum', [arg], options);
  }

  /**
   * See {@link SelectAggMethods.bitAnd}
   */
  bitAnd<T extends Query>(
    this: T,
    arg: SelectableOrExpressionOfType<T, NumberBaseColumn>,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NullableNumber> & NullableNumber['operators'] {
    return makeFnExpression(this, nullableFloat, 'bit_and', [arg], options);
  }

  /**
   * See {@link SelectAggMethods.bitOr}
   */
  bitOr<T extends Query>(
    this: T,
    arg: SelectableOrExpressionOfType<T, NumberBaseColumn>,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NullableNumber> & NullableNumber['operators'] {
    return makeFnExpression(this, nullableFloat, 'bit_or', [arg], options);
  }

  /**
   * See {@link SelectAggMethods.boolAnd}
   */
  boolAnd<T extends Query>(
    this: T,
    arg: SelectableOrExpressionOfType<T, BooleanColumn>,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, BooleanNullable> & BooleanNullable['operators'] {
    return makeFnExpression(this, nullableBoolean, 'bool_and', [arg], options);
  }

  /**
   * See {@link SelectAggMethods.boolOr}
   */
  boolOr<T extends Query>(
    this: T,
    arg: SelectableOrExpressionOfType<T, BooleanColumn>,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, BooleanNullable> & BooleanNullable['operators'] {
    return makeFnExpression(this, nullableBoolean, 'bool_or', [arg], options);
  }

  /**
   * See {@link SelectAggMethods.every}
   */
  every<T extends Query>(
    this: T,
    arg: SelectableOrExpressionOfType<T, BooleanColumn>,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, BooleanNullable> & BooleanNullable['operators'] {
    return makeFnExpression(this, nullableBoolean, 'every', [arg], options);
  }

  /**
   * See {@link SelectAggMethods.jsonAgg}
   */
  jsonAgg<T extends Query, Arg extends SelectableOrExpression<T>>(
    this: T,
    arg: Arg,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NullableJSONAgg<T, Arg>> &
    ArrayColumn<ColumnTypeBase>['operators'] {
    return makeFnExpression(
      this,
      jsonColumn as unknown as NullableJSONAgg<T, Arg>,
      'json_agg',
      [arg],
      options,
    );
  }

  /**
   * See {@link SelectAggMethods.jsonAgg}
   */
  jsonbAgg<T extends Query, Arg extends SelectableOrExpression<T>>(
    this: T,
    arg: Arg,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NullableJSONAgg<T, Arg>> &
    ArrayColumn<ColumnTypeBase>['operators'] {
    return makeFnExpression(
      this,
      jsonbColumn as unknown as NullableJSONAgg<T, Arg>,
      'jsonb_agg',
      [arg],
      options,
    );
  }

  /**
   * See {@link SelectAggMethods.xmlAgg}
   */
  xmlAgg<T extends Query>(
    this: T,
    arg: SelectableOrExpressionOfType<T, XMLColumn>,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NullableText> & NullableText['operators'] {
    return makeFnExpression(this, nullableText, 'xmlagg', [arg], options);
  }

  /**
   * See {@link SelectAggMethods.jsonObjectAgg}
   */
  jsonObjectAgg<
    T extends Query,
    Obj extends Record<string, SelectableOrExpression<T>>,
  >(
    this: T,
    arg: Obj,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NullableJSONObject<T, Obj>> &
    typeof Operators.any {
    return makeFnExpression(
      this,
      jsonColumn as NullableJSONObject<T, Obj>,
      'json_object_agg',
      [{ pairs: arg }],
      options,
    );
  }

  /**
   * See {@link SelectAggMethods.jsonObjectAgg}
   */
  jsonbObjectAgg<
    T extends Query,
    Obj extends Record<string, SelectableOrExpression<T>>,
  >(
    this: T,
    arg: Obj,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NullableJSONObject<T, Obj>> &
    typeof Operators.any {
    return makeFnExpression(
      this,
      jsonbColumn as NullableJSONObject<T, Obj>,
      'jsonb_object_agg',
      [{ pairs: arg }],
      options,
    );
  }

  /**
   * See {@link SelectAggMethods.stringAgg}
   */
  stringAgg<T extends Query>(
    this: T,
    arg: SelectableOrExpressionOfType<T, TextBaseColumn>,
    delimiter: string,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsColumn<T, NullableText> & NullableText['operators'] {
    return makeFnExpression(
      this,
      nullableText,
      'string_agg',
      [arg, { value: delimiter }],
      options,
    );
  }

  /**
   * See {@link SelectAggMethods.rowNumber}
   */
  rowNumber<T extends Query>(
    this: T,
    over?: Over<T>,
  ): SetQueryReturnsColumn<T, NullableInteger> & NullableInteger['operators'] {
    return makeFnExpression(this, nullableInt, 'row_number', emptyArray, {
      over,
    });
  }

  /**
   * See {@link SelectAggMethods.rank}
   */
  rank<T extends Query>(
    this: T,
    over?: Over<T>,
  ): SetQueryReturnsColumn<T, NullableInteger> & NullableInteger['operators'] {
    return makeFnExpression(this, nullableInt, 'rank', emptyArray, { over });
  }

  /**
   * See {@link SelectAggMethods.denseRank}
   */
  denseRank<T extends Query>(
    this: T,
    over?: Over<T>,
  ): SetQueryReturnsColumn<T, NullableInteger> & NullableInteger['operators'] {
    return makeFnExpression(this, nullableInt, 'dense_rank', emptyArray, {
      over,
    });
  }

  /**
   * See {@link SelectAggMethods.percentRank}
   */
  percentRank<T extends Query>(
    this: T,
    over?: Over<T>,
  ): SetQueryReturnsColumn<T, NullableInteger> & NullableInteger['operators'] {
    return makeFnExpression(this, nullableInt, 'percent_rank', emptyArray, {
      over,
    });
  }

  /**
   * See {@link SelectAggMethods.cumeDist}
   */
  cumeDist<T extends Query>(
    this: T,
    over?: Over<T>,
  ): SetQueryReturnsColumn<T, NullableNumber> & NullableNumber['operators'] {
    return makeFnExpression(this, nullableFloat, 'cume_dist', emptyArray, {
      over,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const methods = AggregateMethods.prototype as any;

// Methods that are available inside `select({ (qb) => *here* })` callback
export class SelectAggMethods<T extends Query = Query> {
  /**
   * `fn` allows to call an arbitrary SQL function.
   *
   * For example, calling `sqrt` function to get a square root from some numeric column:
   *
   * ```ts
   * const q = await User.select({
   *   sqrt: (q) => q.fn<number>('sqrt', ['numericColumn']),
   * }).take();
   *
   * q.sqrt; // has type `number` just as provided
   * ```
   *
   * If this is an aggregate function, you can specify aggregation options via third parameter.
   *
   * Forth parameter is for runtime column type. When specified, allows to chain the function with the column operators:
   *
   * ```ts
   * const q = await User.select({
   *   // chain `sqrt("numericColumn")` with the "greater than 5"
   *   sqrtIsGreaterThan5: (q) => q.fn('sqrt', ['numericColumn'], {}, (t) => t.float()).gt(5),
   * }).take();
   *
   * // Return type is boolean | null
   * // todo: it should be just boolean if the column is not nullable, but for now it's always nullable
   * q.sqrtIsGreaterThan5
   * ```
   *
   * @param fn
   * @param args
   * @param options
   * @param type
   */
  fn<Type = unknown, C extends ColumnType = ColumnType<Type>>(
    fn: string,
    args: SelectableOrExpression<T>[],
    options?: AggregateOptions<T>,
    type?: (t: T['columnTypes']) => C,
  ): ColumnExpression<C> {
    return methods.fn.call(this, fn, args, options, type);
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
  count(
    arg: SelectableOrExpression<T> = '*',
    options?: AggregateOptions<T>,
  ): ColumnExpression<IntegerColumn> {
    return methods.count.call(this, arg, options);
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
  min(
    arg: SelectableOrExpressionOfType<T, NumberBaseColumn>,
    options?: AggregateOptions<T>,
  ): ColumnExpression<NullableNumber> {
    return methods.min.call(this, arg, options);
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
  max(
    arg: SelectableOrExpressionOfType<T, NumberBaseColumn>,
    options?: AggregateOptions<T>,
  ): ColumnExpression<NullableNumber> {
    return methods.max.call(this, arg, options);
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
  sum(
    arg: SelectableOrExpressionOfType<T, NumberBaseColumn>,
    options?: AggregateOptions<T>,
  ): ColumnExpression<NullableNumber> {
    return methods.sum.call(this, arg, options);
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
  avg(
    arg: SelectableOrExpressionOfType<T, NumberBaseColumn>,
    options?: AggregateOptions<T>,
  ): ColumnExpression<NullableNumber> {
    return methods.avg.call(this, arg, options);
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
  bitAnd(
    arg: SelectableOrExpressionOfType<T, NumberBaseColumn>,
    options?: AggregateOptions<T>,
  ): ColumnExpression<NullableNumber> {
    return methods.bitAnd.call(this, arg, options);
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
  bitOr(
    arg: SelectableOrExpressionOfType<T, NumberBaseColumn>,
    options?: AggregateOptions<T>,
  ): ColumnExpression<NullableNumber> {
    return methods.bitOr.call(this, arg, options);
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
  boolAnd(
    arg: SelectableOrExpressionOfType<T, BooleanColumn>,
    options?: AggregateOptions<T>,
  ): ColumnExpression<BooleanNullable> {
    return methods.boolAnd.call(this, arg, options);
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
  boolOr(
    arg: SelectableOrExpressionOfType<T, BooleanColumn>,
    options?: AggregateOptions<T>,
  ): ColumnExpression<BooleanNullable> {
    return methods.boolOr.call(this, arg, options);
  }

  /**
   * Equivalent to {@link boolAnd}
   */
  every(
    arg: SelectableOrExpressionOfType<T, BooleanColumn>,
    options?: AggregateOptions<T>,
  ): ColumnExpression<BooleanNullable> {
    return methods.every.call(this, arg, options);
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
  jsonAgg<Arg extends SelectableOrExpression<T>>(
    arg: Arg,
    options?: AggregateOptions<T>,
  ): ColumnExpression<NullableJSONAgg<T, Arg>> {
    return methods.jsonAgg.call(this, arg, options);
  }

  /**
   * See {@link jsonbAgg}
   */
  jsonbAgg<Arg extends SelectableOrExpression<T>>(
    arg: Arg,
    options?: AggregateOptions<T>,
  ): ColumnExpression<NullableJSONAgg<T, Arg>> {
    return methods.jsonbAgg.call(this, arg, options);
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
   *     foo: db.table.sql<string>`"bar" || "baz"`,
   *   },
   *   aggregateOptions,
   * );
   *
   * // select aggregated object
   * db.table.select('id', {
   *   object: (q) =>
   *     q.jsonObjectAgg({
   *       nameAlias: 'name',
   *       foo: db.table.sql<string>`"bar" || "baz"`,
   *     }),
   * });
   * ```
   *
   * @param arg - object where values are column names or SQL
   * @param options - aggregation options
   */
  jsonObjectAgg<Obj extends Record<string, SelectableOrExpression<T>>>(
    arg: Obj,
    options?: AggregateOptions<T>,
  ): ColumnExpression<NullableJSONObject<T, Obj>> {
    return methods.jsonObjectAgg.call(this, arg, options);
  }

  /**
   * See {@link jsonObjectAgg}
   */
  jsonbObjectAgg<Obj extends Record<string, SelectableOrExpression<T>>>(
    arg: Obj,
    options?: AggregateOptions<T>,
  ): ColumnExpression<NullableJSONObject<T, Obj>> {
    return methods.jsonbObjectAgg.call(this, arg, options);
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
  stringAgg(
    arg: SelectableOrExpressionOfType<T, TextBaseColumn>,
    delimiter: string,
    options?: AggregateOptions<T>,
  ): ColumnExpression<NullableText> {
    return methods.stringAgg.call(this, arg, delimiter, options);
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
  xmlAgg(
    arg: SelectableOrExpressionOfType<T, XMLColumn>,
    options?: AggregateOptions<T>,
  ): ColumnExpression<NullableText> {
    return methods.xmlAgg.call(this, arg, options);
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
  rowNumber(over?: Over<T>): ColumnExpression<NullableInteger> {
    return methods.rowNumber.call(this, over);
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
  rank(over?: Over<T>): ColumnExpression<NullableInteger> {
    return methods.rank.call(this, over);
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
  denseRank(over?: Over<T>): ColumnExpression<NullableInteger> {
    return methods.denseRank.call(this, over);
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
  percentRank(over?: Over<T>): ColumnExpression<NullableInteger> {
    return methods.percentRank.call(this, over);
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
  cumeDist(over?: Over<T>): ColumnExpression<NullableNumber> {
    return methods.cumeDist.call(this, over);
  }
}
