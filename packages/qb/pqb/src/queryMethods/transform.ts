import { IsQuery, QueryColumn, QueryThen } from 'orchid-core';
import { _clone, pushQueryValue } from '../query/queryUtils';

export class TransformMethods {
  /**
   * Transform the result of the query right after loading it.
   *
   * `transform` method should be called in the last order, other methods can't be chained after calling it.
   *
   * It is meant to transform the whole result of a query, for transforming individual records consider using {@link QueryMap.map}.
   *
   * The [hooks](/guide/hooks.html) that are going to run after the query will receive the query result **before** transferring.
   *
   * Consider the following example of a cursor-based pagination by `id`:
   *
   * ```ts
   * const lastId: number | undefined = req.query.cursor;
   *
   * type Result = {
   *   nodes: { id: number; text: string }[];
   *   cursor?: number;
   * };
   *
   * // result is only for demo, it will be inferred
   * const posts: Result = await db.post
   *   .select('id', 'text')
   *   .where({ id: { lt: lastId } })
   *   .order({ id: 'DESC' })
   *   .limit(100)
   *   .transform((nodes) => ({ nodes, cursor: nodes.at(-1)?.id }));
   * ```
   *
   * You can also use the `tranform` on nested sub-queries:
   *
   * ```ts
   * type Result = {
   *   nodes: {
   *     id: number;
   *     text: string;
   *     comments: { nodes: { id: number; text: string }[]; cursor?: number };
   *   }[];
   *   cursor?: number;
   * };
   *
   * const postsWithComments: Result = await db.post
   *   .select('id', 'text')
   *   .select({
   *     comments: (q) =>
   *       q.comments
   *         .select('id', 'text')
   *         .transform((nodes) => ({ nodes, cursor: nodes.at(-1)?.id })),
   *   })
   *   .transform((nodes) => ({ nodes, cursor: nodes.at(-1)?.id }));
   * ```
   *
   * @param fn - function to transform query result with
   */
  transform<T extends IsQuery, Result>(
    this: T,
    fn: (
      input: T extends { then: QueryThen<infer Data> } ? Data : never,
    ) => Result,
  ): {
    [K in keyof T]: K extends 'returnType'
      ? 'valueOrThrow'
      : K extends 'result'
      ? { value: QueryColumn<Result> }
      : K extends 'then'
      ? QueryThen<Result>
      : T[K];
  } {
    return pushQueryValue(_clone(this), 'transform', fn) as never;
  }
}
