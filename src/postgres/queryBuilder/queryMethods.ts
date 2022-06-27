import { ColumnsShape, GetTypesOrRaw } from '../schema';
import { AllColumns, Query, Output, PostgresModelConstructor } from '../model';
import { HavingArg, QueryData, toSql, UnionArg, WhereItem, WindowArg } from './toSql';
import { Expression, raw, RawExpression } from './common';
import { Spread, UnionToArray } from '../utils';

type QueryDataArrays<T extends Query> = {
  [K in keyof QueryData<T>]: QueryData<T>[K] extends Array<any> ? QueryData<T>[K] : never
}

export const removeFromQuery = <T extends Query>(q: { query?: QueryData<T> }, key: keyof QueryData<T>) => {
  if (q.query) delete q.query[key]
}

export const setQueryValue = <T extends Query, K extends keyof QueryData<T>>(self: T, key: K, value: QueryData<T>[K]): T => {
  const q = self.toQuery()
  q.query[key] = value
  return q
}

export const pushQueryArray = <T extends Query, K extends keyof QueryData<T>>(self: T, key: K, value: QueryData<T>[K]): T => {
  const q = self.toQuery()
  if (!q.query[key]) q.query[key] = value
  else (q.query[key] as unknown[]).push(...(value as unknown[]))
  return q
}

export const pushQueryValue = <T extends Query, K extends keyof QueryDataArrays<T>>(self: T, key: K, value: QueryDataArrays<T>[K][number]): T => {
  const q = self.toQuery()
  if (!q.query[key]) q.query[key] = [value] as QueryData<T>[K]
  else (q.query[key] as unknown[]).push(value)
  return q
}

export type QueryReturnType = 'all' | 'one' | 'rows' | 'value' | 'void'

export type SetQuery<
  T extends Query = any,
  ResultArg = T['result'],
  ReturnType extends QueryReturnType = T['returnType'],
  Windows extends PropertyKey[] = T['windows'],
  Result = T['result'] extends AllColumns ? ResultArg : Spread<[T['result'], ResultArg]>
> = Omit<T, 'result' | 'returnType' | 'then' | 'windows'> & {
  result: Result
  returnType: ReturnType
  then: ReturnType extends 'all'
    ? Then<T, Result[]>
    : ReturnType extends 'one'
      ? Then<T, Result>
      : ReturnType extends 'value'
        ? Then<T, ResultArg>
        : ReturnType extends 'rows'
          ? Then<T, Result[keyof Result]>
          : ReturnType extends 'void'
            ? Then<T, void>
            : never
  windows: Windows
}

export type SetQueryReturns<T extends Query, R extends QueryReturnType> =
  SetQuery<T, T['result'], R>

export type SetQueryReturnsValue<T extends Query, R> =
  SetQuery<T, R, 'value'>

export type SetQueryWindows<T extends Query, W extends PropertyKey[]> =
  SetQuery<T, T['result'], T['returnType'], W>

type Result<T extends Query> = T['result'] extends AllColumns ? T['type'] : T['result']

type Then<T extends Query, Res> = (
  this: T,
  resolve?: (value: Res) => any,
  reject?: (error: any) => any,
) => Promise<Res | never>

const thenAll: Then<Query, any[]> = function (resolve, reject) {
  return this.adapter.query(this.toSql())
    .then(result => result.rows).then(resolve, reject)
}

const thenOne: Then<Query, any> = function (resolve, reject) {
  return this.adapter.query(this.toSql())
    .then(result => result.rows[0]).then(resolve, reject)
}

const thenRows: Then<Query, any[][]> = function (resolve, reject) {
  return this.adapter.arrays(this.toSql())
    .then(result => result.rows).then(resolve, reject)
}

const thenValue: Then<Query, any> = function (resolve, reject) {
  return this.adapter.arrays(this.toSql())
    .then(result => result.rows[0]?.[0]).then(resolve, reject)
}

const thenVoid: Then<Query, void> = function (resolve, reject) {
  return this.adapter.query(this.toSql())
    .then(() => resolve?.(), reject)
}

export class QueryMethods<S extends ColumnsShape> {
  then!: Then<Query, Output<S>[]>
  windows!: PropertyKey[]

  all<T extends Query>(this: T): SetQueryReturns<T, 'all'> {
    return this.then === thenAll ? this.toQuery() as unknown as SetQueryReturns<T, 'all'> : this.clone()._all()
  }

  _all<T extends Query>(this: T): SetQueryReturns<T, 'all'> {
    const q = this.toQuery()
    q.then = thenAll
    removeFromQuery(q, 'take')
    return q as unknown as SetQueryReturns<T, 'all'>
  }

