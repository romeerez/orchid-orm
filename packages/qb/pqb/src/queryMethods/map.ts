import {
  PickQueryReturnType,
  pushQueryValueImmutable,
  QueryColumn,
  QueryReturnTypeAll,
  QueryReturnTypeOptional,
  QueryThen,
  RecordUnknown,
} from 'orchid-core';
import { _clone } from '../query/queryUtils';

export class QueryMap {
  /**
   * Use `map` to transform individual records of a query result.
   *
   * Use `map` to transform individual records of a query result. If the query returns multiple, `map` function going to transform records one by one.
   *
   * For an optional query result (`findOptional`, `getOptional`, etc.), `map` is **not** called for empty results.
   *
   * For transforming the result of a query as a whole, consider using {@link Query.transform} instead.
   *
   * ```ts
   * // add a `titleLength` to every post
   * const posts = await db.post.limit(10).map((post) => ({
   *   ...post,
   *   titleLength: post.title.length,
   * }));
   *
   * posts[0].titleLength; // number
   *
   * // using the exact same `map` function to transform a single post
   * const singlePost = await db.post.find(id).map((post) => ({
   *   ...post,
   *   titleLength: post.title.length,
   * }));
   *
   * singlePost.titleLength; // number
   *
   * // can be used in sub-queries
   * const postsWithComments = await db.post.select('title', {
   *   comments: (q) =>
   *     q.comments.map((comment) => ({
   *       ...comment,
   *       truncatedContent: comment.content.slice(0, 100),
   *     })),
   * });
   *
   * postsWithComments[0].comments[0].truncatedContent; // string
   * ```
   *
   * @param fn - function to transform an individual record
   */
  map<T extends PickQueryReturnType, Result>(
    this: T,
    fn: // `| null` is the case of aggregations such as `sum`.
    T extends { returnType: 'valueOrThrow'; then: QueryThen<infer Data | null> }
      ? (input: Data) => Result
      : (
          input: T['returnType'] extends QueryReturnTypeAll | 'pluck'
            ? T extends { then: QueryThen<(infer Data)[]> }
              ? Data
              : never
            : // `| undefined` is needed to remove undefined type from map's arg
            T extends { then: QueryThen<infer Data | undefined> }
            ? Data
            : never,
        ) => Result,
  ): // When the map returns object, a query result is a map of key-value columns.
  // It's used to correctly infer type in case of a nested sub-query select with the map inside.
  Result extends RecordUnknown
    ? {
        [K in keyof T]: K extends 'result'
          ? { [K in keyof Result]: QueryColumn<Result[K]> }
          : K extends 'then'
          ? QueryThen<
              T['returnType'] extends QueryReturnTypeAll
                ? Result[]
                : T['returnType'] extends QueryReturnTypeOptional
                ? Result | undefined
                : Result
            >
          : T[K];
      }
    : // When the map returns a scalar value, a query type should adjust to a single value
      {
        [K in keyof T]: K extends 'returnType'
          ? T['returnType'] extends QueryReturnTypeAll | 'pluck'
            ? 'pluck'
            : T['returnType'] extends 'one'
            ? 'value'
            : 'valueOrThrow'
          : K extends 'result'
          ? T['returnType'] extends QueryReturnTypeAll | 'pluck'
            ? { pluck: QueryColumn<Result> }
            : T['returnType'] extends QueryReturnTypeOptional
            ? { value: QueryColumn<Result | undefined> }
            : {
                value: QueryColumn<
                  T extends {
                    returnType: 'valueOrThrow';
                    then: QueryThen<unknown | null>;
                  }
                    ? Result | null // aggregation such as `sum`
                    : Result
                >;
              }
          : K extends 'then'
          ? QueryThen<
              T['returnType'] extends QueryReturnTypeAll | 'pluck'
                ? Result[]
                : T['returnType'] extends QueryReturnTypeOptional
                ? Result | undefined
                : T extends {
                    returnType: 'valueOrThrow';
                    then: QueryThen<unknown | null>;
                  }
                ? Result | null
                : Result
            >
          : T[K];
      } {
    return pushQueryValueImmutable(_clone(this), 'transform', {
      map: fn,
    }) as never;
  }
}
