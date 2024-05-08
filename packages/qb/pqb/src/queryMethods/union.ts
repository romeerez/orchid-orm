import { pushQueryArray } from '../query/queryUtils';
import { Expression, PickQueryResult } from 'orchid-core';
import { Query } from '../query/query';

// argument of `union`-like query methods.
// it supports query objects with the same result as in the previous query,
// or a raw SQL
export type UnionArg<T extends PickQueryResult> =
  | {
      result: {
        [K in keyof T['result']]: {
          dataType: T['result'][K]['dataType'];
        };
      };
    }
  | Expression;

export class Union {
  /**
   * Creates a union query, taking an array or a list of callbacks, builders, or raw statements to build the union statement, with optional boolean `wrap`.
   * If the `wrap` parameter is true, the queries will be individually wrapped in parentheses.
   *
   * ```ts
   * SomeTable.select('id', 'name').union(
   *   [
   *     OtherTable.select('id', 'name'),
   *     SomeTable.sql`SELECT id, name FROM "thirdTable"`,
   *   ],
   *   true, // optional wrap parameter
   * );
   * ```
   *
   * @param args - array of queries or raw SQLs
   * @param wrap - provide `true` if you want the queries to be wrapped into parentheses
   */
  union<T extends PickQueryResult>(
    this: T,
    args: UnionArg<T>[],
    wrap?: boolean,
  ): T {
    return pushQueryArray(
      (this as unknown as Query).clone(),
      'union',
      args.map((arg) => ({ arg, kind: 'UNION' as const, wrap })),
    ) as never;
  }

  /**
   * Same as `union`, but allows duplicated rows.
   *
   * @param args - array of queries or raw SQLs
   * @param wrap - provide `true` if you want the queries to be wrapped into parentheses
   */
  unionAll<T extends PickQueryResult>(
    this: T,
    args: UnionArg<T>[],
    wrap?: boolean,
  ): T {
    return pushQueryArray(
      (this as unknown as Query).clone(),
      'union',
      args.map((arg) => ({ arg, kind: 'UNION ALL' as const, wrap })),
    ) as never;
  }

  /**
   * Same as `union`, but uses a `INTERSECT` SQL keyword instead
   *
   * @param args - array of queries or raw SQLs
   * @param wrap - provide `true` if you want the queries to be wrapped into parentheses
   */
  intersect<T extends PickQueryResult>(
    this: T,
    args: UnionArg<T>[],
    wrap?: boolean,
  ): T {
    return pushQueryArray(
      (this as unknown as Query).clone(),
      'union',
      args.map((arg) => ({ arg, kind: 'INTERSECT' as const, wrap })),
    ) as never;
  }

  /**
   * Same as `intersect`, but allows duplicated rows.
   *
   * @param args - array of queries or raw SQLs
   * @param wrap - provide `true` if you want the queries to be wrapped into parentheses
   */
  intersectAll<T extends PickQueryResult>(
    this: T,
    args: UnionArg<T>[],
    wrap?: boolean,
  ): T {
    return pushQueryArray(
      (this as unknown as Query).clone(),
      'union',
      args.map((arg) => ({ arg, kind: 'INTERSECT ALL' as const, wrap })),
    ) as never;
  }

  /**
   * Same as `union`, but uses an `EXCEPT` SQL keyword instead
   *
   * @param args - array of queries or raw SQLs
   * @param wrap - provide `true` if you want the queries to be wrapped into parentheses
   */
  except<T extends PickQueryResult>(
    this: T,
    args: UnionArg<T>[],
    wrap?: boolean,
  ): T {
    return pushQueryArray(
      (this as unknown as Query).clone(),
      'union',
      args.map((arg) => ({ arg, kind: 'EXCEPT' as const, wrap })),
    ) as never;
  }

  /**
   * Same as `except`, but allows duplicated rows.
   *
   * @param args - array of queries or raw SQLs
   * @param wrap - provide `true` if you want the queries to be wrapped into parentheses
   */
  exceptAll<T extends PickQueryResult>(
    this: T,
    args: UnionArg<T>[],
    wrap?: boolean,
  ): T {
    return pushQueryArray(
      (this as unknown as Query).clone(),
      'union',
      args.map((arg) => ({ arg, kind: 'EXCEPT ALL' as const, wrap })),
    ) as never;
  }
}
