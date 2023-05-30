import {
  Query,
  SetQueryReturnsColumn,
  SetQueryReturnsColumnOptional,
  SetQueryReturnsValue,
  SetQueryReturnsValueOptional,
} from '../query';
import { addParserForRawExpression, processSelectArg } from './select';
import {
  ColumnTypeBase,
  getValueKey,
  RawExpression,
  StringKey,
} from 'orchid-core';
import { SelectQueryData } from '../sql';
import { QueryBase } from '../queryBase';

// `get` method argument, accepts a string for a column name or a raw SQL
export type GetArg<T extends QueryBase> = GetStringArg<T> | RawExpression;

export type GetStringArg<T extends QueryBase> = StringKey<
  keyof T['selectable']
>;

// `get` method result: returns a column type for raw expression or a value type for string argument
type GetResult<
  T extends Query,
  Arg extends GetArg<T>,
> = Arg extends GetStringArg<T>
  ? SetQueryReturnsValue<T, Arg>
  : Arg extends RawExpression
  ? SetQueryReturnsColumn<T, Arg['__column']>
  : never;

type GetResultOptional<
  T extends Query,
  Arg extends GetArg<T>,
> = Arg extends GetStringArg<T>
  ? SetQueryReturnsValueOptional<T, Arg>
  : Arg extends RawExpression
  ? SetQueryReturnsColumnOptional<T, Arg['__column']>
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
  q.query.returnType = returnType;

  if (typeof arg === 'string') {
    let type = q.query.shape[arg] as ColumnTypeBase | undefined;
    if (type) {
    } else {
      const index = arg.indexOf('.');
      if (index !== -1) {
        const table = arg.slice(0, index);
        const column = arg.slice(index + 1);

        if (table === (q.query.as || q.table)) {
          type = q.query.shape[column];
        } else {
          type = q.query.joinedShapes?.[table]?.[column];
        }
      }
    }

    (q.query as SelectQueryData)[getValueKey] = type;

    q.query.select = [
      processSelectArg(
        q,
        q.query.as || q.table,
        arg as unknown as Exclude<GetArg<T>, RawExpression>,
        getValueKey,
      ),
    ];
  } else {
    (q.query as SelectQueryData)[getValueKey] = arg.__column;
    addParserForRawExpression(q, getValueKey, arg);
    q.query.select = [arg];
  }

  return q as unknown as GetResult<T, Arg> & GetResultOptional<T, Arg>;
};

export class QueryGet {
  /**
   * `.get` returns a single value, it will add `LIMIT 1` to the query, and accepts a column name or a raw expression.
   * It will throw `NotFoundError` when not found.
   *
   * ```ts
   * import { NumberColumn } from 'pqb';
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
