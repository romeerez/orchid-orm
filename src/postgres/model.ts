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

type ConditionItem =
  | [key: string, op: string, value: any]
  | [key: string, op: (key: string, value: unknown) => string, value: any]
  | PostgresModel

export type QueryData = {
  take?: true
  select?: (string | Record<string, string | Base>)[]
  selectRaw?: string[]
  distinct?: string[]
  distinctRaw?: string[]
  and?: ConditionItem[]
  or?: ConditionItem[][]
  as?: string
  from?: string
  group?: string[]
  groupRaw?: string[]
}

type QueryDataArrays = {
  [K in keyof QueryData]: QueryData[K] extends Array<any> ? QueryData[K] : never
}

const removeFromQuery = (q: { query?: QueryData }, key: keyof QueryData) => {
  if (q.query) delete q.query[key]
}

const setQueryValue = <T extends Base, K extends keyof QueryData>(self: T, key: K, value: QueryData[K]): T => {
  const q = self.toQuery()
  q.query[key] = value
  return q
}

const pushQueryArray = <T extends Base, K extends keyof QueryData>(self: T, key: K, value: QueryData[K]): T => {
  const q = self.toQuery()
  if (!q.query[key]) q.query[key] = value
  else (q.query[key] as unknown[]).push(...(value as unknown[]))
  return q
}

const pushQueryValue = <T extends Base, K extends keyof QueryDataArrays>(self: T, key: K, value: QueryDataArrays[K][number]): T => {
  const q = self.toQuery()
  if (!q.query[key]) q.query[key] = [value] as QueryData[K]
  else (q.query[key] as unknown[]).push(value)
  return q
}

type ReturnType = 'all' | 'one' | 'rows' | 'value' | 'void'

type Query<
  T extends Base,
  R extends unknown = T['result'],
  RT extends ReturnType = T['returnType'],
  Res = Result<Omit<T, 'result'> & { result: R }>
> = Omit<T, 'result' | 'then'> & {
  result: Res
  then: RT extends 'all'
    ? Then<Res[]>
    : RT extends 'one' | 'value'
      ? Then<Res>
      : RT extends 'rows'
      ? Then<Res[keyof Res]>
      : RT extends 'void'
        ? Then<void>
        : never
}

type Result<T extends Base> = T['result'] extends AllColumns ? T['type'] : T['result']

type QueryReturns<T extends Base, R extends ReturnType> =
  Query<T, T['result'], R>

type Then<T> = (
  this: PostgresModel,
  resolve?: (value: T) => any,
  reject?: (error: any) => any,
) => Promise<T | never>

const thenAll: Then<any[]> = function (resolve, reject) {
  return this.adapter.query(this.toSql())
    .then(result => result.rows).then(resolve, reject)
}

const thenOne: Then<any> = function (resolve, reject) {
  return this.adapter.query(this.toSql())
    .then(result => result.rows[0]).then(resolve, reject)
}

const thenRows: Then<any[][]> = function (resolve, reject) {
  return this.adapter.arrays(this.toSql())
    .then(result => result.rows).then(resolve, reject)
}

const thenValue: Then<any> = function (resolve, reject) {
  return this.adapter.arrays(this.toSql())
    .then(result => result.rows[0]?.[0]).then(resolve, reject)
}

const thenVoid: Then<void> = function (resolve, reject) {
  return this.adapter.query(this.toSql())
    .then(() => resolve?.(), reject)
}

type Base = Omit<PostgresModel, 'result' | 'then'> & { result: any, then: any }
type SubQuery = Base

type Output<S extends ColumnsShape> = TableSchema<S>['output']

type AllColumns = { __all: true }

type WhereArg<S extends ColumnsShape, Result = Output<S>> =
  | Partial<Result>
  | { [K in keyof S]?: { [O in keyof S[K]['operators']]?: S[K]['operators'][O]['type'] } }
  | SubQuery

