import { Query, Selectable } from './query';
import { ColumnOutput, ColumnType } from './columnSchema/columnType';
import { emptyObject } from './utils';

export type AliasOrTable<T extends Pick<Query, 'tableAlias' | 'table'>> =
  T['tableAlias'] extends string
    ? T['tableAlias']
    : T['table'] extends string
    ? T['table']
    : never;

export type StringKey<K extends PropertyKey> = Exclude<K, symbol | number>;

export type RawExpression<C extends ColumnType = ColumnType> = {
  __raw: string;
  __values?: Record<string, unknown> | false;
  __column: C;
};

export const raw = (
  sql: string,
  values: Record<string, unknown> | false,
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

export type Expression<
  T extends Query = Query,
  C extends ColumnType = ColumnType,
> = StringKey<keyof T['selectable']> | RawExpression<C>;

export type ExpressionOfType<T extends Query, C extends ColumnType, Type> =
  | {
      [K in keyof T['selectable']]: ColumnOutput<
        T['selectable'][K]['column']
      > extends Type | null
        ? K
        : never;
    }[Selectable<T>]
  | RawExpression<C>;

export type NumberExpression<
  T extends Query,
  C extends ColumnType = ColumnType,
> = ExpressionOfType<T, C, number>;

export type StringExpression<
  T extends Query,
  C extends ColumnType = ColumnType,
> = ExpressionOfType<T, C, string>;

export type BooleanExpression<
  T extends Query,
  C extends ColumnType = ColumnType,
> = ExpressionOfType<T, C, boolean>;

export type ExpressionOutput<
  T extends Query,
  Expr extends Expression<T>,
> = Expr extends keyof T['selectable']
  ? T['selectable'][Expr]['column']
  : Expr extends RawExpression<infer ColumnType>
  ? ColumnType
  : never;

export const EMPTY_OBJECT = {};

export const getQueryParsers = (q: Query) => {
  return q.query.parsers || q.columnsParsers;
};
