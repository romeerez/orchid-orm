import { cloneQueryArrays, QueryData, toSqlCacheKey } from './sql';
import type { Query, Selectable } from './query';
import type { ColumnOutput, ColumnType } from './columns';
import type { RawExpression } from './raw';
export * from '../../common/utils';

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

export const getClonedQueryData = (query: QueryData): QueryData => {
  const cloned = { ...query };
  delete cloned[toSqlCacheKey];
  cloneQueryArrays(cloned);
  return cloned as QueryData;
};

export const getQueryAs = (q: { table?: string; query: { as?: string } }) => {
  return q.query.as || (q.table as string);
};

export const toArray = <T>(item: T) =>
  (Array.isArray(item) ? item : [item]) as unknown as T extends unknown[]
    ? T
    : [T];

export const noop = () => {};

export type EmptyObject = typeof emptyObject;
export const emptyObject = {};

export const makeRegexToFindInSql = (value: string) => {
  return new RegExp(`${value}(?=(?:[^']*'[^']*')*[^']*$)`, 'g');
};

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

export const EMPTY_OBJECT = {};

export const getQueryParsers = (q: Query) => {
  return q.query.parsers || q.columnsParsers;
};

export type AliasOrTable<T extends Pick<Query, 'tableAlias' | 'table'>> =
  T['tableAlias'] extends string
    ? T['tableAlias']
    : T['table'] extends string
    ? T['table']
    : never;

export type StringKey<K extends PropertyKey> = Exclude<K, symbol | number>;

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
