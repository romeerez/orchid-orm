import { RawExpression } from 'orchid-core';

const used: string[] = [];
export const getRaw = (raw: RawExpression, valuesArray: unknown[]) => {
  if (!raw.__values) {
    return raw.__raw;
  }

  const arr = raw.__raw.split("'");
  const values = raw.__values as Record<string, unknown>;
  const len = arr.length;
  used.length = 0;
  for (let i = 0; i < len; i += 2) {
    arr[i] = arr[i].replace(/\$\$?(\w+)/g, (match, key) => {
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
