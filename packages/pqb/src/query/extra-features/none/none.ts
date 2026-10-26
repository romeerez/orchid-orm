import { Query, QueryReturnType } from '../../query';
import { extendQuery } from '../../query.utils';
import { RawSql } from '../../expressions/raw-sql';
import { NotFoundError } from '../../errors';
import { applyTransforms } from '../data-transform/transform';
import { pushQueryValueImmutable, QueryData } from '../../query-data';
import { FnExpression } from '../../expressions/fn-expression';
import { Column } from '../../../columns/column';
import { getThen } from '../../then/then';

/**
 * Value of an aggregate over no records: `0` for `count`, `null` for others.
 * `undefined` for what it doesn't evaluate: a grouped or `having`-filtered aggregate,
 * a window function, and an aggregate compared by an operator such as `count().gt(0)`.
 */
export const getNoneAggregateValue = ({
  expr,
  getColumn,
  group,
  having,
  chain,
}: QueryData) => {
  if (
    expr instanceof FnExpression &&
    // result columns of aggregates skip the not found wrapping, unlike a column of `fn`
    (getColumn as Column.Pick.Data | undefined)?.data.skipValueToArray &&
    !expr.options.over &&
    !group &&
    !having &&
    !chain
  ) {
    return expr.fn === 'count' ? 0 : null;
  }
  return;
};

const noneResult = (q: Query, queryData: QueryData, type: QueryReturnType) => {
  if (!type || type === 'all' || type === 'rows' || type === 'pluck') {
    return [];
  }

  if (type === 'value' || type === 'valueOrThrow') {
    const value = getNoneAggregateValue(queryData);
    if (value !== undefined) return value;
  }

  if (type === 'one' || type === 'value' || type === 'void') {
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
    // `orCreate` and `upsert` of a `none` query create the record
    if (this.q.upsertSecond) {
      return getThen().call(this, resolve, reject);
    }

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
};

export const _queryNone = <T>(q: T): T => {
  if (isQueryNone(q)) return q;

  q = extendQuery(q as Query, noneMethods) as T;
  // `none` cancels `orCreate` and `upsert` of a `none` query
  (q as Query).q.upsertSecond = undefined;

  pushQueryValueImmutable(q as Query, 'and', new RawSql('false'));

  pushQueryValueImmutable(
    q as Query,
    'transform',
    (data: unknown, queryData: QueryData) =>
      queryData.upsertSecond
        ? data
        : noneResult(q as Query, queryData, queryData.returnType),
  );

  return q;
};

/**
 * Whether the query resolves without querying the database.
 * `orCreate` and `upsert` of a `none` query don't: they create the record.
 */
export const isQueryNone = (q: unknown) =>
  (q as Query).then === noneMethods.then && !(q as Query).q.upsertSecond;

/**
 * Whether the query is `orCreate` or `upsert` of a `none` query.
 */
export const isQueryNoneUpsert = (q: unknown) =>
  (q as Query).then === noneMethods.then && !!(q as Query).q.upsertSecond;
