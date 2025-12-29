import { Query, QueryReturnType } from '../../query';
import { extendQuery } from '../../query.utils';
import { RawSql } from '../../expressions/raw-sql';
import { NotFoundError } from '../../errors';
import { applyTransforms } from '../data-transform/transform';
import { pushQueryValueImmutable, QueryData } from '../../query-data';

const noneResult = (q: Query, queryData: QueryData, type: QueryReturnType) => {
  if (!type || type === 'all' || type === 'rows' || type === 'pluck') {
    return [];
  } else if (type === 'one' || type === 'value' || type === 'void') {
    return queryData.notFoundDefault;
  } else if (type === 'valueOrThrow' && queryData.returning) {
    return 0;
  } else {
    throw new NotFoundError(q);
  }
};

/**
 * Methods added to the query prototype when calling {@link QueryMethods.none}.
 */
export const noneMethods = {
  // `then` resolves or rejects based on a return type of the query.
  // It is `async` so it returns a chainable Promise.
  async then(
    this: Query,
    resolve?: (data?: unknown) => void,
    reject?: (err: unknown) => void,
  ) {
    try {
      let result = noneResult(this, this.q, this.q.returnType);

      if (this.q.transform) {
        result = applyTransforms(
          this.q,
          this.q.returnType,
          this.q.transform,
          result,
        );
      }

      return resolve?.(result);
    } catch (err) {
      return reject?.(err);
    }
  },
  catch(this: PromiseLike<unknown>, reject?: (err: unknown) => void) {
    return this.then(undefined, reject);
  },
};

export const _queryNone = <T>(q: T): T => {
  if (isQueryNone(q)) return q;

  q = extendQuery(q as Query, noneMethods) as T;

  pushQueryValueImmutable(q as Query, 'and', new RawSql('false'));

  pushQueryValueImmutable(
    q as Query,
    'transform',
    (_: unknown, queryData: QueryData) =>
      noneResult(q as Query, queryData, queryData.returnType),
  );

  return q;
};

export const isQueryNone = (q: unknown) =>
  (q as Query).then === noneMethods.then;
