// eslint-disable-next-line
type Value = any;

const quoteValue = (value: Value, nested = false): string => {
  const type = typeof value;
  if (type === 'number' || type === 'bigint') return String(value);
  else if (type === 'string') return quoteString(value);
  else if (type === 'boolean') return value ? 'true' : 'false';
  else if (value instanceof Date) return `'${value.toISOString()}'`;
  else if (Array.isArray(value))
    return `${nested ? '' : 'ARRAY'}[${value
      .map((el) => quoteValue(el, true))
      .join(',')}]`;
  else if (value === null || value === undefined) return 'NULL';
  else return quoteString(JSON.stringify(value));
};

export const quote = (value: Value): string => quoteValue(value);

export const quoteString = (value: string) =>
  `'${value.replaceAll("'", "''")}'`;
