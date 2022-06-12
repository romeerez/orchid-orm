import { PostgresModel, QueryData } from './model';

// quote table or column
const q = (sql: string) => `"${sql}"`
// quote column with table or as
const qc = (quotedAs: string, column: string) => `${quotedAs}.${q(column)}`

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

  if (query.take) {
    sql.push('LIMIT 1')
  }

  return sql.join(' ')
}