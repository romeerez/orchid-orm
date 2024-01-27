import { Query } from '../query/query';
import { QueryCatch, QueryColumn, QueryThen } from 'orchid-core';
import { pushQueryValue } from '../query/queryUtils';
import { QueryBase } from '../query/queryBase';

// A function type to transfer query result with.
// `input` type is inferred from a query `catch` method,
// it is a result of the query before transform.
export type QueryTransformFn<T extends Query> = (
  input: T['catch'] extends QueryCatch<infer Data> ? Data : never,
) => unknown;

// Type of query after applying a `transform`.
// Changes the `returnType` to `valueOrThrow`,
// because it's always returning a single value - the result of the transform function.
// Changes the query result to a type returned by the transform function.
export type QueryTransform<
  T extends QueryBase,
  Fn extends QueryTransformFn<Query>,
  Data = ReturnType<Fn>,
> = {
  [K in keyof QueryBase]: K extends 'returnType'
    ? 'valueOrThrow'
    : K extends 'result'
    ? { value: QueryColumn<Data> }
    : T[K];
} & {
  then: QueryThen<Data>;
  catch: QueryCatch<Data>;
};

export class TransformMethods {
  /**
   * Transform the result of the query right after loading it.
   *
   * `transform` method should be called in the last order, other methods can't be chained after calling it.
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
  transform<T extends Query, Fn extends QueryTransformFn<T>>(
    this: T,
    fn: Fn,
  ): QueryTransform<T, Fn> {
    return pushQueryValue(this.clone(), 'transform', fn) as QueryTransform<
      T,
      Fn
    >;
  }
}
