import { Query } from '../query/query';
import { SelectQueryData } from '../sql';
import { Expression } from 'orchid-core';
import { extendQuery } from '../query/queryUtils';

type ForQueryBuilder<Q extends Query> = Q & {
  noWait<T extends ForQueryBuilder<Q>>(this: T): T;
  skipLocked<T extends ForQueryBuilder<Q>>(this: T): T;
};

const forMethods = {
  noWait<T extends ForQueryBuilder<Query>>(this: T): T {
    const q = this.clone();
    const data = q.q as SelectQueryData | undefined;
    if (data?.for) data.for.mode = 'NO WAIT';
    return q;
  },
  skipLocked<T extends ForQueryBuilder<Query>>(this: T): T {
    const q = this.clone();
    const data = q.q as SelectQueryData | undefined;
    if (data?.for) data.for.mode = 'SKIP LOCKED';
    return q;
  },
};

// Extends the query with `for` methods, the query is cloned, and sets `for` data.
const forQueryBuilder = <T extends Query>(
  q: T,
  type: Exclude<SelectQueryData['for'], undefined>['type'],
  tableNames?: string[] | Expression,
) => {
  q = extendQuery(q, forMethods);

  (q.q as SelectQueryData).for = {
    type,
    tableNames,
  };

  return q as ForQueryBuilder<T>;
};

export class For {
  forUpdate<T extends Query>(
    this: T,
    tableNames?: string[] | Expression,
  ): ForQueryBuilder<T> {
    return forQueryBuilder(this, 'UPDATE', tableNames);
  }

  forNoKeyUpdate<T extends Query>(
    this: T,
    tableNames?: string[] | Expression,
  ): ForQueryBuilder<T> {
    return forQueryBuilder(this, 'NO KEY UPDATE', tableNames);
  }

  forShare<T extends Query>(
    this: T,
    tableNames?: string[] | Expression,
  ): ForQueryBuilder<T> {
    return forQueryBuilder(this, 'SHARE', tableNames);
  }

  forKeyShare<T extends Query>(
    this: T,
    tableNames?: string[] | Expression,
  ): ForQueryBuilder<T> {
    return forQueryBuilder(this, 'KEY SHARE', tableNames);
  }
}
