import { Query } from '../query/query';
import {
  GetArg,
  GetResult,
  GetResultOptional,
  _queryGet,
  _queryGetOptional,
  QueryGetSelf,
} from './get.utils';

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
    return _queryGet(this.clone(), arg);
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
    return _queryGetOptional(this.clone(), arg);
  }
}
