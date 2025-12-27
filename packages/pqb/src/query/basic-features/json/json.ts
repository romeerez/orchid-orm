import { SetQueryReturnsColumnOptional } from '../../query';
import { queryJson } from './json.utils';
import { Column } from '../../../columns';

export abstract class JsonMethods {
  /**
   * Wraps the query in a way to select a single JSON string.
   * So that JSON encoding is done on a database side, and the application doesn't have to turn a response to a JSON.
   * It may be better for performance in some cases.
   *
   * ```ts
   * // json is a JSON string that you can directly send as a response.
   * const json = await db.table.select('id', 'name').json();
   * ```
   *
   * @param coalesce
   */
  json<T>(
    this: T,
    coalesce?: boolean,
  ): SetQueryReturnsColumnOptional<T, Column.Pick.QueryColumnOfType<string>> {
    return queryJson(this, coalesce) as never;
  }
}
