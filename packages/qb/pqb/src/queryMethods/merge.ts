import { Query, QueryReturnType, QueryThen } from '../query';
import { getValueKey } from './get';
import { SelectQueryData } from '../sql';
import { Spread } from 'orchid-core';

export type MergeQuery<
  T extends Query,
  Q extends Query,
  ReturnType extends QueryReturnType = QueryReturnType extends Q['returnType']
    ? T['returnType']
    : Q['returnType'],
> = Omit<T, 'result' | 'returnType' | 'then'> & {
  meta: {
    hasSelect: Q['meta']['hasSelect'];
    hasWhere: Q['meta']['hasWhere'];
  };
  result: T['meta']['hasSelect'] extends true
    ? Spread<[T['result'], Q['result']]>
    : Q['result'];
  returnType: ReturnType;
  then: T['meta']['hasSelect'] extends true
    ? QueryThen<ReturnType, Spread<[T['result'], Q['result']]>>
    : QueryThen<ReturnType, Q['result']>;
  selectable: T['selectable'] & Q['selectable'];
  joinedTables: T['joinedTables'] & Q['joinedTables'];
  windows: T['windows'] & Q['windows'];
  withData: T['withData'] & Q['withData'];
};

const mergableObjects: Record<string, boolean> = {
  shape: true,
  withShapes: true,
  parsers: true,
  defaults: true,
  joinedShapes: true,
  joinedParsers: true,
};

export class MergeQueryMethods {
  merge<T extends Query, Q extends Query>(this: T, q: Q): MergeQuery<T, Q> {
    return this.clone()._merge(q);
  }
  _merge<T extends Query, Q extends Query>(this: T, q: Q): MergeQuery<T, Q> {
    const a = this.query as Record<string, unknown>;
    const b = q.query as Record<string, unknown>;

    for (const key in b) {
      const value = b[key];
      switch (typeof value) {
        case 'boolean':
        case 'string':
        case 'number':
          a[key] = value;
          break;
        case 'object':
          if (Array.isArray(value)) {
            a[key] = a[key] ? [...(a[key] as unknown[]), ...value] : value;
          } else if (mergableObjects[key]) {
            a[key] = a[key]
              ? { ...(a[key] as Record<string, unknown>), ...value }
              : value;
          } else {
            a[key] = value;
          }
          break;
      }
    }

    (a as SelectQueryData)[getValueKey] = (b as SelectQueryData)[getValueKey];

    if (b.returnType) a.returnType = b.returnType;

    return this as unknown as MergeQuery<T, Q>;
  }
}
