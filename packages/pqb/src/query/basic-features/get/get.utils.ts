import { SelectItemExpression } from '../../expressions/select-item-expression';
import { Operators, setQueryOperators } from '../../../columns/operators';
import { getFullColumnTable } from '../../query.utils';
import { Column } from '../../../columns';
import {
  PickQueryQ,
  PickQuerySelectable,
  PickQueryShape,
  PickQueryTable,
} from '../../pick-query-types';
import { Expression } from '../../expressions/expression';
import {
  IsQuery,
  SetQueryReturnsColumnOptional,
  SetQueryReturnsColumnOrThrow,
  SetQueryReturnsValueOptional,
  SetQueryReturnsValueOrThrow,
} from '../../query';
import { getValueKey } from './get-value-key';
import {
  addParserForRawExpression,
  setParserForSelectedString,
} from '../select/select.utils';
import { getQueryAs } from '../as/as';

export type QueryGetSelf = PickQuerySelectable;

// `get` method argument, accepts a string for a column name or a raw SQL
export type GetArg<T extends QueryGetSelf> = GetStringArg<T> | Expression;

export type GetStringArg<T extends PickQuerySelectable> =
  keyof T['__selectable'] & string;

// `get` method result: returns a column type for raw expression or a value type for string argument
export type GetResult<
  T extends QueryGetSelf,
  Arg extends GetArg<T>,
> = Arg extends string
  ? SetQueryReturnsValueOrThrow<T, Arg>
  : Arg extends Expression
  ? SetQueryReturnsColumnOrThrow<T, Arg['result']['value']>
  : never;

export type GetResultOptional<
  T extends QueryGetSelf,
  Arg extends GetArg<T>,
> = Arg extends string
  ? SetQueryReturnsValueOptional<T, Arg>
  : Arg extends Expression
  ? SetQueryReturnsColumnOptional<T, Arg['result']['value']>
  : never;

export const _getSelectableColumn = (
  q: IsQuery,
  arg: string,
): Column.Pick.QueryColumn | undefined => {
  let type: Column.Pick.QueryColumn | undefined = (q as unknown as PickQueryQ).q
    .shape[arg];
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

  let type: Column | undefined;
  if (typeof arg === 'string') {
    const joinedAs = q.valuesJoinedAs?.[arg];

    type = (
      joinedAs
        ? q.joinedShapes?.[joinedAs]?.value
        : _getSelectableColumn(query as never, arg)
    ) as Column | undefined;

    q.getColumn = type;

    const selected = setParserForSelectedString(
      query as never,
      joinedAs ? joinedAs + '.' + arg : arg,
      getQueryAs(query as never),
      getValueKey,
    );

    q.select = selected
      ? [(q.expr = new SelectItemExpression(query as never, selected, type))]
      : undefined;
  } else {
    type = arg.result.value as Column | undefined;
    q.getColumn = type;
    addParserForRawExpression(query as never, getValueKey, arg);
    q.select = [(q.expr = arg)];
  }

  return setQueryOperators(
    query as never,
    type?.operators || Operators.any,
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
