import { Query } from '../model';
import {
  BooleanExpression,
  Expression,
  ExpressionOutput,
  NumberExpression, raw,
  StringExpression,
} from './common';
import { Aggregate, AggregateOptions } from './toSql';
import { MutateQuery, pushQueryValue } from './queryMethods';

const allColumns = raw('*')

const selectAggregate = <T extends Query>(self: T, functionName: string, arg: Aggregate<T>['arg'], options?: AggregateOptions) => {
  return pushQueryValue(self, 'select', { function: functionName, arg, options })
}

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

export const aggregate1FunctionNames: Record<keyof Aggregate1ArgumentTypes<Query, unknown>, string> = {
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
  count<T extends Query, R>(this: T, arg?: Aggregate1ArgumentTypes<T, R>['count'] | '*', options?: AggregateOptions) {
    return this.clone()._count(arg, options)
  }

  _count<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['count'] | '*' = '*', options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.count, arg === '*' ? allColumns : arg, options)._value<T, number>()
  }

  avg<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['avg'], options?: AggregateOptions) {
    return this.clone()._avg(arg, options)
  }

  _avg<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['avg'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.avg, arg, options)._value<T, number>()
  }

  min<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['min'], options?: AggregateOptions) {
    return this.clone()._min(arg, options)
  }

  _min<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['min'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.min, arg, options)._value<T, number>()
  }

  max<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['max'], options?: AggregateOptions) {
    return this.clone()._max(arg, options)
  }

  _max<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['max'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.max, arg, options)._value<T, number>()
  }

  sum<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['sum'], options?: AggregateOptions) {
    return this.clone()._sum(arg, options)
  }

  _sum<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['sum'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.sum, arg, options)._value<T, number>()
  }

  arrayAgg<T extends Query, R, Expr extends Aggregate1ArgumentTypes<T, R>['arrayAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return this.clone()._arrayAgg(arg, options)
  }

  _arrayAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T, any>['arrayAgg']>(this: T, arg: Expr, options?: AggregateOptions): MutateQuery<T, ExpressionOutput<T, Expr>[], 'value'> {
    return selectAggregate(this, aggregate1FunctionNames.arrayAgg, arg, options)
      ._value<T, ExpressionOutput<T, Expr>[]>()
  }

  bitAnd<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['bitAnd'], options?: AggregateOptions) {
    return this.clone()._bitAnd(arg, options)
  }

  _bitAnd<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['bitAnd'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.bitAnd, arg, options)._value<T, number>()
  }

  bitOr<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['bitOr'], options?: AggregateOptions) {
    return this.clone()._bitOr(arg, options)
  }

  _bitOr<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['bitOr'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.bitOr, arg, options)._value<T, number>()
  }

  boolAnd<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['boolAnd'], options?: AggregateOptions) {
    return this.clone()._boolAnd(arg, options)
  }

  _boolAnd<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['boolAnd'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.boolAnd, arg, options)._value<T, boolean>()
  }

  boolOr<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['boolOr'], options?: AggregateOptions) {
    return this.clone()._boolOr(arg, options)
  }

  _boolOr<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['boolOr'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.boolOr, arg, options)._value<T, boolean>()
  }

  every<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['every'], options?: AggregateOptions) {
    return this.clone()._every(arg, options)
  }

  _every<T extends Query, R>(this: T, arg: Aggregate1ArgumentTypes<T, R>['every'], options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.every, arg, options)._value<T, boolean>()
  }

  jsonAgg<T extends Query, R, Expr extends Aggregate1ArgumentTypes<T, R>['jsonAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return this.clone()._jsonAgg(arg, options)
  }

  _jsonAgg<T extends Query, R, Expr extends Aggregate1ArgumentTypes<T, R>['jsonAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.jsonAgg, arg, options)._value<T, string>()
  }

  jsonbAgg<T extends Query, R, Expr extends Aggregate1ArgumentTypes<T, R>['jsonbAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return this.clone()._jsonbAgg(arg, options)
  }

  _jsonbAgg<T extends Query, R, Expr extends Aggregate1ArgumentTypes<T, R>['jsonbAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.jsonbAgg, arg, options)._value<T, string>()
  }

  xmlAgg<T extends Query, R, Expr extends Aggregate1ArgumentTypes<T, R>['xmlAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return this.clone()._xmlAgg(arg, options)
  }

  _xmlAgg<T extends Query, R, Expr extends Aggregate1ArgumentTypes<T, R>['xmlAgg']>(this: T, arg: Expr, options?: AggregateOptions) {
    return selectAggregate(this, aggregate1FunctionNames.xmlAgg, arg, options)._value<T, string>()
  }

  jsonObjectAgg<T extends Query, R, Obj extends Record<string, Expression<T, R>>>(this: T, obj: Obj, options?: AggregateOptions) {
    return this.clone()._jsonObjectAgg(obj, options)
  }

  _jsonObjectAgg<T extends Query, R, Obj extends Record<string, Expression<T, R>>>(this: T, obj: Obj, options?: AggregateOptions) {
    return selectAggregate(this, 'json_object_agg', { __keyValues: obj }, options)._value<T, string>()
  }

  jsonbObjectAgg<T extends Query, R, Obj extends Record<string, Expression<T, R>>>(this: T, obj: Obj, options?: AggregateOptions) {
    return this.clone()._jsonbObjectAgg(obj, options)
  }

  _jsonbObjectAgg<T extends Query, R, Obj extends Record<string, Expression<T, R>>>(this: T, obj: Obj, options?: AggregateOptions) {
    return selectAggregate(this, 'jsonb_object_agg', { __keyValues: obj }, options)._value<T, string>()
  }

  stringAgg<T extends Query, R>(this: T, arg: StringExpression<T, R>, delimiter: string, options?: AggregateOptions) {
    return this.clone()._stringAgg(arg, delimiter, options)
  }

  _stringAgg<T extends Query, R>(this: T, arg: StringExpression<T, R>, delimiter: string, options?: AggregateOptions) {
    return selectAggregate(this, 'string_agg', { __withDelimiter: [arg, delimiter] }, options)._value<T, string>()
  }
}
