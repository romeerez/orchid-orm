import { Query } from '../query';
import { ColumnType, IntegerColumn } from '../columns';
import { SelectAgg, WindowFunctionOptions } from './aggregate';
import { pushQueryValue } from '../queryDataUtils';
import { setParserToQuery } from 'orchid-core';

// select window function:
// - adds a window function select that handles window options
// - adds a parser if provided
const selectWindowFunction = <
  T extends Query,
  Func extends string,
  As extends string | undefined,
  Value extends ColumnType,
>(
  self: T,
  functionName: Func,
  options: WindowFunctionOptions<T, As>,
  parse?: (input: unknown) => Value['type'],
): SelectAgg<T, Func, As, Value> => {
  pushQueryValue(self, 'select', {
    function: functionName,
    options: {
      as: options.as,
      over: options,
    },
  });

  if (parse) {
    setParserToQuery(self.q, options.as || functionName, parse);
  }

  return self as unknown as SelectAgg<T, Func, As, Value>;
};

// parse window functions result into a number
const toInt = parseInt as (input: unknown) => number;

export class Window {
  /**
   * Selects the` row_number` window function.
   *
   * Returns the number of the current row within its partition, counting from 1.
   *
   * ```ts
   * // result is of type Array<{ id: number, rowNumber: number }>
   * const result = await db.table.select('id').selectRowNumber({
   *   as: 'rowNumber',
   *   partitionBy: 'someColumn',
   *   order: { createdAt: 'ASC' },
   * });
   * ```
   *
   * @param options
   */
  selectRowNumber<T extends Query, As extends string | undefined = undefined>(
    this: T,
    options: WindowFunctionOptions<T, As>,
  ): SelectAgg<T, 'row_number', As, IntegerColumn> {
    return this.clone()._selectRowNumber(options);
  }
  _selectRowNumber<T extends Query, As extends string | undefined = undefined>(
    this: T,
    options: WindowFunctionOptions<T, As>,
  ): SelectAgg<T, 'row_number', As, IntegerColumn> {
    return selectWindowFunction(this, 'row_number', options, toInt);
  }

  /**
   * Selects the` rank` window function.
   *
   * Returns the rank of the current row, with gaps; that is, the row_number of the first row in its peer group.
   *
   * ```ts
   * // result is of type Array<{ id: number, rank: number }>
   * const result = await db.table.select('id').selectRank({
   *   as: 'rank',
   *   partitionBy: 'someColumn',
   *   order: { createdAt: 'ASC' },
   * });
   * ```
   *
   * @param options - window function options
   */
  selectRank<T extends Query, As extends string | undefined = undefined>(
    this: T,
    options: WindowFunctionOptions<T, As>,
  ): SelectAgg<T, 'rank', As, IntegerColumn> {
    return this.clone()._selectRank(options);
  }
  _selectRank<T extends Query, As extends string | undefined = undefined>(
    this: T,
    options: WindowFunctionOptions<T, As>,
  ): SelectAgg<T, 'rank', As, IntegerColumn> {
    return selectWindowFunction(this, 'rank', options, toInt);
  }

  /**
   * Selects the` dense_rank` window function.
   *
   * Returns the rank of the current row, without gaps; this function effectively counts peer groups.
   *
   * ```ts
   * // result is of type Array<{ id: number, denseRank: number }>
   * const result = await db.table.select('id').selectDenseRank({
   *   as: 'denseRank',
   *   partitionBy: 'someColumn',
   *   order: { createdAt: 'ASC' },
   * });
   * ```
   *
   * @param options - window function options
   */
  selectDenseRank<T extends Query, As extends string | undefined = undefined>(
    this: T,
    options: WindowFunctionOptions<T, As>,
  ): SelectAgg<T, 'dense_rank', As, IntegerColumn> {
    return this.clone()._selectDenseRank(options);
  }
  _selectDenseRank<T extends Query, As extends string | undefined = undefined>(
    this: T,
    options: WindowFunctionOptions<T, As>,
  ): SelectAgg<T, 'dense_rank', As, IntegerColumn> {
    return selectWindowFunction(this, 'dense_rank', options, toInt);
  }

  /**
   * Selects the `percent_rank` window function.
   *
   * Returns the relative rank of the current row, that is (rank - 1) / (total partition rows - 1). The value thus ranges from 0 to 1 inclusive.
   *
   * ```ts
   * // result is of type Array<{ id: number, percentRank: number }>
   * const result = await db.table.select('id').selectPercentRank({
   *   as: 'percentRank',
   *   partitionBy: 'someColumn',
   *   order: { createdAt: 'ASC' },
   * });
   * ```
   *
   * @param options - window function options
   */
  selectPercentRank<T extends Query, As extends string | undefined = undefined>(
    this: T,
    options: WindowFunctionOptions<T, As>,
  ): SelectAgg<T, 'percent_rank', As, IntegerColumn> {
    return this.clone()._selectPercentRank(options);
  }
  _selectPercentRank<
    T extends Query,
    As extends string | undefined = undefined,
  >(
    this: T,
    options: WindowFunctionOptions<T, As>,
  ): SelectAgg<T, 'percent_rank', As, IntegerColumn> {
    return selectWindowFunction(this, 'percent_rank', options, toInt);
  }

  /**
   * Selects the `cume_dist` window function.
   *
   * Returns the cumulative distribution, that is (number of partition rows preceding or peers with current row) / (total partition rows). The value thus ranges from 1/N to 1.
   *
   * ```ts
   * // result is of type Array<{ id: number, cumeDist: number }>
   * const result = await db.table.select('id').selectCumeDist({
   *   as: 'cumeDist',
   *   partitionBy: 'someColumn',
   *   order: { createdAt: 'ASC' },
   * });
   * ```
   *
   * @param options - window function options
   */
  selectCumeDist<T extends Query, As extends string | undefined = undefined>(
    this: T,
    options: WindowFunctionOptions<T, As>,
  ): SelectAgg<T, 'cume_dist', As, IntegerColumn> {
    return this.clone()._selectCumeDist(options);
  }
  _selectCumeDist<T extends Query, As extends string | undefined = undefined>(
    this: T,
    options: WindowFunctionOptions<T, As>,
  ): SelectAgg<T, 'cume_dist', As, IntegerColumn> {
    return selectWindowFunction(this, 'cume_dist', options, toInt);
  }
}
