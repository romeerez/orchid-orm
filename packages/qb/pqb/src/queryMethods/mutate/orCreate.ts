import { PickQueryQ, Query } from '../../query/query';
import { CreateBelongsToData, CreateData } from './create';
import { MoreThanOneRowError } from '../../errors';
import {
  FnUnknownToUnknown,
  PickQueryMetaResult,
  RecordUnknown,
} from 'orchid-core';
import { _clone } from '../../query/queryUtils';
import { queryFrom } from '../from';
import { _queryUnion } from '../union';
import { QueryAfterHook, SelectQueryData } from '../../sql';
import { UpsertResult, UpsertThis } from 'pqb';

// `orCreate` arg type.
// Unlike `upsert`, doesn't pass a data to `create` callback.
export type OrCreateArg<Data> = Data | (() => Data);

// this is used by `upsert` and `orCreate` methods.
// `updateData` and `mergeData` args are passed only by `upsert`.
export function orCreate<T extends PickQueryMetaResult>(
  query: T,
  data: unknown | FnUnknownToUnknown,
  updateData?: unknown,
  mergeData?: unknown,
): UpsertResult<T> {
  const { q } = query as unknown as PickQueryQ;
  (q as SelectQueryData).returnsOne = true;
  if (!q.select) {
    q.returnType = 'void';
  }

  const { handleResult } = q;
  let result: unknown;
  let created = false;
  q.handleResult = (q, t, r, s) => {
    return created ? result : handleResult(q, t, r, s);
  };

  q.hookSelect = new Map(q.hookSelect);
  q.patchResult = async (q, hookSelect, queryResult) => {
    if (queryResult.rowCount === 0) {
      if (typeof data === 'function') {
        data = data(updateData);
      }

      if (mergeData) data = { ...mergeData, ...(data as RecordUnknown) };

      let hasAfterCallback = q.q.afterCreate;
      let hasAfterCommitCallback = q.q.afterCreateCommit;

      if (updateData) {
        hasAfterCallback = hasAfterCallback || q.q.afterUpdate;
        hasAfterCommitCallback =
          hasAfterCommitCallback || q.q.afterUpdateCommit;
      }

      const inCTE = {
        selectNum: !!(hasAfterCallback || hasAfterCommitCallback),
        targetHookSelect: hookSelect,
      };

      q = q.clone();
      q.q.inCTE = inCTE as never;

      const c = q.create(data as CreateData<Query>);
      c.q.select = q.q.select;

      let q2 = q.qb.with('f', q).with('c', c);

      (q2.q as SelectQueryData).returnsOne = true;
      queryFrom(q2, 'f');
      q2 = _queryUnion(
        q2,
        [q.qb.from('c' as never)],
        'UNION ALL',
        true,
        true,
      ) as never;

      let afterHooks: QueryAfterHook[] | undefined;
      let afterCommitHooks: QueryAfterHook[] | undefined;
      q2.q.handleResult = (a, t, r, s) => {
        if (hasAfterCallback || hasAfterCommitCallback) {
          const fieldName = r.fields[0].name;
          if (r.rows[0][fieldName]) {
            afterHooks = q.q.afterCreate;
            afterCommitHooks = q.q.afterCreateCommit;
          } else {
            afterHooks = q.q.afterUpdate;
            afterCommitHooks = q.q.afterUpdateCommit;
          }
          delete r.rows[0][fieldName];
        }

        result = handleResult(a, t, r, s);
        return a.q.hookSelect
          ? (result as RecordUnknown[]).map((row) => ({ ...row }))
          : result;
      };

      q2.q.log = q.q.log;
      q2.q.logger = q.q.logger;

      q2.q.type = 'upsert';
      q2.q.beforeCreate = q.q.beforeCreate?.map((cb) => () => cb(c));

      if (hasAfterCallback) {
        (q2.q.afterCreate ??= []).push(
          (data, query) =>
            afterHooks &&
            Promise.all([...afterHooks].map((fn) => fn(data, query))),
        );
      }

      if (hasAfterCommitCallback) {
        (q2.q.afterCreateCommit ??= []).push(
          (data, query) =>
            afterCommitHooks &&
            Promise.all([...afterCommitHooks].map((fn) => fn(data, query))),
        );
      }

      await q2;

      created = true;
    } else if (queryResult.rowCount > 1) {
      throw new MoreThanOneRowError(
        q,
        `Only one row was expected to find, found ${queryResult.rowCount} rows.`,
      );
    }
  };

  return query as unknown as UpsertResult<T>;
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
   * const user = await User.selectAll()
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
  orCreate<T extends UpsertThis, BT extends CreateBelongsToData<T>>(
    this: T,
    data: OrCreateArg<CreateData<T, BT>>,
  ): UpsertResult<T>;
}

export const QueryOrCreate: QueryOrCreate = {
  orCreate(data) {
    return orCreate(_clone(this) as never, data);
  },
};
