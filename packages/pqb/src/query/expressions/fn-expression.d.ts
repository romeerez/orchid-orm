import { Query, SetQueryReturnsColumnOrThrow } from '../query';
import { Column } from '../../columns';
import { PickQuerySelectableResultRelationsWindows, PickQuerySelectable, PickQuerySelectableResultWindows } from '../pick-query-types';
import { Expression, ExpressionData, SelectableOrExpression } from './expression';
import { WhereArg, WhereArgs } from '../basic-features/where/where';
import { Order } from '../basic-features/order/order';
import { WindowArgDeclaration } from '../basic-features/window/window';
import { ToSQLCtx } from '../sql/to-sql';
export interface AggregateOptions<T extends PickQuerySelectableResultRelationsWindows> {
    distinct?: boolean;
    order?: Order.Arg<T> | Order.Args<T>;
    filter?: WhereArg<T>;
    filterOr?: WhereArgs<T>;
    withinGroup?: boolean;
    over?: Over<T>;
}
export type Over<T extends PickQuerySelectableResultWindows> = keyof T['windows'] | WindowArgDeclaration<T>;
export type FnExpressionArgs<Q extends PickQuerySelectable> = (SelectableOrExpression<Q> | FnExpressionArgsPairs<Q> | FnExpressionArgsValue)[];
export interface FnExpressionArgsPairs<Q extends PickQuerySelectable> {
    pairs: {
        [K: string]: SelectableOrExpression<Q>;
    };
}
export interface FnExpressionArgsValue {
    value: unknown;
}
export declare class FnExpression<Q extends Query = Query, T extends Column.Pick.QueryColumn = Column.Pick.QueryColumn> extends Expression<T> {
    query: Q;
    fn: string;
    args: FnExpressionArgs<Q>;
    options: AggregateOptions<Q>;
    result: {
        value: T;
    };
    q: ExpressionData;
    /**
     * @param query - query object.
     * @param fn - SQL function name.
     * @param args - arguments of the function.
     * @param options - aggregate options.
     * @param value - column type of the function result.
     */
    constructor(query: Q, fn: string, args: FnExpressionArgs<Q>, options: AggregateOptions<Q> | undefined, value: T);
    makeSQL(ctx: ToSQLCtx, quotedAs?: string): string;
}
export declare function makeFnExpression<T extends PickQuerySelectableResultRelationsWindows, C extends Column.Pick.QueryColumn>(self: T, type: C, fn: string, args: FnExpressionArgs<Query>, options?: AggregateOptions<T>): SetQueryReturnsColumnOrThrow<T, C> & C['operators'];
