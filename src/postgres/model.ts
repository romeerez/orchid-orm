import { PostgresAdapter } from './orm';
import { RelationThunks } from './relations';
import { t } from 'tak'
import { dataTypes, DataTypes } from './schema';
import { toSql } from './toSql';
import { AggregateOptions, aggregateSql } from './aggregate';

type QueryData = {
  select?: string[]
  selectRaw?: string[]
}

type Then<T> = (
  this: PostgresModel,
  resolve?: (value: T) => any,
  reject?: (error: any) => any,
) => Promise<T | never>

type ThenAll<T extends PostgresModel<any>> = Omit<T, 'then'> & { then: Then<T['result'][]> }

const thenAll: Then<any[]> = function (resolve, reject) {
  return this.adapter.query(this.toSql())
    .then(result => result.rows).then(resolve, reject)
}

type ThenOne<T extends PostgresModel<any>> = Omit<T, 'then'> & { then: Then<T['result']> }

const thenOne: Then<any> = function (resolve, reject) {
  return this.adapter.query(this.toSql())
    .then(result => result.rows[0]).then(resolve, reject)
}

type ThenRows<T extends PostgresModel<any>> = Omit<T, 'then'> & { then: Then<T['result'][keyof T['result']][]> }

const thenRows: Then<any[][]> = function (resolve, reject) {
  return this.adapter.arrays(this.toSql())
    .then(result => result.rows).then(resolve, reject)
}

type ThenValue<T extends PostgresModel<any>, V> = Omit<T, 'then'> & { then: Then<V> }

const thenValue: Then<any> = function (resolve, reject) {
  return this.adapter.arrays(this.toSql())
    .then(result => result.rows[0]?.[0]).then(resolve, reject)
}

type ThenVoid<T extends PostgresModel<any>> = Omit<T, 'then'> & { then: Then<void> }

const thenVoid: Then<void> = function (resolve, reject) {
  return this.adapter.query(this.toSql())
    .then(resolve as any, reject)
}

export class PostgresModel<Shape extends t.TakShape = t.TakShape, T = t.TakObject<Shape>['output']> {
  constructor(public adapter: PostgresAdapter) {
  }

  type!: T
  result!: T
  table!: string
  schema!: t.TakObject<Shape>
  query?: QueryData

  aggregateSql = aggregateSql

  then = thenAll

  all(): ThenAll<this> {
    return this.then === thenAll ? this : this.clone()._all()
  }

  _all(): ThenAll<this> {
    this.then = thenAll
    return this
  }

  take(): ThenOne<this> {
    return this.then === thenOne ? this as unknown as ThenOne<this> : this.clone()._take()
  }

  _take(): ThenOne<this> {
    this.then = thenOne
    return this as unknown as ThenOne<this>
  }

  rows(): ThenRows<this> {
    return this.then === thenRows ? this as unknown as ThenRows<this> : this.clone()._rows()
  }

  _rows(): ThenRows<this> {
    this.then = thenRows
    return this as unknown as ThenRows<this>
  }

  value<V>(): ThenValue<this, V> {
    return this.then === thenValue ? this as unknown as ThenValue<this, V> : this.clone()._value<V>()
  }

  _value<V>(): ThenValue<this, V> {
    this.then = thenValue
    return this as unknown as ThenValue<this, V>
  }

  exec(): ThenVoid<this> {
    return this.then === thenVoid as Then<unknown> ? this as unknown as ThenVoid<this> : this.clone()._exec()
  }

  _exec(): ThenVoid<this> {
    (this as unknown as ThenVoid<this>).then = thenVoid
    return this as unknown as ThenVoid<this>
  }

  toQuery(): this & { query: QueryData } {
    if (this.query) return this as this & { query: QueryData }
    const q = this.clone()
    q.query = {}
    return q as this & { query: QueryData }
  }

  clone(): this {
    const cloned = new (this.constructor as PostgresModelConstructor)(this.adapter)
    cloned.table = this.table
    cloned.schema = this.schema
    return cloned as this
  }

  toSql(): string {
    return toSql(this)
  }

  select(...columns: (keyof Shape)[]) {
    return this.clone()._select(...columns)
  }

  _select(...columns: (keyof Shape)[]) {
    const q = this.toQuery()
    if (!q.query.select) q.query.select = columns as string[]
    else q.query.select.push(...columns as string[])
    return q
  }

  selectRaw(...args: string[]) {
    return this.clone()._selectRaw(...args)
  }

  _selectRaw(...args: string[]) {
    const q = this.toQuery()
    if (!q.query.selectRaw) q.query.selectRaw = args
    else q.query.selectRaw.push(...args)
    return q
  }

  count(args?: string, options?: AggregateOptions) {
    return this.clone()._count(args, options)
  }

  _count(args = '*', options?: AggregateOptions) {
    return this._selectRaw(this.aggregateSql('count', args, options))._value()
  }

  avg(args: string, options?: AggregateOptions) {
    return this.clone()._avg(args, options)
  }

  _avg(args: string, options?: AggregateOptions) {
    return this._selectRaw(this.aggregateSql('avg', args, options))._value()
  }

  min(args: string, options?: AggregateOptions) {
    return this.clone()._min(args, options)
  }

  _min(args: string, options?: AggregateOptions) {
    return this._selectRaw(this.aggregateSql('min', args, options))._value()
  }

  max(args: string, options?: AggregateOptions) {
    return this.clone()._max(args, options)
  }

  _max(args: string, options?: AggregateOptions) {
    return this._selectRaw(this.aggregateSql('max', args, options))._value()
  }

  sum(args: string, options?: AggregateOptions) {
    return this.clone()._sum(args, options)
  }

  _sum(args: string, options?: AggregateOptions) {
    return this._selectRaw(this.aggregateSql('sum', args, options))._value()
  }
}

export const model = <Shape extends t.TakShape>({
                                                  table,
  schema,
}: {
  table: string
  schema(t: DataTypes): Shape,
}): { new (adapter: PostgresAdapter): PostgresModel<Shape> } => {
  const shape = schema(dataTypes)
  const schemaObject = t.object(shape)

  return class extends PostgresModel<Shape> {
    table = table
    schema = schemaObject
    columns = Object.keys(shape) as unknown as (keyof Shape)[]
  }
}

export type PostgresModelConstructor = {
  new (adapter: PostgresAdapter): PostgresModel<any>;

  relations?: RelationThunks;
}

export type PostgresModelConstructors = Record<string, PostgresModelConstructor>;
