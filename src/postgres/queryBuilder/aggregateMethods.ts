import { Base } from '../model';
import { Expression, ExpressionOutput } from './common';
import { Aggregate, AggregateOptions } from './toSql';
import { pushQueryValue } from './queryMethods';

const allColumns = { raw: '*' }

const selectAggregate = <T extends Base>(self: T, functionName: string, arg: Aggregate<T>['arg'], options?: AggregateOptions) => {
  return pushQueryValue(self, 'select', { function: functionName, arg, options })
}

export class AggregateMethods {
  count<T extends Base>(this: T, arg?: Expression<T> | '*', options?: AggregateOptions) {
    return this.clone()._count(arg, options)
  }

  _count<T extends Base>(this: T, arg: Expression<T> | '*' = '*', options?: AggregateOptions) {
    return selectAggregate(this, 'count', arg === '*' ? allColumns : arg, options)._value<T, number>()
  }

  avg<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return this.clone()._avg(arg, options)
  }

  _avg<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return selectAggregate(this, 'avg', arg, options)._value<T, number>()
  }

  min<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return this.clone()._min(arg, options)
  }

  _min<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return selectAggregate(this, 'min', arg, options)._value<T, number>()
  }

  max<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return this.clone()._max(arg, options)
  }

  _max<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return selectAggregate(this, 'max', arg, options)._value<T, number>()
  }

  sum<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return this.clone()._sum(arg, options)
  }

  _sum<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return selectAggregate(this, 'sum', arg, options)._value<T, number>()
  }

  arrayAgg<T extends Base, Expr extends Expression<T>>(this: T, arg: Expr, options?: AggregateOptions) {
    return this.clone()._arrayAgg(arg, options)
  }

  _arrayAgg<T extends Base, Expr extends Expression<T>>(this: T, arg: Expr, options?: AggregateOptions) {
    return selectAggregate(this, 'array_agg', arg, options)._value<T, ExpressionOutput<T, Expr>[]>()
  }

  bitAnd<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return this.clone()._bitAnd(arg, options)
  }

  _bitAnd<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return selectAggregate(this, 'bit_and', arg, options)._value<T, number>()
  }

  bitOr<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return this.clone()._bitOr(arg, options)
  }

  _bitOr<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return selectAggregate(this, 'bit_or', arg, options)._value<T, number>()
  }

  boolAnd<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return this.clone()._boolAnd(arg, options)
  }

  _boolAnd<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return selectAggregate(this, 'bool_and', arg, options)._value<T, boolean>()
  }

  boolOr<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return this.clone()._boolOr(arg, options)
  }

  _boolOr<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return selectAggregate(this, 'bool_or', arg, options)._value<T, boolean>()
  }

  every<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return this.clone()._every(arg, options)
  }

  _every<T extends Base>(this: T, arg: Expression<T>, options?: AggregateOptions) {
    return selectAggregate(this, 'every', arg, options)._value<T, boolean>()
  }

  jsonAgg<T extends Base, Expr extends Expression<T>>(this: T, arg: Expr, options?: AggregateOptions) {
    return this.clone()._jsonAgg(arg, options)
  }

  _jsonAgg<T extends Base, Expr extends Expression<T>>(this: T, arg: Expr, options?: AggregateOptions) {
    return selectAggregate(this, 'json_agg', arg, options)._value<T, string>()
  }

  jsonbAgg<T extends Base, Expr extends Expression<T>>(this: T, arg: Expr, options?: AggregateOptions) {
    return this.clone()._jsonbAgg(arg, options)
  }

  _jsonbAgg<T extends Base, Expr extends Expression<T>>(this: T, arg: Expr, options?: AggregateOptions) {
    return selectAggregate(this, 'jsonb_agg', arg, options)._value<T, string>()
  }

  xmlAgg<T extends Base, Expr extends Expression<T>>(this: T, arg: Expr, options?: AggregateOptions) {
    return this.clone()._xmlAgg(arg, options)
  }

  _xmlAgg<T extends Base, Expr extends Expression<T>>(this: T, arg: Expr, options?: AggregateOptions) {
    return selectAggregate(this, 'xmlagg', arg, options)._value<T, string>()
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

  stringAgg<T extends Base>(this: T, arg: Expression<T>, delimiter: string, options?: AggregateOptions) {
    return this.clone()._stringAgg(arg, delimiter, options)
  }

  _stringAgg<T extends Base>(this: T, arg: Expression<T>, delimiter: string, options?: AggregateOptions) {
    return selectAggregate(this, 'string_agg', { __withDelimiter: [arg, delimiter] }, options)._value<T, string>()
  }
}
