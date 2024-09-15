import {
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
  RecordUnknown,
} from 'orchid-core';
import { QueryMetaHasWhere } from './where/where';

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
export type UpsertThis = UpdateSelf &
  CreateSelf &
  QueryMetaHasWhere & {
    returnType: 'one' | 'oneOrThrow';
  };

// this is used by `upsert` and `orCreate` methods.
// `updateData` and `mergeData` args are passed only by `upsert`.
function orCreate<T extends Query>(
  q: T,
  data: unknown | FnUnknownToUnknown,
  updateData?: unknown,
  mergeData?: unknown,
): UpsertResult<T> {
  q.q.returnType = 'one';
  q.q.wrapInTransaction = true;

  const { handleResult } = q.q;
  let result: unknown;
  let created = false;
  q.q.handleResult = (q, t, r, s) => {
    return created ? result : handleResult(q, t, r, s);
  };

  q.q.patchResult = async (q, queryResult) => {
    if (queryResult.rowCount === 0) {
      if (typeof data === 'function') {
        data = data(updateData);
      }

      if (mergeData) data = { ...mergeData, ...(data as RecordUnknown) };

      const inner = q.create(data as CreateData<Query>);

      inner.q.handleResult = (q, t, r, s) => {
        result = handleResult(q, t, r, s);
        return inner.q.hookSelect
          ? (result as RecordUnknown[]).map((row) => ({ ...row }))
          : result;
      };

      await inner;

      created = true;
    } else if (queryResult.rowCount > 1) {
      throw new MoreThanOneRowError(
        q,
        `Only one row was expected to find, found ${queryResult.rowCount} rows.`,
      );
    }
  };
  return q as unknown as UpsertResult<T>;
}

export class QueryUpsertOrCreate {
  /**
   * `upsert` tries to update one record, and it will perform create in case a record was not found.
   *
   * It will implicitly wrap queries in a transaction if it was not wrapped yet.
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
   * It is not returning a value by default, place `select` or `selectAll` before `upsert` to specify returning columns.
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
    const q = (this as unknown as Query).clone();

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

    const c = orCreate(q as Query, data.create, updateData, mergeData);

    if (!c.q.select) {
      c.q.returnType = 'void';
    }

    return c as never;
  }

  /**
   * `orCreate` creates a record only if it was not found by conditions.
   *
   * It will implicitly wrap queries in a transaction if it was not wrapped yet.
   *
   * `find` or `findBy` must precede `orCreate`.
   *
   * It is accepting the same argument as `create` commands.
   *
   * By default, it is not returning columns, place `get`, `select`, or `selectAll` before `orCreate` to specify returning columns.
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
   * The data may be returned from a function, it won't be called if the record was found:
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
   * @param data - the same data as for `create`, it may be returned from a callback
   */
  orCreate<T extends UpsertThis, BT extends CreateBelongsToData<T>>(
    this: T,
    data: OrCreateArg<CreateData<T, BT>>,
  ): UpsertResult<T> {
    return orCreate((this as unknown as Query).clone() as never, data);
  }
}
