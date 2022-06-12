import { PostgresAdapter } from './orm';
import { RelationThunks } from './relations';
import {
  ColumnsShape,
  dataTypes,
  DataTypes,
  GetPrimaryKeys,
  GetPrimaryTypes,
  TableSchema,
  tableSchema,
} from './schema';
import { toSql } from './toSql';
import { AggregateOptions, aggregateSql } from './aggregate';

type ConditionItem = ([key: string, op: string, value: any] | PostgresModel)

export type QueryData = {
  take?: true
  select?: string[]
  selectRaw?: string[]
  and?: ConditionItem[]
  or?: ConditionItem[][]
  as?: string
  from?: string
}

const removeFromQuery = (q: { query?: QueryData }, key: keyof QueryData) => {
  if (q.query) delete q.query[key]
}

const setQueryValue = <T extends Base, K extends keyof QueryData>(q: T, key: K, value: QueryData[K]): T => {
  if (!q.query) q.query = { [key]: value }
  else q.query[key] = value
  return q
}

const pushQueryArray = <T extends Base, K extends keyof QueryData>(q: T, key: K, value: QueryData[K]): T => {
  if (!q.query) q.query = { [key]: value }
  else if (!q.query[key]) q.query[key] = value
  else (q.query[key] as unknown[]).push(...(value as unknown[]))
  return q
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
    .then(() => resolve?.(), reject)
}

type Result<T extends Base> = T['result'] extends AllColumns ? T['type'] : T['result']

type MutateResult<
  T extends Base,
  R,
  S = T['result'] extends AllColumns ? R : T & R
> = Omit<T, 'result' | 'then'> & {
  result: S
  then: T['then'] extends Then<void>
    ? T['then']
    : T['then'] extends Then<Result<T>[]>
      ? Then<S[]>
      : T['then'] extends Then<Result<T>>
        ? Then<S>
        : T['then']
}

type Select<
  T extends Base,
  K extends keyof T['type']
> = MutateResult<T, Pick<T['type'], K>>

type Base = Omit<PostgresModel, 'result' | 'then'> & { result: any, then: any }

type Output<S extends ColumnsShape> = TableSchema<S>['output']

type AllColumns = { __all: true }

type WhereArg<S extends ColumnsShape> = Partial<Output<S>> | PostgresModel<S>

export class PostgresModel<S extends ColumnsShape = any> {
  constructor(public adapter: PostgresAdapter) {
  }

  type!: Output<S>
  result!: AllColumns
  table!: string
  schema!: TableSchema<S>
  primaryKeys!: GetPrimaryKeys<S>
  query?: QueryData

  aggregateSql = aggregateSql

  then = thenAll as Then<Output<S>[]>

  all<T extends Base>(this: T): ThenAll<T> {
    return this.then === thenAll ? this : this.clone()._all()
  }

  _all<T extends Base>(this: T): ThenAll<T> {
    this.then = thenAll
    removeFromQuery(this, 'take')
    return this
  }

  take<T extends Base>(this: T): ThenOne<T> {
    return this.then === thenOne ? this : this.clone()._take()
  }

  _take<T extends Base>(this: T): ThenOne<T> {
    this.then = thenOne
    setQueryValue(this, 'take', true)
    return this
  }

  rows<T extends Base>(this: T): ThenRows<T> {
    return this.then === thenRows ? this as unknown as ThenRows<T> : this.clone()._rows()
  }

  _rows<T extends Base>(this: T): ThenRows<T> {
    this.then = thenRows
    removeFromQuery(this, 'take')
    return this as unknown as ThenRows<T>
  }

  value<T extends Base, V>(this: T): ThenValue<T, V> {
    return this.then === thenValue ? this as unknown as ThenValue<T, V> : this.clone()._value<T, V>()
  }

  _value<T extends Base, V>(this: T): ThenValue<T, V> {
    this.then = thenValue
    removeFromQuery(this, 'take')
    return this as unknown as ThenValue<T, V>
  }

  exec<T extends Base>(this: T): ThenVoid<T> {
    return this.then === thenVoid ? this : this.clone()._exec()
  }

  _exec<T extends Base>(this: T): ThenVoid<T> {
    this.then = thenVoid
    removeFromQuery(this, 'take')
    return this
  }

  toQuery<T extends Base>(this: T): T & { query: QueryData } {
    if (this.query) return this as T & { query: QueryData }
    const q = this.clone()
    return q as T & { query: QueryData }
  }

