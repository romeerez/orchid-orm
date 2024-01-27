import { Query, QueryReturnType, GetQueryResult } from '../query/query';
import { SelectQueryData } from '../sql';
import {
  getValueKey,
  MergeObjects,
  QueryCatch,
  QueryColumns,
  QueryThen,
} from 'orchid-core';

export type MergeQuery<
  T extends Query,
  Q extends Query,
  ReturnType extends QueryReturnType = QueryReturnType extends Q['returnType']
    ? T['returnType']
    : Q['returnType'],
  Result extends QueryColumns = T['meta']['hasSelect'] extends true
    ? Q['meta']['hasSelect'] extends true
      ? {
          [K in
            | keyof T['result']
            | keyof Q['result']]: K extends keyof Q['result']
            ? Q['result'][K]
            : T['result'][K];
        }
      : T['result']
    : Q['result'],
  Data = GetQueryResult<ReturnType, Result>,
> = {
  [K in keyof T]: K extends 'meta'
    ? MergeObjects<T['meta'], Q['meta']>
    : K extends 'result'
    ? Result
    : K extends 'returnType'
    ? ReturnType
    : K extends 'then'
    ? QueryThen<Data>
    : K extends 'catch'
    ? QueryCatch<Data>
    : K extends 'selectable'
    ? MergeObjects<T['selectable'], Q['selectable']>
    : K extends 'windows'
    ? MergeObjects<T['windows'], Q['windows']>
    : K extends 'withData'
    ? MergeObjects<T['withData'], Q['withData']>
    : T[K];
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
    const query = this.clone();
    const a = query.q as Record<string, unknown>;
    const b = q.q as Record<string, unknown>;

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

    return query as unknown as MergeQuery<T, Q>;
  }
}