const pushWhereArg = <S extends ColumnsShape, Result = Output<S>>(self: Base, arr: ConditionItem[], arg: WhereArg<S, Result>) => {
  if (arg instanceof PostgresModel) {
    arr.push(arg)
  } else {
    Object.entries(arg).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null && value !== undefined) {
        for (const op in value) {
          const column = self.schema.shape[key]
          if (!column) {
            // TODO: custom error classes
            throw new Error(`Unknown operator ${op} provided to condition`)
          }

          const operator = column.operators[op]
          if (!operator) {
            // TODO: custom error classes
            throw new Error(`Unknown operator ${op} provided to condition`)
          }

          arr.push([key, operator, value[op]])
        }
        return
      }

      arr.push([key, value === null ? 'IS' : '=', value])
    })
  }
}

export class PostgresModel<S extends ColumnsShape = any, Table extends string = any> {
  constructor(public adapter: PostgresAdapter) {
  }

  type!: Output<S>
  result!: AllColumns
  table!: Table
  schema!: TableSchema<S>
  primaryKeys!: GetPrimaryKeys<S>
  query?: QueryData
  returnType!: 'all'

  aggregateSql = aggregateSql

  then = thenAll as Then<Output<S>[]>

  all<T extends Base>(this: T): QueryReturns<T, 'all'> {
    return this.then === thenAll ? this : this.clone()._all()
  }

  _all<T extends Base>(this: T): QueryReturns<T, 'all'> {
    this.then = thenAll
    removeFromQuery(this, 'take')
    return this
  }

  take<T extends Base>(this: T): QueryReturns<T, 'one'> {
    return this.then === thenOne ? this : this.clone()._take()
  }

  _take<T extends Base>(this: T): QueryReturns<T, 'one'> {
    this.then = thenOne
    setQueryValue(this, 'take', true)
    return this
  }

  rows<T extends Base>(this: T): QueryReturns<T, 'rows'> {
    return this.then === thenRows ? this as unknown as QueryReturns<T, 'rows'> : this.clone()._rows()
  }

  _rows<T extends Base>(this: T): QueryReturns<T, 'rows'> {
    this.then = thenRows
    removeFromQuery(this, 'take')
    return this as unknown as QueryReturns<T, 'rows'>
  }

  value<T extends Base, V>(this: T): Query<T, V, 'value'> {
    return this.then === thenValue ? this as unknown as Query<T, V, 'value'> : this.clone()._value<T, V>()
  }

  _value<T extends Base, V>(this: T): Query<T, V, 'value'> {
    this.then = thenValue
    removeFromQuery(this, 'take')
    return this as unknown as Query<T, V, 'value'>
  }

  exec<T extends Base>(this: T): QueryReturns<T, 'void'> {
    return this.then === thenVoid ? this : this.clone()._exec()
  }

