import { Column } from '../../../columns';
import { IsQuery, QueryReturnType } from '../../query';
import { _clone } from '../../basic-features/clone/clone';
import { QueryBatchResult } from '../../basic-features/select/select.utils';
import { pushQueryValueImmutable, QueryData } from '../../query-data';
import { QueryThen } from '../../then/then';

// result transformer: function for `transform`, object for `map`
export type QueryDataTransform =
  | QueryDataTransformFn
  | {
      map: (record: unknown, index: number, array: unknown) => unknown;
      thisArg?: unknown;
    };

interface QueryDataTransformFn {
  (data: unknown, queryData: unknown): unknown;
}

/**
 * See `transform` query method.
 * This helper applies all transform functions to a result.
 *
 * @param queryData - query data
 * @param returnType - return type of the query, for proper `map` handling
 * @param fns - array of transform functions, can be undefined
 * @param result - query result to transform
 */
export const applyTransforms = (
  queryData: unknown,
  returnType: QueryReturnType,
  fns: QueryDataTransform[],
  result: unknown,
): unknown => {
  for (const fn of fns) {
    if ('map' in fn) {
      if (!returnType || returnType === 'all' || returnType === 'pluck') {
        result = (result as unknown[]).map(fn.map, fn.thisArg);
      } else if (result !== undefined) {
        result =
          result === null ? null : fn.map.call(fn.thisArg, result, 0, result);
      }
    } else {
      result = fn(result, queryData);
    }
  }
  return result;
};

export const applyBatchTransforms = (
  q: QueryData,
  batches: QueryBatchResult[],
) => {
  if (q.transform) {
    for (const item of batches) {
      item.parent[item.key] = applyTransforms(
        q,
        q.returnType,
        q.transform,
        item.data,
      );
    }
  }
};

export class QueryTransform {
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
      queryData: QueryData,
    ) => Result,
  ): {
    [K in keyof T]: K extends 'returnType'
      ? 'valueOrThrow'
      : K extends 'result'
      ? { value: Column.Pick.QueryColumnOfType<Result> }
      : K extends 'then'
      ? QueryThen<Result>
      : T[K];
  } {
    return pushQueryValueImmutable(_clone(this), 'transform', fn) as never;
  }
}
