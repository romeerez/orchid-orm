import {
  PickQueryMetaTable,
  Query,
  SetQueryReturnsColumnOptional,
  SetQueryReturnsColumnOrThrow,
  SetQueryReturnsValueOptional,
  SetQueryReturnsValueOrThrow,
} from '../query/query';
import {
  Expression,
  getValueKey,
  PickQueryMeta,
  QueryColumn,
} from 'orchid-core';
import { SelectQueryData } from '../sql';
import {
  addParserForRawExpression,
  setParserForSelectedString,
} from './select';
import { getQueryAs } from '../common/utils';
import { SelectItemExpression } from '../common/selectItemExpression';
import {
  BaseOperators,
  Operators,
  setQueryOperators,
} from '../columns/operators';

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
  const q = (query as unknown as Query).q;
  q.returnType = returnType;

  let type: QueryColumn | undefined;
  if (typeof arg === 'string') {
    type = q.shape[arg];
    if (!type) {
      const index = arg.indexOf('.');
      if (index !== -1) {
        const table = arg.slice(0, index);
        const column = arg.slice(index + 1);

        if (table === (q.as || (query as unknown as Query).table)) {
          type = q.shape[column];
        } else {
          type = q.joinedShapes?.[table]?.[column];
        }
      }
    }

    (q as SelectQueryData)[getValueKey] = type;

    setParserForSelectedString(
      query as unknown as Query,
      arg,
      getQueryAs(query as unknown as Query),
      getValueKey,
    );

    q.expr = new SelectItemExpression(query as unknown as Query, arg, type);
  } else {
    type = arg.result.value;
    (q as SelectQueryData)[getValueKey] = type;
    addParserForRawExpression(query as unknown as Query, getValueKey, arg);
    q.expr = arg;
  }

  q.select = [q.expr];

  return setQueryOperators(
    query as unknown as Query,
    (type?.operators || Operators.any) as BaseOperators,
  ) as unknown as GetResult<T, Arg> & GetResultOptional<T, Arg>;
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
