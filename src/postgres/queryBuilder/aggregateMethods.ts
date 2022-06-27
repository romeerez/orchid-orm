import { Query } from '../model';
import {
  BooleanExpression,
  Expression,
  ExpressionOutput,
  NumberExpression, raw,
  StringExpression,
} from './common';
import { AggregateArg, AggregateOptions } from './toSql';
import { AddQuerySelect, pushQueryValue, SetQueryReturnsValue } from './queryMethods';

const allColumns = raw('*')

// 1 in the name means only methods which takes 1 argument are listed here
// only such one argument methods are available in .having method
export type Aggregate1ArgumentTypes<T extends Query, R = unknown> = {
  count: Expression<T, R>
  avg: NumberExpression<T, R>
  min: Expression<T, R>
  max: Expression<T, R>
  sum: NumberExpression<T, R>
  arrayAgg: Expression<T, R>
  bitAnd: NumberExpression<T, R>
  bitOr: NumberExpression<T, R>
  boolAnd: BooleanExpression<T, R>
  boolOr: BooleanExpression<T, R>
  every: BooleanExpression<T, R>
  jsonAgg: Expression<T, R>
  jsonbAgg: Expression<T, R>
  xmlAgg: Expression<T, R>
}

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
} as const

type SelectAgg<T extends Query, Func extends string, As extends string | undefined, Value> = AddQuerySelect<T, Record<As extends undefined ? Func : As, Value>>

type AT1<T extends Query> = Aggregate1ArgumentTypes<T>

export class AggregateMethods {
  selectAgg<T extends Query, Func extends string, As extends string | undefined, Value>(this: T, functionName: Func, arg: AggregateArg<T>, options?: AggregateOptions<T, As>): SelectAgg<T, Func, As, Value> {
    return this.clone()._selectAgg(functionName, arg, options) as SelectAgg<T, Func, As, Value>
  }

  _selectAgg<T extends Query, Func extends string, As extends string | undefined, Value>(this: T, functionName: Func, arg: AggregateArg<T>, options?: AggregateOptions<T, As>): SelectAgg<T, Func, As, Value> {
    return pushQueryValue(this, 'select', { function: functionName, arg, options })
  }

  count<T extends Query>(this: T, arg?: AT1<T>['count'] | '*', options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    return this.clone()._count(arg, options)
  }

  _count<T extends Query>(this: T, arg: AT1<T>['count'] | '*' = '*', options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    const q = this._selectCount(arg, options)
    return (q as T)._value<T, number>()
  }

  selectCount<T extends Query, As extends string | undefined = undefined>(this: T, arg: AT1<T>['count'] | '*', options?: AggregateOptions<T, As>): SelectAgg<T, 'count', As, number> {
    return this.clone()._selectCount(arg, options)
  }

  _selectCount<T extends Query, As extends string | undefined = undefined>(this: T, arg: AT1<T>['count'] | '*', options?: AggregateOptions<T, As>): SelectAgg<T, 'count', As, number> {
    return this._selectAgg(aggregate1FunctionNames.count, arg === '*' ? allColumns : arg, options)
  }

  avg<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['avg'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    return this.clone()._avg(arg, options)
  }

  _avg<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['avg'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    const q = this._selectAvg(arg, options)
    return (q as T)._value<T, number>()
  }

  selectAvg<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'avg', As, number> {
    return this.clone()._selectAvg(arg, options)
  }

  _selectAvg<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'avg', As, number> {
    return this._selectAgg(aggregate1FunctionNames.avg, arg, options)
  }

  min<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['min'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    return this.clone()._min(arg, options)
  }

  _min<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['min'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    const q = this._selectMin(arg, options)
    return (q as T)._value<T, number>()
  }

  selectMin<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'min', As, number> {
    return this.clone()._selectMin(arg, options)
  }

  _selectMin<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'min', As, number> {
    return this._selectAgg(aggregate1FunctionNames.min, arg, options)
  }

  max<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['max'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    return this.clone()._max(arg, options)
  }

  _max<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['max'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    const q = this._selectMax(arg, options)
    return (q as T)._value<T, number>()
  }

  selectMax<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'max', As, number> {
    return this.clone()._selectMax(arg, options)
  }

  _selectMax<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'max', As, number> {
    return this._selectAgg(aggregate1FunctionNames.max, arg, options)
  }

  sum<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['sum'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    return this.clone()._sum(arg, options)
  }

  _sum<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['sum'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    const q = this._selectSum(arg, options)
    return (q as T)._value<T, number>()
  }

  selectSum<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'sum', As, number> {
    return this.clone()._selectSum(arg, options)
  }

  _selectSum<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'sum', As, number> {
    return this._selectAgg(aggregate1FunctionNames.sum, arg, options)
  }

  arrayAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T>['arrayAgg']>(this: T, arg: Expr, options?: AggregateOptions<T>): SetQueryReturnsValue<T, ExpressionOutput<T, Expr>[]> {
    return this.clone()._arrayAgg(arg, options)
  }

