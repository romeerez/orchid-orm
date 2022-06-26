import { Base } from '../model';
import {
  BooleanExpression,
  Expression,
  ExpressionOutput,
  NumberExpression,
  StringExpression,
} from './common';
import { Aggregate, AggregateOptions } from './toSql';
import { pushQueryValue } from './queryMethods';

const allColumns = { raw: '*' }

const selectAggregate = <T extends Base>(self: T, functionName: string, arg: Aggregate<T>['arg'], options?: AggregateOptions) => {
  return pushQueryValue(self, 'select', { function: functionName, arg, options })
}

// 1 in the name means only methods which takes 1 argument are listed here
// only such one argument methods are available in .having method
export type Aggregate1ArgumentTypes<T extends Base> = {
  count: Expression<T>
  avg: NumberExpression<T>
  min: Expression<T>
  max: Expression<T>
  sum: NumberExpression<T>
  arrayAgg: Expression<T>
  bitAnd: NumberExpression<T>
  bitOr: NumberExpression<T>
  boolAnd: BooleanExpression<T>
  boolOr: BooleanExpression<T>
  every: BooleanExpression<T>
  jsonAgg: Expression<T>
  jsonbAgg: Expression<T>
  xmlAgg: Expression<T>
}

export const aggregate1FunctionNames: Record<keyof Aggregate1ArgumentTypes<Base>, string> = {
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
}

export class AggregateMethods {
  count<T extends Base>(this: T, arg?: Aggregate1ArgumentTypes<T>['count'] | '*', options?: AggregateOptions) {
    return this.clone()._count(arg, options)
  }

  _count<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['count'] | '*' = '*', options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.count, arg === '*' ? allColumns : arg, options)._value<T, number>()
  }

  avg<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['avg'], options?: AggregateOptions) {
    return this.clone()._avg(arg, options)
  }

  _avg<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['avg'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.avg, arg, options)._value<T, number>()
  }

  min<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['min'], options?: AggregateOptions) {
    return this.clone()._min(arg, options)
  }

  _min<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['min'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.min, arg, options)._value<T, number>()
  }

  max<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['max'], options?: AggregateOptions) {
    return this.clone()._max(arg, options)
  }

  _max<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['max'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.max, arg, options)._value<T, number>()
  }

  sum<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['sum'], options?: AggregateOptions) {
    return this.clone()._sum(arg, options)
  }

  _sum<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['sum'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.sum, arg, options)._value<T, number>()
  }

  arrayAgg<T extends Base, Expr extends Aggregate1ArgumentTypes<T>['arrayAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return this.clone()._arrayAgg(arg, options)
  }

  _arrayAgg<T extends Base, Expr extends Aggregate1ArgumentTypes<T>['arrayAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.arrayAgg, arg, options)._value<T, ExpressionOutput<T, Expr>[]>()
  }

  bitAnd<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['bitAnd'], options?: AggregateOptions) {
    return this.clone()._bitAnd(arg, options)
  }

  _bitAnd<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['bitAnd'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.bitAnd, arg, options)._value<T, number>()
  }

  bitOr<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['bitOr'], options?: AggregateOptions) {
    return this.clone()._bitOr(arg, options)
  }

  _bitOr<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['bitOr'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.bitOr, arg, options)._value<T, number>()
  }

  boolAnd<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['boolAnd'], options?: AggregateOptions) {
    return this.clone()._boolAnd(arg, options)
  }

  _boolAnd<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['boolAnd'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.boolAnd, arg, options)._value<T, boolean>()
  }

  boolOr<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['boolOr'], options?: AggregateOptions) {
    return this.clone()._boolOr(arg, options)
  }

  _boolOr<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['boolOr'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.boolOr, arg, options)._value<T, boolean>()
  }

  every<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['every'], options?: AggregateOptions) {
    return this.clone()._every(arg, options)
  }

  _every<T extends Base>(this: T, arg: Aggregate1ArgumentTypes<T>['every'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.every, arg, options)._value<T, boolean>()
  }

  jsonAgg<T extends Base, Expr extends Aggregate1ArgumentTypes<T>['jsonAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return this.clone()._jsonAgg(arg, options)
  }

  _jsonAgg<T extends Base, Expr extends Aggregate1ArgumentTypes<T>['jsonAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.jsonAgg, arg, options)._value<T, string>()
  }

  jsonbAgg<T extends Base, Expr extends Aggregate1ArgumentTypes<T>['jsonbAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return this.clone()._jsonbAgg(arg, options)
  }

  _jsonbAgg<T extends Base, Expr extends Aggregate1ArgumentTypes<T>['jsonbAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.jsonbAgg, arg, options)._value<T, string>()
  }

  xmlAgg<T extends Base, Expr extends Aggregate1ArgumentTypes<T>['xmlAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return this.clone()._xmlAgg(arg, options)
  }

  _xmlAgg<T extends Base, Expr extends Aggregate1ArgumentTypes<T>['xmlAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.xmlAgg, arg, options)._value<T, string>()
  }

  jsonObjectAgg<T extends Base, Obj extends Record<string, Expression<T>>>(this: T, obj: Obj, options?: AggregateOptions) {
    return this.clone()._jsonObjectAgg(obj, options)
  }

  _jsonObjectAgg<T extends Base, Obj extends Record<string, Expression<T>>>(this: T, obj: Obj, options?: AggregateOptions) {
    return selectAggregate(this, 'json_object_agg', { __keyValues: obj }, options)._value<T, string>()
  }

  jsonbObjectAgg<T extends Base, Obj extends Record<string, Expression<T>>>(this: T, obj: Obj, options?: AggregateOptions) {
    return this.clone()._jsonbObjectAgg(obj, options)
  }

  _jsonbObjectAgg<T extends Base, Obj extends Record<string, Expression<T>>>(this: T, obj: Obj, options?: AggregateOptions) {
    return selectAggregate(this, 'jsonb_object_agg', { __keyValues: obj }, options)._value<T, string>()
  }

  stringAgg<T extends Base>(this: T, arg: StringExpression<T>, delimiter: string, options?: AggregateOptions) {
    return this.clone()._stringAgg(arg, delimiter, options)
  }

  _stringAgg<T extends Base>(this: T, arg: StringExpression<T>, delimiter: string, options?: AggregateOptions) {
    return selectAggregate(this, 'string_agg', { __withDelimiter: [arg, delimiter] }, options)._value<T, string>()
  }
}
