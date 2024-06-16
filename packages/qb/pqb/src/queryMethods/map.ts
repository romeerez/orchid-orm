import { Query, QueryReturnsAll } from '../query/query';
import { QueryColumn, QueryThen, RecordUnknown } from 'orchid-core';
import { pushQueryValue } from '../query/queryUtils';

export class QueryMap {
  /**
   * Use `map` to transform individual records of a query result.
   *
   * It accepts a single record and should return a single transformed record.
   *
   * For transforming the whole result of a query, consider using [transform](#transform) instead.
   *
   * The [hooks](/guide/hooks) that are going to run after the query will receive the query result **before** transformation.
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
      input: QueryReturnsAll<T['returnType']> extends true
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
      ? QueryThen<
          QueryReturnsAll<T['returnType']> extends true ? Result[] : Result
        >
      : T[K];
  } {
    return pushQueryValue(this.clone(), 'transform', { map: fn }) as never;
  }
}
