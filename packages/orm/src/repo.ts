import {
  EmptyObject,
  getClonedQueryData,
  MergeQuery,
  Query,
  QueryReturnType,
  SetQueryReturns,
  WhereResult,
} from 'pqb';

export type QueryMethods<T extends Query> = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (q: T, ...args: any[]) => any
>;

type QueryOne<T extends Query> = SetQueryReturns<
  T,
  Exclude<QueryReturnType, 'all'>
>;

export type MethodsBase<T extends Query> = {
  queryMethods?: QueryMethods<T>;
  queryOneMethods?: QueryMethods<QueryOne<T>>;
  queryWithWhereMethods?: QueryMethods<WhereResult<T>>;
  queryOneWithWhereMethods?: QueryMethods<QueryOne<WhereResult<T>>>;
  methods?: Record<string, unknown>;
};

export type MapQueryMethods<
  T extends Query,
  BaseQuery extends Query,
  Methods,
> = Methods extends QueryMethods<T>
  ? {
      [K in keyof Methods]: Methods[K] extends (
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
    }
  : EmptyObject;

export type MapMethods<
  T extends Query,
  Methods extends MethodsBase<T>,
> = MapQueryMethods<T, Query, Methods['queryMethods']> &
  MapQueryMethods<QueryOne<T>, QueryOne<Query>, Methods['queryOneMethods']> &
  MapQueryMethods<
    WhereResult<T>,
    WhereResult<Query>,
    Methods['queryWithWhereMethods']
  > &
  MapQueryMethods<
    QueryOne<WhereResult<T>>,
    QueryOne<WhereResult<Query>>,
    Methods['queryOneWithWhereMethods']
  > &
  (Methods['methods'] extends Record<string, unknown>
    ? Methods['methods']
    : EmptyObject);

export type Repo<
  T extends Query,
  Methods extends MethodsBase<T>,
  Mapped = MapMethods<T, Methods>,
> = (<Q extends { table: T['table']; shape: T['shape'] }>(q: Q) => Q & Mapped) &
  T &
  Mapped;

export const createRepo = <T extends Query, Methods extends MethodsBase<T>>(
  table: T,
  methods: Methods,
): Repo<T, Methods> => {
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
    result.query = getClonedQueryData(q.query);

    if (plainMethods) {
      Object.assign(proto.baseQuery, plainMethods);
    }

    for (const key in queryMethods) {
      const method = queryMethods[key] as (...args: unknown[]) => unknown;
      (proto.baseQuery as unknown as Record<string, unknown>)[key] = function (
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
  }) as unknown as Repo<T, Methods>;
};
