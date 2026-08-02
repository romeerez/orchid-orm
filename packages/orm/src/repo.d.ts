import { MergeQuery, QueryReturnType, RecordUnknown, QueryHasWhere } from 'pqb/internal';
import { Query } from 'pqb';
type QueryMethods<T extends Query> = Record<string, (q: T, ...args: any[]) => any>;
type QueryOne<T extends Query> = {
    [K in keyof T]: K extends 'returnType' ? Exclude<QueryReturnType, 'all' | undefined> : T[K];
};
export interface MethodsBase<T extends Query> {
    queryMethods?: QueryMethods<T>;
    queryOneMethods?: QueryMethods<QueryOne<T>>;
    queryWithWhereMethods?: QueryMethods<T & QueryHasWhere>;
    queryOneWithWhereMethods?: QueryMethods<QueryOne<T & QueryHasWhere>>;
    methods?: RecordUnknown;
}
export type MapQueryMethods<BaseQuery extends Query, Method> = Method extends (q: any, ...args: infer Args) => infer Result ? <T extends BaseQuery>(this: T, ...args: Args) => Result extends Query ? MergeQuery<T, Result> : Result : never;
export type MapMethods<T extends Query, Methods extends MethodsBase<T>> = {
    [K in keyof Methods['queryMethods'] | keyof Methods['queryOneMethods'] | keyof Methods['queryWithWhereMethods'] | keyof Methods['queryOneWithWhereMethods'] | keyof Methods['methods']]: K extends keyof Methods['methods'] ? Methods['methods'][K] : K extends keyof Methods['queryOneWithWhereMethods'] ? MapQueryMethods<QueryOne<Query & QueryHasWhere>, Methods['queryOneWithWhereMethods'][K]> : K extends keyof Methods['queryWithWhereMethods'] ? MapQueryMethods<Query & QueryHasWhere, Methods['queryWithWhereMethods'][K]> : K extends keyof Methods['queryOneMethods'] ? MapQueryMethods<QueryOne<Query>, Methods['queryOneMethods'][K]> : K extends keyof Methods['queryMethods'] ? MapQueryMethods<Query, Methods['queryMethods'][K]> : never;
};
export type Repo<T extends Query, Methods extends MethodsBase<T>> = T & MapMethods<T, Methods>;
export declare const createRepo: <T extends Query, Methods extends MethodsBase<T>>(table: T, methods: Methods) => Repo<(<Q extends {
    table: T['table'];
    shape: T['shape'];
}>(q: Q) => Query & Q & MapMethods<T, Methods>) & T, Methods>;
export {};
