import { Query, QueryReturnType, QueryThen } from '../query';
import { QueryData } from '../sql';
import { Spread } from '../utils';

export type MergeQuery<
  T extends Query,
  Q extends Query,
  ReturnType extends QueryReturnType = QueryReturnType extends Q['returnType']
    ? T['returnType']
    : Q['returnType'],
> = Omit<T, 'result' | 'returnType' | 'then'> & {
  hasSelect: Q['hasSelect'] extends true ? true : T['hasSelect'];
  result: T['hasSelect'] extends true
    ? Spread<[T['result'], Q['result']]>
    : Q['result'];
  returnType: ReturnType;
  then: T['hasSelect'] extends true
    ? QueryThen<ReturnType, Spread<[T['result'], Q['result']]>>
    : QueryThen<ReturnType, Q['result']>;
};

const mergeArray = (a: QueryData, b: QueryData, key: keyof QueryData) => {
  type T = Record<keyof QueryData, unknown[]>;

  if (a[key]) {
    if (b[key]) {
      (a as unknown as T)[key].push(...(b as unknown as T)[key]);
    }
  } else if (b[key]) {
    (a as unknown as T)[key] = (b as unknown as T)[key];
  }
};

export class MergeQueryMethods {
  merge<T extends Query, Q extends Query>(this: T, q: Q): MergeQuery<T, Q> {
    return this.clone()._merge(q);
  }
  _merge<T extends Query, Q extends Query>(this: T, q: Q): MergeQuery<T, Q> {
    const a = this.query;
    const b = q.query;

    mergeArray(a, b, 'select');

    if (b.returnType) a.returnType = b.returnType;

    return this as unknown as MergeQuery<T, Q>;
  }
}
