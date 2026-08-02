import { SelectableOrExpressionOfType, SetQueryReturnsColumnOrThrow } from '../../query';
import { AggregateOptions, Over } from '../../expressions/fn-expression';
import { OperatorsAny, OperatorsArray, OperatorsBoolean, OperatorsNumber, OperatorsText } from '../../../columns/operators';
import { Column } from '../../../columns/column';
import { Expression, ExpressionOutput, SelectableOrExpression } from '../../expressions/expression';
import { PickQuerySelectableResultRelationsWindows, PickQueryQ, PickQuerySelectable } from '../../pick-query-types';
import { SearchAggregateMethods } from '../../extra-features/search/search';
export declare const isSelectingCount: (q: PickQueryQ) => boolean;
interface OperatorsCount extends OperatorsNumber {
    isCount: true;
}
type CountColumn = Column.Pick.QueryColumnOfTypeAndOps<'int8', number, OperatorsCount>;
type CountReturn<T> = SetQueryReturnsColumnOrThrow<T, CountColumn> & OperatorsCount;
type SelectableDataType<T extends PickQuerySelectable, DataType extends string> = {
    [K in keyof T['__selectable']]: T['__selectable'][K]['column']['dataType'] extends DataType ? K : never;
}[keyof T['__selectable']] | Expression<Column.Pick.QueryColumnOfDataType<DataType>>;
type NumericReturn<T extends PickQuerySelectable, Arg> = Arg extends keyof T['__selectable'] ? SetQueryReturnsColumnOrThrow<T, Column.Pick.QueryColumnOfTypeAndOps<T['__selectable'][Arg]['column']['dataType'], T['__selectable'][Arg]['column']['__type'] | null, OperatorsNumber>> & OperatorsNumber : Arg extends Expression ? SetQueryReturnsColumnOrThrow<T, Column.Pick.QueryColumnOfTypeAndOps<Arg['result']['value']['dataType'], Arg['result']['value']['__type'] | null, OperatorsNumber>> & OperatorsNumber : never;
type NullableNumberReturn<T, DataType> = SetQueryReturnsColumnOrThrow<T, Column.Pick.QueryColumnOfTypeAndOps<DataType, number | null, OperatorsNumber>> & OperatorsNumber;
export type BooleanQueryColumn = Column.Pick.QueryColumnOfTypeAndOps<'bool', boolean, OperatorsBoolean>;
type BooleanNullable = Column.Pick.QueryColumnOfTypeAndOps<'bool', boolean | null, OperatorsBoolean>;
type NullableBooleanReturn<T> = SetQueryReturnsColumnOrThrow<T, BooleanNullable> & OperatorsBoolean;
type NullableJSONAggReturn<T extends PickQuerySelectable, Arg extends SelectableOrExpression<T>> = SetQueryReturnsColumnOrThrow<T, {
    dataType: 'json';
    __type: (ExpressionOutput<T, Arg>['__type'] | null)[] | null;
    __outputType: (ExpressionOutput<T, Arg>['__outputType'] | null)[] | null;
    __queryType: (ExpressionOutput<T, Arg>['__queryType'] | null)[] | null;
    operators: OperatorsArray<never>;
}> & OperatorsArray<never>;
interface RecordSelectableOrExpression<T extends PickQuerySelectable> {
    [K: string]: SelectableOrExpression<T>;
}
type NullableJSONObjectReturn<T extends PickQuerySelectable, Obj extends RecordSelectableOrExpression<T>> = SetQueryReturnsColumnOrThrow<T, {
    dataType: 'json';
    __type: {
        [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['__type'];
    } | null;
    __outputType: {
        [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['__outputType'];
    } | null;
    __queryType: {
        [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['__queryType'];
    } | null;
    operators: OperatorsAny;
}> & OperatorsAny;
type StringColumn = Column.Pick.QueryColumnOfTypeAndOps<string, string, OperatorsText>;
type StringNullable = Column.Pick.QueryColumnOfTypeAndOps<string, string | null, OperatorsText>;
type NullableStringReturn<T> = SetQueryReturnsColumnOrThrow<T, StringNullable> & OperatorsText;
export interface AggregateArgTypes {
    minMax: 'citext' | 'date' | 'float4' | 'float8' | 'inet' | 'int2' | 'int4' | 'int8' | 'interval' | 'money' | 'numeric' | 'text' | 'time' | 'timestamp' | 'timestamptz';
    sum: 'float4' | 'float8' | 'int2' | 'int4' | 'int8' | 'interval' | 'money' | 'numeric';
    avg: // unlike sum, avg has no money
    'float4' | 'float8' | 'int2' | 'int4' | 'int8' | 'interval' | 'numeric';
    bit: 'bit' | 'int2' | 'int4' | 'int8';
    bool: 'bool';
    stringAgg: 'bytea' | 'text';
}
export interface AggregateMethods extends SearchAggregateMethods {
}
export declare class AggregateMethods {
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
    count<T extends PickQuerySelectableResultRelationsWindows>(this: T, arg?: SelectableOrExpression<T>, options?: AggregateOptions<T>): CountReturn<T>;
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
    min<T extends PickQuerySelectableResultRelationsWindows, Arg extends SelectableDataType<T, AggregateArgTypes['minMax']>>(this: T, arg: Arg, options?: AggregateOptions<T>): NumericReturn<T, Arg>;
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
    max<T extends PickQuerySelectableResultRelationsWindows, Arg extends SelectableDataType<T, AggregateArgTypes['minMax']>>(this: T, arg: Arg, options?: AggregateOptions<T>): NumericReturn<T, Arg>;
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
    sum<T extends PickQuerySelectableResultRelationsWindows, Arg extends SelectableDataType<T, AggregateArgTypes['sum']>>(this: T, arg: Arg, options?: AggregateOptions<T>): NumericReturn<T, Arg>;
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
    avg<T extends PickQuerySelectableResultRelationsWindows, Arg extends SelectableDataType<T, AggregateArgTypes['avg']>>(this: T, arg: Arg, options?: AggregateOptions<T>): NumericReturn<T, Arg>;
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
    bitAnd<T extends PickQuerySelectableResultRelationsWindows, Arg extends SelectableDataType<T, AggregateArgTypes['bit']>>(this: T, arg: Arg, options?: AggregateOptions<T>): NumericReturn<T, Arg>;
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
    bitOr<T extends PickQuerySelectableResultRelationsWindows, Arg extends SelectableDataType<T, AggregateArgTypes['bit']>>(this: T, arg: Arg, options?: AggregateOptions<T>): NumericReturn<T, Arg>;
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
    boolAnd<T extends PickQuerySelectableResultRelationsWindows>(this: T, arg: SelectableDataType<T, AggregateArgTypes['bool']>, options?: AggregateOptions<T>): NullableBooleanReturn<T>;
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
    boolOr<T extends PickQuerySelectableResultRelationsWindows>(this: T, arg: SelectableDataType<T, AggregateArgTypes['bool']>, options?: AggregateOptions<T>): NullableBooleanReturn<T>;
    /**
     * Equivalent to {@link boolAnd}
     */
    every<T extends PickQuerySelectableResultRelationsWindows>(this: T, arg: SelectableDataType<T, AggregateArgTypes['bool']>, options?: AggregateOptions<T>): NullableBooleanReturn<T>;
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
    jsonAgg<T extends PickQuerySelectableResultRelationsWindows, Arg extends SelectableOrExpression<T>>(this: T, arg: Arg, options?: AggregateOptions<T>): NullableJSONAggReturn<T, Arg>;
    /**
     * See {@link jsonAgg}
     */
    jsonbAgg<T extends PickQuerySelectableResultRelationsWindows, Arg extends SelectableOrExpression<T>>(this: T, arg: Arg, options?: AggregateOptions<T>): NullableJSONAggReturn<T, Arg>;
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
    jsonObjectAgg<T extends PickQuerySelectableResultRelationsWindows, Obj extends RecordSelectableOrExpression<T>>(this: T, arg: Obj, options?: AggregateOptions<T>): NullableJSONObjectReturn<T, Obj>;
    /**
     * See {@link jsonObjectAgg}
     */
    jsonbObjectAgg<T extends PickQuerySelectableResultRelationsWindows, Obj extends RecordSelectableOrExpression<T>>(this: T, arg: Obj, options?: AggregateOptions<T>): NullableJSONObjectReturn<T, Obj>;
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
    stringAgg<T extends PickQuerySelectableResultRelationsWindows>(this: T, arg: SelectableDataType<T, AggregateArgTypes['stringAgg']>, delimiter: string, options?: AggregateOptions<T>): NullableStringReturn<T>;
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
    xmlAgg<T extends PickQuerySelectableResultRelationsWindows>(this: T, arg: SelectableOrExpressionOfType<T, StringColumn>, options?: AggregateOptions<T>): NullableStringReturn<T>;
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
    rowNumber<T extends PickQuerySelectableResultRelationsWindows>(this: T, over?: Over<T>): NullableNumberReturn<T, 'int8'>;
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
    rank<T extends PickQuerySelectableResultRelationsWindows>(this: T, over?: Over<T>): NullableNumberReturn<T, 'int8'>;
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
    denseRank<T extends PickQuerySelectableResultRelationsWindows>(this: T, over?: Over<T>): NullableNumberReturn<T, 'int8'>;
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
    percentRank<T extends PickQuerySelectableResultRelationsWindows>(this: T, over?: Over<T>): NullableNumberReturn<T, 'float8'>;
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
    cumeDist<T extends PickQuerySelectableResultRelationsWindows>(this: T, over?: Over<T>): NullableNumberReturn<T, 'float8'>;
}
export {};
