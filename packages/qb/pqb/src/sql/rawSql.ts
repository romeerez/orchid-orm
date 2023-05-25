import { RawExpression } from 'orchid-core';

const used: string[] = [];
const literalValues: number[] = [];
export const getRaw = (raw: RawExpression, valuesArray: unknown[]) => {
  let sql;
  const isLiteral = typeof raw.__raw !== 'string';
  const values = raw.__values as Record<string, unknown>;

  if (isLiteral) {
    sql = '';
    const values = raw.__raw;
    const parts = values[0];
    literalValues.length = 0;

    let i = 0;
    for (let last = parts.length - 1; i < last; i++) {
      valuesArray.push(values[i + 1]);
      sql += parts[i];

      if (values) literalValues.push(sql.length);

      sql += `$${valuesArray.length}`;
    }
    sql += parts[i];
  } else {
    sql = raw.__raw as string;
  }

  if (!values) {
    return sql;
  }

  const arr = sql.split("'");
  const len = arr.length;
  used.length = 0;
  for (let i = 0; i < len; i += 2) {
    arr[i] = arr[i].replace(/\$\$?(\w+)/g, (match, key, i) => {
      if (isLiteral && literalValues.includes(i)) return match;

      const value = values[key];
      if (value === undefined) {
        throw new Error(`Query variable \`${key}\` is not provided`);
      }

      used.push(key);

      if (match.length - key.length === 2) {
        if (typeof value !== 'string') {
          throw new Error(
            `Expected string value for $$${key} SQL keyword, got ${typeof value}`,
          );
        }

        return `"${value.replace('"', '""').replace('.', '"."')}"`;
      }

      valuesArray.push(value);
      return `$${valuesArray.length}`;
    });
  }

  if (used.length > 0 && used.length < Object.keys(values).length) {
    for (const key in values) {
      if (!used.includes(key)) {
        throw new Error(`Query variable \`${key}\` is unused`);
      }
    }
  }

  return arr.join("'");
};
