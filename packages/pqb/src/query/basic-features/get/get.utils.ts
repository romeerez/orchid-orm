import { SelectItemExpression } from '../../expressions/select-item-expression';
import { Operators, setQueryOperators } from '../../../columns/operators';
import { getFullColumnTable } from '../../query.utils';
import { Column } from '../../../columns';
import {
  PickQueryQ,
  PickQueryRelationsWithData,
  PickQuerySelectable,
  PickQueryShape,
  PickQueryTable,
} from '../../pick-query-types';
import { Expression, isExpression } from '../../expressions/expression';
import {
  IsQuery,
  isQuery,
  Query,
  SetQueryReturnsColumnOptional,
  SetQueryReturnsColumnOrThrow,
  SetQueryReturnsValueOptional,
  SetQueryReturnsValueOrThrow,
} from '../../query';
import { processSelectAsArg } from '../select/select.utils';
import { getQueryAs } from '../as/as';
import type { SelectAsFnArg } from '../select/select';
import { SelectAsValue } from '../select/select.sql';

export interface QueryGetSelf
  extends PickQuerySelectable, PickQueryRelationsWithData {}

// `get` method argument, accepts a string for a column name or a raw SQL
export type GetArg<T extends QueryGetSelf> =
  | GetStringArg<T>
  | Expression
  | ((q: SelectAsFnArg<T>) => Expression | Query.Pick.SingleValueResult);

export type GetStringArg<T extends PickQuerySelectable> =
  keyof T['__selectable'] & string;

type ResolveGetArgColumn<Arg> = Arg extends Expression
  ? Arg['result']['value']
  : Arg extends (q: never) => infer R
    ? R extends Expression
      ? R['result']['value']
      : R extends Query.Pick.SingleValueResult
        ? R['result']['value']
        : never
    : never;

// `get` method result: returns a column type for raw expression or a value type for string argument
export type GetResult<
  T extends QueryGetSelf,
  Arg extends GetArg<T>,
> = Arg extends string
  ? SetQueryReturnsValueOrThrow<T, Arg>
  : SetQueryReturnsColumnOrThrow<T, ResolveGetArgColumn<Arg>>;

// the value column of `getOptional`: when selected inside another query, a not found record gives `undefined`
type OptionalValueColumn<C> = {
  [K in keyof C]: K extends '__outputType' ? C[K] | undefined : C[K];
};

export type GetResultOptional<
  T extends QueryGetSelf,
  Arg extends GetArg<T>,
> = Arg extends string
  ? SetQueryReturnsValueOptional<T, Arg>
  : SetQueryReturnsColumnOptional<
      T,
      OptionalValueColumn<ResolveGetArgColumn<Arg>>
    >;

export const _getSelectableColumn = (
  q: IsQuery,
  arg: string,
): Column.Pick.QueryColumn | undefined => {
  let type: Column.Pick.QueryColumn | undefined = (q as unknown as PickQueryQ).q
    .selectShape[arg];
  if (!type) {
    const index = arg.indexOf('.');
    if (index !== -1) {
      const as =
        (q as unknown as PickQueryQ).q.as || (q as PickQueryTable).table;

      const table = getFullColumnTable(q, arg, index, as);
      const column = arg.slice(index + 1);

      if (table === as) {
        type = (q as unknown as PickQueryShape).shape[column];
      } else {
        type = (q as unknown as PickQueryQ).q.joinedShapes?.[table]?.[column];
      }
    }
  }
  return type;
};

// mutate the query to get a single value
const _get = <
  T extends QueryGetSelf,
  R extends 'value' | 'valueOrThrow',
  Arg extends GetArg<T>,
>(
  query: T,
  returnType: R,
  arg: Arg,
): R extends 'value' ? GetResultOptional<T, Arg> : GetResult<T, Arg> => {
  const q = (query as unknown as PickQueryQ).q;

  if (q.returning) q.returning = undefined;

  q.returnType = returnType;
  q.batchParsers = undefined;
  let value: unknown = arg;

  const selectAs: SelectAsValue = {};
  let column: Column | undefined;
  const selected = processSelectAsArg(
    query as never,
    selectAs,
    getQueryAs(query as never),
    'v',
    value as never,
    undefined,
    returnType,
  );
  if (selected !== false) {
    value = selectAs.v || value;
    const subQuery = isQuery(value);
    // the value of a selected nested query is wrapped into an array by that query, not by this one
    if (selected && (subQuery || selected.data.valueToArray)) {
      column = Object.create(selected) as Column;
      column.data = { ...selected.data, valueToArray: undefined };
      // an aggregate sub-query always returns a row, but this query can find no record
      if (subQuery) column.data.skipValueToArray = undefined;
    } else {
      column = selected;
    }
    q.getColumn = column;
  }

  if (typeof value === 'string') {
    value =
      selectAs.v &&
      new SelectItemExpression(query as never, selectAs.v as string, column);
  }

  q.select = isExpression(value)
    ? [(q.expr = value)]
    : value
      ? [{ selectAs: { v: value as Query } }]
      : undefined;

  return setQueryOperators(
    query as never,
    column?.operators || Operators.any,
  ) as never;
};

export function _queryGet<T extends QueryGetSelf, Arg extends GetArg<T>>(
  self: T,
  arg: Arg,
): GetResult<T, Arg> {
  return _get(self, 'valueOrThrow', arg);
}

export function _queryGetOptional<
  T extends QueryGetSelf,
  Arg extends GetArg<T>,
>(self: T, arg: Arg): GetResultOptional<T, Arg> {
  return _get(self, 'value', arg);
}