  _arrayAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T>['arrayAgg']>(this: T, arg: Expr, options?: AggregateOptions<T>): SetQueryReturnsValue<T, ExpressionOutput<T, Expr>[]> {
    const q = this._selectArrayAgg(arg, options)
    return (q as T)._value<T, ExpressionOutput<T, Expr>[]>()
  }

  selectArrayAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T>['arrayAgg'], As extends string | undefined = undefined>(this: T, arg: Expr, options?: AggregateOptions<T, As>): SelectAgg<T, 'array_agg', As, ExpressionOutput<T, Expr>[]> {
    return this.clone()._selectArrayAgg(arg, options)
  }

  _selectArrayAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T>['arrayAgg'], As extends string | undefined = undefined>(this: T, arg: Expr, options?: AggregateOptions<T, As>): SelectAgg<T, 'array_agg', As, ExpressionOutput<T, Expr>[]> {
    return this._selectAgg<T, 'array_agg', As, ExpressionOutput<T, Expr>[]>(aggregate1FunctionNames.arrayAgg, arg, options)
  }

  bitAnd<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['bitAnd'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    return this.clone()._bitAnd(arg, options)
  }

  _bitAnd<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['bitAnd'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    const q = this._selectBitAnd(arg, options)
    return (q as T)._value<T, number>()
  }

  selectBitAnd<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'bit_and', As, number> {
    return this.clone()._selectBitAnd(arg, options)
  }

  _selectBitAnd<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'bit_and', As, number> {
    return this._selectAgg(aggregate1FunctionNames.bitAnd, arg, options)
  }

  bitOr<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['bitOr'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    return this.clone()._bitOr(arg, options)
  }

