import { quote } from './quote';

type Fn<T> = (key: string, value: T) => string;

export type Operator<T> = Fn<T> & { type: T };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Operators = Record<string, Operator<any>>;

export const createOperator = <T>(fn: Fn<T>) => {
  return Object.assign(fn, { type: undefined as unknown as T });
};

const all = {
  equals: <T>() =>
    createOperator((key: string, value: T) => {
      return `${key} = ${quote(value)}`;
    }),
  not: <T>() =>
    createOperator((key: string, value: T) => {
      return `${key} <> ${quote(value)}`;
    }),
  in: <T>() =>
    createOperator((key: string, value: T[]) => {
      return `${key} IN (${value.map(quote).join(', ')})`;
    }),
  notIn: <T>() =>
    createOperator((key: string, value: T[]) => {
      return `${key} NOT IN (${value.map(quote).join(', ')})`;
    }),
  lt: <T>() =>
    createOperator((key: string, value: T) => {
      return `${key} < ${quote(value)}`;
    }),
  lte: <T>() =>
    createOperator((key: string, value: T) => {
      return `${key} <= ${quote(value)}`;
    }),
  gt: <T>() =>
    createOperator((key: string, value: T) => {
      return `${key} > ${quote(value)}`;
    }),
  gte: <T>() =>
    createOperator((key: string, value: T) => {
      return `${key} >= ${quote(value)}`;
    }),
  contains: <T>() =>
    createOperator((key: string, value: T) => {
      return `${key} LIKE ${quote(`%${value}%`)}`;
    }),
  containsInsensitive: <T>() =>
    createOperator((key: string, value: T) => {
      return `${key} ILIKE ${quote(`%${value}%`)}`;
    }),
  startsWith: <T>() =>
    createOperator((key: string, value: T) => {
      return `${key} LIKE ${quote(`${value}%`)}`;
    }),
  startsWithInsensitive: <T>() =>
    createOperator((key: string, value: T) => {
      return `${key} ILIKE ${quote(`${value}%`)}`;
    }),
  endsWith: <T>() =>
    createOperator((key: string, value: T) => {
      return `${key} LIKE ${quote(`%${value}`)}`;
    }),
  endsWithInsensitive: <T>() =>
    createOperator((key: string, value: T) => {
      return `${key} ILIKE ${quote(`%${value}`)}`;
    }),
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
};
