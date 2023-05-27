import url from 'url';
import path from 'node:path';

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

// simple merge two objects
// when they have common keys, the value of the second object will be used
export type MergeObjects<
  A extends Record<string, unknown>,
  B extends Record<string, unknown>,
> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? B[K]
    : K extends keyof A
    ? A[K]
    : never;
};

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

export type EmptyTuple = [];
export const emptyArray = [];

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

export const backtickQuote = (s: string) => {
  return `\`${s.replaceAll('\\', '\\\\').replaceAll('`', '\\`')}\``;
};

export const singleQuoteArray = (arr: string[]) => {
  return `[${arr.map(singleQuote).join(', ')}]`;
};

export const quoteObjectKey = (s: string) => {
  return /[A-z_]\w*/.test(s) ? s : singleQuote(s);
};

export const isObjectEmpty = (obj: object) => {
  for (const key in obj) {
    if (obj[key as keyof typeof obj] !== undefined) return false;
  }
  return true;
};

export const objectHasValues = (obj?: object) => {
  if (!obj) return false;
  for (const key in obj) {
    if (obj[key as keyof typeof obj] !== undefined) return true;
  }
  return false;
};

export const pathToLog = (path: string) => {
  return process.platform === 'win32'
    ? path
    : url.pathToFileURL(path).toString();
};

export const toCamelCase = (str: string) => {
  return str
    .replace(/^_+/g, '')
    .replace(/_+./g, (a) => a[a.length - 1].toUpperCase())
    .replace(/_+$/g, '');
};

export const toPascalCase = (str: string) => {
  const camel = toCamelCase(str);
  return camel[0].toUpperCase() + camel.slice(1);
};

export const toSnakeCase = (str: string) => {
  return str.replace(/[A-Z]/g, (a) => `_${a.toLowerCase()}`);
};

// undefined and empty object are considered to be equal
export const deepCompare = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;

  if (typeof a !== typeof b) {
    if (a === undefined && typeof b === 'object') {
      a = emptyObject;
    } else if (typeof a === 'object' && b === undefined) {
      b = emptyObject;
    } else {
      return false;
    }
  }

  if (typeof a === 'object') {
    if (a === null) return b === null;

    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;

      return a.every((item, i) => deepCompare(item, (b as unknown[])[i]));
    }

    for (const key in a) {
      if (
        !deepCompare(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        )
      )
        return false;
    }

    for (const key in b as Record<string, unknown>) {
      if (!(key in a)) return false;
    }
  }

  return true;
};

export const getImportPath = (from: string, to: string) => {
  const rel = path
    .relative(path.dirname(from), to)
    .split(path.sep)
    .join(path.posix.sep);

  const importPath =
    rel.startsWith('./') || rel.startsWith('../') ? rel : `./${rel}`;

  return importPath.replace(/\.[tj]s$/, '');
};

export const getCallerFilePath = (): string | undefined => {
  let stack: NodeJS.CallSite[] | undefined;
  const original = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, s) => (stack = s);
  new Error().stack;
  Error.prepareStackTrace = original;

  if (stack) {
    const libFile = stack[1]?.getFileName();
    const libDir = libFile && path.dirname(libFile);
    for (let i = 2; i < stack.length; i++) {
      const item = stack[i];
      let file = item.getFileName();
      if (
        !file ||
        path.dirname(file) === libDir ||
        /\bnode_modules\b/.test(file)
      ) {
        continue;
      }

      // on Windows with ESM file is file:///C:/path/to/file.ts
      // it is not a valid URL
      if (/file:\/\/\/\w+:\//.test(file)) {
        file = decodeURI(file.slice(8));
      } else {
        try {
          file = new URL(file).pathname;
        } catch (_) {}
      }

      return file;
    }
  }

  return;
};
