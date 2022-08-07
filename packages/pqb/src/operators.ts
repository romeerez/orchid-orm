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

const quoteValue = (arg: unknown): string => {
  if (arg && typeof arg === 'object') {
    if (Array.isArray(arg)) {
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
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} = ${quoteValue(value)}`,
    ),
  not: <T>() =>
    createOperator<T | Query | RawExpression>(
      (key, value) => `${key} <> ${quoteValue(value)}`,
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

export const Operators = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any: base<any>(),
  boolean: base<boolean>(),
  number: numeric<number>(),
  date: numeric<Date>(),
  time: numeric<Date>(),
  text: text<string>(),
  // TODO: json operators
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: base<any>(),
  // TODO: array operators
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  array: base<any>(),
};
