import {
  PickQueryMeta,
  PickQueryMetaResult,
  PickQueryQ,
  PickQueryResult,
  PickQueryReturnType,
  PickQuerySelectable,
  PickQueryTable,
  PickQueryThen,
  PickQueryWindows,
  PickQueryWithData,
} from '../../pick-query-types';
import { RecordUnknown } from '../../../utils';
import { _clone } from '../../basic-features/clone/clone';
import { UnionSet } from '../../basic-features/union/union.sql';
import { QueryThenByQuery } from '../../then/then';

export interface MergeQueryArg
  extends PickQueryTable,
    PickQueryMeta,
    PickQuerySelectable,
    PickQueryResult,
    PickQueryReturnType,
    PickQueryWithData,
    PickQueryWindows,
    PickQueryThen {}

export type MergeQuery<T extends MergeQueryArg, Q extends MergeQueryArg> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta'] | keyof Q['meta']]: K extends
          | 'hasWhere'
          | 'hasSelect'
          ? T['meta'][K] & Q['meta'][K] // true if any of them is true
          : K extends keyof Q['meta']
          ? Q['meta'][K]
          : T['meta'][K];
      }
    : K extends '__selectable'
    ? Q['__selectable'] & Omit<T['__selectable'], keyof Q['__selectable']>
    : K extends 'result'
    ? MergeQueryResult<T, Q>
    : K extends 'returnType'
    ? Q['returnType'] extends undefined
      ? T['returnType']
      : Q['returnType']
    : K extends 'then'
    ? // Q may be an update query that returns count by default,
      // and whether it returns count or not depends on if the T query had selected anything.
      Q['returnType'] extends undefined
      ? QueryThenByQuery<T, MergeQueryResult<T, Q>>
      : Q['returnType'] extends 'all' | 'one' | 'oneOrThrow' | 'rows'
      ? QueryThenByQuery<Q, MergeQueryResult<T, Q>>
      : Q['meta']['hasSelect'] extends true
      ? Q['then']
      : T['meta']['hasSelect'] extends true
      ? T['then']
      : Q['then']
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
  'defaultParsers',
  'parsers',
  'defaults',
  'joinedShapes',
  'joinedParsers',
  'joinedBatchParsers',
  'selectedComputeds',
]);

const dontMergeArrays = new Set(['selectAllColumns']);

export class MergeQueryMethods {
  merge<T extends MergeQueryArg, Q extends MergeQueryArg>(
    this: T,
    q: Q,
  ): MergeQuery<T, Q> {
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
