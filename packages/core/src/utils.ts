import url from 'url';

export type StringKey<K extends PropertyKey> = Exclude<K, symbol | number>;

export type SomeIsTrue<T extends unknown[]> = T extends [
  infer Head,
  ...infer Tail,
]
  ? Head extends true
    ? true
    : SomeIsTrue<Tail>
  : false;

export type MaybeArray<T> = T | T[];

export type SetOptional<T, K extends PropertyKey> = Omit<T, K> & {
  [P in K]?: P extends keyof T ? T[P] : never;
};

// Converts union to overloaded function
type OptionalPropertyNames<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T]-?: {} extends { [P in K]: T[K] } ? K : never;
}[keyof T];

type SpreadProperties<L, R, K extends keyof L & keyof R> = {
  [P in K]: L[P] | Exclude<R[P], undefined>;
};

type Id<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;

type SpreadTwo<L, R> = Id<
  Pick<L, Exclude<keyof L, keyof R>> &
    Pick<R, Exclude<keyof R, OptionalPropertyNames<R>>> &
    Pick<R, Exclude<OptionalPropertyNames<R>, keyof L>> &
    SpreadProperties<L, R, OptionalPropertyNames<R> & keyof L>
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Spread<A extends readonly [...any]> = A extends [
  infer L,
  ...infer R,
]
  ? SpreadTwo<L, Spread<R>>
  : unknown;

export type SimpleSpread<A extends readonly [...any]> = A extends [
  infer L,
  ...infer R,
]
  ? L & SimpleSpread<R>
  : // eslint-disable-next-line @typescript-eslint/ban-types
    {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilterTuple<T extends readonly any[], E> = T extends [
  infer F,
  ...infer R,
]
  ? [F] extends [E]
    ? [F, ...FilterTuple<R, E>]
    : FilterTuple<R, E>
  : [];

export type CoalesceString<
  Left extends string | undefined,
  Right extends string,
> = Left extends undefined ? Right : Left;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
          Object.create(null),
      );
    });
  });
}

export const joinTruthy = (...strings: (string | false | undefined)[]) => {
  return strings.filter((string) => string).join('');
};

export const toArray = <T>(item: T) =>
  (Array.isArray(item) ? item : [item]) as unknown as T extends unknown[]
    ? T
    : [T];

export const noop = () => {};

export type EmptyObject = typeof emptyObject;
export const emptyObject = {};

export const pushOrNewArrayToObject = <
  Obj extends EmptyObject,
  Key extends keyof Obj,
>(
  obj: Obj,
  key: Key,
  value: Exclude<Obj[Key], undefined> extends unknown[]
    ? Exclude<Obj[Key], undefined>[number]
    : never,
) => {
  if (obj[key]) (obj[key] as unknown as unknown[]).push(value);
  else (obj[key] as unknown as unknown[]) = [value];
};

export const pushOrNewArray = <Arr extends unknown[]>(
  arr: Arr | undefined,
  value: Arr[number],
): Arr => {
  if (arr) {
    arr.push(value);
    return arr;
  } else {
    return [value] as Arr;
  }
};

export const singleQuote = (s: string) => {
  return `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
};

export const singleQuoteArray = (arr: string[]) => {
  return `[${arr.map(singleQuote).join(', ')}]`;
};

export const quoteObjectKey = (s: string) => {
  return /[A-z_]\w*/.test(s) ? s : singleQuote(s);
};

export const isObjectEmpty = (obj: object) => {
  for (const _ in obj) {
    return false;
  }
  return true;
};

export const pathToLog = (path: string) => {
  return process.platform === 'win32'
    ? path
    : url.pathToFileURL(path).toString();
};

export const toCamelCase = (str: string) => {
  return str
    .replace(/^_+/, '')
    .replace(/_+./, (a) => a[a.length - 1].toUpperCase())
    .replace(/_+$/, '');
};

export const toSnakeCase = (str: string) => {
  return str.replace(/[A-Z]/g, (a) => `_${a.toLowerCase()}`);
};
