import { ShallowSimplify } from '../utils';
import { QueryReturnType } from '../query/query';
import { ColumnShapeOutput, QueryColumns } from '../columns';
import { PickQueryReturnType } from '../query/pick-query-types';

// This is a standard Promise['then'] method
// copied from TS standard library because the original `then` is not decoupled from the Promise
export interface QueryThen<T> {
  <TResult1 = T, TResult2 = never>(
    onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>,
  ): Promise<TResult1 | TResult2>;
}

export type QueryThenShallowSimplify<T> = QueryThen<ShallowSimplify<T>>;

export type QueryThenShallowSimplifyArr<T> = QueryThen<ShallowSimplify<T>[]>;

export type QueryThenShallowSimplifyOptional<T> = QueryThen<
  ShallowSimplify<T> | undefined
>;

export type QueryThenByQuery<
  T extends PickQueryReturnType,
  Result extends QueryColumns,
> = T['returnType'] extends undefined | 'all'
  ? QueryThenShallowSimplifyArr<ColumnShapeOutput<Result>>
  : T['returnType'] extends 'one'
  ? QueryThenShallowSimplifyOptional<ColumnShapeOutput<Result>>
  : T['returnType'] extends 'oneOrThrow'
  ? QueryThenShallowSimplify<ColumnShapeOutput<Result>>
  : T['returnType'] extends 'value'
  ? QueryThen<Result['value']['outputType'] | undefined>
  : T['returnType'] extends 'valueOrThrow'
  ? QueryThen<Result['value']['outputType']>
  : T['returnType'] extends 'rows'
  ? QueryThen<ColumnShapeOutput<Result>[keyof Result][][]>
  : T['returnType'] extends 'pluck'
  ? QueryThen<Result['pluck']['outputType'][]>
  : QueryThen<void>;

export type QueryThenByReturnType<
  T extends QueryReturnType,
  Result extends QueryColumns,
> = T extends undefined | 'all'
  ? QueryThenShallowSimplifyArr<ColumnShapeOutput<Result>>
  : T extends 'one'
  ? QueryThenShallowSimplifyOptional<ColumnShapeOutput<Result>>
  : T extends 'oneOrThrow'
  ? QueryThenShallowSimplify<ColumnShapeOutput<Result>>
  : T extends 'value'
  ? QueryThen<Result['value']['outputType'] | undefined>
  : T extends 'valueOrThrow'
  ? QueryThen<Result['value']['outputType']>
  : T extends 'rows'
  ? QueryThen<ColumnShapeOutput<Result>[keyof Result][][]>
  : T extends 'pluck'
  ? QueryThen<Result['pluck']['outputType'][]>
  : QueryThen<void>;

// This is a standard Promise['catch'] method
// copied from TS standard library because the original `catch` is not decoupled from the Promise
export interface QueryCatch {
  <Q, TResult = never>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this: { then: (onfulfilled?: (value: Q) => any) => any },
    onrejected?: (reason: any) => TResult | PromiseLike<TResult>,
  ): Promise<Q | TResult>;
}
