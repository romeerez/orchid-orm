import { Column } from '../../../columns';
import { PickQueryRelationsWithData, PickQuerySelectable } from '../../pick-query-types';
import { Expression } from '../../expressions/expression';
import { IsQuery, Query, SetQueryReturnsColumnOptional, SetQueryReturnsColumnOrThrow, SetQueryReturnsValueOptional, SetQueryReturnsValueOrThrow } from '../../query';
import type { SelectAsFnArg } from '../select/select';
export interface QueryGetSelf extends PickQuerySelectable, PickQueryRelationsWithData {
}
export type GetArg<T extends QueryGetSelf> = GetStringArg<T> | Expression | ((q: SelectAsFnArg<T>) => Expression | Query.Pick.SingleValueResult);
export type GetStringArg<T extends PickQuerySelectable> = keyof T['__selectable'] & string;
type ResolveGetArgColumn<Arg> = Arg extends Expression ? Arg['result']['value'] : Arg extends (q: never) => infer R ? R extends Expression ? R['result']['value'] : R extends Query.Pick.SingleValueResult ? R['result']['value'] : never : never;
export type GetResult<T extends QueryGetSelf, Arg extends GetArg<T>> = Arg extends string ? SetQueryReturnsValueOrThrow<T, Arg> : SetQueryReturnsColumnOrThrow<T, ResolveGetArgColumn<Arg>>;
export type GetResultOptional<T extends QueryGetSelf, Arg extends GetArg<T>> = Arg extends string ? SetQueryReturnsValueOptional<T, Arg> : SetQueryReturnsColumnOptional<T, ResolveGetArgColumn<Arg>>;
export declare const _getSelectableColumn: (q: IsQuery, arg: string) => Column.Pick.QueryColumn | undefined;
export declare function _queryGet<T extends QueryGetSelf, Arg extends GetArg<T>>(self: T, arg: Arg): GetResult<T, Arg>;
export declare function _queryGetOptional<T extends QueryGetSelf, Arg extends GetArg<T>>(self: T, arg: Arg): GetResultOptional<T, Arg>;
export {};