  take<T extends Query>(this: T): SetQueryReturns<T, 'one'> {
    return this.then === thenOne ? this as unknown as SetQueryReturns<T, 'one'> : this.clone()._take()
  }

  _take<T extends Query>(this: T): SetQueryReturns<T, 'one'> {
    const q = this.toQuery()
    q.then = thenOne
    setQueryValue(q, 'take', true)
    return q as unknown as SetQueryReturns<T, 'one'>
  }

  rows<T extends Query>(this: T): SetQueryReturns<T, 'rows'> {
    return this.then === thenRows ? this as unknown as SetQueryReturns<T, 'rows'> : this.clone()._rows()
  }

  _rows<T extends Query>(this: T): SetQueryReturns<T, 'rows'> {
    const q = this.toQuery()
    q.then = thenRows
    removeFromQuery(q, 'take')
    return q as unknown as SetQueryReturns<T, 'rows'>
  }

  value<T extends Query, V>(this: T): SetQueryReturnsValue<T, V> {
    return this.then === thenValue ? this as unknown as SetQueryReturnsValue<T, V> : this.clone()._value<T, V>()
  }

  _value<T extends Query, V>(this: T): SetQueryReturnsValue<T, V> {
    const q = this.toQuery()
    q.then = thenValue
    removeFromQuery(q, 'take')
    return q as unknown as SetQueryReturnsValue<T, V>
  }

  exec<T extends Query>(this: T): SetQueryReturns<T, 'void'> {
    return this.then === thenVoid ? this as unknown as SetQueryReturns<T, 'void'> : this.clone()._exec()
  }

  _exec<T extends Query>(this: T): SetQueryReturns<T, 'void'> {
    const q = this.toQuery()
    q.then = thenVoid
    removeFromQuery(q, 'take')
    return q as unknown as SetQueryReturns<T, 'void'>
  }

  toQuery<T extends Query>(this: T): T & { query: QueryData<T> } {
    if (this.query) return this as T & { query: QueryData<T> }
    const q = this.clone()
    return q as T & { query: QueryData<T> }
  }

  clone<T extends Query>(this: T): T {
    const cloned = new (this.constructor as PostgresModelConstructor)(this.adapter)
    cloned.table = this.table
    cloned.schema = this.schema
    cloned.then = this.then
    cloned.query = {}
    if (this.query) {
      for (const key in this.query) {
        const value = this.query[key as keyof QueryData<T>]
        if (Array.isArray(value)) {
          (cloned.query as Record<string, unknown>)[key] = [...value]
        } else {
          (cloned.query as Record<string, unknown>)[key] = value
        }
      }
    }

    return cloned as T
  }

  toSql(this: Query): string {
    return toSql(this)
  }

  asType<T extends Query>(this: T): <S>() => SetQuery<T, S> {
    return <S>() => this as unknown as SetQuery<T, S>
  }

  select<T extends Query, K extends (keyof T['type'])[]>(this: T, ...columns: K): SetQuery<T, Pick<T['type'], K[number]>> {
    return this.clone()._select(...columns)
  }

  _select<T extends Query, K extends (keyof T['type'])[]>(this: T, ...columns: K): SetQuery<T, Pick<T['type'], K[number]>> {
    return pushQueryArray(this, 'select', columns)
  }

  selectAs<T extends Query, S extends Record<string, (keyof T['type']) | Query | RawExpression<any>>>(this: T, select: S) {
    return this.clone()._selectAs(select)
  }

  _selectAs<T extends Query, S extends Record<string, (keyof T['type']) | Query | RawExpression<any>>>(this: T, select: S): SetQuery<T, { [K in keyof S]: S[K] extends keyof T['type'] ? T['type'][S[K]] : S[K] extends RawExpression<infer Type> ? Type : S[K] extends Query ? Result<S[K]> : never }> {
    return pushQueryValue(this, 'select', { selectAs: select })
  }

  distinct<T extends Query>(this: T, ...columns: Expression<T>[]): T {
    return this.clone()._distinct(...columns)
  }

  _distinct<T extends Query>(this: T, ...columns: Expression<T>[]): T {
    return pushQueryArray(this, 'distinct', columns as string[])
  }

  and<T extends Query>(this: T, ...args: WhereItem<T>[]): T {
    return this.where(...args)
  }

  _and<T extends Query>(this: T, ...args: WhereItem<T>[]): T {
    return this._where(...args)
  }

  where<T extends Query>(this: T, ...args: WhereItem<T>[]): T {
    return this.clone()._where(...args)
  }

  _where<T extends Query>(this: T, ...args: WhereItem<T>[]): T {
    return pushQueryArray(this, 'and', args)
  }

  or<T extends Query>(this: T, ...args: WhereItem<T>[]): T {
    return this.clone()._or(...args)
  }

