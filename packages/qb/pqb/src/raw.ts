import { ColumnType } from './columns/columnType';
import { emptyObject } from './utils';

export type RawExpression<C extends ColumnType = ColumnType> = {
  __raw: string;
  __values?: Record<string, unknown> | false;
  __column: C;
};

export const raw = (
  sql: string,
  values?: Record<string, unknown> | false,
): RawExpression =>
  ({
    __raw: sql,
    __values: values,
  } as RawExpression);

export const isRaw = (obj: object): obj is RawExpression => '__raw' in obj;

const keys: string[] = [];
export const getRaw = (raw: RawExpression, valuesArray: unknown[]) => {
  if (raw.__values === false) {
    return raw.__raw;
  }

  const arr = raw.__raw.split("'");
  const values = (raw.__values || emptyObject) as Record<string, unknown>;
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

export const getRawSql = (raw: RawExpression) => {
  return raw.__raw;
};
