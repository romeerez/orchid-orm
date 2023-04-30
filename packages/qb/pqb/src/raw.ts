import { RawExpression } from 'orchid-core';

const keys: string[] = [];
export const getRaw = (raw: RawExpression, valuesArray: unknown[]) => {
  if (!raw.__values) {
    return raw.__raw;
  }

  const arr = raw.__raw.split("'");
  const values = raw.__values as Record<string, unknown>;
  const len = arr.length;
  keys.length = 0;
  for (let i = 0; i < len; i += 2) {
    arr[i] = arr[i].replace(/\$(\w+)/g, (_, key) => {
      const value = values[key];
      if (value === undefined) {
        throw new Error(`Query variable \`${key}\` is not provided`);
      }

      keys.push(key);
      valuesArray.push(value);
      return `$${valuesArray.length}`;
    });
  }

  if (keys.length > 0 && keys.length < Object.keys(values).length) {
    for (const key in values) {
      if (!keys.includes(key)) {
        throw new Error(`Query variable \`${key}\` is unused`);
      }
    }
  }

  return arr.join("'");
};
