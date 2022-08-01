import {
  BooleanExpression,
  Expression,
  ExpressionOutput,
  NumberExpression,
  raw,
  StringExpression,
} from './common';
import { AddQuerySelect, Query, SetQueryReturnsValue } from './query';
import { AggregateArg, AggregateOptions } from './sql';
import { pushQueryValue } from './queryDataUtils';
import {
  BooleanColumn,
  ColumnType,
  ArrayColumn,
  NumberColumn,
  StringColumn,
} from './columnSchema';
import { CoalesceString } from './utils';

const allColumns = raw('*');

// 1 in the name means only methods which takes 1 argument are listed here
// only such one argument methods are available in .having method
export type Aggregate1ArgumentTypes<
  T extends Query = Query,
  C extends ColumnType = ColumnType,
> = {
  count: Expression<T, C>;
  avg: NumberExpression<T, C>;
  min: Expression<T, C>;
  max: Expression<T, C>;
  sum: NumberExpression<T, C>;
  arrayAgg: Expression<T, C>;
  bitAnd: NumberExpression<T, C>;
  bitOr: NumberExpression<T, C>;
  boolAnd: BooleanExpression<T, C>;
  boolOr: BooleanExpression<T, C>;
  every: BooleanExpression<T, C>;
  jsonAgg: Expression<T, C>;
  jsonbAgg: Expression<T, C>;
  xmlAgg: Expression<T, C>;
};

export const aggregate1FunctionNames = {
  count: 'count',
  avg: 'avg',
  min: 'min',
  max: 'max',
  sum: 'sum',
  arrayAgg: 'array_agg',
  bitAnd: 'bit_and',
  bitOr: 'bit_or',
  boolAnd: 'bool_and',
  boolOr: 'bool_or',
  every: 'every',
  jsonAgg: 'json_agg',
  jsonbAgg: 'jsonb_agg',
  xmlAgg: 'xmlagg',
} as const;

type SelectAgg<
  T extends Query,
  Func extends string,
  As extends string | undefined,
  Value extends ColumnType,
> = AddQuerySelect<T, Record<CoalesceString<As, Func>, Value>>;

type AT1<T extends Query> = Aggregate1ArgumentTypes<T>;

