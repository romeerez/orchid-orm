import {
  Query,
  SetQueryKind,
  SetQueryReturnsOne,
  SetQueryReturnsVoid,
} from '../query';
import { UpdateData } from './update';
import { CreateData } from './create';
import { WhereResult } from './where';
import { MoreThanOneRowError } from '../errors';
import { isObjectEmpty } from 'orchid-core';

export type UpsertCreateArg<T extends Query> =
  | CreateData<T>
  | (() => CreateData<T>);

export type UpsertData<T extends Query> = {
  update: UpdateData<T>;
  create: UpsertCreateArg<T>;
};

export type UpsertResult<T extends Query> = T['meta']['hasSelect'] extends true
  ? SetQueryReturnsOne<SetQueryKind<T, 'upsert'>>
  : SetQueryReturnsVoid<SetQueryKind<T, 'upsert'>>;

export type UpsertThis = WhereResult<Query> & {
  returnType: 'one' | 'oneOrThrow';
};

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
   * `update` and `create` properties are accepting the same type of objects as the `update` and `create` commands.
   *
   * Not returning a value by default, place `select` or `selectAll` before `upsert` to specify returning columns.
   *
   * ```ts
   * const user = await User.selectAll()
   *   .find({ email: 'some@email.com' })
   *   .upsert({
   *     update: {
   *       name: 'updated user',
   *     },
   *     create: {
   *       email: 'some@email.com',
   *       name: 'created user',
   *     },
   *   });
   * ```
   *
   * The data for `create` may be returned from a function, it won't be called if a record was updated:
   *
   * ```ts
   * const user = await User.selectAll()
   *   .find({ email: 'some@email.com' })
   *   .upsert({
   *     update: {
   *       name: 'updated user',
   *     },
   *     create: () => ({
   *       email: 'some@email.com',
   *       name: 'created user',
   *     }),
   *   });
   * ```
   *
   * @param data - `update` property for the data to update, `create` property for the data to create
   */
  upsert<T extends UpsertThis>(this: T, data: UpsertData<T>): UpsertResult<T> {
    return this.clone()._upsert(data);
  }

  _upsert<T extends UpsertThis>(this: T, data: UpsertData<T>): UpsertResult<T> {
    if (!isObjectEmpty(data.update)) {
      this._update<WhereResult<Query>>(data.update);
    }
    return this._orCreate(data.create);
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
   * const user = await User.selectAll().find({ email: 'some@email.com' }).orCreate({
   *   email: 'some@email.com',
   *   name: 'created user',
   * });
   * ```
   *
   * The data may be returned from a function, it won't be called if the record was found:
   *
   * ```ts
   * const user = await User.selectAll()
   *   .find({ email: 'some@email.com' })
   *   .orCreate(() => ({
   *     email: 'some@email.com',
   *     name: 'created user',
   *   }));
   * ```
   *
   * @param data - the same data as for `create`, it may be returned from a callback
   */
  orCreate<T extends UpsertThis>(
    this: T,
    data: UpsertCreateArg<T>,
  ): UpsertResult<T> {
    return this.clone()._orCreate(data);
  }

  _orCreate<T extends UpsertThis>(
    this: T,
    data: UpsertCreateArg<T>,
  ): UpsertResult<T> {
    this.q.returnType = 'one';
    this.q.wrapInTransaction = true;

    const { handleResult } = this.q;
    let result: unknown;
    let created = false;
    this.q.handleResult = (q, t, r, s) => {
      return created ? result : handleResult(q, t, r, s);
    };

    this.q.patchResult = async (q, queryResult) => {
      if (queryResult.rowCount === 0) {
        if (typeof data === 'function') {
          data = data();
        }

        const inner = q.create(data as CreateData<Query>);
        const { handleResult } = inner.q;
        inner.q.handleResult = (q, t, r, s) => {
          queryResult = r;
          const res = handleResult(q, t, r, s);
          result = res;
          return res;
        };
        await inner;
        created = true;
      } else if (queryResult.rowCount > 1) {
        throw new MoreThanOneRowError(
          this,
          `Only one row was expected to find, found ${queryResult.rowCount} rows.`,
        );
      }
    };
    return this as unknown as UpsertResult<T>;
  }
}
