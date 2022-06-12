import { PostgresModel, QueryData } from './model';
import { quote } from './quote';

// quote table or column
const q = (sql: string) => `"${sql}"`
// quote column with table or as
export const qc = (quotedAs: string, column: string) => `${quotedAs}.${q(column)}`

const EMPTY_OBJECT = {} as QueryData

export const toSql = (model: PostgresModel<any>): string => {
  const sql: string[] = ['SELECT']

  const { query = EMPTY_OBJECT, table } = model
  const quotedAs = q(table)

  if (query.select || query.selectRaw) {
    const select: string[] = []
    if (query.select) {
      select.push(...query.select.map((column) =>
        qc(quotedAs, column)
      ))
    }
    if (query.selectRaw) {
      select.push(...query.selectRaw)
    }
    sql.push(select.join(', '))
  } else {
    sql.push(`${quotedAs}.*`)
  }

  sql.push('FROM', q(table))

  const whereConditions = whereConditionsToSql(query, quotedAs)
  if (whereConditions.length) sql.push('WHERE', whereConditions)

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
        ands.push(`${qc(quotedAs, item[0])} ${item[1]} ${quote(item[2])}`)
      }
    })
    ors.push(ands.join(' AND '))
  })

  return ors.join(' OR ')
}