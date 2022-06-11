import { PostgresModel } from './model';

// quote table or column
const q = (sql: string) => `"${sql}"`
// quote column with table or as
const qc = (quotedAs: string, column: string) => `${quotedAs}.${q(column)}`

export const toSql = (model: PostgresModel<any>): string => {
  const sql: string[] = ['SELECT']

  const { query, table } = model
  const quotedAs = q(table)

  if (query?.select || query?.selectRaw) {
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
    sql.push('*')
  }

  sql.push('FROM', q(table))

  return sql.join(' ')
}