export type AggregateOptions = {
  distinct?: boolean
  order?: string
  filter?: string
  withinGroup?: boolean
}

export const aggregateSql = (
  functionName: string,
  args: string,
  { distinct, order, filter, withinGroup }: AggregateOptions = {},
) => {
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
