import { Query } from '../query';
import { SelectQueryData } from '../sql';
import { RawExpression } from '../raw';

type ForQueryBuilder<Q extends Query> = Q & {
  noWait<T extends ForQueryBuilder<Q>>(this: T): T;
  _noWait<T extends ForQueryBuilder<Q>>(this: T): T;
  skipLocked<T extends ForQueryBuilder<Q>>(this: T): T;
  _skipLocked<T extends ForQueryBuilder<Q>>(this: T): T;
};

const forQueryBuilder = <T extends Query>(
  q: T,
  type: Exclude<SelectQueryData['for'], undefined>['type'],
  tableNames?: string[] | RawExpression,
) => {
  (q.query as SelectQueryData).for = { type, tableNames };
  q.baseQuery = Object.create(q.baseQuery);
  q.baseQuery.baseQuery = q.baseQuery;

  Object.assign(q.baseQuery, {
    noWait<T extends ForQueryBuilder<Query>>(this: T): T {
      return this.clone()._noWait();
    },
    _noWait<T extends ForQueryBuilder<Query>>(this: T): T {
      const q = this.query as SelectQueryData | undefined;
      if (q?.for) q.for.mode = 'NO WAIT';
      return this;
    },
    skipLocked<T extends ForQueryBuilder<Query>>(this: T): T {
      return this.clone()._skipLocked();
    },
    _skipLocked<T extends ForQueryBuilder<Query>>(this: T): T {
      const q = this.query as SelectQueryData | undefined;
      if (q?.for) q.for.mode = 'SKIP LOCKED';
      return this;
    },
  });

  return q.clone() as ForQueryBuilder<T>;
};

export class For {
  forUpdate<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): ForQueryBuilder<T> {
    return this.clone()._forUpdate(tableNames);
  }

  _forUpdate<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): ForQueryBuilder<T> {
    return forQueryBuilder(this, 'UPDATE', tableNames);
  }

  forNoKeyUpdate<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): ForQueryBuilder<T> {
    return this.clone()._forNoKeyUpdate(tableNames);
  }

  _forNoKeyUpdate<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): ForQueryBuilder<T> {
    return forQueryBuilder(this, 'NO KEY UPDATE', tableNames);
  }

  forShare<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): ForQueryBuilder<T> {
    return this.clone()._forShare(tableNames);
  }

  _forShare<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): ForQueryBuilder<T> {
    return forQueryBuilder(this, 'SHARE', tableNames);
  }

  forKeyShare<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): ForQueryBuilder<T> {
    return this.clone()._forKeyShare(tableNames);
  }

  _forKeyShare<T extends Query>(
    this: T,
    tableNames?: string[] | RawExpression,
  ): ForQueryBuilder<T> {
    return forQueryBuilder(this, 'KEY SHARE', tableNames);
  }
}
