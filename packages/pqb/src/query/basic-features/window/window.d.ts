import { RecordUnknown } from '../../../utils';
import { Order } from '../order/order';
import { Expression, SelectableOrExpression, SelectableOrExpressions } from '../../expressions/expression';
export interface WindowArg<T extends Order.ArgThis> {
    [K: string]: WindowArgDeclaration<T> | Expression;
}
export interface WindowArgDeclaration<T extends Order.ArgThis = Order.ArgThis> {
    partitionBy?: SelectableOrExpression<T> | SelectableOrExpressions<T>;
    order?: Order.Arg<T>;
}
type WindowResult<T, W extends RecordUnknown> = T & {
    windows: {
        [K in keyof W]: true;
    };
};
export declare class QueryWindow {
    /**
     * Add a window with `window` and use it later by its name for aggregate or window functions:
     *
     * ```ts
     * db.table
     *   // define window `windowName`
     *   .window({
     *     windowName: {
     *       partitionBy: 'someColumn',
     *       order: {
     *         id: 'DESC',
     *       },
     *     },
     *   })
     *   .select({
     *     avg: (q) =>
     *       // calculate average price over the window
     *       q.avg('price', {
     *         // use window by its name
     *         over: 'windowName',
     *       }),
     *   });
     * ```
     *
     * @param arg - window config
     */
    window<T extends Order.ArgThis, W extends WindowArg<T>>(this: T, arg: W): WindowResult<T, W>;
}
export {};