export class AggregateMethods {
  selectAgg<
    T extends Query,
    Func extends string,
    As extends string | undefined,
    Value extends ColumnType,
  >(
    this: T,
    functionName: Func,
    arg: AggregateArg<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, Func, As, Value> {
    return this.clone()._selectAgg(functionName, arg, options) as SelectAgg<
      T,
      Func,
      As,
      Value
    >;
  }

  _selectAgg<
    T extends Query,
    Func extends string,
    As extends string | undefined,
    Value extends ColumnType,
  >(
    this: T,
    functionName: Func,
    arg: AggregateArg<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, Func, As, Value> {
    return pushQueryValue(this, 'select', {
      function: functionName,
      arg,
      options,
    }) as unknown as SelectAgg<T, Func, As, Value>;
  }

  count<T extends Query>(
    this: T,
    arg?: AT1<T>['count'] | '*',
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    return this.clone()._count(arg, options);
  }

  _count<T extends Query>(
    this: T,
    arg: AT1<T>['count'] | '*' = '*',
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    const q = this._selectCount(arg, options) as unknown as T;
    return q._value<T, NumberColumn>();
  }

  selectCount<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: AT1<T>['count'] | '*',
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'count', As, NumberColumn> {
    return this.clone()._selectCount(arg, options);
  }

  _selectCount<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: AT1<T>['count'] | '*',
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'count', As, NumberColumn> {
    return this._selectAgg(
      aggregate1FunctionNames.count,
      arg === '*' ? allColumns : arg,
      options,
    );
  }

  avg<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['avg'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    return this.clone()._avg(arg, options);
  }

  _avg<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['avg'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    const q = this._selectAvg(arg, options) as unknown as T;
    return q._value<T, NumberColumn>();
  }

  selectAvg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'avg', As, NumberColumn> {
    return this.clone()._selectAvg(arg, options);
  }

  _selectAvg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'avg', As, NumberColumn> {
    return this._selectAgg(aggregate1FunctionNames.avg, arg, options);
  }

  min<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['min'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    return this.clone()._min(arg, options);
  }

  _min<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['min'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    const q = this._selectMin(arg, options) as unknown as T;
    return q._value<T, NumberColumn>();
  }

  selectMin<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'min', As, NumberColumn> {
    return this.clone()._selectMin(arg, options);
  }

  _selectMin<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'min', As, NumberColumn> {
    return this._selectAgg(aggregate1FunctionNames.min, arg, options);
  }

  max<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['max'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    return this.clone()._max(arg, options);
  }

  _max<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['max'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    const q = this._selectMax(arg, options) as unknown as T;
    return q._value<T, NumberColumn>();
  }

  selectMax<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'max', As, NumberColumn> {
    return this.clone()._selectMax(arg, options);
  }

  _selectMax<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'max', As, NumberColumn> {
    return this._selectAgg(aggregate1FunctionNames.max, arg, options);
  }

  sum<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['sum'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    return this.clone()._sum(arg, options);
  }

  _sum<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['sum'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    const q = this._selectSum(arg, options) as unknown as T;
    return q._value<T, NumberColumn>();
  }

  selectSum<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'sum', As, NumberColumn> {
    return this.clone()._selectSum(arg, options);
  }

  _selectSum<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'sum', As, NumberColumn> {
    return this._selectAgg(aggregate1FunctionNames.sum, arg, options);
  }

  arrayAgg<
    T extends Query,
    Expr extends Aggregate1ArgumentTypes<T>['arrayAgg'],
  >(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, ArrayColumn<ExpressionOutput<T, Expr>>> {
    return this.clone()._arrayAgg(arg, options);
  }

  _arrayAgg<
    T extends Query,
    Expr extends Aggregate1ArgumentTypes<T>['arrayAgg'],
  >(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, ArrayColumn<ExpressionOutput<T, Expr>>> {
    const q = this._selectArrayAgg(arg, options) as unknown as T;
    return q._value<T, ArrayColumn<ExpressionOutput<T, Expr>>>();
  }

  selectArrayAgg<
    T extends Query,
    Expr extends Aggregate1ArgumentTypes<T>['arrayAgg'],
    As extends string | undefined = undefined,
  >(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'array_agg', As, ArrayColumn<ExpressionOutput<T, Expr>>> {
    return this.clone()._selectArrayAgg(arg, options);
  }

  _selectArrayAgg<
    T extends Query,
    Expr extends Aggregate1ArgumentTypes<T>['arrayAgg'],
    As extends string | undefined = undefined,
  >(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'array_agg', As, ArrayColumn<ExpressionOutput<T, Expr>>> {
    return this._selectAgg<
      T,
      'array_agg',
      As,
      ArrayColumn<ExpressionOutput<T, Expr>>
    >(aggregate1FunctionNames.arrayAgg, arg, options);
  }

  bitAnd<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['bitAnd'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    return this.clone()._bitAnd(arg, options);
  }

  _bitAnd<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['bitAnd'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    const q = this._selectBitAnd(arg, options) as unknown as T;
    return q._value<T, NumberColumn>();
  }

  selectBitAnd<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bit_and', As, NumberColumn> {
    return this.clone()._selectBitAnd(arg, options);
  }

  _selectBitAnd<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bit_and', As, NumberColumn> {
    return this._selectAgg(aggregate1FunctionNames.bitAnd, arg, options);
  }

  bitOr<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['bitOr'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    return this.clone()._bitOr(arg, options);
  }

  _bitOr<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['bitOr'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> {
    const q = this._selectBitOr(arg, options) as unknown as T;
    return q._value<T, NumberColumn>();
  }

  selectBitOr<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bit_or', As, NumberColumn> {
    return this.clone()._selectBitOr(arg, options);
  }

  _selectBitOr<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bit_or', As, NumberColumn> {
    return this._selectAgg(aggregate1FunctionNames.bitOr, arg, options);
  }

  boolAnd<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['boolAnd'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, BooleanColumn> {
    return this.clone()._boolAnd(arg, options);
  }

  _boolAnd<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['boolAnd'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, BooleanColumn> {
    const q = this._selectBoolAnd(arg, options) as unknown as T;
    return q._value<T, BooleanColumn>();
  }

  selectBoolAnd<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bool_and', As, BooleanColumn> {
    return this.clone()._selectBoolAnd(arg, options);
  }

  _selectBoolAnd<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bool_and', As, BooleanColumn> {
    return this._selectAgg(aggregate1FunctionNames.boolAnd, arg, options);
  }

  boolOr<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['boolOr'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, BooleanColumn> {
    return this.clone()._boolOr(arg, options);
  }

  _boolOr<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['boolOr'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, BooleanColumn> {
    const q = this._selectBoolOr(arg, options) as unknown as T;
    return q._value<T, BooleanColumn>();
  }

  selectBoolOr<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bool_or', As, BooleanColumn> {
    return this.clone()._selectBoolOr(arg, options);
  }

  _selectBoolOr<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bool_or', As, BooleanColumn> {
    return this._selectAgg(aggregate1FunctionNames.boolOr, arg, options);
  }

  every<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['every'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, BooleanColumn> {
    return this.clone()._every(arg, options);
  }

  _every<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['every'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, BooleanColumn> {
    const q = this._selectEvery(arg, options) as unknown as T;
    return q._value<T, BooleanColumn>();
  }

  selectEvery<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'every', As, BooleanColumn> {
    return this.clone()._selectEvery(arg, options);
  }

  _selectEvery<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'every', As, BooleanColumn> {
    return this._selectAgg(aggregate1FunctionNames.every, arg, options);
  }

  jsonAgg<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['jsonAgg'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, StringColumn> {
    return this.clone()._jsonAgg(arg, options);
  }

  _jsonAgg<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['jsonAgg'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, StringColumn> {
    const q = this._selectJsonAgg(arg, options) as unknown as T;
    return q._value<T, StringColumn>();
  }

  selectJsonAgg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['jsonAgg'],
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'json_agg', As, StringColumn> {
    return this.clone()._selectJsonAgg(arg, options);
  }

  _selectJsonAgg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['jsonAgg'],
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'json_agg', As, StringColumn> {
    return this._selectAgg(aggregate1FunctionNames.jsonAgg, arg, options);
  }

  jsonbAgg<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['jsonbAgg'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, StringColumn> {
    return this.clone()._jsonbAgg(arg, options);
  }

  _jsonbAgg<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['jsonbAgg'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, StringColumn> {
    const q = this._selectJsonbAgg(arg, options) as unknown as T;
    return q._value<T, StringColumn>();
  }

  selectJsonbAgg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['jsonbAgg'],
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'jsonb_agg', As, StringColumn> {
    return this.clone()._selectJsonbAgg(arg, options);
  }

  _selectJsonbAgg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['jsonbAgg'],
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'jsonb_agg', As, StringColumn> {
    return this._selectAgg(aggregate1FunctionNames.jsonbAgg, arg, options);
  }

  xmlAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T>['xmlAgg']>(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, StringColumn> {
    return this.clone()._xmlAgg(arg, options);
  }

  _xmlAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T>['xmlAgg']>(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, StringColumn> {
    const q = this._selectXmlAgg(arg, options) as unknown as T;
    return q._value<T, StringColumn>();
  }

  selectXmlAgg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['xmlAgg'],
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'xmlagg', As, StringColumn> {
    return this.clone()._selectXmlAgg(arg, options);
  }

  _selectXmlAgg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['xmlAgg'],
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'xmlagg', As, StringColumn> {
    return this._selectAgg(aggregate1FunctionNames.xmlAgg, arg, options);
  }

  jsonObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>>(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, StringColumn> {
    return this.clone()._jsonObjectAgg(obj, options);
  }

  _jsonObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>>(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, StringColumn> {
    const q = this._selectJsonObjectAgg(obj, options) as unknown as T;
    return q._value<T, StringColumn>();
  }

  selectJsonObjectAgg<
    T extends Query,
    Obj extends Record<string, Expression<T>>,
    As extends string | undefined = undefined,
  >(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'json_object_agg', As, StringColumn> {
    return this.clone()._selectJsonObjectAgg(obj, options);
  }

  _selectJsonObjectAgg<
    T extends Query,
    Obj extends Record<string, Expression<T>>,
    As extends string | undefined = undefined,
  >(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'json_object_agg', As, StringColumn> {
    return this._selectAgg('json_object_agg', obj, options);
  }

  jsonbObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>>(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, StringColumn> {
    return this.clone()._jsonbObjectAgg(obj, options);
  }

  _jsonbObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>>(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, StringColumn> {
    const q = this._selectJsonbObjectAgg(obj, options) as unknown as T;
    return q._value<T, StringColumn>();
  }

  selectJsonbObjectAgg<
    T extends Query,
    Obj extends Record<string, Expression<T>>,
    As extends string | undefined = undefined,
  >(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'jsonb_object_agg', As, StringColumn> {
    return this.clone()._selectJsonbObjectAgg(obj, options);
  }

  _selectJsonbObjectAgg<
    T extends Query,
    Obj extends Record<string, Expression<T>>,
    As extends string | undefined = undefined,
  >(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'jsonb_object_agg', As, StringColumn> {
    return this._selectAgg('jsonb_object_agg', obj, options);
  }

  stringAgg<T extends Query>(
    this: T,
    arg: StringExpression<T>,
    delimiter: string,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, StringColumn> {
    return this.clone()._stringAgg(arg, delimiter, options);
  }

  _stringAgg<T extends Query>(
    this: T,
    arg: StringExpression<T>,
    delimiter: string,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, StringColumn> {
    const q = this._selectStringAgg(arg, delimiter, options) as unknown as T;
    return q._value<T, StringColumn>();
  }

  selectStringAgg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: StringExpression<T>,
    delimiter: string,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'string_agg', As, StringColumn> {
    return this.clone()._selectStringAgg(arg, delimiter, options);
  }

  _selectStringAgg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: StringExpression<T>,
    delimiter: string,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'string_agg', As, StringColumn> {
    return this._selectAgg('string_agg', [arg, delimiter], options);
  }
}
