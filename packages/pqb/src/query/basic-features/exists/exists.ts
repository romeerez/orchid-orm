import { _queryGetOptional, QueryGetSelf } from '../get/get.utils';
import { SetQueryReturnsColumnOrThrow } from '../../query';
import { BooleanQueryColumn } from '../aggregate/aggregate';
import { _clone } from '../clone/clone';
import { RawSql } from '../../expressions/raw-sql';
import { BooleanColumn } from '../../../columns/column-types/boolean';

const _exists = (query: QueryGetSelf, value: boolean) => {
  const q = _queryGetOptional(_clone(query), new RawSql(String(value)));
  q.q.notFoundDefault = !value;
  q.q.coalesceValue = new RawSql(String(!value));
  q.q.getColumn = BooleanColumn.instanceSkipValueToArray;
  return q as never;
};

export class QueryExistsMethods {
  /**
   * Use `exists()` to check if there is at least one record-matching condition.
   *
   * It will discard previous `select` statements if any. Returns a boolean.
   *
   * ```ts
   * const exists: boolean = await db.table.where(...conditions).exists();
   * ```
   */
  exists<T extends QueryGetSelf>(
    this: T,
  ): SetQueryReturnsColumnOrThrow<T, BooleanQueryColumn> {
    return _exists(this, true);
  }

  /**
   * Use `notExists()` to check if there are no matching records.
   *
   * It will discard previous `select` statements if any. Returns a boolean.
   *
   * ```ts
   * const exists: boolean = await db.table.where(...conditions).notExists();
   * ```
   */
  notExists<T extends QueryGetSelf>(
    this: T,
  ): SetQueryReturnsColumnOrThrow<T, BooleanQueryColumn> {
    return _exists(this, false);
  }
}