  _or<T extends Query>(this: T, ...args: WhereItem<T>[]): T {
    return pushQueryArray(this, 'or', args.map(arg => [arg]))
  }

  find<T extends Query>(this: T, ...args: GetTypesOrRaw<T['primaryTypes']>): SetQueryReturns<T, 'one'> {
    return (this.clone()._find as any)(...args as unknown[])
  }

  _find<T extends Query>(this: T, ...args: GetTypesOrRaw<T['primaryTypes']>): SetQueryReturns<T, 'one'> {
    const conditions: Partial<Output<T['shape']>> = {}
    this.primaryKeys.forEach((key: string, i: number) => {
      conditions[key as keyof Output<T['shape']>] = args[i]
    })
    return this._where(conditions)._take()
  }

  findBy<T extends Query>(this: T, ...args: WhereItem<T>[]): SetQueryReturns<T, 'one'> {
    return this.clone()._findBy(...args)
  }

  _findBy<T extends Query>(this: T, ...args: WhereItem<T>[]): SetQueryReturns<T, 'one'> {
    return this._where(...args).take()
  }

  as<T extends Query>(this: T, as: string): T {
    return this.clone()._as(as)
  }

  _as<T extends Query>(this: T, as: string): T {
    return setQueryValue(this, 'as', as)
  }

  from<T extends Query>(this: T, from: string | RawExpression): T {
    return this.clone()._from(from)
  }

  _from<T extends Query>(this: T, from: string | RawExpression): T {
    return setQueryValue(this, 'from', from)
  }

  group<T extends Query>(this: T, ...columns: (keyof T['type'] | RawExpression)[]): T {
    return this.clone()._group(...columns)
  }

  _group<T extends Query>(this: T, ...columns: (keyof T['type'] | RawExpression)[]): T {
    return pushQueryArray(this, 'group', columns as string[])
  }

  having<T extends Query>(this: T, ...args: HavingArg<T>[]): T {
    return this.clone()._having(...args)
  }

  _having<T extends Query>(this: T, ...args: HavingArg<T>[]): T {
    return pushQueryArray(this, 'having', args)
  }

  window<T extends Query, W extends WindowArg<T>>(this: T, arg: W): SetQueryWindows<T, UnionToArray<keyof W>> {
    return this.clone()._window(arg)
  }

  _window<T extends Query, W extends WindowArg<T>>(this: T, arg: W): SetQueryWindows<T, UnionToArray<keyof W>> {
    return pushQueryValue(this, 'window', arg) as unknown as SetQueryWindows<T, UnionToArray<keyof W>>
  }

  wrap<T extends Query, Q extends Query>(this: T, query: Q, as = 't'): Q {
    return this.clone()._wrap(query.clone(), as)
  }

  _wrap<T extends Query, Q extends Query>(this: T, query: Q, as = 't'): Q {
    return query._as(as)._from(raw(`(${this.toSql()})`))
  }

  json<T extends Query>(this: T): SetQueryReturnsValue<T, string> {
    return this.clone()._json()
  }

  _json<T extends Query>(this: T): SetQueryReturnsValue<T, string> {
    const q = this._wrap(
      this.selectAs({
        json: raw(
          this.query?.take
            ? `COALESCE(row_to_json("t".*), '{}')`
            : `COALESCE(json_agg(row_to_json("t".*)), '[]')`
        )
      })
    )

    return q._value<typeof q, string>() as unknown as SetQueryReturnsValue<T, string>
  }

  union<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return this._union(...args)
  }

  _union<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return pushQueryArray(this, 'union', args.map((arg) => ({ arg, kind: 'UNION' })))
  }

  unionAll<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return this._unionAll(...args)
  }

  _unionAll<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return pushQueryArray(this, 'union', args.map((arg) => ({ arg, kind: 'UNION ALL' })))
  }

  intersect<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return this._intersect(...args)
  }

  _intersect<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return pushQueryArray(this, 'union', args.map((arg) => ({ arg, kind: 'INTERSECT' })))
  }

  intersectAll<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return this._intersectAll(...args)
  }

  _intersectAll<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return pushQueryArray(this, 'union', args.map((arg) => ({ arg, kind: 'INTERSECT ALL' })))
  }

  except<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return this._except(...args)
  }

  _except<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return pushQueryArray(this, 'union', args.map((arg) => ({ arg, kind: 'EXCEPT' })))
  }

  exceptAll<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return this._exceptAll(...args)
  }

  _exceptAll<T extends Query>(this: T, ...args: UnionArg<T>[]): T {
    return pushQueryArray(this, 'union', args.map((arg) => ({ arg, kind: 'EXCEPT ALL' })))
  }
}

QueryMethods.prototype.then = thenAll
