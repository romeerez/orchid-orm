import {
  PickQueryResult,
  PickQuerySelectable,
  PickQueryTsQuery,
} from '../../pick-query-types';
import { Expression } from '../../expressions/expression';
import { pushQueryArrayImmutable } from '../../query.utils';
import { _clone } from '../clone/clone';
import { SQLQueryArgs } from '../../db-sql-query';
import { sqlQueryArgsToExpression } from '../../expressions/raw-sql';
import { OrderTsQueryConfig } from '../../extra-features/search/search.sql';
import { SortDir } from './order.sql';
import { pushQueryValueImmutable } from '../../query-data';

export interface OrderArgSelf
  extends PickQuerySelectable,
    PickQueryResult,
    PickQueryTsQuery {}

export type OrderArg<T extends OrderArgSelf> =
  | OrderArgKey<T>
  | OrderArgTsQuery<T>
  | {
      [K in OrderArgKey<T> | OrderArgTsQuery<T>]?: K extends OrderArgTsQuery<T>
        ? OrderTsQueryConfig
        : SortDir;
    }
  | Expression;

export type OrderArgs<T extends OrderArgSelf> = OrderArg<T>[];

type OrderArgTsQuery<T extends OrderArgSelf> =
  | string
  | undefined extends T['__tsQuery']
  ? never
  : Exclude<T['__tsQuery'], undefined>;

type OrderArgKey<T extends OrderArgSelf> =
  | {
      // filter out runtime computed selectables
      [K in keyof T['__selectable']]: T['__selectable'][K]['column']['queryType'] extends undefined
        ? never
        : K;
    }[keyof T['__selectable']]
  // separate mappings are better than a single combined
  | {
      [K in keyof T['result']]: T['result'][K]['dataType'] extends
        | 'array'
        | 'object'
        | 'runtimeComputed'
        ? never
        : K;
    }[keyof T['result']];

export class QueryOrder {
  /**
   * Adds an order by clause to the query.
   *
   * Takes one or more arguments, each argument can be a column name or an object.
   *
   * ```ts
   * db.table.order('id', 'name'); // ASC by default
   *
   * db.table.order({
   *   id: 'ASC', // or DESC
   *
   *   // to set nulls order:
   *   name: 'ASC NULLS FIRST',
   *   age: 'DESC NULLS LAST',
   * });
   * ```
   *
   * `order` can refer to the values returned from `select` sub-queries (unlike `where` which cannot).
   * So you can select a count of related records and order by it.
   *
   * For example, `comment` has many `likes`.
   * We are selecting few columns of `comment`, selecting `likesCount` by a sub-query in a select, and ordering comments by likes count:
   *
   * ```ts
   * db.comment
   *   .select('title', 'content', {
   *     likesCount: (q) => q.likes.count(),
   *   })
   *   .order({
   *     likesCount: 'DESC',
   *   });
   * ```
   *
   * @param args - column name(s) or an object with column names and sort directions.
   */
  order<T extends OrderArgSelf>(this: T, ...args: OrderArgs<T>): T {
    return pushQueryArrayImmutable(_clone(this), 'order', args) as never;
  }

  /**
   * Order by SQL expression
   *
   * Order by raw SQL expression.
   *
   * ```ts
   * db.table.orderSql`raw sql`;
   * ```
   *
   * @param args - SQL expression
   */
  orderSql<T>(this: T, ...args: SQLQueryArgs): T {
    return pushQueryValueImmutable(
      _clone(this),
      'order',
      sqlQueryArgsToExpression(args),
    ) as never;
  }
}
