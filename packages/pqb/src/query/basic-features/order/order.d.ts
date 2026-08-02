import { PickQueryResult, PickQuerySelectable, PickQueryTsQuery } from '../../pick-query-types';
import { Expression } from '../../expressions/expression';
import { SQLQueryArgs } from '../../db-sql-query';
import { OrderTsQueryConfig } from '../../extra-features/search/search.sql';
import { SortDir } from './order.sql';
export declare namespace Order {
    export interface ArgThis extends PickQuerySelectable, PickQueryResult, PickQueryTsQuery {
    }
    export type Arg<T extends ArgThis> = ArgKey<T> | ArgTsQuery<T> | {
        [K in ArgKey<T> | ArgTsQuery<T>]?: K extends ArgTsQuery<T> ? OrderTsQueryConfig : SortDir;
    } | Expression;
    export type Args<T extends ArgThis> = Arg<T>[];
    type ArgTsQuery<T extends ArgThis> = string | undefined extends T['__tsQuery'] ? never : Exclude<T['__tsQuery'], undefined>;
    type ArgKey<T extends ArgThis> = {
        [K in keyof T['__selectable']]: T['__selectable'][K]['column']['__queryType'] extends undefined ? never : K;
    }[keyof T['__selectable']] | {
        [K in keyof T['result']]: T['result'][K]['dataType'] extends 'array' | 'object' | 'runtimeComputed' ? never : K;
    }[keyof T['result']];
    export {};
}
export declare class QueryOrder {
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
    order<T extends Order.ArgThis>(this: T, ...args: Order.Args<T>): T;
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
    orderSql<T>(this: T, ...args: SQLQueryArgs): T;
}
