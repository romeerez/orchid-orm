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
  map<T extends Query, Result extends RecordUnknown>(
    this: T,
    fn: (
      input: T['returnType'] extends undefined | 'all'
        ? T['then'] extends QueryThen<(infer Data)[]>
          ? Data
          : never
        : T['then'] extends QueryThen<infer Data>
        ? Data
        : never,
    ) => Result,
  ): {
    [K in keyof T]: K extends 'result'
      ? { [K in keyof Result]: QueryColumn<Result[K]> }
      : K extends 'then'
      ? QueryThen<T['returnType'] extends undefined | 'all' ? Result[] : Result>
      : T[K];
  } {
    return pushQueryValue(this.clone(), 'transform', { map: fn }) as never;
  }
}
