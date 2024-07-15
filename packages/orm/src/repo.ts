import { getClonedQueryData, MergeQuery, Query, WhereResult } from 'pqb';
import { QueryReturnType, RecordUnknown } from 'orchid-core';

type QueryMethods<T extends Query> = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (q: T, ...args: any[]) => any
>;

type QueryOne<T extends Query> = {
  [K in keyof T]: K extends 'returnType'
    ? Exclude<QueryReturnType, 'all' | undefined>
    : T[K];
};

export interface MethodsBase<T extends Query> {
  queryMethods?: QueryMethods<T>;
  queryOneMethods?: QueryMethods<QueryOne<T>>;
  queryWithWhereMethods?: QueryMethods<WhereResult<T>>;
  queryOneWithWhereMethods?: QueryMethods<QueryOne<WhereResult<T>>>;
  methods?: RecordUnknown;
}

export type MapQueryMethods<BaseQuery extends Query, Method> = Method extends (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: any,
  ...args: infer Args
) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
infer Result
  ? <T extends BaseQuery>(
      this: T,
      ...args: Args
    ) => Result extends Query ? MergeQuery<T, Result> : Result
  : never;

export type MapMethods<T extends Query, Methods extends MethodsBase<T>> = {
  [K in
    | keyof Methods['queryMethods']
    | keyof Methods['queryOneMethods']
    | keyof Methods['queryWithWhereMethods']
    | keyof Methods['queryOneWithWhereMethods']
    | keyof Methods['methods']]: K extends keyof Methods['methods']
    ? Methods['methods'][K]
    : K extends keyof Methods['queryOneWithWhereMethods']
    ? MapQueryMethods<
        QueryOne<WhereResult<Query>>,
        Methods['queryOneWithWhereMethods'][K]
      >
    : K extends keyof Methods['queryWithWhereMethods']
    ? MapQueryMethods<WhereResult<Query>, Methods['queryWithWhereMethods'][K]>
    : K extends keyof Methods['queryOneMethods']
    ? MapQueryMethods<QueryOne<Query>, Methods['queryOneMethods'][K]>
    : K extends keyof Methods['queryMethods']
    ? MapQueryMethods<Query, Methods['queryMethods'][K]>
    : never;
};

export type Repo<T extends Query, Methods extends MethodsBase<T>> = T &
  MapMethods<T, Methods>;

export const createRepo = <T extends Query, Methods extends MethodsBase<T>>(
  table: T,
  methods: Methods,
): Repo<
  (<Q extends { table: T['table']; shape: T['shape'] }>(
    q: Q,
  ) => Query & Q & MapMethods<T, Methods>) &
    T,
  Methods
> => {
  const queryMethods = {
    ...methods.queryMethods,
    ...methods.queryOneMethods,
    ...methods.queryWithWhereMethods,
    ...methods.queryOneWithWhereMethods,
  };

  const plainMethods = methods.methods;

  const repo = (q: Query) => {
    const proto = Object.create(q.baseQuery);
    proto.baseQuery = proto;
    const result = Object.create(proto);
    result.q = getClonedQueryData(q.q);

    if (plainMethods) {
      Object.assign(proto.baseQuery, plainMethods);
    }

    for (const key in queryMethods) {
      const method = queryMethods[key] as (...args: unknown[]) => unknown;
      (proto.baseQuery as unknown as RecordUnknown)[key] = function (
        ...args: unknown[]
      ) {
        return method(this, ...args);
      };
    }

    return result;
  };

  const q = repo(table);

  return new Proxy(repo, {
    get(_, key) {
      return q[key];
    },
  }) as never;
};
