import {
  Query,
  SetQueryReturnsColumn,
  SetQueryReturnsColumnOptional,
  SetQueryReturnsValue,
  SetQueryReturnsValueOptional,
} from '../query/query';
import {
  addParserForRawExpression,
  setParserForSelectedString,
} from './select';
import {
  ColumnTypeBase,
  Expression,
  getValueKey,
  StringKey,
} from 'orchid-core';
import { SelectQueryData } from '../sql';
import { QueryBase } from '../query/queryBase';
import { Operators, setQueryOperators } from '../columns/operators';
import { SelectItemExpression } from '../common/selectItemExpression';
import { UnknownColumn } from '../columns';
import { getQueryAs } from '../common/utils';

// `get` method argument, accepts a string for a column name or a raw SQL
export type GetArg<T extends QueryBase> = GetStringArg<T> | Expression;

export type GetStringArg<T extends QueryBase> = StringKey<
  keyof T['selectable']
>;

// `get` method result: returns a column type for raw expression or a value type for string argument
type GetResult<
  T extends Query,
  Arg extends GetArg<T>,
> = Arg extends GetStringArg<T>
  ? SetQueryReturnsValue<T, Arg>
  : Arg extends Expression
  ? SetQueryReturnsColumn<T, Arg['_type']>
  : never;

type GetResultOptional<
  T extends Query,
  Arg extends GetArg<T>,
> = Arg extends GetStringArg<T>
  ? SetQueryReturnsValueOptional<T, Arg>
  : Arg extends Expression
  ? SetQueryReturnsColumnOptional<T, Arg['_type']>
  : never;

// mutate the query to get a single value
const _get = <
  T extends Query,
  R extends 'value' | 'valueOrThrow',
  Arg extends GetArg<T>,
>(
  q: T,
  returnType: R,
  arg: Arg,
): R extends 'value' ? GetResultOptional<T, Arg> : GetResult<T, Arg> => {
  q.q.returnType = returnType;

  let type: ColumnTypeBase | undefined;
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

    q.q.expr = new SelectItemExpression(q, arg, type || UnknownColumn.instance);
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

export class QueryGet {
  /**
   * `.get` returns a single value, it will add `LIMIT 1` to the query, and accepts a column name or a raw expression.
   * It will throw `NotFoundError` when not found.
   *
   * ```ts
   * import { NumberColumn } from 'orchid-orm';
   *
   * const firstName: string = await db.table.get('name');
   *
   * const rawResult: number = await db.table.get(
   *   db.table.sql((t) => t.integer())`1 + 1`,
   * );
   * ```
   *
   * @param arg - string for a column to get, or a raw SQL
   */
  get<T extends Query, Arg extends GetArg<T>>(
    this: T,
    arg: Arg,
  ): GetResult<T, Arg> {
    return this.clone()._get(arg);
  }

  _get<T extends Query, Arg extends GetArg<T>>(
    this: T,
    arg: Arg,
  ): GetResult<T, Arg> {
    return _get(this, 'valueOrThrow', arg);
  }

  /**
   * `.getOptional` returns a single value or undefined when not found:
   *
   * ```ts
   * const firstName: string | undefined = await db.table.getOptional('name');
   * ```
   *
   * @param arg - string for a column to get, or a raw SQL
   */
  getOptional<T extends Query, Arg extends GetArg<T>>(
    this: T,
    arg: Arg,
  ): GetResultOptional<T, Arg> {
    return this.clone()._getOptional(arg);
  }

  _getOptional<T extends Query, Arg extends GetArg<T>>(
    this: T,
    arg: Arg,
  ): GetResultOptional<T, Arg> {
    return _get(this, 'value', arg);
  }
}
