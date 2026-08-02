import { Query, QueryReturnType } from '../query';
import { Column, ColumnsShape } from '../../columns';
import { HackySavepointState, QueryResult, TransactionAdapter } from '../../adapters/adapter';
import { ShallowSimplify } from '../../utils';
import { ColumnsParsers } from '../query-columns/query-column-parsers';
import { QueryError } from '../errors';
import { HandleResult } from '../query-data';
import { PickQueryReturnType } from '../pick-query-types';
export interface QueryThen<T> {
    <TResult1 = T, TResult2 = never>(onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>, onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>): Promise<TResult1 | TResult2>;
}
export type QueryThenShallowSimplify<T> = QueryThen<ShallowSimplify<T>>;
export type QueryThenShallowSimplifyArr<T> = QueryThen<ShallowSimplify<T>[]>;
export type QueryThenShallowSimplifyOptional<T> = QueryThen<ShallowSimplify<T> | undefined>;
export type QueryThenByQuery<T extends PickQueryReturnType, Result extends Column.QueryColumns> = T['returnType'] extends undefined | 'all' ? QueryThenShallowSimplifyArr<ColumnsShape.Output<Result>> : T['returnType'] extends 'one' ? QueryThenShallowSimplifyOptional<ColumnsShape.Output<Result>> : T['returnType'] extends 'oneOrThrow' ? QueryThenShallowSimplify<ColumnsShape.Output<Result>> : T['returnType'] extends 'value' ? QueryThen<Result['value']['__outputType'] | undefined> : T['returnType'] extends 'valueOrThrow' ? QueryThen<Result['value']['__outputType']> : T['returnType'] extends 'rows' ? QueryThen<ColumnsShape.Output<Result>[keyof Result][][]> : T['returnType'] extends 'pluck' ? QueryThen<Result['pluck']['__outputType'][]> : QueryThen<void>;
export type QueryThenByReturnType<T extends QueryReturnType, Result extends Column.QueryColumns> = T extends undefined | 'all' ? QueryThenShallowSimplifyArr<ColumnsShape.Output<Result>> : T extends 'one' ? QueryThenShallowSimplifyOptional<ColumnsShape.Output<Result>> : T extends 'oneOrThrow' ? QueryThenShallowSimplify<ColumnsShape.Output<Result>> : T extends 'value' ? QueryThen<Result['value']['__outputType'] | undefined> : T extends 'valueOrThrow' ? QueryThen<Result['value']['__outputType']> : T extends 'rows' ? QueryThen<ColumnsShape.Output<Result>[keyof Result][][]> : T extends 'pluck' ? QueryThen<Result['pluck']['__outputType'][]> : QueryThen<void>;
export interface QueryCatch {
    <Q, TResult = never>(this: {
        then: (onfulfilled?: (value: Q) => any) => any;
    }, onrejected?: (reason: any) => TResult | PromiseLike<TResult>): Promise<Q | TResult>;
}
export declare const queryMethodByReturnType: {
    [K in string]: 'query' | 'arrays';
};
type Resolve = (result: any) => any;
type Reject = (error: any) => any;
export interface QueryCatchers {
    catchUniqueError<ThenResult, CatchResult>(this: {
        then: (onfulfilled?: (value: ThenResult) => any) => any;
    }, fn: (reason: QueryError) => CatchResult): Promise<ThenResult | CatchResult>;
}
export declare class Then implements QueryCatchers {
    catch(this: Query, fn: (reason: any) => unknown): Promise<unknown>;
    catchUniqueError(fn: (reason: QueryError) => unknown): never;
}
export declare const getThen: () => (this: Query, resolve?: Resolve, reject?: Reject) => Promise<unknown>;
export declare function maybeWrappedThen(this: Query, resolve?: Resolve, reject?: Reject, parentSavepoint?: ThenSavepointState): Promise<unknown>;
export interface ThenSavepointState extends HackySavepointState {
    transactionAdapter: TransactionAdapter;
}
export declare const handleResult: HandleResult;
export declare const parseRecord: (parsers: ColumnsParsers, // oxlint-disable-next-line typescript/no-explicit-any
row: any) => unknown;
export declare const filterResult: (q: Query, returnType: QueryReturnType, queryResult: QueryResult, result: unknown, tempColumns: Set<string> | undefined, hasAfterHook?: unknown) => unknown;
export {};
