import { Query } from './query';
import { getRaw, isRaw, RawExpression } from './common';
import { quote } from './quote';

type Fn<T> = (key: string, value: T) => string;

export type Operator<T> = Fn<T> & { type: T };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Operators = Record<string, Operator<any>>;

export const createOperator = <T>(fn: Fn<T>) => {
  return Object.assign(fn, { type: undefined as unknown as T });
};

const quoteValue = (arg: unknown, jsonArray?: boolean): string => {
  if (arg && typeof arg === 'object') {
    if (!jsonArray && Array.isArray(arg)) {
      return `(${arg.map(quote).join(', ')})`;
    }

    if ('toSql' in arg) {
      return `(${(arg as Query).toSql()})`;
    }

    if (isRaw(arg)) {
      return getRaw(arg);
    }
  }

  return quote(arg);
};

const all = {
  equals: <T>() =>
    createOperator<T | Query | RawExpression>((key, value) =>
      value === null ? `${key} IS NULL` : `${key} = ${quoteValue(value)}`,
    ),
  not: <T>() =>
    createOperator<T | Query | RawExpression>((key, value) =>
      value === null ? `${key} IS NOT NULL` : `${key} <> ${quoteValue(value)}`,
    ),
  in: <T>() =>
    createOperator<T[] | Query | RawExpression>(
      (key, value) => `${key} IN ${quoteValue(value)}`,
    ),
  notIn: <T>() =>
    createOperator<T[] | Query | RawExpression>(
      (key, value) => `${key} NOT IN ${quoteValue(value)}`,
    ),
  lt: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} < ${quoteValue(value)}`,
    ),
  lte: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} <= ${quoteValue(value)}`,
    ),
  gt: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} > ${quoteValue(value)}`,
    ),
  gte: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} >= ${quoteValue(value)}`,
    ),
  contains: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} LIKE '%' || ${quoteValue(value)} || '%'`,
    ),
  containsInsensitive: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} ILIKE '%' || ${quoteValue(value)} || '%'`,
    ),
  startsWith: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} LIKE ${quoteValue(value)} || '%'`,
    ),
  startsWithInsensitive: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} ILIKE ${quoteValue(value)} || '%'`,
    ),
  endsWith: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} LIKE '%' || ${quoteValue(value)}`,
    ),
  endsWithInsensitive: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} ILIKE '%' || ${quoteValue(value)}`,
    ),
  between: <T>() =>
    createOperator<[T | Query | RawExpression, T | Query | RawExpression]>(
      (key, [from, to]) =>
        `${key} BETWEEN ${quoteValue(from)} AND ${quoteValue(to)}`,
    ),
  jsonPath: <T>() =>
    createOperator<
      [path: string, op: string, value: T | Query | RawExpression]
    >(
      (key, [path, op, value]) =>
        `jsonb_path_query_first(${key}, ${quote(
          path,
        )}) #>> '{}' ${op} ${quoteValue(value, true)}`,
    ),
  jsonSupersetOf: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} @> ${quoteValue(value, true)}`,
    ),
  jsonSubsetOf: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} <@ ${quoteValue(value, true)}`,
    ),
};

const base = <T>() => ({
  equals: all.equals<T>(),
  not: all.not<T>(),
  in: all.in<T>(),
  notIn: all.notIn<T>(),
});

const numeric = <T>() => ({
  ...base<T>(),
  lt: all.lt<T>(),
  lte: all.lte<T>(),
  gt: all.gt<T>(),
  gte: all.gte<T>(),
  between: all.between<T>(),
});

const text = <T>() => ({
  ...base<T>(),
  contains: all.contains<T>(),
  containsInsensitive: all.containsInsensitive<T>(),
  startsWith: all.startsWith<T>(),
  startsWithInsensitive: all.startsWithInsensitive<T>(),
  endsWith: all.endsWith<T>(),
  endsWithInsensitive: all.endsWithInsensitive<T>(),
});

const json = <T>() => ({
  ...base<T>(),
  jsonPath: all.jsonPath<T>(),
  jsonSupersetOf: all.jsonSupersetOf<T>(),
  jsonSubsetOf: all.jsonSubsetOf<T>(),
});

export const Operators = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any: base<any>(),
  boolean: base<boolean>(),
  number: numeric<number>(),
  date: numeric<Date>(),
  time: numeric<Date>(),
  text: text<string>(),
  json: json<unknown>(),
  // TODO: array operators
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  array: base<any>(),
};
