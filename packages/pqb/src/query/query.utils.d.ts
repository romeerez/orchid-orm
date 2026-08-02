import { IsQuery, Query, QueryTake, QueryTakeOptional, SetQueryReturnsAll, SetQueryReturnsRows } from './query';
import { RecordUnknown } from '../utils';
import { PickQueryQ, PickQueryQAndBaseQuery, PickQueryResult, PickQueryResultReturnType } from './pick-query-types';
import { Column } from '../columns';
/**
 * Push all elements of given array into the array in the query data,
 * set given array if there is no array yet in the query data.
 * Not mutating the array.
 *
 * @param q - query
 * @param key - key to get the array
 * @param value - array with values
 */
export declare const pushQueryArrayImmutable: <T extends PickQueryQ>(q: T, key: string, value: unknown[]) => T;
/**
 * Set value into the object in query data, create the object if it doesn't yet exist.
 * Does not mutate the object.
 *
 * @param q - query
 * @param object - query data key to get the object
 * @param key - object key to set the value into
 * @param value - value to set by the key
 */
export declare const setQueryObjectValueImmutable: <T extends PickQueryQ>(q: T, object: string, key: string, value: unknown) => T;
/**
 * Throw runtime error when delete or update has no where conditions
 *
 * @param q - query
 * @param method - 'update' or 'delete'
 */
export declare const throwIfNoWhere: (q: PickQueryQ, method: string) => void;
export declare const throwIfJoinLateral: (q: PickQueryQ, method: string) => void;
export declare const throwIfReadOnly: (query: Query) => void;
export declare const throwOnReadOnlyUpdate: (query: unknown, column: Column.Pick.Data, key: string) => void;
export declare const saveAliasedShape: (q: IsQuery, as: string, key: 'joinedShapes' | 'withShapes') => string;
/**
 * Extend query prototype with new methods.
 * The query and its data are cloned (with Object.create).
 *
 * @param q - query object to extend from
 * @param methods - methods to add
 */
export declare const extendQuery: <T extends PickQueryQAndBaseQuery, Methods extends RecordUnknown>(q: T, methods: Methods) => T & Methods;
export declare const _queryAll: <T extends PickQueryResult>(q: T) => SetQueryReturnsAll<T>;
export declare const _queryTake: <T extends PickQueryResultReturnType>(query: T) => QueryTake<T>;
export declare const _queryTakeOptional: <T extends PickQueryResultReturnType>(query: T) => QueryTakeOptional<T>;
export declare const _queryExec: <T extends IsQuery>(q: T) => never;
export declare const _queryRows: <T extends PickQueryResult>(q: T) => SetQueryReturnsRows<T>;
export declare const getFullColumnTable: (q: IsQuery, column: string, index: number, as: string | undefined) => string;
