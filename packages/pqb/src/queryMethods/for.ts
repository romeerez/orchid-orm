import { Query } from '../query';
import { RawExpression } from '../common';
import { setQueryValue } from '../queryDataUtils';
import { QueryData } from '../sql';

type ForQueryBuilder<Q extends Query> = Q & {
  noWait<T extends ForQueryBuilder<Q>>(this: T): T;
  _noWait<T extends ForQueryBuilder<Q>>(this: T): T;
  skipLocked<T extends ForQueryBuilder<Q>>(this: T): T;
  _skipLocked<T extends ForQueryBuilder<Q>>(this: T): T;
};

const forQueryBuilder = <T extends Query>(
  q: T,
  type: Exclude<QueryData['for'], undefined>['type'],
  tableNames?: string[] | RawExpression,
) => {
  setQueryValue(q, 'for', { type, tableNames });
  return Object.assign(q, {
    noWait<T extends ForQueryBuilder<Query>>(this: T): T {
      return this.clone()._noWait();
    },
    _noWait<T extends ForQueryBuilder<Query>>(this: T): T {
      if (this.query?.for) this.query.for.mode = 'NO WAIT';
      return this;
    },
    skipLocked<T extends ForQueryBuilder<Query>>(this: T): T {
      return this.clone()._skipLocked();
    },
    _skipLocked<T extends ForQueryBuilder<Query>>(this: T): T {
      if (this.query?.for) this.query.for.mode = 'SKIP LOCKED';
      return this;
    },
  });
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
