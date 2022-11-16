import {
  EmptyObject,
  getClonedQueryData,
  MergeQuery,
  Query,
  SetQueryReturns,
  WhereResult,
} from 'pqb';

export type QueryMethods<T extends Query> = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (q: T, ...args: any[]) => any
>;

export type MethodsBase<T extends Query> = {
  queryMethods?: QueryMethods<T>;
  queryOneMethods?: QueryMethods<SetQueryReturns<T, 'one' | 'oneOrThrow'>>;
  queryWithWhereMethods?: QueryMethods<WhereResult<T>>;
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
  MapQueryMethods<
    SetQueryReturns<T, 'one' | 'oneOrThrow'>,
    SetQueryReturns<Query, 'one' | 'oneOrThrow'>,
    Methods['queryOneMethods']
  > &
  MapQueryMethods<
    WhereResult<T>,
    WhereResult<Query>,
    Methods['queryWithWhereMethods']
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
  model: T,
  methods: Methods,
): Repo<T, Methods> => {
  const queryMethods = {
    ...methods.queryMethods,
    ...methods.queryOneMethods,
    ...methods.queryWithWhereMethods,
  };

  const plainMethods = methods.methods;

  const repo = (q: Query) => {
    const proto = Object.create(q.__model);
    proto.__model = proto;
    const result = Object.create(proto);
    result.query = getClonedQueryData(q.query);

    if (plainMethods) {
      Object.assign(proto.__model, plainMethods);
    }

    for (const key in queryMethods) {
      const method = queryMethods[key] as (...args: unknown[]) => unknown;
      (proto.__model as unknown as Record<string, unknown>)[key] = function (
        ...args: unknown[]
      ) {
        return method(this, ...args);
      };
    }

    return result;
  };

  const q = repo(model);

  return new Proxy(repo, {
    get(_, key) {
      return q[key];
    },
  }) as unknown as Repo<T, Methods>;
};
