import { SingleSqlItem } from './query';
export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
export type MaybeArray<T> = T | T[];
export type MaybePromise<T> = T | Promise<T>;
export interface FnUnknownToUnknown {
    (a: unknown): unknown;
}
export interface RecordKeyTrue {
    [K: string]: true;
}
export interface RecordString {
    [K: string]: string;
}
export interface RecordStringOrNumber {
    [K: string]: string | number;
}
export interface RecordOptionalString {
    [K: string]: string | undefined;
}
export interface RecordUnknown {
    [K: string]: unknown;
}
export interface RecordBoolean {
    [K: string]: boolean;
}
export type ShallowSimplify<T> = T extends any ? {
    [K in keyof T]: T[K];
} : T;
/**
 * Merge methods from multiple class into another class.
 * @param derivedCtor - target class to merge methods into
 * @param constructors - classes to merge methods from
 */
export declare function applyMixins(targetClass: any, mixinClasses: any[]): void;
/**
 * Join array of strings with '', ignoring empty strings, false, undefined.
 * @param strings - array of strings, or false, or undefined
 */
export declare const joinTruthy: (...strings: (string | false | undefined)[]) => string;
/**
 * When array is passed, it is returned as is, otherwise, returns a new array with the provided value.
 * @param item - array or a value to turn into array
 */
export declare const toArray: <T>(item: T) => T extends unknown[] ? T : [T];
export declare const noop: () => void;
export declare const returnArg: <T>(a: T) => T;
export type EmptyObject = {};
export declare const emptyObject: {};
export type EmptyTuple = [];
export declare const emptyArray: never[];
/**
 * Push a value into an array in the object if it's defined, or set a new array with a single value into the object.
 * Does not mutate the array.
 *
 * @param obj - object that can contain the array by the key
 * @param key - key to access an array in the object
 * @param value - value to push into the array
 */
export declare const pushOrNewArrayToObjectImmutable: (obj: object, key: string | number, value: unknown) => void;
/**
 * Set value into the object in data, create the object if it doesn't yet exist.
 * Does not mutate the object.
 *
 * @param q - object
 * @param object - query data key to get the object
 * @param key - object key to set the value into
 * @param value - value to set by the key
 */
export declare const setObjectValueImmutable: <T>(q: T, object: string, key: PropertyKey, value: unknown) => T;
export declare const spreadObjectValues: (q: object, object: string, value: RecordUnknown) => void;
/**
 * Push value into an array if it's defined, or return a new array with a single value.
 * @param arr - array to push into, or `undefined`
 * @param value - value to push into the array
 */
export declare const pushOrNewArray: <Arr extends unknown[]>(arr: Arr | undefined, value: Arr[number]) => Arr;
/**
 * For code generation: quote a string with a single quote, escape characters.
 * @param s - string to quote
 */
export declare const singleQuote: (s: string) => string;
/**
 * For code generation: quote string with a backtick, escape characters.
 * @param s - string to quote
 */
export declare const backtickQuote: (s: string) => string;
/**
 * For code generation: stringify array of strings using a single quote.
 * @param arr
 */
export declare const singleQuoteArray: (arr: string[]) => string;
/**
 * For code generation: some strings must be quoted when used as an object key.
 * This function quotes the strings when needed.
 * @param key - object key to quote
 * @param toCamel - change to camel case
 */
export declare const quoteObjectKey: (key: string, toCamel: boolean | undefined) => string;
/**
 * Check if the object has no values that are not `undefined`.
 * @param obj
 */
export declare const isObjectEmpty: (obj: object) => boolean;
/**
 * Check if the object has at least one value that is not `undefined`.
 * Nulls counts.
 * @param obj - any object
 */
export declare const objectHasValues: (obj?: object) => boolean;
/**
 * If we simply log file path as it is, it may be not clickable in the terminal.
 * On Windows, it is clickable as it is, so it is returned as is.
 * On Linux (at least in my JetBrains editor terminal) it's transformed to URL format to be clickable.
 * @param path - file path
 */
export declare const pathToLog: (path: string) => string;
/**
 * Translate a string to camelCase
 * @param str - string to translate
 */
export declare const toCamelCase: (str: string) => string;
/**
 * Translate a string to a PascalCase
 * @param str - string to translate
 */
export declare const toPascalCase: (str: string) => string;
/**
 * Translate a string to a snake_case.
 * @param str - string to translate
 */
export declare const toSnakeCase: (str: string) => string;
/**
 * Compare two values deeply.
 * undefined and empty object are considered to be equal.
 * @param a - any value
 * @param b - any value
 */
export declare const deepCompare: (a: unknown, b: unknown) => boolean;
/**
 * Returns a relative path to use as an `import` source to import one file from another.
 * @param from - TS file where we want to place the `import`
 * @param to - TS file that we're importing
 */
export declare const getImportPath: (from: string, to: string) => string;
/**
 * Get stack trace to collect info about who called the function
 */
export declare const getStackTrace: () => NodeJS.CallSite[] | undefined;
/**
 * Get a file path of the function which called the function which called this `getCallerFilePath`.
 * Determines file path by error stack trace, skips any paths that are located in `node_modules`.
 * @param stack - optionally provide an existing stack trace
 */
export declare const getCallerFilePath: (stack?: NodeJS.CallSite[] | undefined) => string | undefined;
/**
 * Call function passing `this` as an argument,
 * micro-optimization for `map` and `forEach` to not define temporary inline function
 * ```ts
 * arrayOfFns.map(callWithThis, argument)
 * ```
 * @param cb
 */
export declare const callWithThis: <T, R>(this: T, cb: (arg: T) => R) => R;
export declare const pick: <T, Keys extends keyof T>(obj: T, keys: Keys[]) => Pick<T, Keys>;
export declare const omit: <T, Keys extends keyof T>(obj: T, keys: Keys[]) => Omit<T, Keys>;
export declare const addValue: (values: unknown[], value: unknown) => string;
export declare const getFreeAlias: (obj: RecordUnknown | undefined, as: string) => string;
export declare const setFreeAlias: (obj: RecordUnknown, as: string, value: unknown) => string;
export declare const getFreeSetAlias: (set: Set<string>, as: string, start?: number) => string;
export declare const exhaustive: (_: never) => never;
export declare const pluralize: (w: string, count: number, append?: string) => string;
export declare const isIterable: (x: unknown) => x is Iterable<unknown>;
export declare const colors: {
    yellow: (s: string) => string;
    green: (s: string) => string;
    red: (s: string) => string;
    blue: (s: string) => string;
    bright: (s: string) => string;
    blueBold: (s: string) => string;
    yellowBold: (s: string) => string;
    greenBold: (s: string) => string;
    pale: (s: string) => string;
};
export declare const commitSql: SingleSqlItem;
export declare const rollbackSql: SingleSqlItem;
export declare const quoteIdentifier: (role: string) => string;
