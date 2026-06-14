import { Query, SetQueryReturnsPluck } from '../../query';
import { QueryThen } from '../../then/then';
import {
  Expression,
  isExpression,
  SelectableOrExpression,
} from '../../expressions/expression';
import {
  PickQueryRelationsWithData,
  PickQuerySelectable,
} from '../../pick-query-types';
import { _clone } from '../clone/clone';
import {
  addParserForSelectItem,
  processSelectAsArg,
} from '../select/select.utils';
import type { SelectAsFnArg } from '../select/select';

export interface QueryPluckSelf
  extends PickQuerySelectable, PickQueryRelationsWithData {}

export type PluckArg<T extends QueryPluckSelf> =
  | SelectableOrExpression<T>
  | ((q: SelectAsFnArg<T>) => Expression | Query.Pick.SingleValueResult);

export type PluckResult<
  T extends QueryPluckSelf,
  S extends PluckArg<T>,
> = S extends (q: never) => infer R
  ? R extends Expression
    ? SetQueryReturnsPluck<T, R>
    : R extends Query.Pick.SingleValueResult
      ? {
          [K in keyof T]: K extends '__hasSelect'
            ? true
            : K extends 'result'
              ? { pluck: R['result']['value'] }
              : K extends 'returnType'
                ? 'pluck'
                : K extends 'then'
                  ? QueryThen<R['result']['value']['outputType'][]>
                  : T[K];
        }
      : never
  : S extends SelectableOrExpression<T>
    ? SetQueryReturnsPluck<T, S>
    : never;

export class QueryPluck {
  /**
   * `.pluck` returns a single array of a single selected column values:
   *
   * ```ts
   * const ids = await db.table.select('id').pluck();
   * // ids are an array of all users' id like [1, 2, 3]
   * ```
   * @param select - column name or a raw SQL
   */
  pluck<T extends QueryPluckSelf, S extends PluckArg<T>>(
    this: T,
    select: S,
  ): PluckResult<T, S> {
    const q = _clone(this);
    q.q.returnType = 'pluck';

    let selected;
    if (typeof select === 'function') {
      const item = processSelectAsArg(
        q as never,
        q.q.as || q.table,
        'pluck',
        select as never,
      );
      if (item !== false) {
        selected = isExpression(item) ? item : { selectAs: { pluck: item } };
      }
    } else {
      selected = addParserForSelectItem(
        q as never,
        q.q.as || q.table,
        'pluck',
        select,
      );
    }

    q.q.select = selected ? [selected as never] : undefined;
    return q as never;
  }
}
