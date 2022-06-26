import { Base, PostgresModel } from '../model';
import { quote } from './quote';
import { Expression } from './common';

// quote table or column
const q = (sql: string) => `"${sql}"`
// quote column with table or as
export const qc = (quotedAs: string, column: string) => `${quotedAs}.${q(column)}`

export type QueryData<T extends Base> = {
  take?: true
  select?: SelectItem<T>[]
  distinct?: string[]
  distinctRaw?: string[]
  and?: ConditionItem[]
  or?: ConditionItem[][]
  as?: string
  from?: string
  group?: string[]
  groupRaw?: string[]
}

export type SelectItem<T extends Base> =
  | Expression<T>
  | Aggregate<T>
  | { selectAs: Record<string, Expression<T> | Base> }
  | { raw: string }

export type ConditionItem =
  | [key: string, op: string, value: any]
  | [key: string, op: (key: string, value: unknown) => string, value: any]
  | PostgresModel

export type AggregateOptions = {
  distinct?: boolean
  order?: string
  filter?: string
  withinGroup?: boolean
}

export type Aggregate<T extends Base> = {
  function: string,
  arg: Expression<T> | { __keyValues: Record<string, Expression<T>> } | { __withDelimiter: [Expression<T>, string] }
  options: AggregateOptions
}

const EMPTY_OBJECT = {}

export const toSql = <T extends Base>(model: T): string => {
  const sql: string[] = ['SELECT']

  const query = (model.query || EMPTY_OBJECT) as QueryData<T>
  const quotedAs = q(query.as || model.table)

  if (query.distinct || query.distinctRaw) {
    sql.push('DISTINCT')

    if (query.distinct?.length || query.distinctRaw?.length) {
      const columns: string[] = []
      query.distinct?.forEach(column => {
        columns.push(qc(quotedAs, column))
      })
      if (query.distinctRaw) {
        columns.push(...query.distinctRaw)
      }
      sql.push(`ON (${columns.join(', ')})`)
    }
  }

  if (query.select) {
    const select: string[] = []
    if (query.select) {
      query.select.forEach((item) => {
        if (typeof item === 'object') {
          if ('selectAs' in item) {
            const obj = item.selectAs as Record<string, Expression<T> | Base>
            for (const as in obj) {
              const value = obj[as]
              if (typeof value === 'string') {
                select.push(`${qc(quotedAs, value)} AS ${q(as)}`)
              } else {
                select.push(`(${(value as Base).json().toSql()}) AS ${q(as)}`)
              }
            }
          } else if ('raw' in item) {
            select.push(item.raw)
          } else {
            const sql: string[] = [`${item.function}(`]

            const options = item.options || EMPTY_OBJECT

            if (options.distinct && !options.withinGroup) sql.push('DISTINCT ')

            if (typeof item.arg === 'object') {
              if ('__keyValues' in item.arg) {
                const args: string[] = []
                for (const key in item.arg.__keyValues) {
                  args.push(`${quote(key)}, ${expressionToSql(quotedAs, item.arg.__keyValues[key])}`)
                }
                sql.push(args.join(', '))
              } else if ('__withDelimiter' in item.arg) {
                sql.push(`${expressionToSql(quotedAs, item.arg.__withDelimiter[0])}, ${quote(item.arg.__withDelimiter[1])}`)
              } else {
                sql.push(expressionToSql(quotedAs, item.arg))
              }
            } else {
              sql.push(expressionToSql(quotedAs, item.arg))
            }

            if (options.withinGroup) sql.push(') WITHIN GROUP (')
            else if (options.order) sql.push(' ')

            if (options.order) sql.push(`ORDER BY ${options.order}`)

            sql.push(')')

            if (options.filter) sql.push(` FILTER (WHERE ${options.filter})`)

            select.push(sql.join(''))
          }
        } else {
          select.push(qc(quotedAs, item as string))
        }
      })
    }
    sql.push(select.join(', '))
  } else {
    sql.push(`${quotedAs}.*`)
  }

  sql.push('FROM', query.from || q(model.table))
  if (query.as) sql.push('AS', quotedAs)

  const whereConditions = whereConditionsToSql(query, quotedAs)
  if (whereConditions.length) sql.push('WHERE', whereConditions)

  if (query.group || query.groupRaw) {
    const group: string[] = []
    if (query.group) {
      group.push(...query.group.map((column) =>
        qc(quotedAs, column)
      ))
    }
    if (query.groupRaw) {
      group.push(...query.groupRaw)
    }
    sql.push(`GROUP BY ${group.join(', ')}`)
  }

  if (query.take) {
    sql.push('LIMIT 1')
  }

  return sql.join(' ')
}

const expressionToSql = <T extends Base>(quotedAs: string, expr: Expression<T>) => {
  return typeof expr === 'object' ? expr.raw : qc(quotedAs, expr as string)
}

const whereConditionsToSql = <T extends Base>(query: QueryData<T>, quotedAs: string): string => {
  const or = query.and && query.or ? [query.and, ...query.or] : query.and ? [query.and] : query.or
  if (!(or?.length)) return ''

  const ors: string[] = []
  or.forEach((and) => {
    const ands: string[] = []
    and.forEach(item => {
      if (item instanceof PostgresModel) {
        const sql = whereConditionsToSql(item.query || EMPTY_OBJECT, q(item.table))
        if (sql.length) ands.push(`(${sql})`)
      } else {
        if (typeof item[1] === 'string') {
          ands.push(`${qc(quotedAs, item[0])} ${item[1]} ${quote(item[2])}`)
        } else {
          ands.push(item[1](qc(quotedAs, item[0]), item[2]))
        }
      }
    })
    ors.push(ands.join(' AND '))
  })

  return ors.join(' OR ')
}