import { RawExpression } from './common';
import { QueryData } from './sql';

export type MaybeArray<T> = T | T[];

export type SetOptional<T, K extends PropertyKey> = Omit<T, K> & {
  [P in K]?: P extends keyof T ? T[P] : never;
};

export type GetTypesOrRaw<T extends [...unknown[]]> = T extends [
  infer Head,
  ...infer Tail,
]
  ? [GetTypeOrRaw<Head>, ...GetTypesOrRaw<Tail>]
  : [];

export type GetTypeOrRaw<T> = T | RawExpression;

// credits goes to https://stackoverflow.com/a/50375286
export type UnionToIntersection<U> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I
    : never;

// Converts union to overloaded function
export type UnionToOvlds<U> = UnionToIntersection<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  U extends any ? (f: U) => void : never
>;

type PopPropertyKeyUnion<U> = UnionToOvlds<U> extends (
  a: infer A extends PropertyKey,
) => void
  ? A
  : never;

type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

export type PropertyKeyUnionToArray<
  T,
  A extends PropertyKey[] = [],
> = IsUnion<T> extends true
  ? PropertyKeyUnionToArray<
      Exclude<T, PopPropertyKeyUnion<T>>,
      [PopPropertyKeyUnion<T>, ...A]
    >
  : [T, ...A];

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

export const getClonedQueryData = (query: QueryData): QueryData => {
  const cloned = { ...query };

  for (const key in query) {
    if (Array.isArray(query[key as keyof QueryData])) {
      (cloned as Record<string, unknown>)[key] = [
        ...(query[key as keyof QueryData] as unknown[]),
      ];
    }
  }

  return cloned;
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
