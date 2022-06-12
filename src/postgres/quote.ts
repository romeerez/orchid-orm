const singleQuoteRegex = /'/g
const doubleQuoteRegex = /"/g

// eslint-disable-next-line
type Value = any

const quoteValue = (value: Value): string => {
  const type = typeof value
  if (type === 'number') return String(value)
  else if (type === 'string')
    return `"${(value as string)
      .replace(doubleQuoteRegex, '\\"')
      .replace(singleQuoteRegex, "''")}"`
  else if (type === 'boolean') return value ? 'true' : 'false'
  else if (value instanceof Date) return `"${value.toISOString()}"`
  else if (Array.isArray(value)) return quoteArray(value)
  else if (type === null || type === undefined) return 'NULL'
  else
    return `"${JSON.stringify(value)
      .replace(doubleQuoteRegex, '\\"')
      .replace(singleQuoteRegex, "''")}"`
}

const quoteArray = (array: Value[]) => `'{${array.map(quoteValue).join(',')}}'`

export const quote = (value: Value): string => {
  const type = typeof value
  if (type === 'number') return `${value}`
  else if (type === 'string')
    return `'${(value as string).replace(singleQuoteRegex, "''")}'`
  else if (type === 'boolean') return value ? 'true' : 'false'
  else if (value instanceof Date) return `'${value.toISOString()}'`
  else if (Array.isArray(value)) return quoteArray(value)
  else if (value === null || value === undefined) return 'NULL'
  else return `'${JSON.stringify(value).replace(singleQuoteRegex, "''")}'`
}
