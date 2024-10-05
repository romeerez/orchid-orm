import { Query } from '../query/query';
import { SelectQueryData } from '../sql';
import { Expression, IsQuery } from 'orchid-core';
import { _clone, extendQuery } from '../query/queryUtils';

type ForQueryBuilder<Q> = Q & {
  noWait<T extends Q>(this: T): T;
  skipLocked<T extends Q>(this: T): T;
};

const forMethods = {
  noWait() {
    const q = _clone(this);
    const data = q.q as SelectQueryData | undefined;
    if (data?.for) data.for.mode = 'NO WAIT';
    return q as never;
  },
  skipLocked() {
    const q = _clone(this);
    const data = q.q as SelectQueryData | undefined;
    if (data?.for) data.for.mode = 'SKIP LOCKED';
    return q as never;
  },
};

// Extends the query with `for` methods, the query is cloned, and sets `for` data.
const forQueryBuilder = <T>(
  arg: T,
  type: Exclude<SelectQueryData['for'], undefined>['type'],
  tableNames?: string[] | Expression,
): ForQueryBuilder<T> => {
  const q = extendQuery(arg as Query, forMethods);

  (q.q as SelectQueryData).for = {
    type,
    tableNames,
  };

  return q as never;
};

export class For {
  forUpdate<T extends IsQuery>(
    this: T,
    tableNames?: string[] | Expression,
  ): ForQueryBuilder<T> {
    return forQueryBuilder(this, 'UPDATE', tableNames);
  }

  forNoKeyUpdate<T extends IsQuery>(
    this: T,
    tableNames?: string[] | Expression,
  ): ForQueryBuilder<T> {
    return forQueryBuilder(this, 'NO KEY UPDATE', tableNames);
  }

  forShare<T extends IsQuery>(
    this: T,
    tableNames?: string[] | Expression,
  ): ForQueryBuilder<T> {
    return forQueryBuilder(this, 'SHARE', tableNames);
  }

  forKeyShare<T extends IsQuery>(
    this: T,
    tableNames?: string[] | Expression,
  ): ForQueryBuilder<T> {
    return forQueryBuilder(this, 'KEY SHARE', tableNames);
  }
}
