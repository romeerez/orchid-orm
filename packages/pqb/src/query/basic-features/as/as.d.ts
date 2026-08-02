import { PickQuerySelectableShapeAs } from '../../pick-query-types';
import { RecordString } from '../../../utils';
import { Query } from '../../query';
import { QueryData } from '../../query-data';
interface PickQueryDataAliases {
    aliases?: RecordString;
}
export interface QueryDataAliases extends PickQueryDataAliases {
    as?: string;
    outerAliases?: RecordString;
}
export type SetQueryTableAlias<T extends PickQuerySelectableShapeAs, As extends string> = {
    [K in keyof T]: K extends '__selectable' ? Omit<T['__selectable'], `${T['__as']}.${keyof T['shape'] & string}`> & {
        [K in keyof T['shape'] & string as `${As}.${K}`]: {
            as: K;
            column: T['shape'][K];
        };
    } : K extends '__as' ? As : T[K];
};
export type AsQueryArg = PickQuerySelectableShapeAs;
/** getters **/
export declare const getQueryAs: (q: {
    table?: string;
    q: {
        as?: string;
    };
}) => string;
export declare const requireQueryAs: (q: {
    table?: string;
    q: {
        as?: string;
    };
}) => string;
export declare const _getQueryAs: (q: Query) => string | undefined;
export declare const _getQueryFreeAlias: (q: QueryDataAliases, as: string) => string;
export declare const _checkIfAliased: (q: Query, as: string, name: string) => boolean;
export declare const _getQueryAliasOrName: (q: PickQueryDataAliases, as: string) => string;
export declare const _getQueryOuterAliases: (q: QueryDataAliases) => RecordString | undefined;
/** setters **/
export declare const _setQueryAs: <T extends AsQueryArg, As extends string>(self: T, as: As) => SetQueryTableAlias<T, As>;
export declare const _setQueryAlias: (q: Query, name: string, as: string) => void;
export declare const _setSubQueryAliases: (q: Query) => void;
/**
 * Is used in `chain`: combines query and its relation aliases,
 * stores the result to the relation query data.
 */
export declare const _applyRelationAliases: (query: Query, relQueryData: QueryData) => void;
export declare const _copyQueryAliasToQuery: (fromQuery: Query, toQuery: Query, key: string) => string;
export declare abstract class QueryAsMethods {
    /**
     * Sets table alias:
     *
     * ```ts
     * db.table.as('u').select('u.name');
     *
     * // Can be used in the join:
     * db.table.join(db.profile.as('p'), 'p.userId', 'user.id');
     * ```
     *
     * @param as - alias for the table of this query
     */
    as<T extends AsQueryArg, As extends string>(this: T, as: As): SetQueryTableAlias<T, As>;
}
export {};
