import { ColumnsShape, GetTypesOrRaw } from '../schema';
import { AllColumns, Query, Output, PostgresModelConstructor } from '../model';
import { HavingArg, QueryData, toSql, WhereItem } from './toSql';
import { Expression, raw, RawExpression } from './common';

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

type ReturnType = 'all' | 'one' | 'rows' | 'value' | 'void'

export type MutateQuery<
  T extends Query = any,
  R extends unknown = T['result'],
  RT extends ReturnType = T['returnType'],
  Res = Result<Omit<T, 'result'> & { result: R }>
> = Omit<T, 'result' | 'then'> & {
  result: RT extends 'value' ? R : Res
  then: RT extends 'all'
    ? Then<T, Res[]>
    : RT extends 'one'
      ? Then<T, Res>
      : RT extends 'value'
        ? Then<T, R>
        : RT extends 'rows'
          ? Then<T, Res[keyof Res]>
          : RT extends 'void'
            ? Then<T, void>
            : never
}

type Result<T extends Query> = T['result'] extends AllColumns ? T['type'] : T['result']

type QueryReturns<T extends Query, R extends ReturnType> =
  MutateQuery<T, T['result'], R>

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

  all<T extends Query>(this: T): QueryReturns<T, 'all'> {
    return this.then === thenAll ? this.toQuery() : this.clone()._all()
  }

  _all<T extends Query>(this: T): QueryReturns<T, 'all'> {
    const q = this.toQuery()
    q.then = thenAll
    removeFromQuery(q, 'take')
    return q
  }

  take<T extends Query>(this: T): QueryReturns<T, 'one'> {
    return this.then === thenOne ? this : this.clone()._take()
  }

  _take<T extends Query>(this: T): QueryReturns<T, 'one'> {
    const q = this.toQuery()
    q.then = thenOne
    setQueryValue(q, 'take', true)
    return q
  }

  rows<T extends Query>(this: T): QueryReturns<T, 'rows'> {
    return this.then === thenRows ? this as unknown as QueryReturns<T, 'rows'> : this.clone()._rows()
  }

  _rows<T extends Query>(this: T): QueryReturns<T, 'rows'> {
    const q = this.toQuery()
    q.then = thenRows
    removeFromQuery(q, 'take')
    return q as unknown as QueryReturns<T, 'rows'>
  }

  value<T extends Query, V>(this: T): MutateQuery<T, V, 'value'> {
    return this.then === thenValue ? this as unknown as MutateQuery<T, V, 'value'> : this.clone()._value<T, V>()
  }

  _value<T extends Query, V>(this: T): MutateQuery<T, V, 'value'> {
    const q = this.toQuery()
    q.then = thenValue
    removeFromQuery(q, 'take')
    return q as unknown as MutateQuery<T, V, 'value'>
  }

  exec<T extends Query>(this: T): QueryReturns<T, 'void'> {
    return this.then === thenVoid ? this : this.clone()._exec()
  }

  _exec<T extends Query>(this: T): QueryReturns<T, 'void'> {
    const q = this.toQuery()
    q.then = thenVoid
    removeFromQuery(q, 'take')
    return q
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

  asType<T extends Query>(this: T): <S>() => MutateQuery<T, S> {
    return <S>() => this as unknown as MutateQuery<T, S>
  }

  select<T extends Query, K extends (keyof T['type'])[]>(this: T, ...columns: K): MutateQuery<T, Pick<T['type'], K[number]>> {
    return this.clone()._select(...columns)
  }

  _select<T extends Query, K extends (keyof T['type'])[]>(this: T, ...columns: K): MutateQuery<T, Pick<T['type'], K[number]>> {
    return pushQueryArray(this, 'select', columns)
  }

  selectAs<T extends Query, S extends Record<string, (keyof T['type']) | Query | RawExpression<any>>>(this: T, select: S): MutateQuery<T, { [K in keyof S]: S[K] extends keyof T['type'] ? T['type'][S[K]] : S[K] extends RawExpression<infer Type> ? Type : S[K] extends Query ? Result<S[K]> : never }> {
    return this.clone()._selectAs(select)
  }

  _selectAs<T extends Query, S extends Record<string, (keyof T['type']) | Query | RawExpression<any>>>(this: T, select: S): MutateQuery<T, { [K in keyof S]: S[K] extends keyof T['type'] ? T['type'][S[K]] : S[K] extends RawExpression<infer Type> ? Type : S[K] extends Query ? Result<S[K]> : never }> {
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

  find<T extends Query>(this: T, ...args: GetTypesOrRaw<T['primaryTypes']>): QueryReturns<T, 'one'> {
    return (this.clone()._find as any)(...args as unknown[])
  }

  _find<T extends Query>(this: T, ...args: GetTypesOrRaw<T['primaryTypes']>): QueryReturns<T, 'one'> {
    const conditions: Partial<Output<T['shape']>> = {}
    this.primaryKeys.forEach((key: string, i: number) => {
      conditions[key as keyof Output<T['shape']>] = args[i]
    })
    return this._where(conditions)._take()
  }

  findBy<T extends Query>(this: T, ...args: WhereItem<T>[]): QueryReturns<T, 'one'> {
    return this.clone()._findBy(...args)
  }

  _findBy<T extends Query>(this: T, ...args: WhereItem<T>[]): QueryReturns<T, 'one'> {
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

  wrap<T extends Query, Q extends Query>(this: T, query: Q, as = 't'): Q {
    return this.clone()._wrap(query.clone(), as)
  }

  _wrap<T extends Query, Q extends Query>(this: T, query: Q, as = 't'): Q {
    return query._as(as)._from(raw(`(${this.toSql()})`))
  }

  json<T extends Query>(this: T): MutateQuery<T, string, 'value'> {
    return this.clone()._json()
  }

  _json<T extends Query>(this: T): MutateQuery<T, string, 'value'> {
    const q = this._wrap(
      this.selectAs({
        json: raw(
          this.query?.take
            ? `COALESCE(row_to_json("t".*), '{}')`
            : `COALESCE(json_agg(row_to_json("t".*)), '[]')`
        )
      })
    )

    return q._value<typeof q, string>() as unknown as MutateQuery<T, string, 'value'>
  }
}

QueryMethods.prototype.then = thenAll
