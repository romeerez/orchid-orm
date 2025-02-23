import {
  PickQueryQ,
  Query,
  SetQueryReturnsOneKind,
  SetQueryReturnsVoidKind,
} from '../query/query';
import { _queryUpdate, UpdateData, UpdateSelf } from './update';
import { CreateBelongsToData, CreateData, CreateSelf } from './create';
import { MoreThanOneRowError } from '../errors';
import {
  FnUnknownToUnknown,
  isObjectEmpty,
  PickQueryMetaResult,
  QueryMetaBase,
  RecordUnknown,
} from 'orchid-core';
import { _clone } from '../query/queryUtils';
import { queryFrom } from './from';
import { _queryUnion } from './union';
import { QueryAfterHook, SelectQueryData } from '../sql';

// `orCreate` arg type.
// Unlike `upsert`, doesn't pass a data to `create` callback.
export type OrCreateArg<Data> = Data | (() => Data);

type UpsertCreate<DataKey extends PropertyKey, CD> = {
  [K in keyof CD as K extends DataKey ? never : K]: CD[K];
} & {
  [K in DataKey]?: K extends keyof CD ? CD[K] : never;
};

// unless upsert query has a select, it returns void
export type UpsertResult<T extends PickQueryMetaResult> =
  T['meta']['hasSelect'] extends true
    ? SetQueryReturnsOneKind<T, 'upsert'>
    : SetQueryReturnsVoidKind<T, 'upsert'>;

// Require type of query object to query only one record
// because upserting multiple isn't possible
export interface UpsertThis extends UpdateSelf, CreateSelf {
  meta: MetaPropHasWhere;
  returnType: 'one' | 'oneOrThrow' | 'value' | 'valueOrThrow' | 'void';
}

interface MetaPropHasWhere extends QueryMetaBase {
  hasWhere: true;
}

// this is used by `upsert` and `orCreate` methods.
// `updateData` and `mergeData` args are passed only by `upsert`.
function orCreate<T extends PickQueryMetaResult>(
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

      let q2 = q.queryBuilder.with('f', q).with('c', c);

      (q2.q as SelectQueryData).returnsOne = true;
      queryFrom(q2, 'f');
      q2 = _queryUnion(
        q2,
        [q.queryBuilder.from('c' as never)],
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
      q2.q.beforeCreate = q.q.beforeCreate;

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

export class QueryUpsertOrCreate {
  /**
   * `upsert` tries to update a single record, and then it creates the record if it doesn't yet exist.
   *
   * `find` or `findBy` must precede `upsert` because it does not work with multiple updates.
   *
   * In case more than one row was updated, it will throw `MoreThanOneRowError` and the transaction will be rolled back.
   *
   * It can take `update` and `create` objects, then they are used separately for update and create queries.
   * Or, it can take `data` and `create` objects, `data` will be used for update and be mixed to `create` object.
   *
   * `data` and `update` objects are of the same type that's expected by `update` method, `create` object is of type of `create` method argument.
   *
   * No values are returned by default, place `select` or `selectAll` before `upsert` to specify returning columns.
   *
   * ```ts
   * await User.selectAll()
   *   .findBy({ email: 'some@email.com' })
   *   .upsert({
   *     data: {
   *       // update record's name
   *       name: 'new name',
   *     },
   *     create: {
   *       // create a new record with this email and a name 'new name'
   *       email: 'some@email.com',
   *     },
   *   });
   *
   * // the same as above but using `update` and `create`
   * await User.selectAll()
   *   .findBy({ email: 'some@email.com' })
   *   .upsert({
   *     update: {
   *       name: 'updated user',
   *     },
   *     create: {
   *       email: 'some@email.com',
   *       // here we use a different name when creating a record
   *       name: 'created user',
   *     },
   *   });
   * ```
   *
   * The data for `create` may be returned from a function, it won't be called if a record was updated:
   *
   * ```ts
   * await User.selectAll()
   *   .findBy({ email: 'some@email.com' })
   *   .upsert({
   *     update: {
   *       name: 'updated user',
   *     },
   *     create: () => ({
   *       email: 'some@email.com',
   *       name: 'created user',
   *     }),
   *   });
   *
   * // the same as above using `data`
   * await User.selectAll()
   *   .findBy({ email: 'some@email.com' })
   *   .upsert({
   *     data: {
   *       name: 'updated user',
   *     },
   *     create: () => ({
   *       email: 'some@email.com',
   *       // name in `create` is overriding the name from `data`
   *       name: 'created user',
   *     }),
   *   });
   * ```
   *
   * Data from `data` or `update` is passed to the `create` function and can be used:
   *
   * ```ts
   * const user = await User.selectAll()
   *   .findBy({ email: 'some@email.com' })
   *   .upsert({
   *     data: {
   *       name: 'updated user',
   *     },
   *     // `updateData` has the exact type of what is passed to `data`
   *     create: (updateData) => ({
   *       email: `${updateData.name}@email.com`,
   *     }),
   *   });
   * ```
   *
   * `upsert` works in the exact same way as [orCreate](#orCreate), but with `UPDATE` statement instead of `SELECT`.
   * it also performs a single query if the record exists, and two queries if there is no record yet.
   *
   * @param data - `update` property for the data to update, `create` property for the data to create
   */
  upsert<
    T extends UpsertThis,
    Update extends UpdateData<T>,
    BT extends CreateBelongsToData<T>,
  >(
    this: T,
    data:
      | {
          update: Update;
          create: CreateData<T, BT> | ((update: Update) => CreateData<T, BT>);
        }
      | {
          data: Update;
          create:
            | UpsertCreate<keyof Update, CreateData<T, BT>>
            | ((
                update: Update,
              ) => UpsertCreate<keyof Update, CreateData<T, BT>>);
        },
  ): UpsertResult<T> {
    const q = _clone(this);

    let updateData;
    let mergeData;
    if ('data' in data) {
      updateData = mergeData = data.data;
    } else {
      updateData = data.update;
    }

    if (!isObjectEmpty(updateData)) {
      _queryUpdate(q, updateData as never);
    }

    return orCreate(q as Query, data.create, updateData, mergeData) as never;
  }

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
   * const user = await User.selectAll()
   *   .findBy({ email: 'some@email.com' })
   *   .orCreate({
   *     email: 'some@email.com',
   *     name: 'created user',
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
  ): UpsertResult<T> {
    return orCreate(_clone(this) as never, data);
  }
}
