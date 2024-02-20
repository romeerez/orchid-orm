import url from 'url';
import path from 'node:path';

// It may be a value or an array of such values.
export type MaybeArray<T> = T | T[];

// Converts union to overloaded function.
type OptionalPropertyNames<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T]-?: {} extends { [P in K]: T[K] } ? K : never;
}[keyof T];

// Spread properties of two objects, if only one of properties is optional it becomes required.
type SpreadProperties<L, R, K extends keyof L & keyof R> = {
  [P in K]: L[P] | Exclude<R[P], undefined>;
};

// Copied from type-fest, not clear what it does.
type Id<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;

// Combine two object into a single.
type SpreadTwo<L, R> = Id<
  Pick<L, Exclude<keyof L, keyof R>> &
    Pick<R, Exclude<keyof R, OptionalPropertyNames<R>>> &
    Pick<R, Exclude<OptionalPropertyNames<R>, keyof L>> &
    SpreadProperties<L, R, OptionalPropertyNames<R> & keyof L>
>;

/**
 * Merge an array of object types into a single combined object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Spread<A extends readonly [...any]> = A extends [
  infer L,
  ...infer R,
]
  ? SpreadTwo<L, Spread<R>>
  : unknown;

// Simple merge two objects.
// When they have common keys, the value of the second object will be used.
export type MergeObjects<A extends RecordUnknown, B extends RecordUnknown> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? B[K]
    : K extends keyof A
    ? A[K]
    : never;
};

// Utility type to store info to know which keys are available.
// Use it for cases where you'd want to pick a string union,
// this record type solves the same use case, but is better at handling the empty case.
export interface RecordKeyTrue {
  [K: string]: true;
}

export interface RecordString {
  [K: string]: string;
}

export interface RecordUnknown {
  [K: string]: unknown;
}

// Use a default string if the first argument string is undefined.
export type CoalesceString<
  Left extends string | undefined,
  Right extends string,
> = Left extends undefined ? Right : Left;

/**
 * Merge methods from multiple class into another class.
 * @param derivedCtor - target class to merge methods into
 * @param constructors - classes to merge methods from
 */
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

/**
 * Join array of strings with '', ignoring empty strings, false, undefined.
 * @param strings - array of strings, or false, or undefined
 */
export const joinTruthy = (...strings: (string | false | undefined)[]) => {
  return strings.filter((string) => string).join('');
};

/**
 * When array is passed, it is returned as is, otherwise, returns a new array with the provided value.
 * @param item - array or a value to turn into array
 */
export const toArray = <T>(item: T) =>
  (Array.isArray(item) ? item : [item]) as unknown as T extends unknown[]
    ? T
    : [T];

// Shared doing nothing function
export const noop = () => {};

// eslint-disable-next-line @typescript-eslint/ban-types
export type EmptyObject = {};
// Shared empty object to avoid unnecessary allocations
export const emptyObject = {};

// Type of empty array
export type EmptyTuple = [];
// Shared empty array to avoid unnecessary allocations
export const emptyArray = [];

/**
 * Push value into array in the object if it's defined, or set a new array with a single value into the object.
 * @param obj - object that can contain the array by the key
 * @param key - key to access array in the object
 * @param value - value to push into the array
 */
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

/**
 * Push value into array if it's defined, or return a new array with a single value.
 * @param arr - array to push into, or `undefined`
 * @param value - value to push into the array
 */
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

/**
 * For code generation: quote a string with a single quote, escape characters.
 * @param s - string to quote
 */
export const singleQuote = (s: string) => {
  return `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
};

/**
 * For code generation: quote string with a backtick, escape characters.
 * @param s - string to quote
 */
export const backtickQuote = (s: string) => {
  return `\`${s.replaceAll('\\', '\\\\').replaceAll('`', '\\`')}\``;
};

/**
 * For code generation: stringify array of strings using a single quote.
 * @param arr
 */
export const singleQuoteArray = (arr: string[]) => {
  return `[${arr.map(singleQuote).join(', ')}]`;
};

/**
 * For code generation: some strings must be quoted when used as an object key.
 * This function quotes the strings when needed.
 * @param key - object key to quote
 */
export const quoteObjectKey = (key: string) => {
  return /[A-z_]\w*/.test(key) ? key : singleQuote(key);
};

/**
 * Check if the object has no values that are not `undefined`.
 * @param obj
 */
export const isObjectEmpty = (obj: object) => !objectHasValues(obj);

