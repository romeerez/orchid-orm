// eslint-disable-next-line
type Value = any;

const escape = (
  value: Value,
  migration?: boolean,
  nested?: boolean,
): string => {
  const type = typeof value;
  if (type === 'number' || type === 'bigint') return String(value);
  else if (type === 'string') return escapeString(value);
  else if (type === 'boolean') return value ? 'true' : 'false';
  else if (value instanceof Date) return `'${value.toISOString()}'`;
  else if (Array.isArray(value))
    return migration && nested && !value.length
      ? ''
      : (migration ? '{' : nested ? '[' : 'ARRAY[') +
          value.map((el) => escape(el, migration, true)).join(',') +
          (migration ? '}' : ']');
  else if (value === null || value === undefined) return 'NULL';
  else return escapeString(JSON.stringify(value));
};

export const escapeForLog = (value: Value): string => escape(value);

export const escapeForMigration = (value: Value): string => escape(value, true);

export const escapeString = (value: string) =>
  `'${value.replaceAll("'", "''")}'`;