  clone<T extends Base>(this: T): T {
    const cloned = new (this.constructor as PostgresModelConstructor)(this.adapter)
    cloned.table = this.table
    cloned.schema = this.schema
    cloned.then = this.then
    cloned.query = {}
    if (this.query) {
      for (const key in this.query) {
        const value = this.query[key as keyof QueryData]
        if (Array.isArray(value)) {
          (cloned.query as Record<string, unknown>)[key] = [...value]
        } else {
          (cloned.query as Record<string, unknown>)[key] = value
        }
      }
    }

    return cloned as T
  }

  toSql(): string {
    return toSql(this)
  }

  asType<T extends Base>(this: T): <S>() => MutateResult<T, S> {
    return <S>() => this as unknown as MutateResult<T, S>
  }

  select<T extends Base, K extends (keyof T['type'])[]>(this: T, ...columns: K): Select<T, K[number]> {
    return this.clone()._select(...columns)
  }

  _select<T extends Base, K extends (keyof T['type'])[]>(this: T, ...columns: K): Select<T, K[number]> {
    return pushQueryArray(this, 'select', columns as string[])
  }

  selectRaw<T extends Base>(this: T, ...args: string[]): T {
    return this.clone()._selectRaw(...args)
  }

  _selectRaw<T extends Base>(this: T, ...args: string[]): T {
    return pushQueryArray(this, 'selectRaw', args)
  }

  where<T extends Base>(this: T, ...args: WhereArg<S>[]): T {
    return this.and(...args)
  }

  _where<T extends Base>(this: T, ...args: WhereArg<S>[]): T {
    return this._and(...args)
  }

  and<T extends Base>(this: T, ...args: WhereArg<S>[]): T {
    return this.clone()._and(...args)
  }

  _and<T extends Base>(this: T, ...args: WhereArg<S>[]): T {
    const and: ConditionItem[] = []
    args.forEach(arg => {
      if (arg instanceof PostgresModel) {
        and.push(arg)
      } else {
        Object.entries(arg).forEach(([key, value]) =>
          and.push([key, value === null ? 'IS' : '=', value])
        )
      }
    })
    return pushQueryArray(this, 'and', and)
  }

  or<T extends Base>(this: T, ...args: WhereArg<S>[]): T {
    return this.clone()._or(...args)
  }

  _or<T extends Base>(this: T, ...args: WhereArg<S>[]): T {
    const or = args.map(arg => {
      const arr: ConditionItem[] = []
      if (arg instanceof PostgresModel) {
        arr.push(arg)
      } else {
        Object.entries(arg).forEach(([key, value]) =>
          arr.push([key, value === null ? 'IS' : '=', value])
        )
      }
      return arr
    })
    return pushQueryArray(this, 'or', or)
  }

  find<T extends Base>(this: T, ...args: GetPrimaryTypes<S>): ThenOne<T> {
    return (this.clone()._find as any)(...args as unknown[])
  }

  _find<T extends Base>(this: T, ...args: GetPrimaryTypes<S>): ThenOne<T> {
    const conditions: Record<string, unknown> = {}
    this.primaryKeys.forEach((key, i) => {
      conditions[key] = (args as unknown[])[i]
    })
    return this._where(conditions)._take()
  }

  findBy<T extends Base>(this: T, ...args: WhereArg<S>[]): ThenOne<T> {
    return this.clone()._findBy(...args)
  }

  _findBy<T extends Base>(this: T, ...args: WhereArg<S>[]): ThenOne<T> {
    return this._where(...args).take()
  }

  as<T extends Base>(this: T, as: string): T {
    return this.clone()._as(as)
  }

  _as<T extends Base>(this: T, as: string): T {
    return setQueryValue(this, 'as', as)
  }

  from<T extends Base>(this: T, from: string): T {
    return this.clone()._from(from)
  }

  _from<T extends Base>(this: T, from: string): T {
    return setQueryValue(this, 'from', from)
  }

  wrap<T extends Base, Q extends Base>(this: T, query: Q, as = 't'): Q {
    return this.clone()._wrap(query.clone(), as)
  }

  _wrap<T extends Base, Q extends Base>(this: T, query: Q, as = 't'): Q {
    return query._as(as)._from(`(${this.toSql()})`)
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

export const model = <S extends ColumnsShape>({
  table,
  schema,
}: {
  table: string
  schema(t: DataTypes): S,
}): { new (adapter: PostgresAdapter): PostgresModel<S> } => {
  const shape = schema(dataTypes)
  const schemaObject = tableSchema(shape)

  return class extends PostgresModel<S> {
    table = table
    schema = schemaObject
    primaryKeys = schemaObject.getPrimaryKeys()
  }
}

export type PostgresModelConstructor = {
  new (adapter: PostgresAdapter): PostgresModel;

  relations?: RelationThunks;
}

export type PostgresModelConstructors = Record<string, PostgresModelConstructor>;