/**
 * Check if the object has at least one value that is not `undefined`.
 * Nulls counts.
 * @param obj - any object
 */
export const objectHasValues = (obj?: object) => {
  if (!obj) return false;
  for (const key in obj) {
    if (obj[key as keyof typeof obj] !== undefined) return true;
  }
  return false;
};

/**
 * If we simply log file path as it is, it may be not clickable in the terminal.
 * On Windows, it is clickable as it is, so it is returned as is.
 * On Linux (at least in my JetBrains editor terminal) it's transformed to URL format to be clickable.
 * @param path - file path
 */
export const pathToLog = (path: string) => {
  return process.platform === 'win32'
    ? path
    : url.pathToFileURL(path).toString();
};

/**
 * Translate a string to camelCase
 * @param str - string to translate
 */
export const toCamelCase = (str: string) => {
  return str
    .replace(/^_+/g, '')
    .replace(/_+./g, (a) => a[a.length - 1].toUpperCase())
    .replace(/_+$/g, '');
};

/**
 * Translate a string to a PascalCase
 * @param str - string to translate
 */
export const toPascalCase = (str: string) => {
  const camel = toCamelCase(str);
  return camel[0].toUpperCase() + camel.slice(1);
};

/**
 * Translate a string to a snake_case.
 * @param str - string to translate
 */
export const toSnakeCase = (str: string) => {
  return str.replace(/[A-Z]/g, (a) => `_${a.toLowerCase()}`);
};

/**
 * Compare two values deeply.
 * undefined and empty object are considered to be equal.
 * @param a - any value
 * @param b - any value
 */
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
      if (!deepCompare((a as RecordUnknown)[key], (b as RecordUnknown)[key]))
        return false;
    }

    for (const key in b as RecordUnknown) {
      if (!(key in a)) return false;
    }
  }

  return true;
};

/**
 * Returns a relative path to use as an `import` source to import one file from another.
 * @param from - TS file where we want to place the `import`
 * @param to - TS file that we're importing
 */
export const getImportPath = (from: string, to: string) => {
  const rel = path
    .relative(path.dirname(from), to)
    .split(path.sep)
    .join(path.posix.sep);

  const importPath =
    rel.startsWith('./') || rel.startsWith('../') ? rel : `./${rel}`;

  return importPath.replace(/\.[tj]s$/, '');
};

/**
 * Get stack trace to collect info about who called the function
 */
export const getStackTrace = (): NodeJS.CallSite[] | undefined => {
  let stack: NodeJS.CallSite[] | undefined;
  const original = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, s) => (stack = s);
  new Error().stack;
  Error.prepareStackTrace = original;
  return stack;
};

/**
 * Get a file path of the function which called the function which called this `getCallerFilePath`.
 * Determines file path by error stack trace, skips any paths that are located in `node_modules`.
 * @param stack - optionally provide an existing stack trace
 */
export const getCallerFilePath = (
  stack = getStackTrace(),
): string | undefined => {
  if (stack) {
    // file name of this file in orchid-core
    const coreLibFile = stack[0]?.getFileName();
    let i = 1;
    if (stack[1]?.getFileName() === coreLibFile) {
      i++;
    }
    // other orchid library that called the function in this file
    const libFile = stack[i]?.getFileName();
    const libDir = libFile && path.dirname(libFile);
    for (; i < stack.length; i++) {
      const item = stack[i];
      let file = item.getFileName();
      if (
        !file ||
        // skip files in the caller orchid library
        path.dirname(file) === libDir ||
        // skip any files in the node_modules
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

/**
 * Call function passing `this` as an argument,
 * micro-optimization for `map` and `forEach` to not define temporary inline function
 * ```ts
 * arrayOfFns.map(callWithThis, argument)
 * ```
 * @param cb
 */
export const callWithThis = function <T, R>(this: T, cb: (arg: T) => R): R {
  return cb(this);
};

export const cloneInstance = <T>(instance: T): T => {
  return Object.assign(
    Object.create(Object.getPrototypeOf(instance)),
    instance,
  );
};

export const pick = <T, Keys extends keyof T>(
  obj: T,
  keys: Keys[],
): Pick<T, Keys> => {
  const res = {} as T;
  for (const key of keys) {
    res[key] = obj[key];
  }
  return res;
};

export const omit = <T, Keys extends keyof T>(
  obj: T,
  keys: Keys[],
): Omit<T, Keys> => {
  const res = { ...obj };
  for (const key of keys) {
    delete res[key];
  }
  return res;
};
