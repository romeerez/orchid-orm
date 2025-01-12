import {
  PickQueryMetaResultReturnTypeWithDataWindows,
  PickQueryQ,
} from '../query/query';
import { UnionSet } from '../sql';
import {
  PickQueryMetaResult,
  QueryThenByQuery,
  RecordUnknown,
} from 'orchid-core';
import { _clone } from '../query/queryUtils';

export type MergeQuery<
  T extends PickQueryMetaResultReturnTypeWithDataWindows,
  Q extends PickQueryMetaResultReturnTypeWithDataWindows,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta'] | keyof Q['meta']]: K extends 'selectable'
          ? Q['meta']['selectable'] &
              Omit<T['meta']['selectable'], keyof Q['meta']['selectable']>
          : K extends 'hasWhere' | 'hasSelect'
          ? T['meta'][K] & Q['meta'][K] // true if any of them is true
          : K extends keyof Q['meta']
          ? Q['meta'][K]
          : T['meta'][K];
      }
    : K extends 'result'
    ? MergeQueryResult<T, Q>
    : K extends 'returnType'
    ? Q['returnType'] extends undefined
      ? T['returnType']
      : Q['returnType']
    : K extends 'then'
    ? QueryThenByQuery<
        Q['returnType'] extends undefined ? T : Q,
        MergeQueryResult<T, Q>
      >
    : K extends 'windows'
    ? Q['windows'] & Omit<T['windows'], keyof Q['windows']>
    : K extends 'withData'
    ? Q['withData'] & Omit<T['withData'], keyof Q['withData']>
    : T[K];
};

type MergeQueryResult<
  T extends PickQueryMetaResult,
  Q extends PickQueryMetaResult,
> = T['meta']['hasSelect'] extends true
  ? Q['meta']['hasSelect'] extends true
    ? Omit<T['result'], keyof Q['result']> & Q['result']
    : T['result']
  : Q['result'];

const mergableObjects = new Set([
  'shape',
  'withShapes',
  'parsers',
  'defaults',
  'joinedShapes',
  'joinedParsers',
  'joinedBatchParsers',
  'selectedComputeds',
]);

const dontMergeArrays = new Set(['selectAllColumns', 'selectAllKeys']);

export class MergeQueryMethods {
  merge<
    T extends PickQueryMetaResultReturnTypeWithDataWindows,
    Q extends PickQueryMetaResultReturnTypeWithDataWindows,
  >(this: T, q: Q): MergeQuery<T, Q> {
    const query = _clone(this);
    const a = query.q as never as RecordUnknown;
    const b = (q as unknown as PickQueryQ).q as never as RecordUnknown;

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
            if (!dontMergeArrays.has(key)) {
              a[key] = a[key] ? [...(a[key] as unknown[]), ...value] : value;
            }
          } else if (mergableObjects.has(key)) {
            a[key] = a[key]
              ? { ...(a[key] as RecordUnknown), ...value }
              : value;
          } else if (key === 'union') {
            a[key] = a[key]
              ? {
                  b: (a[key] as UnionSet).b,
                  u: [...(a[key] as UnionSet).u, ...(value as UnionSet).u],
                }
              : value;
          } else if (value instanceof Set) {
            a[key] = a[key]
              ? new Set([...(a[key] as Set<unknown>), ...value])
              : value;
          } else {
            a[key] = value;
          }
          break;
      }
    }

    if (b.returnType) a.returnType = b.returnType;

    return query as never;
  }
}
