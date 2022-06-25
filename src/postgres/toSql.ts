import { PostgresModel, QueryData } from './model';
import { quote } from './quote';

// quote table or column
const q = (sql: string) => `"${sql}"`
// quote column with table or as
export const qc = (quotedAs: string, column: string) => `${quotedAs}.${q(column)}`

const EMPTY_OBJECT = {} as QueryData

export const toSql = (model: PostgresModel<any>): string => {
  const sql: string[] = ['SELECT']

  const { query = EMPTY_OBJECT } = model
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

  if (query.select || query.selectRaw) {
    const select: string[] = []
    if (query.select) {
      query.select.forEach((column) => {
        if (typeof column === 'string') {
          select.push(qc(quotedAs, column))
        } else {
          for (const as in column) {
            const value = column[as]
            if (typeof value === 'string') {
              select.push(`${qc(quotedAs, value)} AS ${q(as)}`)
            } else {
              select.push(`(${value.json().toSql()}) AS ${q(as)}`)
            }
          }
        }
      })
    }
    if (query.selectRaw) {
      select.push(...query.selectRaw)
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

const whereConditionsToSql = (query: QueryData, quotedAs: string): string => {
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