import { Base } from '../model';

export type AggregateOptions = {
  distinct?: boolean
  order?: string
  filter?: string
  withinGroup?: boolean
}

export class AggregateMethods {
  aggregateSql(
    functionName: string,
    args: string,
    { distinct, order, filter, withinGroup }: AggregateOptions = {},
  ) {
    const sql: string[] = [`${functionName}(`]

    if (distinct && !withinGroup) sql.push('DISTINCT ')

    sql.push(args)

    if (withinGroup) sql.push(') WITHIN GROUP (')
    else if (order) sql.push(' ')

    if (order) sql.push(`ORDER BY ${order}`)

    sql.push(')')

    if (filter) sql.push(` FILTER (WHERE ${filter})`)

    return sql.join('')
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
