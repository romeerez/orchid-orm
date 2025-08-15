import { Expression, PickQueryResult } from 'orchid-core';
import { PickQueryQ, Query } from '../query/query';
import { UnionItem, UnionKind } from '../sql';
import { _clone } from '../query/queryUtils';

// argument of `union`-like query methods.
// it supports query objects with the same result as in the previous query,
// or a raw SQL
export type UnionArgs<T extends PickQueryResult> = (
  | {
      result: {
        [K in keyof T['result']]: {
          queryType: T['result'][K]['queryType'];
        };
      };
    }
  | ((q: T) => Expression)
)[];

export const _queryUnion = <T extends PickQueryResult>(
  base: T,
  args: UnionArgs<T>,
  k: UnionKind,
  p?: boolean,
  m?: boolean,
): T => {
  const query = (base as unknown as Query).baseQuery.clone();

  const u = args.map(
    (a) =>
      ({
        a: typeof a === 'function' ? a(query as never) : a,
        k,
        m,
      } as UnionItem),
  );

  const { q } = query;
  const baseQ = (base as unknown as PickQueryQ).q;

  q.union = baseQ.union
    ? {
        ...baseQ.union,
        u: [...baseQ.union.u, ...u],
      }
    : {
        b: base as never,
        u,
        p,
      };

  return query as never;
};

export class Union {
  /**
   * Creates a union query, takes one or more queries or SQL expressions.
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * // The first query of the union
   * db.one
   *   .select('id', 'name')
   *   // add two more queries to the union
   *   .union(
   *     db.two.select('id', 'name'),
   *     (q = sql`SELECT id, name FROM "thirdTable"`),
   *   )
   *   // sub-sequent `union` is equivalent to passing multiple queries into a single `union`
   *   .union(db.three.select('id', 'name'));
   * ```
   *
   * `order`, `limit`, `offset` are special, it matters if you place them **before** or **after** the `union`, it also have a meaning to place them before and after.
   *
   * ```ts
   * // order, limit, offset are applied ONLY to 'one'
   * db.one
   *   .order('x')
   *   .limit(1)
   *   .offset(1)
   *   // 'two' also has order, limit, and offset
   *   .unionAll(db.two.order('y').limit(2).offset(2))
   *   // sets order, limit, offset for all records
   *   .order('z')
   *   .limit(3)
   *   .offset(3);
   * ```
   *
   * Equivalent SQL:
   *
   * ```sql
   * -- both union parts have their own order, limit, offset
   * ( SELECT * FROM one ORDER x ASC LIMIT 1 OFFSET 1 )
   * UNION ALL
   * ( SELECT * FROM two ORDER y ASC LIMIT 2 OFFSET 2 )
   * -- order, limit, offset of the whole query
   * ORDER BY z ASC LIMIT 3 OFFSET 3
   * ```
   *
   * All the listed methods have the same signature, they are only different by SQL keyword:
   *
   * - `union` - union of all queries, performs deduplication
   * - `unionAll` - `union` that allows duplicated rows
   * - `intersect` - get only rows that are present in all queries
   * - `intersectAll` - `intersect` that allows duplicated rows
   * - `except` - get only rows that are in the first query but not in the second
   * - `exceptAll` - `except` that allows duplicated rows
   *
   * @param args - array of queries or SQL expressions
   */
  union<T extends PickQueryResult>(this: T, ...args: UnionArgs<T>): T {
    return _queryUnion(
      _clone(this),
      args as UnionArgs<Query>,
      'UNION',
    ) as never;
  }

  /**
   * Same as {@link union}, but allows duplicated rows.
   *
   * @param args - array of queries or SQL expressions
   */
  unionAll<T extends PickQueryResult>(this: T, ...args: UnionArgs<T>): T {
    return _queryUnion(
      _clone(this),
      args as UnionArgs<Query>,
      'UNION ALL',
    ) as never;
  }

  /**
   * Same as {@link union}, but uses a `INTERSECT` SQL keyword instead
   *
   * @param args - array of queries or SQL expressions
   */
  intersect<T extends PickQueryResult>(this: T, ...args: UnionArgs<T>): T {
    return _queryUnion(
      _clone(this),
      args as UnionArgs<Query>,
      'INTERSECT',
    ) as never;
  }

  /**
   * Same as {@link intersect}, but allows duplicated rows.
   *
   * @param args - array of queries or SQL expressions
   */
  intersectAll<T extends PickQueryResult>(this: T, ...args: UnionArgs<T>): T {
    return _queryUnion(
      _clone(this),
      args as UnionArgs<Query>,
      'INTERSECT ALL',
    ) as never;
  }

  /**
   * Same as {@link union}, but uses an `EXCEPT` SQL keyword instead
   *
   * @param args - array of queries or SQL expressions
   */
  except<T extends PickQueryResult>(this: T, ...args: UnionArgs<T>): T {
    return _queryUnion(
      _clone(this),
      args as UnionArgs<Query>,
      'EXCEPT',
    ) as never;
  }

  /**
   * Same as {@link except}, but allows duplicated rows.
   *
   * @param args - array of queries or SQL expressions
   */
  exceptAll<T extends PickQueryResult>(this: T, ...args: UnionArgs<T>): T {
    return _queryUnion(
      _clone(this),
      args as UnionArgs<Query>,
      'EXCEPT ALL',
    ) as never;
  }
}