  _bitOr<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['bitOr'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, number> {
    const q = this._selectBitOr(arg, options)
    return (q as T)._value<T, number>()
  }

  selectBitOr<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'bit_or', As, number> {
    return this.clone()._selectBitOr(arg, options)
  }

  _selectBitOr<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'bit_or', As, number> {
    return this._selectAgg(aggregate1FunctionNames.bitOr, arg, options)
  }

  boolAnd<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['boolAnd'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, boolean> {
    return this.clone()._boolAnd(arg, options)
  }

  _boolAnd<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['boolAnd'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, boolean> {
    const q = this._selectBoolAnd(arg, options)
    return (q as T)._value<T, boolean>()
  }

  selectBoolAnd<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'bool_and', As, boolean> {
    return this.clone()._selectBoolAnd(arg, options)
  }

  _selectBoolAnd<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'bool_and', As, boolean> {
    return this._selectAgg(aggregate1FunctionNames.boolAnd, arg, options)
  }

  boolOr<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['boolOr'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, boolean> {
    return this.clone()._boolOr(arg, options)
  }

  _boolOr<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['boolOr'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, boolean> {
    const q = this._selectBoolOr(arg, options)
    return (q as T)._value<T, boolean>()
  }

  selectBoolOr<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'bool_or', As, boolean> {
    return this.clone()._selectBoolOr(arg, options)
  }

  _selectBoolOr<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'bool_or', As, boolean> {
    return this._selectAgg(aggregate1FunctionNames.boolOr, arg, options)
  }

  every<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['every'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, boolean> {
    return this.clone()._every(arg, options)
  }

  _every<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['every'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, boolean> {
    const q = this._selectEvery(arg, options)
    return (q as T)._value<T, boolean>()
  }

  selectEvery<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'every', As, boolean> {
    return this.clone()._selectEvery(arg, options)
  }

  _selectEvery<T extends Query, As extends string | undefined = undefined>(this: T, arg: Expression<T>, options?: AggregateOptions<T, As>): SelectAgg<T, 'every', As, boolean> {
    return this._selectAgg(aggregate1FunctionNames.every, arg, options)
  }

  jsonAgg<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['jsonAgg'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, string> {
    return this.clone()._jsonAgg(arg, options)
  }

  _jsonAgg<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['jsonAgg'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, string> {
    const q = this._selectJsonAgg(arg, options)
    return (q as T)._value<T, string>()
  }

  selectJsonAgg<T extends Query, As extends string | undefined = undefined>(this: T, arg: Aggregate1ArgumentTypes<T>['jsonAgg'], options?: AggregateOptions<T, As>): SelectAgg<T, 'json_agg', As, string> {
    return this.clone()._selectJsonAgg(arg, options)
  }

  _selectJsonAgg<T extends Query, As extends string | undefined = undefined>(this: T, arg: Aggregate1ArgumentTypes<T>['jsonAgg'], options?: AggregateOptions<T, As>): SelectAgg<T, 'json_agg', As, string> {
    return this._selectAgg(aggregate1FunctionNames.jsonAgg, arg, options)
  }

  jsonbAgg<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['jsonbAgg'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, string> {
    return this.clone()._jsonbAgg(arg, options)
  }

  _jsonbAgg<T extends Query>(this: T, arg: Aggregate1ArgumentTypes<T>['jsonbAgg'], options?: AggregateOptions<T>): SetQueryReturnsValue<T, string> {
    const q = this._selectJsonbAgg(arg, options)
    return (q as T)._value<T, string>()
  }

  selectJsonbAgg<T extends Query, As extends string | undefined = undefined>(this: T, arg: Aggregate1ArgumentTypes<T>['jsonbAgg'], options?: AggregateOptions<T, As>): SelectAgg<T, 'jsonb_agg', As, string> {
    return this.clone()._selectJsonbAgg(arg, options)
  }

  _selectJsonbAgg<T extends Query, As extends string | undefined = undefined>(this: T, arg: Aggregate1ArgumentTypes<T>['jsonbAgg'], options?: AggregateOptions<T, As>): SelectAgg<T, 'jsonb_agg', As, string> {
    return this._selectAgg(aggregate1FunctionNames.jsonbAgg, arg, options)
  }

  xmlAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T>['xmlAgg']>(this: T, arg: Expr, options?: AggregateOptions<T>): SetQueryReturnsValue<T, string> {
    return this.clone()._xmlAgg(arg, options)
  }

  _xmlAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T>['xmlAgg']>(this: T, arg: Expr, options?: AggregateOptions<T>): SetQueryReturnsValue<T, string> {
    const q = this._selectXmlAgg(arg, options)
    return (q as T)._value<T, string>()
  }

  selectXmlAgg<T extends Query, As extends string | undefined = undefined>(this: T, arg: Aggregate1ArgumentTypes<T>['xmlAgg'], options?: AggregateOptions<T, As>): SelectAgg<T, 'xmlagg', As, string> {
    return this.clone()._selectXmlAgg(arg, options)
  }

  _selectXmlAgg<T extends Query, As extends string | undefined = undefined>(this: T, arg: Aggregate1ArgumentTypes<T>['xmlAgg'], options?: AggregateOptions<T, As>): SelectAgg<T, 'xmlagg', As, string> {
    return this._selectAgg(aggregate1FunctionNames.xmlAgg, arg, options)
  }

  jsonObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>>(this: T, obj: Obj, options?: AggregateOptions<T>): SetQueryReturnsValue<T, string> {
    return this.clone()._jsonObjectAgg(obj, options)
  }

  _jsonObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>>(this: T, obj: Obj, options?: AggregateOptions<T>): SetQueryReturnsValue<T, string> {
    const q = this._selectJsonObjectAgg(obj, options)
    return (q as T)._value<T, string>()
  }

  selectJsonObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>, As extends string | undefined = undefined>(this: T, obj: Obj, options?: AggregateOptions<T, As>): SelectAgg<T, 'json_object_agg', As, string> {
    return this.clone()._selectJsonObjectAgg(obj, options)
  }

  _selectJsonObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>, As extends string | undefined = undefined>(this: T, obj: Obj, options?: AggregateOptions<T, As>): SelectAgg<T, 'json_object_agg', As, string> {
    return this._selectAgg('json_object_agg', obj, options)
  }

  jsonbObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>>(this: T, obj: Obj, options?: AggregateOptions<T>): SetQueryReturnsValue<T, string> {
    return this.clone()._jsonbObjectAgg(obj, options)
  }

  _jsonbObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>>(this: T, obj: Obj, options?: AggregateOptions<T>): SetQueryReturnsValue<T, string> {
    const q = this._selectJsonbObjectAgg(obj, options)
    return (q as T)._value<T, string>()
  }

  selectJsonbObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>, As extends string | undefined = undefined>(this: T, obj: Obj, options?: AggregateOptions<T, As>): SelectAgg<T, 'jsonb_object_agg', As, string> {
    return this.clone()._selectJsonbObjectAgg(obj, options)
  }

  _selectJsonbObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>, As extends string | undefined = undefined>(this: T, obj: Obj, options?: AggregateOptions<T, As>): SelectAgg<T, 'jsonb_object_agg', As, string> {
    return this._selectAgg('jsonb_object_agg', obj, options)
  }

  stringAgg<T extends Query>(this: T, arg: StringExpression<T>, delimiter: string, options?: AggregateOptions<T>): SetQueryReturnsValue<T, string> {
    return this.clone()._stringAgg(arg, delimiter, options)
  }

  _stringAgg<T extends Query>(this: T, arg: StringExpression<T>, delimiter: string, options?: AggregateOptions<T>): SetQueryReturnsValue<T, string> {
    const q = this._selectStringAgg(arg, delimiter, options)
    return (q as T)._value<T, string>()
  }

  selectStringAgg<T extends Query, As extends string | undefined = undefined>(this: T, arg: StringExpression<T>, delimiter: string, options?: AggregateOptions<T, As>): SelectAgg<T, 'string_agg', As, string> {
    return this.clone()._selectStringAgg(arg, delimiter, options)
  }

  _selectStringAgg<T extends Query, As extends string | undefined = undefined>(this: T, arg: StringExpression<T>, delimiter: string, options?: AggregateOptions<T, As>): SelectAgg<T, 'string_agg', As, string> {
    return this._selectAgg('string_agg', [arg, delimiter], options)
  }
}
