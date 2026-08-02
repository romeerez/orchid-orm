import { PickQueryHasSelect, PickQueryHasSelectResult, PickQueryHasWhere, PickQueryResult, PickQueryReturnType, PickQuerySelectable, PickQueryTable, PickQueryThen, PickQueryWindows, PickQueryWithData } from '../../pick-query-types';
import { QueryThenByQuery } from '../../then/then';
export interface MergeQueryArg extends PickQueryTable, PickQuerySelectable, PickQueryResult, PickQueryReturnType, PickQueryWithData, PickQueryWindows, PickQueryThen, PickQueryHasSelect, PickQueryHasWhere {
}
export type MergeQuery<T extends MergeQueryArg, Q extends MergeQueryArg> = {
    [K in keyof T]: K extends '__hasWhere' | '__hasSelect' ? T[K] & Q[K] : K extends '__selectable' | 'windows' | 'withData' ? Q[K] & Omit<T[K], keyof Q[K]> : K extends 'result' ? MergeQueryResult<T, Q> : K extends 'returnType' ? Q['returnType'] extends undefined ? T['returnType'] : Q['returnType'] : K extends 'then' ? Q['returnType'] extends undefined ? QueryThenByQuery<T, MergeQueryResult<T, Q>> : Q['returnType'] extends 'all' | 'one' | 'oneOrThrow' | 'rows' ? QueryThenByQuery<Q, MergeQueryResult<T, Q>> : Q['__hasSelect'] extends true ? Q['then'] : T['__hasSelect'] extends true ? T['then'] : Q['then'] : T[K];
};
type MergeQueryResult<T extends PickQueryHasSelectResult, Q extends PickQueryHasSelectResult> = T['__hasSelect'] extends true ? Q['__hasSelect'] extends true ? Omit<T['result'], keyof Q['result']> & Q['result'] : T['result'] : Q['result'];
export declare class MergeQueryMethods {
    merge<T extends MergeQueryArg, Q extends MergeQueryArg>(this: T, q: Q): MergeQuery<T, Q>;
}
export {};
