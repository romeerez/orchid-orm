import { Query, SetQueryReturnsOne, SetQueryReturnsVoid } from '../query';
import { UpdateData } from './update';
import { CreateData } from './create';
import { WhereResult } from './where';
import { MoreThanOneRowError } from '../errors';
import { isObjectEmpty } from 'orchid-core';

export type UpsertData<T extends Query> = {
  update: UpdateData<T>;
  create: CreateData<T>;
};

export type UpsertResult<T extends Query> = T['meta']['hasSelect'] extends true
  ? SetQueryReturnsOne<T>
  : SetQueryReturnsVoid<T>;

export type UpsertThis = WhereResult<Query> & {
  returnType: 'one' | 'oneOrThrow';
};

export class QueryUpsertOrCreate {
  upsert<T extends UpsertThis>(this: T, data: UpsertData<T>): UpsertResult<T> {
    return this.clone()._upsert(data);
  }

  _upsert<T extends UpsertThis>(this: T, data: UpsertData<T>): UpsertResult<T> {
    if (!isObjectEmpty(data.update)) {
      this._update<WhereResult<Query>>(data.update);
    }
    return this._orCreate(data.create);
  }

  orCreate<T extends UpsertThis>(
    this: T,
    data: CreateData<T>,
  ): UpsertResult<T> {
    return this.clone()._orCreate(data);
  }

  _orCreate<T extends UpsertThis>(
    this: T,
    data: CreateData<T>,
  ): UpsertResult<T> {
    this.query.returnType = 'one';
    this.query.wrapInTransaction = true;
    const { handleResult } = this.query;
    this.query.handleResult = (q, queryResult, i) => {
      if (queryResult.rowCount === 0) {
        return (q as Query).create(data as CreateData<Query>);
      } else if (queryResult.rowCount > 1) {
        throw new MoreThanOneRowError(
          q,
          `Only one row was expected to find, found ${queryResult.rowCount} rows.`,
        );
      }

      return handleResult(q, queryResult, i);
    };
    return this as unknown as UpsertResult<T>;
  }
}
