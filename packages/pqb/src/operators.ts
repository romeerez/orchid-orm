type Fn = (key: string, value: string) => string;

export type Operator<T> = Fn & { type: T };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Operators = Record<string, Operator<any>>;

export const createOperator = <T>(fn: Fn) => {
  return Object.assign(fn, { type: undefined as unknown as T });
};

const all = {
  equals: <T>() => createOperator<T>((key, value) => `${key} = ${value}`),
  not: <T>() => createOperator<T>((key, value) => `${key} <> ${value}`),
  in: <T>() => createOperator<T[]>((key, value) => `${key} IN ${value}`),
  notIn: <T>() => createOperator<T[]>((key, value) => `${key} NOT IN ${value}`),
  lt: <T>() => createOperator<T>((key, value) => `${key} < ${value}`),
  lte: <T>() => createOperator<T>((key, value) => `${key} <= ${value}`),
  gt: <T>() => createOperator<T>((key, value) => `${key} > ${value}`),
  gte: <T>() => createOperator<T>((key, value) => `${key} >= ${value}`),
  contains: <T>() =>
    createOperator<T>((key, value) => `${key} LIKE '%' || ${value} || '%'`),
  containsInsensitive: <T>() =>
    createOperator<T>((key, value) => `${key} ILIKE '%' || ${value} || '%'`),
  startsWith: <T>() =>
    createOperator<T>((key, value) => `${key} LIKE ${value} || '%'`),
  startsWithInsensitive: <T>() =>
    createOperator<T>((key, value) => `${key} ILIKE ${value} || '%'`),
  endsWith: <T>() =>
    createOperator<T>((key, value) => `${key} LIKE '%' || ${value}`),
  endsWithInsensitive: <T>() =>
    createOperator<T>((key, value) => `${key} ILIKE '%' || ${value}`),
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
  // TODO: json operators
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: base<any>(),
  // TODO: array operators
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  array: base<any>(),
};
