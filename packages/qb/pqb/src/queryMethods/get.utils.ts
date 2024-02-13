import {
  Query,
  SetQueryReturnsColumn,
  SetQueryReturnsColumnOptional,
  SetQueryReturnsValue,
  SetQueryReturnsValueOptional,
} from '../query/query';
import {
  ColumnTypeBase,
  emptyObject,
  Expression,
  getValueKey,
  QueryColumn,
} from 'orchid-core';
import { SelectQueryData } from '../sql';
import {
  addParserForRawExpression,
  setParserForSelectedString,
} from './select';
import { getQueryAs } from '../common/utils';
import { SelectItemExpression } from '../common/selectItemExpression';
import { Operators, setQueryOperators } from '../columns/operators';

export type QueryGetSelf = Pick<
  Query,
  'meta' | 'q' | 'table' | 'baseQuery' | 'clone'
>;

// `get` method argument, accepts a string for a column name or a raw SQL
export type GetArg<T extends QueryGetSelf> = GetStringArg<T> | Expression;

export type GetStringArg<T extends Pick<Query, 'meta'>> =
  keyof T['meta']['selectable'] & string;

// `get` method result: returns a column type for raw expression or a value type for string argument
export type GetResult<
  T extends QueryGetSelf,
  Arg extends GetArg<T>,
> = Arg extends GetStringArg<T>
  ? SetQueryReturnsValue<T, Arg>
  : Arg extends Expression
  ? SetQueryReturnsColumn<T, Arg['_type']>
  : never;

export type GetResultOptional<
  T extends QueryGetSelf,
  Arg extends GetArg<T>,
> = Arg extends GetStringArg<T>
  ? SetQueryReturnsValueOptional<T, Arg>
  : Arg extends Expression
  ? SetQueryReturnsColumnOptional<T, Arg['_type']>
  : never;

// mutate the query to get a single value
const _get = <
  T extends QueryGetSelf,
  R extends 'value' | 'valueOrThrow',
  Arg extends GetArg<T>,
>(
  q: T,
  returnType: R,
  arg: Arg,
): R extends 'value' ? GetResultOptional<T, Arg> : GetResult<T, Arg> => {
  q.q.returnType = returnType;

  let type: QueryColumn | undefined;
  if (typeof arg === 'string') {
    type = q.q.shape[arg];
    if (!type) {
      const index = arg.indexOf('.');
      if (index !== -1) {
        const table = arg.slice(0, index);
        const column = arg.slice(index + 1);

        if (table === (q.q.as || q.table)) {
          type = q.q.shape[column];
        } else {
          type = q.q.joinedShapes?.[table]?.[column];
        }
      }
    }

    (q.q as SelectQueryData)[getValueKey] = type;

    setParserForSelectedString(q, arg, getQueryAs(q), getValueKey);

    q.q.expr = new SelectItemExpression(
      q as unknown as Query,
      arg,
      type || (emptyObject as ColumnTypeBase),
    );
  } else {
    type = arg._type;
    (q.q as SelectQueryData)[getValueKey] = type;
    addParserForRawExpression(q, getValueKey, arg);
    q.q.expr = arg;
  }

  q.q.select = [q.q.expr];

  return setQueryOperators(
    q,
    type?.operators || Operators.any,
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
