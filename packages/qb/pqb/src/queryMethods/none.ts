import { Query } from '../query/query';
import { noop } from 'orchid-core';
import { NotFoundError } from '../errors';
import { extendQuery, pushQueryValueImmutable } from '../query/queryUtils';
import { RawSQL } from '../sql/rawSql';

/**
 * Methods added to the query prototype when calling {@link QueryMethods.none}.
 */
export const noneMethods = {
  // `then` resolves or rejects based on return type of the query.
  // It is `async` so it returns a chainable Promise.
  async then(
    this: Query,
    resolve?: (data?: unknown) => void,
    reject?: (err: unknown) => void,
  ) {
    const type = this.q.returnType;
    if (!type || type === 'all' || type === 'rows' || type === 'pluck')
      resolve?.([]);
    else if (type === 'one' || type === 'value' || type === 'void') resolve?.();
    else if (type === 'valueOrThrow' && this.q.returning) resolve?.(0);
    else reject?.(new NotFoundError(this));
  },
  // `catch` returns a Promise, so it is chainable with then/catch.
  catch: () => new Promise(noop),
};

export const _queryNone = <T>(q: T): T => {
  if (isQueryNone(q)) return q;

  q = extendQuery(q as Query, noneMethods) as T;
  pushQueryValueImmutable(q as Query, 'and', new RawSQL('false'));
  return q;
};

export const isQueryNone = (q: unknown) =>
  (q as Query).then === noneMethods.then;
