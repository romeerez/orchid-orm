import {
  PickQueryMetaTable,
  PickQueryQ,
  SetQueryReturnsColumnOptional,
  SetQueryReturnsColumnOrThrow,
  SetQueryReturnsValueOptional,
  SetQueryReturnsValueOrThrow,
} from '../query/query';
import {
  Expression,
  getValueKey,
  IsQuery,
  PickQueryMeta,
  PickQueryShape,
  PickQueryTable,
  QueryColumn,
} from 'orchid-core';
import {
  addParserForRawExpression,
  setParserForSelectedString,
} from './select';
import { getQueryAs } from '../common/utils';
import { SelectItemExpression } from '../common/selectItemExpression';
import { Operators, setQueryOperators } from '../columns/operators';

export type QueryGetSelf = PickQueryMetaTable;

// `get` method argument, accepts a string for a column name or a raw SQL
export type GetArg<T extends QueryGetSelf> = GetStringArg<T> | Expression;

export type GetStringArg<T extends PickQueryMeta> =
  keyof T['meta']['selectable'] & string;

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
): QueryColumn | undefined => {
  let type: QueryColumn | undefined = (q as unknown as PickQueryQ).q.shape[arg];
  if (!type) {
    const index = arg.indexOf('.');
    if (index !== -1) {
      const table = arg.slice(0, index);
      const column = arg.slice(index + 1);

      if (
        table ===
        ((q as unknown as PickQueryQ).q.as || (q as PickQueryTable).table)
      ) {
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

  let type: QueryColumn | undefined;
  if (typeof arg === 'string') {
    type = _getSelectableColumn(query as never, arg);
    q.getColumn = type;

    const selected = setParserForSelectedString(
      query as never,
      arg,
      getQueryAs(query as never),
      getValueKey,
    );

    q.select = selected
      ? [(q.expr = new SelectItemExpression(query as never, selected, type))]
      : undefined;
  } else {
    type = arg.result.value;
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
