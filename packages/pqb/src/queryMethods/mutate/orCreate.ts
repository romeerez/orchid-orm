import { PickQueryQ } from '../../query/query';
import { _queryInsert, CreateData } from './create';
import {
  PickQueryMetaResultReturnType,
  FnUnknownToUnknown,
  RecordUnknown,
} from '../../core';
import { _clone } from '../../query/queryUtils';
import { UpsertResult, UpsertThis } from './upsert';

// `orCreate` arg type.
// Unlike `upsert`, doesn't pass a data to `create` callback.
export type OrCreateArg<Data> = Data | (() => Data);

// this is used by `upsert` and `orCreate` methods.
// `updateData` and `mergeData` args are passed only by `upsert`.
export function _orCreate<T extends PickQueryMetaResultReturnType>(
  query: T,
  data: unknown | FnUnknownToUnknown,
  updateData?: unknown,
  mergeData?: unknown,
): UpsertResult<T> {
  const { q } = query as unknown as PickQueryQ;
  q.returnsOne = true;
  if (!q.select) {
    q.returnType = 'void';
  }

  if (typeof data === 'function') {
    data = data(updateData);
  }

  if (mergeData) data = { ...mergeData, ...(data as RecordUnknown) };

  _queryInsert(query as never, data as never);

  q.type = 'upsert';

  return query as never;
}

export interface QueryOrCreate {
  /**
   * `orCreate` creates a record only if it was not found by conditions.
   *
   * `find` or `findBy` must precede `orCreate`.
   *
   * It is accepting the same argument as `create` commands.
   *
   * No result is returned by default, place `get`, `select`, or `selectAll` before `orCreate` to specify returning columns.
   *
   * ```ts
   * const user = await db.user
   *   .selectAll()
   *   .findBy({ email: 'some@email.com' })
   *   .orCreate({
   *     email: 'some@email.com',
   *     name: 'created user',
   *     // supports sql and nested queries
   *     fromSQL: () => sql`*SQL expression*`,
   *     fromQuery: () => db.someTable.create(data).get('column'),
   *     fromRelated: (q) => q.relatedTable.update(data).get('column'),
   *   });
   * ```
   *
   * The data can be returned from a function, it won't be called if the record was found:
   *
   * ```ts
   * const user = await db.user
   *   .selectAll()
   *   .findBy({ email: 'some@email.com' })
   *   .orCreate(() => ({
   *     email: 'some@email.com',
   *     name: 'created user',
   *   }));
   * ```
   *
   * `orCreate` works by performing just a single query in the case if the record exists, and one additional query when the record does not exist.
   *
   * At first, it performs a "find" query, the query cost is exact same as if you didn't use `orCreate`.
   *
   * Then, if the record wasn't found, it performs a single query with CTE expressions to try finding it again, for the case it was already created just a moment before,
   * and then it creates the record if it's still not found. Using such CTE allows to skip using transactions, while still conforming to atomicity.
   *
   * ```sql
   * -- first query
   * SELECT * FROM "table" WHERE "key" = 'value'
   *
   * -- the record could have been created in between these two queries
   *
   * -- second query
   * WITH find_row AS (
   *   SELECT * FROM "table" WHERE "key" = 'value'
   * )
   * WITH insert_row AS (
   *   INSERT INTO "table" ("key")
   *   SELECT 'value'
   *   -- skip the insert if the row already exists
   *   WHERE NOT EXISTS (SELECT 1 FROM find_row)
   *   RETURNING *
   * )
   * SELECT * FROM find_row
   * UNION ALL
   * SELECT * FROM insert_row
   * ```
   *
   * @param data - the same data as for `create`, it may be returned from a callback
   */
  orCreate<T extends UpsertThis>(
    this: T,
    data: OrCreateArg<CreateData<T>>,
  ): UpsertResult<T>;
}

export const QueryOrCreate: QueryOrCreate = {
  orCreate(data) {
    return _orCreate(_clone(this) as never, data);
  },
};