  _exec<T extends Base>(this: T): QueryReturns<T, 'void'> {
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

  asType<T extends Base>(this: T): <S>() => Query<T, S> {
    return <S>() => this as unknown as Query<T, S>
  }

  select<T extends Base, K extends (keyof T['type'])[]>(this: T, ...columns: K): Query<T, Pick<T['type'], K[number]>> {
    return this.clone()._select(...columns)
  }

  _select<T extends Base, K extends (keyof T['type'])[]>(this: T, ...columns: K): Query<T, Pick<T['type'], K[number]>> {
    return pushQueryArray(this, 'select', columns as string[])
  }

  selectAs<T extends Base, S extends Record<string, keyof T['type']>>(this: T, select: S): Query<T, { [K in keyof S]: T['type'][S[K]] }> {
    return this.clone()._selectAs(select)
  }

  _selectAs<T extends Base, S extends Record<string, keyof T['type']>>(this: T, select: S): Query<T, { [K in keyof S]: T['type'][S[K]] }> {
    return pushQueryValue(this, 'select', select)
  }

  selectSubQuery<T extends Base, S extends Record<string, Base>>(this: T, subQueries: S): Query<T, { [K in keyof S]: Result<S[K]> }> {
    return this.clone()._selectSubQuery(subQueries)
  }

  _selectSubQuery<T extends Base, S extends Record<string, Base>>(this: T, subQueries: S): Query<T, { [K in keyof S]: Result<S[K]> }> {
    return pushQueryValue(this, 'select', subQueries)
  }

  selectRaw<T extends Base>(this: T, ...args: string[]): T {
    return this.clone()._selectRaw(...args)
  }

  _selectRaw<T extends Base>(this: T, ...args: string[]): T {
    return pushQueryArray(this, 'selectRaw', args)
  }

  distinct<T extends Base>(this: T, ...columns: (keyof T['type'])[]): T {
    return this.clone()._distinct(...columns)
  }

  _distinct<T extends Base>(this: T, ...columns: (keyof T['type'])[]): T {
    return pushQueryArray(this, 'distinct', columns as string[])
  }

  distinctRaw<T extends Base>(this: T, ...args: string[]): T {
    return this.clone()._distinctRaw(...args)
  }

  _distinctRaw<T extends Base>(this: T, ...args: string[]): T {
    return pushQueryArray(this, 'distinctRaw', args)
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
    args.forEach(arg => pushWhereArg(this, and, arg))
    return pushQueryArray(this, 'and', and)
  }

  or<T extends Base>(this: T, ...args: WhereArg<S>[]): T {
    return this.clone()._or(...args)
  }

  _or<T extends Base>(this: T, ...args: WhereArg<S>[]): T {
    const or = args.map(arg => {
      const arr: ConditionItem[] = []
      pushWhereArg(this, arr, arg)
      return arr
    })
    return pushQueryArray(this, 'or', or)
  }

  find<T extends Base>(this: T, ...args: GetPrimaryTypes<S>): QueryReturns<T, 'one'> {
    return (this.clone()._find as any)(...args as unknown[])
  }

  _find<T extends Base>(this: T, ...args: GetPrimaryTypes<S>): QueryReturns<T, 'one'> {
    const conditions: Record<string, unknown> = {}
    this.primaryKeys.forEach((key, i) => {
      conditions[key] = (args as unknown[])[i]
    })
    return this._where(conditions)._take()
  }

  findBy<T extends Base>(this: T, ...args: WhereArg<S>[]): QueryReturns<T, 'one'> {
    return this.clone()._findBy(...args)
  }

  _findBy<T extends Base>(this: T, ...args: WhereArg<S>[]): QueryReturns<T, 'one'> {
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

  group<T extends Base>(this: T, ...columns: (keyof T['type'])[]): T {
    return this.clone()._group(...columns)
  }

  _group<T extends Base>(this: T, ...columns: (keyof T['type'])[]): T {
    return pushQueryArray(this, 'group', columns as string[])
  }

  groupRaw<T extends Base>(this: T, ...sql: string[]): T {
    return this.clone()._groupRaw(...sql)
  }

  _groupRaw<T extends Base>(this: T, ...sql: string[]): T {
    return pushQueryArray(this, 'groupRaw', sql)
  }

  wrap<T extends Base, Q extends Base>(this: T, query: Q, as = 't'): Q {
    return this.clone()._wrap(query.clone(), as)
  }

  _wrap<T extends Base, Q extends Base>(this: T, query: Q, as = 't'): Q {
    return query._as(as)._from(`(${this.toSql()})`)
  }

  json<T extends Base>(this: T): Query<T, string, 'value'> {
    return this.clone()._json()
  }

  _json<T extends Base>(this: T): Query<T, string, 'value'> {
    return this._wrap(this.selectRaw(
      this.query?.take
        ? `COALESCE(row_to_json("t".*), '{}') AS json`
        : `COALESCE(json_agg(row_to_json("t".*)), '[]') AS json`
    ))._value()
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

export const model = <S extends ColumnsShape, Table extends string>({
  table,
  schema,
}: {
  table: Table
  schema(t: DataTypes): S,
}): { new (adapter: PostgresAdapter): PostgresModel<S, Table> } => {
  const shape = schema(dataTypes)
  const schemaObject = tableSchema(shape)

  return class extends PostgresModel<S, Table> {
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
