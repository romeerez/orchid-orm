import {
  GetArg,
  GetResult,
  GetResultOptional,
  _queryGet,
  _queryGetOptional,
  QueryGetSelf,
} from './get.utils';
import { _clone } from '../query/queryUtils';

export class QueryGet {
  /**
   * `.get` returns a single value, adds `LIMIT 1` to the query, and accepts a column name or a raw SQL expression.
   *
   * `get` throws a `NotFoundError` when not found, and `getOptional` returns `undefined`.
   *
   * ```ts
   * import { NumberColumn } from 'orchid-orm';
   * import { sql } from './baseTable';
   *
   * const firstName: string = await db.table.get('name');
   *
   * const rawResult: number = await db.table.get(sql((t) => t.integer())`1 + 1`);
   *
   * const firstNameOptional: string | undefined = await db.table.getOptional(
   *   'name',
   * );
   * ```
   *
   * @param arg - string for a column to get, or a raw SQL
   */
  get<T extends QueryGetSelf, Arg extends GetArg<T>>(
    this: T,
    arg: Arg,
  ): GetResult<T, Arg> {
    return _queryGet(_clone(this), arg) as never;
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
  getOptional<T extends QueryGetSelf, Arg extends GetArg<T>>(
    this: T,
    arg: Arg,
  ): GetResultOptional<T, Arg> {
    return _queryGetOptional(_clone(this), arg) as never;
  }
}
