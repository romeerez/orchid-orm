import { Query } from '../query';
import { ColumnType, IntegerColumn } from '../columns';
import { SelectAgg, WindowFunctionOptions } from './aggregate';
import { pushQueryValue } from '../queryDataUtils';
import { addParserToQuery } from './select';

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
    addParserToQuery(self.query, options.as || functionName, parse);
  }

  return self as unknown as SelectAgg<T, Func, As, Value>;
};

const toInt = (input: unknown) => parseInt(input as string);

export class Window {
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
