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

type ThenAll<T extends Base> = Omit<T, 'then'> & { then: Then<Result<T>[]> }

const thenAll: Then<any[]> = function (resolve, reject) {
  return this.adapter.query(this.toSql())
    .then(result => result.rows).then(resolve, reject)
}

type ThenOne<T extends Base> = Omit<T, 'then'> & { then: Then<Result<T>> }

const thenOne: Then<any> = function (resolve, reject) {
  return this.adapter.query(this.toSql())
    .then(result => result.rows[0]).then(resolve, reject)
}

type ThenRows<T extends Base> = Omit<T, 'then'> & { then: Then<Result<T>[keyof Result<T>][][]> }

const thenRows: Then<any[][]> = function (resolve, reject) {
  return this.adapter.arrays(this.toSql())
    .then(result => result.rows).then(resolve, reject)
}

type ThenValue<T extends Base, V> = Omit<T, 'then'> & { then: Then<V> }

const thenValue: Then<any> = function (resolve, reject) {
  return this.adapter.arrays(this.toSql())
    .then(result => result.rows[0]?.[0]).then(resolve, reject)
}

type ThenVoid<T extends Base> = Omit<T, 'then'> & { then: Then<void> }

const thenVoid: Then<void> = function (resolve, reject) {
  return this.adapter.query(this.toSql())
    .then(resolve as any, reject)
}

type Result<T extends Base> = T['result'] extends AllColumns ? T['type'] : T['result']

type MutateResult<
  T extends Base,
  R
> = Omit<T, 'result' | 'then'> & {
  result: R
  then: T['then'] extends Then<void>
    ? T['then']
    : T['then'] extends Then<Result<T>[]>
      ? Then<R[]>
      : T['then'] extends Then<Result<T>>
        ? Then<R>
        : T['then']
}

type Select<
  T extends Base,
  K extends keyof T['type']
> = MutateResult<
  T,
  T['result'] extends AllColumns
    ? Pick<T['type'], K>
    : T['result'] & Pick<T['type'], K>
>

type Base = Omit<PostgresModel, 'then'> & { then: any }

type AllColumns = { __all: true }

export class PostgresModel<S extends t.TakShape = any, O = t.TakObject<S>['output']> {
  constructor(public adapter: PostgresAdapter) {
  }

  type!: O
  result!: AllColumns
  table!: string
  schema!: t.TakObject<S>
  query?: QueryData

  aggregateSql = aggregateSql

  then = thenAll as Then<O[]>

  all<T extends Base>(this: T): ThenAll<T> {
    return this.then === thenAll ? this : this.clone()._all()
  }

  _all<T extends Base>(this: T): ThenAll<T> {
    this.then = thenAll
    return this
  }

  take<T extends Base>(this: T): ThenOne<T> {
    return this.then === thenOne ? this : this.clone()._take()
  }

  _take<T extends Base>(this: T): ThenOne<T> {
    this.then = thenOne
    return this
  }

  rows<T extends Base>(this: T): ThenRows<T> {
    return this.then === thenRows ? this as unknown as ThenRows<T> : this.clone()._rows()
  }

  _rows<T extends Base>(this: T): ThenRows<T> {
    this.then = thenRows
    return this as unknown as ThenRows<T>
  }

  value<T extends Base, V>(this: T): ThenValue<T, V> {
    return this.then === thenValue ? this as unknown as ThenValue<T, V> : this.clone()._value<T, V>()
  }

  _value<T extends Base, V>(this: T): ThenValue<T, V> {
    this.then = thenValue
    return this as unknown as ThenValue<T, V>
  }

  exec<T extends Base>(this: T): ThenVoid<T> {
    return this.then === thenVoid ? this : this.clone()._exec()
  }

  _exec<T extends Base>(this: T): ThenVoid<T> {
    this.then = thenVoid
    return this
  }

  toQuery<T extends Base>(this: T): T & { query: QueryData } {
    if (this.query) return this as T & { query: QueryData }
    const q = this.clone()
    q.query = {}
    return q as T & { query: QueryData }
  }

  clone<T extends Base>(this: T): T {
    const cloned = new (this.constructor as PostgresModelConstructor)(this.adapter)
    cloned.table = this.table
    cloned.schema = this.schema
    cloned.then = this.then
    return cloned as T
  }

  toSql(): string {
    return toSql(this)
  }

  select<T extends Base, K extends (keyof T['type'])[]>(this: T, ...columns: K): Select<T, K[number]> {
    return this.clone()._select(...columns)
  }

  _select<T extends Base, K extends (keyof T['type'])[]>(this: T, ...columns: K): Select<T, K[number]> {
    const q = this.toQuery()
    if (!q.query.select) q.query.select = columns as string[]
    else q.query.select.push(...columns as string[])
    return q as unknown as Select<T, K[number]>
  }

  selectRaw<T extends Base>(this: T, ...args: string[]): T {
    return this.clone()._selectRaw(...args)
  }

  _selectRaw<T extends Base>(this: T, ...args: string[]): T {
    const q = this.toQuery()
    if (!q.query.selectRaw) q.query.selectRaw = args
    else q.query.selectRaw.push(...args)
    return q
  }

  count<T extends Base>(this: T, args?: string, options?: AggregateOptions) {
    return this.clone()._count(args, options)
  }

  _count<T extends Base>(this: T, args = '*', options?: AggregateOptions) {
    return this._selectRaw(this.aggregateSql('count', args, options))._value<T, number>()
  }

  avg<T extends Base>(this: T, args: string, options?: AggregateOptions) {
    return this.clone()._avg(args, options)
  }

  _avg<T extends Base>(this: T, args: string, options?: AggregateOptions) {
    return this._selectRaw(this.aggregateSql('avg', args, options))._value<T, number>()
  }

  min<T extends Base>(this: T, args: string, options?: AggregateOptions) {
    return this.clone()._min(args, options)
  }

  _min<T extends Base>(this: T, args: string, options?: AggregateOptions) {
    return this._selectRaw(this.aggregateSql('min', args, options))._value<T, number>()
  }

  max<T extends Base>(this: T, args: string, options?: AggregateOptions) {
    return this.clone()._max(args, options)
  }

  _max<T extends Base>(this: T, args: string, options?: AggregateOptions) {
    return this._selectRaw(this.aggregateSql('max', args, options))._value<T, number>()
  }

  sum<T extends Base>(this: T, args: string, options?: AggregateOptions) {
    return this.clone()._sum(args, options)
  }

  _sum<T extends Base>(this: T, args: string, options?: AggregateOptions) {
    return this._selectRaw(this.aggregateSql('sum', args, options))._value<T, number>()
  }
}

export const model = <S extends t.TakShape>({
  table,
  schema,
}: {
  table: string
  schema(t: DataTypes): S,
}): { new (adapter: PostgresAdapter): PostgresModel<S> } => {
  const shape = schema(dataTypes)
  const schemaObject = t.object(shape)

  return class extends PostgresModel<S> {
    table = table
    schema = schemaObject
    columns = Object.keys(shape) as unknown as (keyof S)[]
  }
}

export type PostgresModelConstructor = {
  new (adapter: PostgresAdapter): PostgresModel;

  relations?: RelationThunks;
}

export type PostgresModelConstructors = Record<string, PostgresModelConstructor>;
