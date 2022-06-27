import { Query, PostgresModel, Output } from '../model';
import { quote } from './quote';
import { Expression, getRaw, isRaw, RawExpression } from './common';
import { ColumnsShape } from '../schema';
import { Aggregate1ArgumentTypes } from './aggregateMethods';
import { Operator } from './operators';

// quote table or column
const q = (sql: string) => `"${sql}"`
// quote column with table or as
export const qc = (quotedAs: string, column: string) => `${quotedAs}.${q(column)}`

export type QueryData<T extends Query> = {
  take?: true
  select?: SelectItem<T>[]
  distinct?: Expression<T>[]
  and?: WhereItem<T>[]
  or?: WhereItem<T>[][]
  as?: string
  from?: string | RawExpression
  group?: (keyof T['type'] | RawExpression)[]
  having?: HavingArg<T>[]
}

export type SelectItem<T extends Query> =
  | keyof T['type']
  | Aggregate<T>
  | { selectAs: Record<string, Expression<T> | Query> }

export type WhereItem<T extends Query> =
  | Partial<Output<T['shape']>>
  | { [K in keyof T['shape']]?: ColumnOperators<T['shape'], K> | RawExpression }
  | Query
  | RawExpression

export type AggregateOptions = {
  distinct?: boolean
  order?: string
  filter?: string
  withinGroup?: boolean
}

const aggregateOptionNames: (keyof AggregateOptions)[] = ['distinct', 'order', 'filter', 'withinGroup']

export type Aggregate<T extends Query> = {
  function: string,
  arg: Expression<T> | { __keyValues: Record<string, Expression<T>> } | { __withDelimiter: [Expression<T>, string] }
  options: AggregateOptions
}

export type ColumnOperators<S extends ColumnsShape, Column extends keyof S> =
  { [O in keyof S[Column]['operators']]?: S[Column]['operators'][O]['type'] }

export type HavingArg<T extends Query> = {
  [Agg in keyof Aggregate1ArgumentTypes<T>]?: {
    [Column in Exclude<Aggregate1ArgumentTypes<T>[Agg], RawExpression>]?:
    | T['type'][Column]
    | ColumnOperators<T['shape'], Column> & AggregateOptions
  }
} | RawExpression

const EMPTY_OBJECT = {}

export const toSql = <T extends Query>(model: T): string => {
  const sql: string[] = ['SELECT']

  const query = (model.query || EMPTY_OBJECT) as QueryData<T>
  const quotedAs = q(query.as || model.table)

  if (query.distinct) {
    sql.push('DISTINCT')

    if (query.distinct.length) {
      const columns: string[] = []
      query.distinct?.forEach((item) => {
        columns.push(expressionToSql(quotedAs, item))
      })
      sql.push(`ON (${columns.join(', ')})`)
    }
  }

  if (query.select) {
    const select: string[] = []
    if (query.select) {
      query.select.forEach((item) => {
        if (typeof item === 'object') {
          if ('selectAs' in item) {
            const obj = item.selectAs as Record<string, Expression<T> | Query>
            for (const as in obj) {
              const value = obj[as]
              if (typeof value === 'object') {
                if (isRaw(value)) {
                  select.push(`${getRaw(value)} AS ${q(as)}`)
                } else {
                  select.push(`(${(value as Query).json().toSql()}) AS ${q(as)}`)
                }
              } else {
                select.push(`${qc(quotedAs, value as string)} AS ${q(as)}`)
              }
            }
          } else {
            select.push(aggregateToSql(quotedAs, item))
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

  sql.push(
    'FROM',
    query.from
      ? typeof query.from === 'object' ? getRaw(query.from) : q(query.from)
      : q(model.table)
  )
  if (query.as) sql.push('AS', quotedAs)

  const whereConditions = whereConditionsToSql(model, query, quotedAs)
  if (whereConditions.length) sql.push('WHERE', whereConditions)

  if (query.group) {
    const group = query.group.map((item) =>
      typeof item === 'object' && isRaw(item)
        ? getRaw(item)
        : qc(quotedAs, item as string)
    )
    sql.push(`GROUP BY ${group.join(', ')}`)
  }

  if (query.having) {
    const having: string[] = []
    query.having.forEach((item) => {
      if (isRaw(item)) {
        having.push(getRaw(item))
        return
      }
      for (const key in item) {
        const columns = item[key as keyof Exclude<HavingArg<T>, RawExpression>]
        for (const column in columns) {
          const valueOrOptions = columns[column as keyof typeof columns]
          if (typeof valueOrOptions === 'object' && valueOrOptions !== null && valueOrOptions !== undefined) {
            for (const op in valueOrOptions) {
              if (!aggregateOptionNames.includes(op as keyof AggregateOptions)) {
                const operator = model.schema.shape[column].operators[op] as Operator<any>
                if (!operator) {
                  // TODO: custom error classes
                  throw new Error(`Unknown operator ${op} provided to condition`)
                }
                having.push(operator(aggregateToSql(quotedAs, {
                  function: key,
                  arg: column,
                  options: valueOrOptions as AggregateOptions
                }), valueOrOptions[op]))
              }
            }
          } else {
            having.push(`${aggregateToSql(quotedAs, {
              function: key,
              arg: column,
              options: EMPTY_OBJECT
            })} = ${quote(valueOrOptions)}`)
          }
        }
      }
    })
    sql.push(`HAVING ${having.join(' AND ')}`)
  }

  if (query.take) {
    sql.push('LIMIT 1')
  }

  return sql.join(' ')
}

const expressionToSql = <T extends Query>(quotedAs: string, expr: Expression<T>) => {
  return typeof expr === 'object' && isRaw(expr) ? getRaw(expr) : qc(quotedAs, expr as string)
}

const aggregateToSql = <T extends Query>(quotedAs: string, item: Aggregate<T>) => {
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

  return sql.join('')
}

const whereConditionsToSql = <T extends Query>(model: Query, query: QueryData<T>, quotedAs: string): string => {
  const or = query.and && query.or ? [query.and, ...query.or] : query.and ? [query.and] : query.or
  if (!(or?.length)) return ''

  const ors: string[] = []
  or.forEach((and) => {
    const ands: string[] = []
    and.forEach((item) => {
      if (item instanceof PostgresModel) {
        const sql = whereConditionsToSql(item, item.query || EMPTY_OBJECT, q(item.table))
        if (sql.length) ands.push(`(${sql})`)
      } else {
        for (const key in item) {
          const value = item[key as keyof typeof item] as object
          if (typeof value === 'object' && value !== null && value !== undefined) {
            if (isRaw(value)) {
              ands.push(`${qc(quotedAs, key)} = ${getRaw(value)}`)
            } else {
              const column = model.schema.shape[key]
              if (!column) {
                // TODO: custom error classes
                throw new Error(`Unknown column ${key} provided to condition`)
              }

              for (const op in value) {
                const operator = column.operators[op]
                if (!operator) {
                  // TODO: custom error classes
                  throw new Error(`Unknown operator ${op} provided to condition`)
                }

                ands.push(operator(qc(quotedAs, key), value[op as keyof typeof value]))
              }
            }
          } else {
            ands.push(`${qc(quotedAs, key)} ${value === null ? 'IS' : '='} ${quote(value)}`)
          }
        }
      }
    })
    ors.push(ands.join(' AND '))
  })

  return ors.join(' OR ')
}