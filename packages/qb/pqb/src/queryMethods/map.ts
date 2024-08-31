import { Query } from '../query/query';
import { QueryColumn, QueryThen, RecordUnknown } from 'orchid-core';
import { pushQueryValue } from '../query/queryUtils';

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
  map<T extends Query, Result>(
    this: T,
    fn: (
      input: T['returnType'] extends undefined | 'all' | 'pluck'
        ? T['then'] extends QueryThen<(infer Data)[]>
          ? Data
          : never
        : // `| undefined` is needed to remove undefined type from map's arg
        T['then'] extends QueryThen<infer Data | undefined>
        ? Data
        : never,
    ) => Result,
  ): // When the map returns object, query result is a map of key-value columns.
  // It's used to correctly infer type in case of a nested sub-query select with the map inside.
  Result extends RecordUnknown
    ? {
        [K in keyof T]: K extends 'result'
          ? { [K in keyof Result]: QueryColumn<Result[K]> }
          : K extends 'then'
          ? QueryThen<
              T['returnType'] extends undefined | 'all' ? Result[] : Result
            >
          : T[K];
      }
    : // When the map returns a scalar value, query type should adjust to a single value
      {
        [K in keyof T]: K extends 'returnType'
          ? T['returnType'] extends undefined | 'all' | 'pluck'
            ? 'pluck'
            : T['returnType'] extends 'one'
            ? 'value'
            : 'valueOrThrow'
          : K extends 'result'
          ? T['returnType'] extends undefined | 'all' | 'pluck'
            ? { pluck: QueryColumn<Result> }
            : T['returnType'] extends 'one' | 'value'
            ? { value: QueryColumn<Result | undefined> }
            : { value: QueryColumn<Result> }
          : K extends 'then'
          ? QueryThen<
              T['returnType'] extends undefined | 'all' | 'pluck'
                ? Result[]
                : Result
            >
          : T[K];
      } {
    return pushQueryValue(this.clone(), 'transform', { map: fn }) as never;
  }
}
