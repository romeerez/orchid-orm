import { RecordUnknown } from '../../../utils';
import { _clone } from '../clone/clone';
import { OrderArg, OrderArgSelf } from '../order/order';
import { pushQueryValueImmutable } from '../../query-data';
import {
  Expression,
  SelectableOrExpression,
  SelectableOrExpressions,
} from '../../expressions/expression';

// argument of the window method
// it is an object where keys are name of windows
// and values can be a window options or a raw SQL
export interface WindowArg<T extends OrderArgSelf> {
  [K: string]: WindowArgDeclaration<T> | Expression;
}

// SQL window options to specify partitionBy and order of the window
export interface WindowArgDeclaration<T extends OrderArgSelf = OrderArgSelf> {
  partitionBy?: SelectableOrExpression<T> | SelectableOrExpressions<T>;
  order?: OrderArg<T>;
}

// add new windows to a query
type WindowResult<T, W extends RecordUnknown> = T & {
  windows: { [K in keyof W]: true };
};

export class QueryWindow {
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
  window<T extends OrderArgSelf, W extends WindowArg<T>>(
    this: T,
    arg: W,
  ): WindowResult<T, W> {
    return pushQueryValueImmutable(_clone(this), 'window', arg) as never;
  }
}
