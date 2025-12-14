import {
  Query,
  SetQueryReturnsOneKind,
  SetQueryReturnsValueOrThrowKind,
  SetQueryReturnsVoidKind,
} from '../../query/query';
import { _queryUpdate, UpdateData, UpdateSelf } from './update';
import { CreateData, CreateSelf } from './create';
import {
  isObjectEmpty,
  PickQueryMetaResultReturnType,
  QueryMetaBase,
} from '../../core';
import { _clone } from '../../query/queryUtils';
import { _orCreate } from './orCreate';

type UpsertCreate<DataKey extends PropertyKey, CD> = {
  [K in keyof CD as K extends DataKey ? never : K]: CD[K];
} & {
  [K in DataKey]?: K extends keyof CD ? CD[K] : never;
};

// unless upsert query has a select, it returns void
export type UpsertResult<T extends PickQueryMetaResultReturnType> =
  T['meta']['hasSelect'] extends true
    ? T['returnType'] extends 'value' | 'valueOrThrow'
      ? SetQueryReturnsValueOrThrowKind<T, 'upsert'>
      : SetQueryReturnsOneKind<T, 'upsert'>
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

export interface QueryUpsert {
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
   *       // supports sql and nested queries
   *       fromSQL: () => sql`*SQL expression*`,
   *       fromQuery: () => db.someTable.create(data).get('column'),
   *     },
   *     create: {
   *       // create a new record with this email and a name 'new name'
   *       email: 'some@email.com',
   *       // supports sql and nested queries as well
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
  upsert<T extends UpsertThis, Update extends UpdateData<T>>(
    this: T,
    data:
      | {
          update: Update;
          create: CreateData<T> | ((update: Update) => CreateData<T>);
        }
      | {
          data: Update;
          create:
            | UpsertCreate<keyof Update, CreateData<T>>
            | ((update: Update) => UpsertCreate<keyof Update, CreateData<T>>);
        },
  ): UpsertResult<T>;
}

export const QueryUpsert: QueryUpsert = {
  upsert(data) {
    const q = _clone(this);
    q.q.upsertUpdate = true;

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

    return _orCreate(q as Query, data.create, updateData, mergeData) as never;
  },
};
