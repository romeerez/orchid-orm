import { Query } from '../query';
import { SelectAggMethods } from './aggregate';
import { ColumnTypeBase, Expression, TemplateLiteralArgs } from 'orchid-core';
import { pushQueryValue } from '../queryDataUtils';
import { getSubQueryBuilder } from '../subQueryBuilder';

// Arguments of `having`:
// can be a SQL template literal or one or multiple callbacks returning a boolean expression.
type HavingArgs<T extends Query> = TemplateLiteralArgs | HavingArgFn<T>[];

// Function argument of `having`:
// the same query builder as in `select` is passed in, boolean expression is expected to be returned.
type HavingArgFn<T extends Query> = (
  q: SelectAggMethods<T>,
) => Expression<ColumnTypeBase<boolean | null>>;

export class Having {
  /**
   * Build a `HAVING` clause to the query to filter records by results of [aggregate functions](#aggregate-functions).
   *
   * The argument of `having` is a function where you call the aggregate function and compare it with some value by using [column operators](/guide/where.html#column-operators).
   *
   * ```ts
   * db.table.having((q) => q.count().gte(10));
   * // HAVING count(*) >= 10
   * ```
   *
   * Alternatively, it accepts a raw SQL template:
   *
   * ```ts
   * db.table.having`count(*) >= ${10}`;
   * ```
   *
   * Multiple having conditions will be combined with `AND`:
   *
   * ```ts
   * db.table.having(
   *   (q) => q.sum('column').gt(5),
   *   (q) => q.avg('column').lt(10),
   * );
   * // HAVING sum(column) > 5 AND avg(column) < 10
   * ```
   *
   * After applying a comparison, `or` and `and` methods become available:
   *
   * ```ts
   * db.table.having((q) =>
   *   q.sum('column').equals(5).or(q.min('column').gt(1), q.max('column').lt(10)),
   * );
   * // HAVING (sum(column) = 5) OR (min(column) > 1 AND max(column) < 10)
   * ```
   *
   * Aggregate functions are exactly the same functions described in [aggregate functions](#aggregate-functions), they can accept aggregation options:
   *
   * ```ts
   * db.table.having((q) =>
   *   q
   *     .count('id', {
   *       distinct: true,
   *       order: { createdAt: 'DESC', filter: { someColumn: { not: null } } },
   *     })
   *     .gte(10),
   * );
   * ```
   *
   * Arguments of the aggregate function and of the comparison can be raw SQL:
   *
   * ```ts
   * db.table.having((q) => q.count(q.sql('coalesce(one, two)')).gte(q.sql`2 + 2`));
   * ```
   *
   * @param args - raw SQL template string or one or multiple callbacks returning a boolean expression
   */
  having<T extends Query>(this: T, ...args: HavingArgs<T>): T {
    return this.clone()._having(...args);
  }
  _having<T extends Query>(this: T, ...args: HavingArgs<T>): T {
    let data;
    if ('raw' in args[0]) {
      data = args;
    } else {
      const qb = getSubQueryBuilder(this);
      data = args.map((arg) => (arg as HavingArgFn<T>)(qb));
    }
    return pushQueryValue(this, 'having', data);
  }
}
