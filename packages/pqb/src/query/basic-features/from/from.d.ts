import { IsQuery, SelectableFromShape } from '../../query';
import { PickQueryAs, PickQueryHasSelect, PickQueryResultAs, PickQuerySelectableResultInputTypeAs, PickQueryReturnType, PickQuerySelectable, PickQueryShape, PickQueryWithData } from '../../pick-query-types';
import { MaybeArray, UnionToIntersection } from '../../../utils';
import { SetQueryTableAlias } from '../as/as';
import { WithDataItems } from '../cte/cte.sql';
import { SQLQueryArgs } from '../../db-sql-query';
import { QueryThenByQuery } from '../../then/then';
export interface FromQuerySelf extends PickQuerySelectable, PickQueryShape, PickQueryReturnType, PickQueryWithData, PickQueryAs, PickQueryHasSelect {
}
export type FromArg<T extends FromQuerySelf> = IsQuery | Exclude<keyof T['withData'], symbol | number>;
export type FromResult<T extends FromQuerySelf, Arg extends MaybeArray<FromArg<T>>> = Arg extends string ? T['withData'] extends WithDataItems ? {
    [K in keyof T]: K extends '__selectable' ? SelectableFromShape<T['withData'][Arg]['shape'], Arg> : K extends 'result' ? T['withData'][Arg]['shape'] : K extends 'then' ? QueryThenByQuery<T, T['withData'][Arg]['shape']> : T[K];
} : SetQueryTableAlias<T, Arg> : Arg extends PickQuerySelectableResultInputTypeAs ? {
    [K in keyof T]: K extends '__defaultSelect' ? keyof Arg['result'] : K extends '__selectable' ? SelectableFromShape<Arg['result'], Arg['__as']> : K extends '__as' ? Arg['__as'] : K extends 'result' ? Arg['result'] : K extends 'shape' ? Arg['result'] : K extends '__inputType' ? Arg['__inputType'] : K extends 'then' ? QueryThenByQuery<T, Arg['result']> : T[K];
} : Arg extends (infer A)[] ? {
    [K in keyof T]: K extends '__selectable' ? UnionToIntersection<A extends string ? T['withData'] extends WithDataItems ? {
        [K in keyof T['withData'][A]['shape'] & string as `${A}.${K}`]: {
            as: K;
            column: T['withData'][A]['shape'][K];
        };
    } : never : A extends PickQueryResultAs ? {
        [K in keyof A['result'] & string as `${A['__as']}.${K}`]: K extends string ? {
            as: K;
            column: A['result'][K];
        } : never;
    } : never> : T[K];
} : T;
export declare function queryFrom<T extends FromQuerySelf, Arg extends MaybeArray<FromArg<T>>>(self: T, arg: Arg): FromResult<T, Arg>;
export declare function queryFromSql<T extends FromQuerySelf>(self: T, args: SQLQueryArgs): T;
export declare class FromMethods {
    /**
     * Set the `FROM` value, by default the table name is used.
     *
     * `from` determines a set of available tables and columns withing the query,
     * and thus it must not follow `select`, use `select` only after `from`.
     *
     * ```ts
     * // accepts sub-query:
     * db.table.from(db.otherTable.select('foo', 'bar'));
     *
     * // accepts alias of `WITH` expression:
     * q.with('withTable', db.table.select('id', 'name'))
     *   .from('withTable')
     *   // `select` is after `from`
     *   .select('id', 'name');
     * ```
     *
     * `from` can accept multiple sources:
     *
     * ```ts
     * db.table
     *   // add a `WITH` statement called `withTable
     *   .with('withTable', db.table.select('one'))
     *   // select from `withTable` and from `otherTable`
     *   .from('withTable', db.otherTable.select('two'))
     *   // source names and column names are properly typed when selecting
     *   .select('withTable.one', 'otherTable.two');
     * ```
     *
     * @param arg - query or name of CTE table
     */
    from<T extends FromQuerySelf, Arg extends MaybeArray<FromArg<T>>>(this: T, arg: T['__hasSelect'] extends true ? '`select` must be placed after `from`' : Arg): FromResult<T, Arg>;
    /**
     * Set the `FROM` value with custom SQL:
     *
     * ```ts
     * const value = 123;
     * db.table.fromSql`value = ${value}`;
     * ```
     *
     * @param args - SQL expression
     */
    fromSql<T extends FromQuerySelf>(this: T, ...args: SQLQueryArgs): T;
    /**
     * Adds `ONLY` SQL keyword to the `FROM`.
     * When selecting from a parent table that has a table inheritance,
     * setting `only` will make it to select rows only from the parent table.
     *
     * ```ts
     * db.table.only();
     *
     * // disabling `only` after being enabled
     * db.table.only().only(false);
     * ```
     *
     * @param only - can be disabled by passing `false` if was enabled previously.
     */
    only<T>(this: T, only?: boolean): T;
}
