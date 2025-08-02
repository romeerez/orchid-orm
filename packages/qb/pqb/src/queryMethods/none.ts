import { Query } from '../query/query';
import { noop, pushQueryValueImmutable, QueryReturnType } from 'orchid-core';
import { NotFoundError } from '../errors';
import { extendQuery } from '../query/queryUtils';
import { RawSQL } from '../sql/rawSql';
import { QueryData } from '../sql';

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
      const result = noneResult(this, this.q, this.q.returnType);
      resolve?.(result);
    } catch (err) {
      reject?.(err);
    }
  },
  // `catch` returns a Promise, so it is chainable with then/catch.
  catch: () => new Promise(noop),
};

export const _queryNone = <T>(q: T): T => {
  if (isQueryNone(q)) return q;

  q = extendQuery(q as Query, noneMethods) as T;

  pushQueryValueImmutable(q as Query, 'and', new RawSQL('false'));

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
